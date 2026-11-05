BEGIN;
CREATE OR REPLACE FUNCTION public.create_transporter(p_name text,p_phone text DEFAULT NULL,p_notes text DEFAULT NULL)
RETURNS public.transporters LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid; v_row public.transporters%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 v_owner:=auth.uid();
 IF NOT EXISTS(SELECT 1 FROM public.settings WHERE id=v_owner::text) THEN RAISE EXCEPTION 'Only the shop owner can add transporters'; END IF;
 IF nullif(trim(p_name),'') IS NULL THEN RAISE EXCEPTION 'Transporter name is required'; END IF;
 INSERT INTO public.transporters("userId",name,phone,notes)
 VALUES(v_owner::text,trim(p_name),nullif(trim(p_phone),''),nullif(trim(p_notes),'')) RETURNING * INTO v_row;
 RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.create_purchase_with_logistics(p_purchase jsonb)
RETURNS public.purchases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid; v_row public.purchases%ROWTYPE; v_transporter uuid;
 v_freight numeric; v_freight_paid numeric; v_name text; v_source text; v_mode text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 v_owner:=auth.uid();
 IF NOT EXISTS(SELECT 1 FROM public.settings WHERE id=v_owner::text) THEN RAISE EXCEPTION 'Only the shop owner can record purchases'; END IF;
 v_transporter:=nullif(p_purchase->>'transporter_id','')::uuid;
 v_freight:=COALESCE((p_purchase->>'freight_amount')::numeric,0);
 v_freight_paid:=COALESCE((p_purchase->>'freight_paid_amount')::numeric,0);
 IF v_freight<0 OR v_freight_paid<0 OR v_freight_paid>v_freight THEN RAISE EXCEPTION 'Check freight and freight paid amounts'; END IF;
 IF v_freight>0 AND v_transporter IS NULL THEN RAISE EXCEPTION 'Select a transporter for separate delivery charges'; END IF;
 IF v_transporter IS NOT NULL THEN
  SELECT name INTO v_name FROM public.transporters WHERE id=v_transporter AND "userId"=v_owner::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transporter not found'; END IF;
 END IF;
 v_source:=COALESCE(NULLIF(p_purchase->>'purchase_source',''),'Direct');
 IF v_source NOT IN ('Direct','Agent-assisted') THEN RAISE EXCEPTION 'Invalid purchase source'; END IF;
 v_mode:=nullif(trim(p_purchase->>'delivery_mode'),'');
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
 RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.record_transporter_payment(
 p_transporter_id uuid,p_amount numeric,p_method text DEFAULT 'Cash',p_notes text DEFAULT NULL
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid; v_due numeric; v_remaining numeric; v_alloc numeric; v_purchase record;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 v_owner:=auth.uid();
 IF NOT EXISTS(SELECT 1 FROM public.settings WHERE id=v_owner::text) THEN RAISE EXCEPTION 'Only the shop owner can record transporter payments'; END IF;
 IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Payment must be greater than zero'; END IF;
 IF nullif(trim(COALESCE(p_method,'')),'') IS NULL THEN RAISE EXCEPTION 'Payment method is required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.transporters WHERE id=p_transporter_id AND "userId"=v_owner::text) THEN RAISE EXCEPTION 'Transporter not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text||':transporter:'||p_transporter_id::text,0));
 SELECT COALESCE(sum(freight_due_amount),0) INTO v_due FROM public.purchases WHERE transporter_id=p_transporter_id AND "userId"=v_owner::text;
 IF p_amount>v_due THEN RAISE EXCEPTION 'Payment exceeds transporter outstanding balance'; END IF;
 v_remaining:=p_amount;
 FOR v_purchase IN SELECT id,freight_due_amount FROM public.purchases WHERE transporter_id=p_transporter_id AND "userId"=v_owner::text AND freight_due_amount>0 ORDER BY "timestamp",id FOR UPDATE LOOP
  EXIT WHEN v_remaining<=0;
  v_alloc:=least(v_remaining,v_purchase.freight_due_amount);
  UPDATE public.purchases SET freight_paid_amount=freight_paid_amount+v_alloc,freight_due_amount=freight_due_amount-v_alloc WHERE id=v_purchase.id;
  v_remaining:=v_remaining-v_alloc;
 END LOOP;
 INSERT INTO public.transporter_payments("userId",transporter_id,amount,payment_method,notes)
 VALUES(v_owner::text,p_transporter_id,p_amount,trim(p_method),p_notes);
 RETURN v_due-p_amount;
END; $$;
REVOKE ALL ON FUNCTION public.create_transporter(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_purchase_with_logistics(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_transporter_payment(uuid,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_transporter(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_with_logistics(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_transporter_payment(uuid,numeric,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;