-- Phase 2B: owner-scoped opening-balance staging and one-time posting.
-- Books start date is fixed to the owner's approved 2026-09-01 cutover.
-- Additive only; this does not import or modify operational history.
BEGIN;

CREATE TABLE IF NOT EXISTS public.accounting_opening_balance_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  as_of_date date NOT NULL DEFAULT DATE '2026-08-31' CHECK (as_of_date = DATE '2026-08-31'),
  books_start_date date NOT NULL DEFAULT DATE '2026-09-01' CHECK (books_start_date = DATE '2026-09-01'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','posted')),
  notes text,
  journal_entry_id uuid,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  posted_at timestamptz,
  UNIQUE (owner_id, id),
  FOREIGN KEY (owner_id, journal_entry_id)
    REFERENCES public.journal_entries(owner_id, id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_opening_balance_one_batch_per_owner_uidx
  ON public.accounting_opening_balance_batches(owner_id);

CREATE TABLE IF NOT EXISTS public.accounting_opening_balance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('account','inventory','customer_receivable','supplier_payable')),
  account_id uuid NOT NULL,
  reference_id text,
  debit numeric(20,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(20,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  quantity numeric(20,4),
  unit_cost numeric(20,4),
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
  CHECK (
    (item_type = 'account' AND reference_id IS NULL AND quantity IS NULL AND unit_cost IS NULL)
    OR
    (item_type = 'inventory' AND reference_id IS NOT NULL AND quantity > 0 AND unit_cost > 0 AND debit > 0 AND credit = 0)
    OR
    (item_type = 'customer_receivable' AND reference_id IS NOT NULL AND debit > 0 AND credit = 0 AND quantity IS NULL AND unit_cost IS NULL)
    OR
    (item_type = 'supplier_payable' AND reference_id IS NOT NULL AND credit > 0 AND debit = 0 AND quantity IS NULL AND unit_cost IS NULL)
  ),
  FOREIGN KEY (owner_id, batch_id)
    REFERENCES public.accounting_opening_balance_batches(owner_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id, account_id)
    REFERENCES public.accounts(owner_id, id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_opening_items_reference_uidx
  ON public.accounting_opening_balance_items(batch_id, item_type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS accounting_opening_items_batch_idx
  ON public.accounting_opening_balance_items(owner_id, batch_id);

ALTER TABLE public.accounting_opening_balance_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_opening_balance_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.accounting_opening_balance_batches,
  public.accounting_opening_balance_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.accounting_opening_balance_batches,
  public.accounting_opening_balance_items TO authenticated;

DROP POLICY IF EXISTS accounting_opening_batches_owner_read
  ON public.accounting_opening_balance_batches;
CREATE POLICY accounting_opening_batches_owner_read
  ON public.accounting_opening_balance_batches
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS accounting_opening_items_owner_read
  ON public.accounting_opening_balance_items;
CREATE POLICY accounting_opening_items_owner_read
  ON public.accounting_opening_balance_items
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_accounting_opening_balance_batch(
  p_notes text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_batch_id uuid;
  v_item jsonb;
  v_kind text;
  v_code text;
  v_account_id uuid;
  v_reference_id text;
  v_debit numeric;
  v_credit numeric;
  v_quantity numeric;
  v_unit_cost numeric;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accounting_settings
    WHERE owner_id = v_owner AND currency_code = 'INR'
      AND books_start_date = DATE '2026-09-01'
  ) THEN
    RAISE EXCEPTION 'Accounting must be initialized in INR with books start date 2026-09-01';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) < 2 THEN
    RAISE EXCEPTION 'Opening balance items must be an array with at least two lines';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_opening_balance_batches WHERE owner_id = v_owner) THEN
    RAISE EXCEPTION 'An opening balance batch already exists for this shop';
  END IF;

  INSERT INTO public.accounting_opening_balance_batches(owner_id, notes, created_by)
  VALUES (v_owner, NULLIF(trim(COALESCE(p_notes,'')),''), v_owner)
  RETURNING id INTO v_batch_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_kind := v_item->>'item_type';
    v_reference_id := NULLIF(trim(COALESCE(v_item->>'reference_id','')),'');
    v_debit := COALESCE(NULLIF(v_item->>'debit','')::numeric,0);
    v_credit := COALESCE(NULLIF(v_item->>'credit','')::numeric,0);
    v_quantity := NULLIF(v_item->>'quantity','')::numeric;
    v_unit_cost := NULLIF(v_item->>'unit_cost','')::numeric;

    IF v_kind = 'inventory' THEN v_code := '1200';
    ELSIF v_kind = 'customer_receivable' THEN v_code := '1100';
    ELSIF v_kind = 'supplier_payable' THEN v_code := '2000';
    ELSIF v_kind = 'account' THEN v_code := v_item->>'account_code';
    ELSE RAISE EXCEPTION 'Unsupported opening balance item type: %', v_kind;
    END IF;

    SELECT id INTO v_account_id
    FROM public.accounts
    WHERE owner_id = v_owner AND code = v_code AND is_active;
    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'Required active account % was not found', v_code;
    END IF;

    IF v_kind = 'account' AND v_code IN ('1100','1200','2000') THEN
      RAISE EXCEPTION 'Control accounts 1100, 1200 and 2000 require supporting detail rows';
    END IF;

    IF v_kind = 'inventory' THEN
      IF v_reference_id IS NULL OR v_quantity IS NULL OR v_unit_cost IS NULL
         OR v_quantity <= 0 OR v_unit_cost <= 0
         OR round(v_quantity * v_unit_cost, 4) <> round(v_debit, 4) THEN
        RAISE EXCEPTION 'Inventory line must include product, positive base-unit quantity and verified cost; debit must equal quantity × unit cost';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.products
        WHERE id = v_reference_id AND "userId" = v_owner::text
      ) THEN RAISE EXCEPTION 'Inventory product % not found for this shop', v_reference_id; END IF;
    ELSIF v_kind = 'customer_receivable' THEN
      IF v_reference_id IS NULL OR v_debit <= 0 OR v_credit <> 0
         OR v_quantity IS NOT NULL OR v_unit_cost IS NOT NULL THEN
        RAISE EXCEPTION 'Customer receivable requires a customer and positive debit';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.customers
        WHERE id = v_reference_id AND "userId" = v_owner::text
      ) THEN RAISE EXCEPTION 'Customer % not found for this shop', v_reference_id; END IF;
    ELSIF v_kind = 'supplier_payable' THEN
      IF v_reference_id IS NULL OR v_credit <= 0 OR v_debit <> 0
         OR v_quantity IS NOT NULL OR v_unit_cost IS NOT NULL THEN
        RAISE EXCEPTION 'Supplier payable requires a supplier and positive credit';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.suppliers
        WHERE id = v_reference_id::uuid AND "userId" = v_owner::text
      ) THEN RAISE EXCEPTION 'Supplier % not found for this shop', v_reference_id; END IF;
    END IF;

    IF NOT ((v_debit > 0 AND v_credit = 0) OR (v_credit > 0 AND v_debit = 0)) THEN
      RAISE EXCEPTION 'Each opening balance line must have one positive debit or credit';
    END IF;

    INSERT INTO public.accounting_opening_balance_items(
      owner_id, batch_id, item_type, account_id, reference_id,
      debit, credit, quantity, unit_cost, memo
    ) VALUES (
      v_owner, v_batch_id, v_kind, v_account_id, v_reference_id,
      v_debit, v_credit, v_quantity, v_unit_cost,
      NULLIF(v_item->>'memo','')
    );
  END LOOP;

  RETURN v_batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_accounting_opening_balance_batch(
  p_batch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_batch public.accounting_opening_balance_batches%ROWTYPE;
  v_debit numeric(20,4);
  v_credit numeric(20,4);
  v_inventory numeric(20,4);
  v_inventory_detail numeric(20,4);
  v_ar numeric(20,4);
  v_ar_detail numeric(20,4);
  v_ap numeric(20,4);
  v_ap_detail numeric(20,4);
  v_count integer;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_batch FROM public.accounting_opening_balance_batches
  WHERE id = p_batch_id AND owner_id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening balance batch not found'; END IF;
  IF v_batch.status = 'posted' THEN RAISE EXCEPTION 'Opening balance batch is already posted'; END IF;

  SELECT count(*), COALESCE(sum(debit),0), COALESCE(sum(credit),0)
  INTO v_count, v_debit, v_credit
  FROM public.accounting_opening_balance_items
  WHERE owner_id = v_owner AND batch_id = p_batch_id;
  IF v_count < 2 OR round(v_debit,4) <> round(v_credit,4) THEN
    RAISE EXCEPTION 'Opening balance batch is not balanced';
  END IF;

  SELECT COALESCE(sum(i.debit),0) INTO v_inventory
  FROM public.accounting_opening_balance_items i
  JOIN public.accounts a ON a.id = i.account_id AND a.owner_id = i.owner_id
  WHERE i.owner_id = v_owner AND i.batch_id = p_batch_id AND a.code = '1200';
  SELECT COALESCE(sum(debit),0) INTO v_inventory_detail
  FROM public.accounting_opening_balance_items
  WHERE owner_id = v_owner AND batch_id = p_batch_id AND item_type = 'inventory';
  IF round(v_inventory,4) <> round(v_inventory_detail,4) THEN
    RAISE EXCEPTION 'Inventory control account does not equal product-wise opening inventory detail';
  END IF;

  SELECT COALESCE(sum(i.debit),0) INTO v_ar
  FROM public.accounting_opening_balance_items i
  JOIN public.accounts a ON a.id = i.account_id AND a.owner_id = i.owner_id
  WHERE i.owner_id = v_owner AND i.batch_id = p_batch_id AND a.code = '1100';
  SELECT COALESCE(sum(debit),0) INTO v_ar_detail
  FROM public.accounting_opening_balance_items
  WHERE owner_id = v_owner AND batch_id = p_batch_id AND item_type = 'customer_receivable';
  IF round(v_ar,4) <> round(v_ar_detail,4) THEN
    RAISE EXCEPTION 'Accounts receivable control account does not equal customer-wise detail';
  END IF;

  SELECT COALESCE(sum(i.credit),0) INTO v_ap
  FROM public.accounting_opening_balance_items i
  JOIN public.accounts a ON a.id = i.account_id AND a.owner_id = i.owner_id
  WHERE i.owner_id = v_owner AND i.batch_id = p_batch_id AND a.code = '2000';
  SELECT COALESCE(sum(credit),0) INTO v_ap_detail
  FROM public.accounting_opening_balance_items
  WHERE owner_id = v_owner AND batch_id = p_batch_id AND item_type = 'supplier_payable';
  IF round(v_ap,4) <> round(v_ap_detail,4) THEN
    RAISE EXCEPTION 'Accounts payable control account does not equal supplier-wise detail';
  END IF;

  UPDATE public.accounting_opening_balance_batches
  SET status = 'validated', validated_at = now()
  WHERE id = p_batch_id AND owner_id = v_owner;

  RETURN jsonb_build_object(
    'batch_id', p_batch_id, 'status', 'validated', 'line_count', v_count,
    'total_debit', v_debit, 'total_credit', v_credit,
    'inventory_control', v_inventory, 'inventory_detail', v_inventory_detail,
    'receivables_control', v_ar, 'receivables_detail', v_ar_detail,
    'payables_control', v_ap, 'payables_detail', v_ap_detail
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.post_accounting_opening_balance_batch(
  p_batch_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_batch public.accounting_opening_balance_batches%ROWTYPE;
  v_entry_id uuid;
  v_lines jsonb;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_batch FROM public.accounting_opening_balance_batches
  WHERE id = p_batch_id AND owner_id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening balance batch not found'; END IF;
  IF v_batch.status <> 'validated' THEN
    RAISE EXCEPTION 'Opening balance batch must be validated before posting';
  END IF;
  IF v_batch.books_start_date <> DATE '2026-09-01'
     OR NOT EXISTS (
       SELECT 1 FROM public.accounting_settings
       WHERE owner_id = v_owner AND books_start_date = DATE '2026-09-01'
         AND currency_code = 'INR'
     ) THEN
    RAISE EXCEPTION 'Opening balance batch does not match the approved accounting basis';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'account_id', account_id,
    'debit', debit,
    'credit', credit,
    'memo', memo,
    'party_type', CASE item_type
      WHEN 'customer_receivable' THEN 'customer'
      WHEN 'supplier_payable' THEN 'supplier'
      ELSE NULL
    END,
    'party_id', reference_id
  ) ORDER BY id)
  INTO v_lines
  FROM public.accounting_opening_balance_items
  WHERE owner_id = v_owner AND batch_id = p_batch_id;

  v_entry_id := public.post_journal_entry(
    TIMESTAMPTZ '2026-09-01 00:00:00+05:30',
    'Opening balances as at 2026-08-31 close',
    'opening_balance',
    p_batch_id::text,
    'opening-balance:' || p_batch_id::text,
    v_lines
  );

  UPDATE public.accounting_opening_balance_batches
  SET status = 'posted', journal_entry_id = v_entry_id, posted_at = now()
  WHERE id = p_batch_id AND owner_id = v_owner;

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_accounting_opening_balance_batch(text,jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_accounting_opening_balance_batch(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_accounting_opening_balance_batch(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_accounting_opening_balance_batch(text,jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_accounting_opening_balance_batch(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_accounting_opening_balance_batch(uuid)
  TO authenticated;

COMMIT;
