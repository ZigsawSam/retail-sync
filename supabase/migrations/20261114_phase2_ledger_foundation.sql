-- Phase 2A: central accounting ledger foundation.
-- Additive only: preserves all operational history and does not backfill prior transactions.
BEGIN;

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset','liability','equity','income','expense')),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit','credit')),
  is_system boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, code),
  UNIQUE (owner_id, id)
);

CREATE TABLE IF NOT EXISTS public.accounting_settings (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  currency_code char(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  books_start_date date NOT NULL,
  initialized_at timestamptz NOT NULL DEFAULT now(),
  initialized_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  entry_number bigint GENERATED ALWAYS AS IDENTITY,
  effective_at timestamptz NOT NULL,
  description text NOT NULL CHECK (length(trim(description)) > 0),
  source_type text NOT NULL CHECK (length(trim(source_type)) > 0),
  source_id text NOT NULL CHECK (length(trim(source_id)) > 0),
  idempotency_key text NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted')),
  reversal_of uuid NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, entry_number),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, idempotency_key),
  FOREIGN KEY (owner_id, reversal_of) REFERENCES public.journal_entries(owner_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_owner_source_uidx
  ON public.journal_entries(owner_id, source_type, source_id);

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  journal_entry_id uuid NOT NULL,
  account_id uuid NOT NULL,
  debit numeric(20,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(20,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  party_type text,
  party_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
  FOREIGN KEY (owner_id, journal_entry_id)
    REFERENCES public.journal_entries(owner_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id, account_id)
    REFERENCES public.accounts(owner_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS journal_entries_owner_effective_idx
  ON public.journal_entries(owner_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS journal_lines_owner_account_idx
  ON public.journal_lines(owner_id, account_id, journal_entry_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

-- Supabase default privileges in this project grant broad rights on new tables.
-- Revoke client writes explicitly; authenticated users receive read-only access
-- constrained by the owner-scoped RLS policies above.
REVOKE ALL ON TABLE public.accounts, public.accounting_settings,
  public.journal_entries, public.journal_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.accounts, public.accounting_settings,
  public.journal_entries, public.journal_lines TO authenticated;
REVOKE ALL ON SEQUENCE public.journal_entries_entry_number_seq
  FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS accounting_accounts_owner_read ON public.accounts;
CREATE POLICY accounting_accounts_owner_read ON public.accounts
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS accounting_settings_owner_read ON public.accounting_settings;
CREATE POLICY accounting_settings_owner_read ON public.accounting_settings
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS journal_entries_owner_read ON public.journal_entries;
CREATE POLICY journal_entries_owner_read ON public.journal_entries
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS journal_lines_owner_read ON public.journal_lines;
CREATE POLICY journal_lines_owner_read ON public.journal_lines
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.prevent_posted_journal_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    IF TG_OP IN ('UPDATE','DELETE') THEN
      RAISE EXCEPTION 'Journal entries are immutable; create a reversal instead';
    END IF;
    IF TG_OP = 'INSERT'
       AND current_setting('retail_sync.posting_journal', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Journal entries can only be inserted by the journal posting function';
    END IF;
  ELSIF TG_TABLE_NAME = 'journal_lines' THEN
    IF TG_OP IN ('UPDATE','DELETE') THEN
      RAISE EXCEPTION 'Posted journal lines are immutable; create a reversal instead';
    END IF;
    -- Only the trusted posting RPC may insert lines during its transaction.
    IF current_setting('retail_sync.posting_journal', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Journal lines can only be inserted by the journal posting function';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journal_entries_immutable_trg ON public.journal_entries;
CREATE TRIGGER journal_entries_immutable_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.prevent_posted_journal_mutation();

DROP TRIGGER IF EXISTS journal_lines_immutable_trg ON public.journal_lines;
CREATE TRIGGER journal_lines_immutable_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.prevent_posted_journal_mutation();

CREATE OR REPLACE FUNCTION public.initialize_accounting(
  p_currency_code text,
  p_books_start_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $
DECLARE
  v_owner uuid := auth.uid();
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id = v_owner::text OR "userId" = v_owner::text) THEN
    RAISE EXCEPTION 'Shop owner account not found';
  END IF;
  IF p_currency_code IS NULL OR p_currency_code !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Currency must be a 3-letter ISO code, for example INR';
  END IF;
  IF p_books_start_date IS NULL THEN RAISE EXCEPTION 'Accounting start date is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_settings WHERE owner_id = v_owner) THEN
    RAISE EXCEPTION 'Accounting has already been initialized; contact an administrator to change its settings';
  END IF;

  INSERT INTO public.accounting_settings(owner_id, currency_code, books_start_date, initialized_by)
  VALUES (v_owner, p_currency_code, p_books_start_date, v_owner);

  INSERT INTO public.accounts(owner_id, code, name, account_type, normal_balance)
  VALUES
    (v_owner,'1000','Cash on hand','asset','debit'),
    (v_owner,'1010','Bank account','asset','debit'),
    (v_owner,'1020','Payment clearing','asset','debit'),
    (v_owner,'1100','Accounts receivable','asset','debit'),
    (v_owner,'1200','Inventory','asset','debit'),
    (v_owner,'1500','Fixed assets','asset','debit'),
    (v_owner,'1590','Accumulated depreciation','asset','credit'),
    (v_owner,'2000','Accounts payable','liability','credit'),
    (v_owner,'2050','Tax payable','liability','credit'),
    (v_owner,'2100','Other liabilities','liability','credit'),
    (v_owner,'3000','Owner capital','equity','credit'),
    (v_owner,'3100','Owner drawings','equity','debit'),
    (v_owner,'3900','Opening balance equity','equity','credit'),
    (v_owner,'4000','Sales revenue','income','credit'),
    (v_owner,'4050','Sales returns and allowances','income','debit'),
    (v_owner,'5000','Cost of goods sold','expense','debit'),
    (v_owner,'6000','Operating expenses','expense','debit'),
    (v_owner,'6100','Bank and payment fees','expense','debit');
END;
$$;

CREATE OR REPLACE FUNCTION public.post_journal_entry(
  p_effective_at timestamptz,
  p_description text,
  p_source_type text,
  p_source_id text,
  p_idempotency_key text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $
DECLARE
  v_owner uuid := auth.uid();
  v_entry_id uuid;
  v_existing_id uuid;
  v_line jsonb;
  v_account_id uuid;
  v_debit numeric;
  v_credit numeric;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_line_count integer := 0;
  v_existing_source_id uuid;
  v_existing_source_type text;
  v_existing_source_key text;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounting_settings WHERE owner_id = v_owner) THEN
    RAISE EXCEPTION 'Accounting has not been initialized';
  END IF;
  IF p_effective_at IS NULL OR p_description IS NULL OR length(trim(p_description)) = 0
     OR p_source_type IS NULL OR length(trim(p_source_type)) = 0
     OR p_source_id IS NULL OR length(trim(p_source_id)) = 0
     OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'Journal entry metadata is incomplete';
  END IF;
  IF p_effective_at::date < (SELECT books_start_date FROM public.accounting_settings WHERE owner_id = v_owner) THEN
    RAISE EXCEPTION 'Journal entry date is before the accounting start date';
  END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Journal lines must be supplied as an array';
  END IF;
  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'A journal entry requires at least two lines';
  END IF;

  -- Lock both identities so retries cannot create duplicate entries through
  -- either the idempotency key or the source-document uniqueness constraint.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_owner::text || ':journal-key:' || p_idempotency_key, 0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_owner::text || ':journal-source:' || p_source_type || ':' || p_source_id, 0
  ));

  SELECT id, source_type, source_id
    INTO v_existing_id, v_existing_source_type, v_existing_source_key
    FROM public.journal_entries
   WHERE owner_id = v_owner AND idempotency_key = p_idempotency_key;
  IF v_existing_id IS NOT NULL THEN
    -- A key must never be reused for a different source document.
    IF v_existing_source_type IS DISTINCT FROM p_source_type
       OR v_existing_source_key IS DISTINCT FROM p_source_id THEN
      RAISE EXCEPTION 'Idempotency key is already used by a different source document';
    END IF;
    RETURN v_existing_id;
  END IF;

  SELECT id INTO v_existing_source_id
    FROM public.journal_entries
   WHERE owner_id = v_owner AND source_type = p_source_type AND source_id = p_source_id;
  IF v_existing_source_id IS NOT NULL THEN
    RETURN v_existing_source_id;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_account_id := NULLIF(v_line->>'account_id','')::uuid;
    v_debit := COALESCE((v_line->>'debit')::numeric, 0);
    v_credit := COALESCE((v_line->>'credit')::numeric, 0);
    IF v_account_id IS NULL OR v_debit < 0 OR v_credit < 0
       OR NOT ((v_debit > 0 AND v_credit = 0) OR (v_credit > 0 AND v_debit = 0)) THEN
      RAISE EXCEPTION 'Each journal line must have one positive debit or credit and a valid account';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = v_account_id AND owner_id = v_owner AND is_active) THEN
      RAISE EXCEPTION 'Account not found, inactive, or not owned by this shop';
    END IF;
    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
    v_line_count := v_line_count + 1;
  END LOOP;

  IF v_line_count < 2 OR round(v_total_debit, 4) <> round(v_total_credit, 4) THEN
    RAISE EXCEPTION 'Journal entry is not balanced';
  END IF;

  -- Permit journal-line inserts only inside this trusted posting transaction.
  PERFORM set_config('retail_sync.posting_journal', 'on', true);

  INSERT INTO public.journal_entries(
    owner_id, effective_at, description, source_type, source_id, idempotency_key, created_by
  ) VALUES (
    v_owner, p_effective_at, trim(p_description), trim(p_source_type),
    trim(p_source_id), trim(p_idempotency_key), v_owner
  ) RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.journal_lines(
      owner_id, journal_entry_id, account_id, debit, credit, memo, party_type, party_id
    ) VALUES (
      v_owner, v_entry_id, (v_line->>'account_id')::uuid,
      COALESCE((v_line->>'debit')::numeric, 0),
      COALESCE((v_line->>'credit')::numeric, 0),
      NULLIF(v_line->>'memo',''), NULLIF(v_line->>'party_type',''),
      NULLIF(v_line->>'party_id','')
    );
  END LOOP;

  -- Close the narrow line-insert window before returning to the caller.
  PERFORM set_config('retail_sync.posting_journal', 'off', true);

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_accounting(text,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_journal_entry(timestamptz,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_accounting(text,date) TO authenticated;
-- Journal posting is intentionally not exposed to clients. Trusted transaction
-- RPCs owned by the database may invoke it inside their own transaction.

NOTIFY pgrst, 'reload schema';
COMMIT;
