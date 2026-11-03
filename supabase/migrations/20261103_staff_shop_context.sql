-- Staff-safe shop context: expose only shop identity and cash-summary inputs.
-- Staff do not receive direct SELECT access to owner settings or expense rows.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.settings') IS NULL OR to_regclass('public.expenses') IS NULL THEN
    RAISE EXCEPTION 'Required settings or expenses table is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='settings' AND column_name='id' AND data_type='text')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='settings' AND column_name='shopName')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='settings' AND column_name='startingBalance')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='settings' AND column_name='currency')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='userId' AND data_type='text')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='amount') THEN
    RAISE EXCEPTION 'Deployed settings/expenses schema differs from expected Retail Sync fields; refusing to create staff summary RPC';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.staff_get_shop_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_owner uuid;
  v_settings record;
  v_expenses numeric := 0;
BEGIN
  v_owner := public.current_staff_owner_id();
  IF v_owner IS NULL OR public.current_staff_role() NOT IN ('cashier', 'inventory_manager') THEN
    RAISE EXCEPTION 'Active staff authorization required';
  END IF;

  SELECT s."shopName", s."startingBalance", s.currency
    INTO v_settings
    FROM public.settings s
   WHERE s.id = v_owner::text;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop settings not found';
  END IF;

  SELECT COALESCE(SUM(e.amount), 0)
    INTO v_expenses
    FROM public.expenses e
   WHERE e."userId" = v_owner::text;

  RETURN jsonb_build_object(
    'shopName', COALESCE(v_settings."shopName", 'My Shop'),
    'startingBalance', COALESCE(v_settings."startingBalance", 0),
    'currency', COALESCE(v_settings.currency, 'INR'),
    'expensesTotal', COALESCE(v_expenses, 0)
  );
END
$function$;

REVOKE ALL ON FUNCTION public.staff_get_shop_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_get_shop_context() TO authenticated;

COMMIT;
