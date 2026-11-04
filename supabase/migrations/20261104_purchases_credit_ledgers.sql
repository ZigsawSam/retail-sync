-- Purchases, supplier balances, and customer receivables.
-- All money movements are recorded separately from inventory/expense records.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS "customerId" text,
  ADD COLUMN IF NOT EXISTS "paidAmount" numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dueAmount" numeric(14,2) NOT NULL DEFAULT 0;

UPDATE public.sales
SET "paidAmount" = CASE
      WHEN "paymentMethod" = 'Store Credit' AND COALESCE("clearanceStatus",'Pending') <> 'Cleared' THEN 0
      ELSE COALESCE("totalAmount",0)
    END,
    "dueAmount" = CASE
      WHEN "paymentMethod" = 'Store Credit' AND COALESCE("clearanceStatus",'Pending') <> 'Cleared' THEN COALESCE("totalAmount",0)
      ELSE 0
    END
WHERE COALESCE("paidAmount",0) = 0 AND COALESCE("dueAmount",0) = 0;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  gst_number text,
  owner_name text,
  email text,
  alternate_phone text,
  city text,
  state text,
  postal_code text,
  country text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS gst_number text,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS alternate_phone text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text;

CREATE INDEX IF NOT EXISTS suppliers_user_idx ON public.suppliers ("userId");

CREATE TABLE IF NOT EXISTS public.purchases (
  id text PRIMARY KEY DEFAULT ('PUR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  "userId" text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  supplier_name text NOT NULL,
  invoice_number text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric(14,2) NOT NULL CHECK (total_amount >= 0),
  paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (due_amount >= 0),
  payment_method text NOT NULL DEFAULT 'Cash',
  notes text,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  CHECK (paid_amount + due_amount = total_amount)
);
CREATE INDEX IF NOT EXISTS purchases_user_timestamp_idx ON public.purchases ("userId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS purchases_supplier_idx ON public.purchases (supplier_id);

CREATE TABLE IF NOT EXISTS public.account_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL,
  party_type text NOT NULL CHECK (party_type IN ('customer','supplier')),
  party_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('received','paid')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL,
  notes text,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_payments_user_timestamp_idx ON public.account_payments ("userId", "timestamp" DESC);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read suppliers" ON public.suppliers;
CREATE POLICY "owners read suppliers" ON public.suppliers FOR SELECT TO authenticated USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "owners read purchases" ON public.purchases;
CREATE POLICY "owners read purchases" ON public.purchases FOR SELECT TO authenticated USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "owners read account payments" ON public.account_payments;
CREATE POLICY "owners read account payments" ON public.account_payments FOR SELECT TO authenticated USING ("userId" = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.create_supplier(
  p_name text, p_phone text DEFAULT NULL, p_address text DEFAULT NULL, p_notes text DEFAULT NULL,
  p_gst_number text DEFAULT NULL, p_owner_name text DEFAULT NULL, p_email text DEFAULT NULL,
  p_alternate_phone text DEFAULT NULL, p_city text DEFAULT NULL, p_state text DEFAULT NULL,
  p_postal_code text DEFAULT NULL, p_country text DEFAULT NULL
)
RETURNS public.suppliers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_row public.suppliers%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_owner := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id = v_owner::text) THEN RAISE EXCEPTION 'Shop owner account not found'; END IF;
  IF nullif(trim(p_name),'') IS NULL THEN RAISE EXCEPTION 'Supplier name is required'; END IF;
  INSERT INTO public.suppliers("userId",name,phone,address,notes,gst_number,owner_name,email,alternate_phone,city,state,postal_code,country)
  VALUES(v_owner::text,trim(p_name),nullif(trim(p_phone),''),nullif(trim(p_address),''),nullif(trim(p_notes),''),
    nullif(trim(p_gst_number),''),nullif(trim(p_owner_name),''),nullif(trim(p_email),''),
    nullif(trim(p_alternate_phone),''),nullif(trim(p_city),''),nullif(trim(p_state),''),
    nullif(trim(p_postal_code),''),nullif(trim(p_country),'')) RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.update_supplier(
  p_supplier_id uuid, p_name text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL, p_gst_number text DEFAULT NULL, p_owner_name text DEFAULT NULL,
  p_email text DEFAULT NULL, p_alternate_phone text DEFAULT NULL, p_city text DEFAULT NULL,
  p_state text DEFAULT NULL, p_postal_code text DEFAULT NULL, p_country text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.suppliers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_row public.suppliers%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_owner := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id = v_owner::text) THEN RAISE EXCEPTION 'Shop owner account not found'; END IF;
  IF nullif(trim(COALESCE(p_name,'')),'') IS NULL THEN RAISE EXCEPTION 'Supplier name is required'; END IF;
  UPDATE public.suppliers SET name=trim(p_name), phone=nullif(trim(p_phone),''), address=nullif(trim(p_address),''),
    gst_number=nullif(trim(p_gst_number),''), owner_name=nullif(trim(p_owner_name),''),
    email=nullif(trim(p_email),''), alternate_phone=nullif(trim(p_alternate_phone),''),
    city=nullif(trim(p_city),''), state=nullif(trim(p_state),''),
    postal_code=nullif(trim(p_postal_code),''), country=nullif(trim(p_country),''),
    notes=nullif(trim(p_notes),'')
  WHERE id=p_supplier_id AND "userId"=v_owner::text RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier not found'; END IF;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.create_purchase(p_purchase jsonb)
RETURNS public.purchases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid; v_supplier uuid; v_item jsonb; v_product_id text;
  v_qty integer; v_price numeric; v_total numeric := 0;
  v_paid numeric; v_row public.purchases%ROWTYPE; v_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_owner := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id = v_owner::text) THEN RAISE EXCEPTION 'Only the shop owner can record purchases'; END IF;
  IF jsonb_typeof(p_purchase->'items') <> 'array' OR jsonb_array_length(p_purchase->'items') = 0 THEN RAISE EXCEPTION 'Add at least one purchase item'; END IF;
  v_supplier := nullif(p_purchase->>'supplier_id','')::uuid;
  IF v_supplier IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id=v_supplier AND "userId"=v_owner::text) THEN RAISE EXCEPTION 'Supplier not found'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_purchase->'items') LOOP
    v_product_id := v_item->>'productId';
    v_qty := (v_item->>'quantity')::integer;
    v_price := (v_item->>'purchasePrice')::numeric;
    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 OR v_price IS NULL OR v_price < 0 THEN RAISE EXCEPTION 'Invalid purchase item'; END IF;
    UPDATE public.products SET quantity = quantity + v_qty, "purchasePrice" = v_price
    WHERE id::text=v_product_id AND "userId"=v_owner::text;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'Product not found: %',v_product_id; END IF;
    v_total := v_total + (v_qty * v_price);
  END LOOP;
  v_paid := COALESCE((p_purchase->>'paid_amount')::numeric,0);
  IF v_paid < 0 OR v_paid > v_total THEN RAISE EXCEPTION 'Paid amount must be between zero and purchase total'; END IF;
  INSERT INTO public.purchases("userId",supplier_id,supplier_name,invoice_number,items,total_amount,paid_amount,due_amount,payment_method,notes)
  VALUES(v_owner::text,v_supplier,COALESCE(NULLIF(trim(p_purchase->>'supplier_name'),''),'Unspecified supplier'),
    nullif(trim(p_purchase->>'invoice_number'),''),p_purchase->'items',v_total,v_paid,v_total-v_paid,
    COALESCE(NULLIF(p_purchase->>'payment_method',''),'Cash'),nullif(trim(p_purchase->>'notes'),'')) RETURNING * INTO v_row;
  IF v_paid > 0 THEN
    INSERT INTO public.account_payments("userId",party_type,party_id,direction,amount,payment_method,notes)
    VALUES(v_owner::text,'supplier',COALESCE(v_supplier::text,v_row.id),'paid',v_paid,v_row.payment_method,'Initial payment for purchase '||v_row.id);
  END IF;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.record_supplier_payment(p_supplier_id uuid, p_amount numeric, p_method text DEFAULT 'Cash', p_notes text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_remaining numeric := p_amount; v_due numeric; v_alloc numeric; v_purchase record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_owner := auth.uid();
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Payment must be greater than zero'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id=p_supplier_id AND "userId"=v_owner::text) THEN RAISE EXCEPTION 'Supplier not found'; END IF;
  SELECT COALESCE(sum(due_amount),0) INTO v_due FROM public.purchases WHERE supplier_id=p_supplier_id AND "userId"=v_owner::text;
  IF p_amount > v_due THEN RAISE EXCEPTION 'Payment exceeds outstanding supplier balance'; END IF;
  FOR v_purchase IN SELECT id,due_amount FROM public.purchases WHERE supplier_id=p_supplier_id AND "userId"=v_owner::text AND due_amount>0 ORDER BY "timestamp",id FOR UPDATE LOOP
    EXIT WHEN v_remaining <= 0;
    v_alloc := least(v_remaining,v_purchase.due_amount);
    UPDATE public.purchases SET paid_amount=paid_amount+v_alloc,due_amount=due_amount-v_alloc WHERE id=v_purchase.id;
    v_remaining := v_remaining-v_alloc;
  END LOOP;
  INSERT INTO public.account_payments("userId",party_type,party_id,direction,amount,payment_method,notes)
  VALUES(v_owner::text,'supplier',p_supplier_id::text,'paid',p_amount,COALESCE(p_method,'Cash'),p_notes);
  RETURN v_due-p_amount;
END; $$;

CREATE OR REPLACE FUNCTION public.record_customer_payment(p_customer_id text, p_amount numeric, p_method text DEFAULT 'Cash', p_notes text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_remaining numeric := p_amount; v_due numeric; v_alloc numeric; v_sale record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_owner := auth.uid();
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Payment must be greater than zero'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id::text=p_customer_id AND "userId"=v_owner::text) THEN RAISE EXCEPTION 'Customer not found'; END IF;
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
  VALUES(v_owner::text,'customer',p_customer_id,'received',p_amount,COALESCE(p_method,'Cash'),p_notes);
  RETURN v_due-p_amount;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_supplier(text,text,text,text,text,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_supplier(uuid,text,text,text,text,text,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment(uuid,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_payment(text,numeric,text,text) TO authenticated;
