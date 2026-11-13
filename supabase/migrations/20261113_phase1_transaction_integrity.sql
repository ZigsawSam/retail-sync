-- Phase 1: transaction idempotency and atomic financial posting.
-- Existing rows are preserved. New request keys are optional for backwards compatibility,
-- while the updated application always supplies one for user-initiated transactions.
BEGIN;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS request_key text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS request_key text;
ALTER TABLE public.account_payments ADD COLUMN IF NOT EXISTS request_key text;

CREATE UNIQUE INDEX IF NOT EXISTS sales_owner_request_key_uidx
  ON public.sales ("userId", request_key) WHERE request_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS purchases_owner_request_key_uidx
  ON public.purchases ("userId", request_key) WHERE request_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS account_payments_owner_request_key_uidx
  ON public.account_payments ("userId", request_key) WHERE request_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_sale_and_deduct_stock(p_sale jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_id uuid;
  v_staff_owner_id uuid;
  v_staff_role text;
  v_request_key text;
  v_item record;
  v_sale public.sales%ROWTYPE;
  v_rows integer;
  v_total numeric;
  v_paid numeric;
  v_due numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_staff_owner_id := public.current_staff_owner_id();
  v_staff_role := public.current_staff_role();
  IF v_staff_owner_id IS NOT NULL THEN
    IF v_staff_role <> 'cashier' THEN RAISE EXCEPTION 'Only cashiers can create sales'; END IF;
    v_owner_id := v_staff_owner_id;
  ELSE
    v_owner_id := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id = v_owner_id::text) THEN
      RAISE EXCEPTION 'Shop owner account not found';
    END IF;
  END IF;

  v_request_key := NULLIF(trim(p_sale->>'request_key'), '');
  IF v_request_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_owner_id::text || ':sale:' || v_request_key, 0));
    SELECT * INTO v_sale FROM public.sales
      WHERE "userId" = v_owner_id::text AND request_key = v_request_key;
    IF FOUND THEN RETURN to_jsonb(v_sale); END IF;
  END IF;

  IF jsonb_typeof(p_sale->'items') <> 'array'
     OR jsonb_array_length(p_sale->'items') = 0 THEN
    RAISE EXCEPTION 'A sale must contain at least one item';
  END IF;

  v_total := COALESCE((p_sale->>'totalAmount')::numeric, 0);
  v_paid := COALESCE((p_sale->>'paidAmount')::numeric,
    CASE WHEN p_sale->>'paymentMethod' = 'Cash' THEN v_total ELSE 0 END);
  v_due := COALESCE((p_sale->>'dueAmount')::numeric, v_total - v_paid);
  IF v_total < 0 OR v_paid < 0 OR v_due < 0 OR abs((v_paid + v_due) - v_total) > 0.01 THEN
    RAISE EXCEPTION 'Sale total, paid amount and due amount do not reconcile';
  END IF;

  FOR v_item IN
    SELECT item->>'productId' AS product_id,
           SUM((item->>'quantity')::integer)::integer AS quantity
    FROM jsonb_array_elements(p_sale->'items') AS item
    GROUP BY item->>'productId'
    ORDER BY item->>'productId'
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid product or sale quantity';
    END IF;
    UPDATE public.products
       SET quantity = quantity - v_item.quantity
     WHERE id::text = v_item.product_id
       AND "userId" = v_owner_id::text
       AND quantity >= v_item.quantity;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'Insufficient stock or product unavailable (product ID: %)', v_item.product_id;
    END IF;
  END LOOP;

  INSERT INTO public.sales
  SELECT (jsonb_populate_record(
    NULL::public.sales,
    p_sale || jsonb_build_object(
      'userId', v_owner_id::text,
      'request_key', v_request_key,
      'paidAmount', v_paid,
      'dueAmount', v_due,
      'clearanceStatus', CASE WHEN v_due = 0 THEN 'Cleared' ELSE 'Pending' END,
      'timestamp', COALESCE(p_sale->>'timestamp', now()::text)
    )
  )).*
  RETURNING * INTO v_sale;

  RETURN to_jsonb(v_sale);
END;
$$;

DROP FUNCTION IF EXISTS public.create_purchase(jsonb);
CREATE FUNCTION public.create_purchase(p_purchase jsonb)
RETURNS public.purchases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_supplier uuid;
  v_item jsonb;
  v_product_id text;
  v_qty integer;
  v_price numeric;
  v_total numeric := 0;
  v_paid numeric;
  v_request_key text;
  v_row public.purchases%ROWTYPE;
  v_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_owner := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id = v_owner::text) THEN
    RAISE EXCEPTION 'Only the shop owner can record purchases';
  END IF;

  v_request_key := NULLIF(trim(p_purchase->>'request_key'), '');
  IF v_request_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text || ':purchase:' || v_request_key, 0));
    SELECT * INTO v_row FROM public.purchases
      WHERE "userId" = v_owner::text AND request_key = v_request_key;
    IF FOUND THEN RETURN v_row; END IF;
  END IF;

  IF jsonb_typeof(p_purchase->'items') <> 'array'
     OR jsonb_array_length(p_purchase->'items') = 0 THEN
    RAISE EXCEPTION 'Add at least one purchase item';
  END IF;
  v_supplier := NULLIF(p_purchase->>'supplier_id','')::uuid;
  IF v_supplier IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = v_supplier AND "userId" = v_owner::text
  ) THEN RAISE EXCEPTION 'Supplier not found'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_purchase->'items') LOOP
    v_product_id := v_item->>'productId';
    v_qty := (v_item->>'quantity')::integer;
    v_price := (v_item->>'purchasePrice')::numeric;
    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 OR v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'Invalid purchase item';
    END IF;
    v_total := v_total + (v_qty * v_price);
  END LOOP;

  v_paid := COALESCE((p_purchase->>'paid_amount')::numeric, 0);
  IF v_paid < 0 OR v_paid > v_total THEN
    RAISE EXCEPTION 'Paid amount must be between zero and purchase total';
  END IF;
  IF v_paid < v_total AND v_supplier IS NULL THEN
    RAISE EXCEPTION 'A supplier is required when a purchase has an outstanding balance';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_purchase->'items') LOOP
    v_product_id := v_item->>'productId';
    v_qty := (v_item->>'quantity')::integer;
    v_price := (v_item->>'purchasePrice')::numeric;
    UPDATE public.products SET quantity = quantity + v_qty, "purchasePrice" = v_price
      WHERE id::text = v_product_id AND "userId" = v_owner::text;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'Product not found: %', v_product_id; END IF;
  END LOOP;

  INSERT INTO public.purchases(
    "userId", supplier_id, supplier_name, invoice_number, items,
    total_amount, paid_amount, due_amount, payment_method, notes, request_key
  )
  VALUES(
    v_owner::text, v_supplier,
    COALESCE(NULLIF(trim(p_purchase->>'supplier_name'),''), 'Unspecified supplier'),
    NULLIF(trim(p_purchase->>'invoice_number'),''), p_purchase->'items',
    v_total, v_paid, v_total-v_paid,
    COALESCE(NULLIF(p_purchase->>'payment_method',''), 'Cash'),
    NULLIF(trim(p_purchase->>'notes'),''), v_request_key
  ) RETURNING * INTO v_row;

  IF v_paid > 0 THEN
    INSERT INTO public.account_payments(
      "userId", party_type, party_id, direction, amount, payment_method, notes, request_key
    )
    VALUES(
      v_owner::text, 'supplier', COALESCE(v_supplier::text, v_row.id), 'paid',
      v_paid, v_row.payment_method, 'Initial payment for purchase ' || v_row.id,
      CASE WHEN v_request_key IS NULL THEN NULL ELSE 'purchase-initial:' || v_request_key END
    );
  END IF;
  RETURN v_row;
END;
$$;

DROP FUNCTION IF EXISTS public.record_supplier_payment(uuid,numeric,text,text);
DROP FUNCTION IF EXISTS public.record_supplier_payment(uuid,numeric,text,text,text);
CREATE FUNCTION public.record_supplier_payment(
  p_supplier_id uuid, p_amount numeric, p_method text DEFAULT 'Cash',
  p_notes text DEFAULT NULL, p_request_key text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_staff_owner uuid;
  v_remaining numeric := p_amount;
  v_due numeric;
  v_alloc numeric;
  v_purchase record;
  v_existing public.account_payments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_staff_owner := public.current_staff_owner_id();
  IF v_staff_owner IS NOT NULL THEN
    IF public.current_staff_role() <> 'cashier' THEN RAISE EXCEPTION 'Only cashiers can record supplier payments'; END IF;
    v_owner := v_staff_owner;
  ELSE
    v_owner := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id = v_owner::text) THEN
      RAISE EXCEPTION 'Shop owner account not found';
    END IF;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Payment must be greater than zero'; END IF;
  IF NULLIF(trim(COALESCE(p_method,'')), '') IS NULL THEN RAISE EXCEPTION 'Payment method is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND "userId" = v_owner::text) THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;
  IF p_request_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text || ':payment:' || p_request_key, 0));
    SELECT * INTO v_existing FROM public.account_payments
      WHERE "userId" = v_owner::text AND request_key = p_request_key;
    IF FOUND THEN
      IF v_existing.party_type <> 'supplier' OR v_existing.party_id <> p_supplier_id::text
         OR v_existing.direction <> 'paid' OR v_existing.amount <> p_amount
         OR v_existing.payment_method <> trim(p_method) THEN
        RAISE EXCEPTION 'This payment request key was already used for a different payment';
      END IF;
      SELECT COALESCE(sum(due_amount),0) INTO v_due FROM public.purchases
        WHERE supplier_id = p_supplier_id AND "userId" = v_owner::text;
      RETURN v_due;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text || ':supplier:' || p_supplier_id::text, 0));
  SELECT COALESCE(sum(due_amount),0) INTO v_due FROM public.purchases
    WHERE supplier_id = p_supplier_id AND "userId" = v_owner::text;
  IF p_amount > v_due THEN RAISE EXCEPTION 'Payment exceeds outstanding supplier balance'; END IF;
  FOR v_purchase IN
    SELECT id, due_amount FROM public.purchases
    WHERE supplier_id = p_supplier_id AND "userId" = v_owner::text AND due_amount > 0
    ORDER BY "timestamp", id FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_alloc := least(v_remaining, v_purchase.due_amount);
    UPDATE public.purchases SET paid_amount = paid_amount + v_alloc, due_amount = due_amount - v_alloc
      WHERE id = v_purchase.id;
    v_remaining := v_remaining - v_alloc;
  END LOOP;
  INSERT INTO public.account_payments(
    "userId", party_type, party_id, direction, amount, payment_method, notes, request_key
  ) VALUES (
    v_owner::text, 'supplier', p_supplier_id::text, 'paid', p_amount, trim(p_method), p_notes, p_request_key
  );
  SELECT COALESCE(sum(due_amount),0) INTO v_due FROM public.purchases
    WHERE supplier_id = p_supplier_id AND "userId" = v_owner::text;
  RETURN v_due;
END;
$$;

DROP FUNCTION IF EXISTS public.record_customer_payment(text,numeric,text,text);
DROP FUNCTION IF EXISTS public.record_customer_payment(text,numeric,text,text,text);
CREATE FUNCTION public.record_customer_payment(
  p_customer_id text, p_amount numeric, p_method text DEFAULT 'Cash',
  p_notes text DEFAULT NULL, p_request_key text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_staff_owner uuid;
  v_remaining numeric := p_amount;
  v_due numeric;
  v_alloc numeric;
  v_sale record;
  v_existing public.account_payments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_staff_owner := public.current_staff_owner_id();
  IF v_staff_owner IS NOT NULL THEN
    IF public.current_staff_role() <> 'cashier' THEN RAISE EXCEPTION 'Only cashiers can record customer collections'; END IF;
    v_owner := v_staff_owner;
  ELSE
    v_owner := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id = v_owner::text) THEN
      RAISE EXCEPTION 'Shop owner account not found';
    END IF;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Payment must be greater than zero'; END IF;
  IF NULLIF(trim(COALESCE(p_method,'')), '') IS NULL THEN RAISE EXCEPTION 'Payment method is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id::text = p_customer_id AND "userId" = v_owner::text) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
  IF p_request_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text || ':payment:' || p_request_key, 0));
    SELECT * INTO v_existing FROM public.account_payments
      WHERE "userId" = v_owner::text AND request_key = p_request_key;
    IF FOUND THEN
      IF v_existing.party_type <> 'customer' OR v_existing.party_id <> p_customer_id
         OR v_existing.direction <> 'received' OR v_existing.amount <> p_amount
         OR v_existing.payment_method <> trim(p_method) THEN
        RAISE EXCEPTION 'This payment request key was already used for a different payment';
      END IF;
      SELECT COALESCE(sum("dueAmount"),0) INTO v_due FROM public.sales
        WHERE "customerId" = p_customer_id AND "userId" = v_owner::text;
      RETURN v_due;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text || ':customer:' || p_customer_id, 0));
  SELECT COALESCE(sum("dueAmount"),0) INTO v_due FROM public.sales
    WHERE "customerId" = p_customer_id AND "userId" = v_owner::text;
  IF p_amount > v_due THEN RAISE EXCEPTION 'Payment exceeds outstanding customer balance'; END IF;
  FOR v_sale IN
    SELECT id, "dueAmount" FROM public.sales
    WHERE "customerId" = p_customer_id AND "userId" = v_owner::text AND "dueAmount" > 0
    ORDER BY "timestamp", id FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_alloc := least(v_remaining, v_sale."dueAmount");
    UPDATE public.sales
      SET "paidAmount" = "paidAmount" + v_alloc,
          "dueAmount" = "dueAmount" - v_alloc,
          "clearanceStatus" = CASE WHEN "dueAmount" - v_alloc = 0 THEN 'Cleared' ELSE 'Pending' END
      WHERE id = v_sale.id;
    v_remaining := v_remaining - v_alloc;
  END LOOP;
  INSERT INTO public.account_payments(
    "userId", party_type, party_id, direction, amount, payment_method, notes, request_key
  ) VALUES (
    v_owner::text, 'customer', p_customer_id, 'received', p_amount, trim(p_method), p_notes, p_request_key
  );
  SELECT COALESCE(sum("dueAmount"),0) INTO v_due FROM public.sales
    WHERE "customerId" = p_customer_id AND "userId" = v_owner::text;
  RETURN v_due;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale_and_deduct_stock(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_purchase(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_supplier_payment(uuid,numeric,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_customer_payment(text,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale_and_deduct_stock(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment(uuid,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_payment(text,numeric,text,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
