-- Phase 2B follow-up: allow owners to discard an unposted draft safely.
-- Posted opening journals are never eligible for deletion.
BEGIN;

CREATE OR REPLACE FUNCTION public.discard_accounting_opening_balance_draft(
  p_batch_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_status text;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT status INTO v_status
  FROM public.accounting_opening_balance_batches
  WHERE id = p_batch_id AND owner_id = v_owner
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening balance batch not found'; END IF;
  IF v_status = 'posted' THEN
    RAISE EXCEPTION 'A posted opening balance batch cannot be discarded; use a reversal workflow';
  END IF;
  DELETE FROM public.accounting_opening_balance_items
  WHERE owner_id = v_owner AND batch_id = p_batch_id;
  DELETE FROM public.accounting_opening_balance_batches
  WHERE owner_id = v_owner AND id = p_batch_id AND status IN ('draft','validated');
END;
$$;

REVOKE ALL ON FUNCTION public.discard_accounting_opening_balance_draft(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discard_accounting_opening_balance_draft(uuid)
  TO authenticated;

COMMIT;
