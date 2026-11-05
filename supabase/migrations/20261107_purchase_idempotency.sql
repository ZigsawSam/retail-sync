BEGIN;
CREATE TABLE IF NOT EXISTS public.purchase_request_keys (
  "userId" text NOT NULL,
  request_id uuid NOT NULL,
  purchase_id text NOT NULL REFERENCES public.purchases(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", request_id),
  UNIQUE (purchase_id)
);
ALTER TABLE public.purchase_request_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchase_request_keys_owner_select ON public.purchase_request_keys;
CREATE POLICY purchase_request_keys_owner_select ON public.purchase_request_keys
  FOR SELECT TO authenticated USING ("userId" = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.create_purchase_with_logistics(p_purchase jsonb)
RETURNS public.purchases
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_owner uuid; v_row public.purchases%ROWTYPE; v_transporter uuid;
  v_freight numeric; v_freight_paid numeric; v_name text; v_source text; v_mode text;
  v_request_id uuid; v_existing_purchase_id text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_owner:=auth.uid();
  IF NOT EXISTS(SELECT 1 FROM public.settings WHERE id=v_owner::text) THEN
    RAISE EXCEPTION 'Only the shop owner can record purchases';
  END IF;
  v_request_id:=nullif(p_purchase->>'request_id','')::uuid;
  IF v_request_id IS NULL THEN RAISE EXCEPTION 'Purchase request ID is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text||':purchase:'||v_request_id::text,0));
  SELECT purchase_id INTO v_existing_purchase_id FROM public.purchase_request_keys
    WHERE "userId"=v_owner::text AND request_id=v_request_id;
  IF v_existing_purchase_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.purchases WHERE id=v_existing_purchase_id AND "userId"=v_owner::text;
    IF NOT FOUND THEN RAISE EXCEPTION 'Previously submitted purchase record is unavailable'; END IF;
    RETURN v_row;
  END IF;

  v_transporter:=nullif(p_purchase->>'transporter_id','')::uuid;
  v_freight:=COALESCE((p_purchase->>'freight_amount')::numeric,0);
  v_freight_paid:=COALESCE((p_purchase->>'freight_paid_amount')::numeric,0);
  IF v_freight<0 OR v_freight_paid<0 OR v_freight_paid>v_freight THEN
    RAISE EXCEPTION 'Check freight and freight paid amounts';
  END IF;
  IF v_freight>0 AND v_transporter IS NULL THEN
    RAISE EXCEPTION 'Select a transporter for separate delivery charges';
  END IF;
  IF v_transporter IS NOT NULL THEN
    SELECT name INTO v_name FROM public.transporters
      WHERE id=v_transporter AND "userId"=v_owner::text;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transporter not found'; END IF;
  END IF;
  v_source:=COALESCE(NULLIF(p_purchase->>'purchase_source',''),'Direct');
  IF v_source NOT IN ('Direct','Agent-assisted') THEN RAISE EXCEPTION 'Invalid purchase source'; END IF;
  v_mode:=nullif(trim(p_purchase->>'delivery_mode'),'');
  -- Existing create_purchase validates products, calculates merchandise totals,
  -- increments stock, writes the purchase invoice and records initial supplier payment.
  -- Nested calls share this transaction; any later failure rolls all of it back.
  v_row:=public.create_purchase(p_purchase);
  UPDATE public.purchases SET purchase_source=v_source,delivery_mode=v_mode,
    transporter_id=v_transporter,transporter_name=v_name,freight_amount=v_freight,
    freight_paid_amount=v_freight_paid,freight_due_amount=v_freight-v_freight_paid
    WHERE id=v_row.id AND "userId"=v_owner::text RETURNING * INTO v_row;
  IF v_freight_paid>0 THEN
    INSERT INTO public.transporter_payments("userId",transporter_id,amount,payment_method,notes)
    VALUES(v_owner::text,v_transporter,v_freight_paid,
      COALESCE(NULLIF(p_purchase->>'freight_payment_method',''),'Cash'),
      'Initial freight payment for purchase '||v_row.id);
  END IF;
  INSERT INTO public.purchase_request_keys("userId",request_id,purchase_id)
    VALUES(v_owner::text,v_request_id,v_row.id);
  RETURN v_row;
END; $$;
REVOKE ALL ON FUNCTION public.create_purchase_with_logistics(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_purchase_with_logistics(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;