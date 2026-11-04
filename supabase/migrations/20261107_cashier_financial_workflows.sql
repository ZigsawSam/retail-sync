-- Cashiers can record operating expenses and customer/supplier settlements.
-- They can read the financial registers but cannot edit or delete existing rows.
BEGIN;

CREATE OR REPLACE FUNCTION public.staff_list_expenses()
RETURNS SETOF public.expenses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL OR public.current_staff_role() <> 'cashier' THEN
    RAISE EXCEPTION 'Only authenticated cashiers can read the expense register';
  END IF;
  v_owner := public.current_staff_owner_id();
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Cashier shop assignment not found'; END IF;
  RETURN QUERY SELECT e.* FROM public.expenses e
    WHERE e."userId" = v_owner::text
    ORDER BY e."timestamp" DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.staff_create_expense(p_expense jsonb)
RETURNS public.expenses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_login record; v_row public.expenses%ROWTYPE; v_amount numeric;
BEGIN
  IF auth.uid() IS NULL OR public.current_staff_role() <> 'cashier' THEN
    RAISE EXCEPTION 'Only authenticated cashiers can record expenses';
  END IF;
  v_owner := public.current_staff_owner_id();
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Cashier shop assignment not found'; END IF;
  SELECT id,name INTO v_login FROM public.staff_logins
   WHERE auth_user_id=auth.uid() AND user_id=v_owner AND is_active=true AND terminated_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active cashier login not found'; END IF;
  v_amount := (p_expense->>'amount')::numeric;
  IF v_amount IS NULL OR v_amount = 0 THEN RAISE EXCEPTION 'Expense amount must be non-zero'; END IF;
  IF nullif(trim(p_expense->>'category'),'') IS NULL
     OR nullif(trim(p_expense->>'description'),'') IS NULL THEN
    RAISE EXCEPTION 'Expense category and description are required';
  END IF;
  INSERT INTO public.expenses
  SELECT (jsonb_populate_record(NULL::public.expenses,
    (p_expense - 'id' - 'userId' - 'logged_by' - 'logged_by_name') || jsonb_build_object(
      'userId',v_owner::text,
      'timestamp',COALESCE(p_expense->>'timestamp',now()::text),
      'logged_by',v_login.id,
      'logged_by_name',v_login.name
    ))).* RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.staff_get_payment_context()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL OR public.current_staff_role() <> 'cashier' THEN
    RAISE EXCEPTION 'Only authenticated cashiers can read the payment register';
  END IF;
  v_owner := public.current_staff_owner_id();
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Cashier shop assignment not found'; END IF;
  RETURN jsonb_build_object(
    'customers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone)) FROM public.customers c WHERE c."userId"=v_owner::text),'[]'::jsonb),
    'suppliers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)) FROM public.suppliers s WHERE s."userId"=v_owner::text),'[]'::jsonb),
    'purchases', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'supplier_id',p.supplier_id,'supplier_name',p.supplier_name,'due_amount',p.due_amount,'timestamp',p."timestamp")) FROM public.purchases p WHERE p."userId"=v_owner::text),'[]'::jsonb),
    'sales', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'customerId',s."customerId",'customerName',s."customerName",'paidAmount',s."paidAmount",'dueAmount',s."dueAmount",'timestamp',s."timestamp",'paymentMethod',s."paymentMethod",'totalAmount',s."totalAmount")) FROM public.sales s WHERE s."userId"=v_owner::text),'[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'party_type',a.party_type,'party_id',a.party_id,'direction',a.direction,'amount',a.amount,'payment_method',a.payment_method,'notes',a.notes,'timestamp',a."timestamp") ORDER BY a."timestamp" DESC) FROM public.account_payments a WHERE a."userId"=v_owner::text),'[]'::jsonb)
  );
END; $$;

-- Existing settlement RPCs now resolve the shop owner from the cashier identity
-- and continue to allocate receipts/payments against the oldest outstanding invoices.
CREATE OR REPLACE FUNCTION public.record_supplier_payment(p_supplier_id uuid, p_amount numeric, p_method text DEFAULT 'Cash', p_notes text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_staff_owner uuid; v_remaining numeric := p_amount; v_due numeric; v_alloc numeric; v_purchase record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_staff_owner := public.current_staff_owner_id();
  IF v_staff_owner IS NOT NULL THEN
    IF public.current_staff_role() <> 'cashier' THEN RAISE EXCEPTION 'Only cashiers can record supplier payments'; END IF;
    v_owner := v_staff_owner;
  ELSE
    v_owner := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id=v_owner::text) THEN RAISE EXCEPTION 'Shop owner account not found'; END IF;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Payment must be greater than zero'; END IF;
  IF nullif(trim(COALESCE(p_method,'')),'') IS NULL THEN RAISE EXCEPTION 'Payment method is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id=p_supplier_id AND "userId"=v_owner::text) THEN RAISE EXCEPTION 'Supplier not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text || ':supplier:' || p_supplier_id::text,0));
  SELECT COALESCE(sum(due_amount),0) INTO v_due FROM public.purchases WHERE supplier_id=p_supplier_id AND "userId"=v_owner::text;
  IF p_amount > v_due THEN RAISE EXCEPTION 'Payment exceeds outstanding supplier balance'; END IF;
  FOR v_purchase IN SELECT id,due_amount FROM public.purchases WHERE supplier_id=p_supplier_id AND "userId"=v_owner::text AND due_amount>0 ORDER BY "timestamp",id FOR UPDATE LOOP
    EXIT WHEN v_remaining <= 0;
    v_alloc := least(v_remaining,v_purchase.due_amount);
    UPDATE public.purchases SET paid_amount=paid_amount+v_alloc,due_amount=due_amount-v_alloc WHERE id=v_purchase.id;
    v_remaining := v_remaining-v_alloc;
  END LOOP;
  INSERT INTO public.account_payments("userId",party_type,party_id,direction,amount,payment_method,notes)
  VALUES(v_owner::text,'supplier',p_supplier_id::text,'paid',p_amount,trim(p_method),p_notes);
  RETURN v_due-p_amount;
END; $$;

CREATE OR REPLACE FUNCTION public.record_customer_payment(p_customer_id text, p_amount numeric, p_method text DEFAULT 'Cash', p_notes text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_staff_owner uuid; v_remaining numeric := p_amount; v_due numeric; v_alloc numeric; v_sale record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_staff_owner := public.current_staff_owner_id();
  IF v_staff_owner IS NOT NULL THEN
    IF public.current_staff_role() <> 'cashier' THEN RAISE EXCEPTION 'Only cashiers can record customer collections'; END IF;
    v_owner := v_staff_owner;
  ELSE
    v_owner := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id=v_owner::text) THEN RAISE EXCEPTION 'Shop owner account not found'; END IF;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Payment must be greater than zero'; END IF;
  IF nullif(trim(COALESCE(p_method,'')),'') IS NULL THEN RAISE EXCEPTION 'Payment method is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id::text=p_customer_id AND "userId"=v_owner::text) THEN RAISE EXCEPTION 'Customer not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text || ':customer:' || p_customer_id,0));
  SELECT COALESCE(sum("dueAmount"),0) INTO v_due FROM public.sales WHERE "customerId"=p_customer_id AND "userId"=v_owner::text;
  IF p_amount > v_due THEN RAISE EXCEPTION 'Payment exceeds outstanding customer balance'; END IF;
  FOR v_sale IN SELECT id,"dueAmount" FROM public.sales WHERE "customerId"=p_customer_id AND "userId"=v_owner::text AND "dueAmount">0 ORDER BY "timestamp",id FOR UPDATE LOOP
    EXIT WHEN v_remaining <= 0;
    v_alloc := least(v_remaining,v_sale."dueAmount");
    UPDATE public.sales SET "paidAmount"="paidAmount"+v_alloc,"dueAmount"="dueAmount"-v_alloc,
      "clearanceStatus"=CASE WHEN "dueAmount"-v_alloc=0 THEN 'Cleared' ELSE 'Pending' END
    WHERE id=v_sale.id;
    v_remaining := v_remaining-v_alloc;
  END LOOP;
  INSERT INTO public.account_payments("userId",party_type,party_id,direction,amount,payment_method,notes)
  VALUES(v_owner::text,'customer',p_customer_id,'received',p_amount,trim(p_method),p_notes);
  RETURN v_due-p_amount;
END; $$;

REVOKE ALL ON FUNCTION public.staff_list_expenses() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_create_expense(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_get_payment_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_expenses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_create_expense(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_get_payment_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment(uuid,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_payment(text,numeric,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
