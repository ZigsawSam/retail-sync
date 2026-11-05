BEGIN;
CREATE OR REPLACE FUNCTION public.staff_get_transporter_payment_context()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid;
BEGIN
 IF auth.uid() IS NULL OR public.current_staff_role()<>'cashier' THEN
   RAISE EXCEPTION 'Only authenticated cashiers can read transporter balances';
 END IF;
 v_owner:=public.current_staff_owner_id();
 IF v_owner IS NULL THEN RAISE EXCEPTION 'Cashier shop assignment not found'; END IF;
 RETURN jsonb_build_object(
  'transporters',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'phone',t.phone))
    FROM public.transporters t WHERE t."userId"=v_owner::text),'[]'::jsonb),
  'purchases',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'transporter_id',p.transporter_id,'freight_due_amount',p.freight_due_amount,'freight_amount',p.freight_amount,'timestamp',p."timestamp"))
    FROM public.purchases p WHERE p."userId"=v_owner::text),'[]'::jsonb),
  'payments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',tp.id,'transporter_id',tp.transporter_id,'amount',tp.amount,'payment_method',tp.payment_method,'notes',tp.notes,'timestamp',tp."timestamp") ORDER BY tp."timestamp" DESC)
    FROM public.transporter_payments tp WHERE tp."userId"=v_owner::text),'[]'::jsonb)
 );
END; $$;

CREATE OR REPLACE FUNCTION public.staff_record_transporter_payment(
 p_transporter_id uuid,p_amount numeric,p_method text DEFAULT 'Cash',p_notes text DEFAULT NULL
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid; v_due numeric; v_remaining numeric; v_alloc numeric; v_purchase record;
BEGIN
 IF auth.uid() IS NULL OR public.current_staff_role()<>'cashier' THEN
   RAISE EXCEPTION 'Only authenticated cashiers can record transporter payments';
 END IF;
 v_owner:=public.current_staff_owner_id();
 IF v_owner IS NULL THEN RAISE EXCEPTION 'Cashier shop assignment not found'; END IF;
 IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Payment must be greater than zero'; END IF;
 IF nullif(trim(COALESCE(p_method,'')),'') IS NULL THEN RAISE EXCEPTION 'Payment method is required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.transporters WHERE id=p_transporter_id AND "userId"=v_owner::text) THEN
   RAISE EXCEPTION 'Transporter not found';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text||':transporter:'||p_transporter_id::text,0));
 SELECT COALESCE(sum(freight_due_amount),0) INTO v_due FROM public.purchases
  WHERE transporter_id=p_transporter_id AND "userId"=v_owner::text;
 IF p_amount>v_due THEN RAISE EXCEPTION 'Payment exceeds transporter outstanding balance'; END IF;
 v_remaining:=p_amount;
 FOR v_purchase IN SELECT id,freight_due_amount FROM public.purchases
  WHERE transporter_id=p_transporter_id AND "userId"=v_owner::text AND freight_due_amount>0
  ORDER BY "timestamp",id FOR UPDATE LOOP
   EXIT WHEN v_remaining<=0;
   v_alloc:=least(v_remaining,v_purchase.freight_due_amount);
   UPDATE public.purchases SET freight_paid_amount=freight_paid_amount+v_alloc,
    freight_due_amount=freight_due_amount-v_alloc WHERE id=v_purchase.id;
   v_remaining:=v_remaining-v_alloc;
 END LOOP;
 INSERT INTO public.transporter_payments("userId",transporter_id,amount,payment_method,notes)
 VALUES(v_owner::text,p_transporter_id,p_amount,trim(p_method),p_notes);
 RETURN v_due-p_amount;
END; $$;
REVOKE ALL ON FUNCTION public.staff_get_transporter_payment_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_record_transporter_payment(uuid,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_get_transporter_payment_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_record_transporter_payment(uuid,numeric,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;