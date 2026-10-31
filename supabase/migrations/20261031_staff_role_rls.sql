-- Retail Sync: role-specific staff access for the deployed camelCase tenant schema.
-- Owner policies are intentionally retained. PostgreSQL combines permissive policies with OR.
-- Staff receive only the operations in the approved cashier/inventory-manager matrix.

BEGIN;

DO $$
DECLARE
  required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY['products', 'customers', 'sales'] LOOP
    IF to_regclass(format('public.%I', required_table)) IS NULL THEN
      RAISE EXCEPTION 'Required table public.% does not exist; refusing partial staff RLS rollout', required_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = required_table
        AND column_name = 'userId'
        AND data_type = 'text'
    ) THEN
      RAISE EXCEPTION 'Expected public.%."userId" TEXT column is missing', required_table;
    END IF;
  END LOOP;
END
$$;

-- Harden the previously introduced identity resolvers. They return only the
-- tenant and role associated with the caller's own active Auth identity.
CREATE OR REPLACE FUNCTION public.current_staff_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT sl.user_id
  FROM public.staff_logins AS sl
  WHERE sl.auth_user_id = auth.uid()
    AND sl.is_active IS TRUE
    AND sl.terminated_at IS NULL
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT sl.role
  FROM public.staff_logins AS sl
  WHERE sl.auth_user_id = auth.uid()
    AND sl.is_active IS TRUE
    AND sl.terminated_at IS NULL
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.current_staff_owner_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_staff_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_staff_owner_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_list_products()
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'category', p.category,
      'quantity', p.quantity,
      'barcode', p.barcode,
      'lowStockLimit', p."lowStockLimit",
      'overstockLimit', p."overstockLimit"
    )
    ||
    CASE
      WHEN public.current_staff_role() = 'cashier'
        THEN jsonb_build_object('sellingPrice', p."sellingPrice")
      ELSE '{}'::jsonb
    END
  FROM public.products AS p
  WHERE p."userId" = public.current_staff_owner_id()::text
    AND public.current_staff_role() IN ('cashier', 'inventory_manager')
$function$;

REVOKE ALL ON FUNCTION public.staff_list_products() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_products() TO authenticated;

-- Products: staff read role-filtered JSON through staff_list_products().
-- Inventory managers can change quantity only; staff cannot insert/delete.
-- Staff cannot SELECT the base products table. Read-only role-filtered data is
-- exposed through staff_list_products(), which omits cost and pricing fields
-- that the caller's role is not allowed to see.
DROP POLICY IF EXISTS staff_products_read_shop ON public.products;

-- Inventory managers cannot create catalog products; catalog administration remains owner-only.
DROP POLICY IF EXISTS staff_inventory_products_insert ON public.products;

DROP POLICY IF EXISTS staff_inventory_products_update ON public.products;
CREATE POLICY staff_inventory_products_update
  ON public.products FOR UPDATE TO authenticated
  USING (
    public.current_staff_owner_id() IS NOT NULL
    AND public.current_staff_owner_id()::text = "userId"
    AND public.current_staff_role() = 'inventory_manager'
  )
  WITH CHECK (
    public.current_staff_owner_id() IS NOT NULL
    AND public.current_staff_owner_id()::text = "userId"
    AND public.current_staff_role() = 'inventory_manager'
  );

-- Inventory managers may change only the stock quantity column, never prices,
-- ownership, identifiers, categories, or other product metadata.
CREATE OR REPLACE FUNCTION public.enforce_staff_product_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF public.current_staff_role() = 'inventory_manager'
     AND public.current_staff_owner_id()::text = OLD."userId" THEN
    IF (to_jsonb(NEW) - 'quantity') IS DISTINCT FROM (to_jsonb(OLD) - 'quantity') THEN
      RAISE EXCEPTION 'Inventory managers may update stock quantity only';
    END IF;
    IF NEW.quantity < 0 THEN
      RAISE EXCEPTION 'Stock quantity cannot be negative';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS enforce_staff_product_update_columns ON public.products;
CREATE TRIGGER enforce_staff_product_update_columns
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_staff_product_update_columns();

-- Customers: both roles can read; cashiers can create records. Neither staff
-- role can update/delete existing customer records in this initial policy set.
DROP POLICY IF EXISTS staff_customers_read_shop ON public.customers;
CREATE POLICY staff_customers_read_shop
  ON public.customers FOR SELECT TO authenticated
  USING (
    public.current_staff_owner_id() IS NOT NULL
    AND public.current_staff_owner_id()::text = "userId"
    AND public.current_staff_role() IN ('cashier', 'inventory_manager')
  );

DROP POLICY IF EXISTS staff_cashier_customers_insert ON public.customers;
CREATE POLICY staff_cashier_customers_insert
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    public.current_staff_owner_id() IS NOT NULL
    AND public.current_staff_owner_id()::text = "userId"
    AND public.current_staff_role() = 'cashier'
  );

-- Sales: cashiers can read/create sales for their shop. No staff updates/deletes.
DROP POLICY IF EXISTS staff_cashier_sales_read_shop ON public.sales;
CREATE POLICY staff_cashier_sales_read_shop
  ON public.sales FOR SELECT TO authenticated
  USING (
    public.current_staff_owner_id() IS NOT NULL
    AND public.current_staff_owner_id()::text = "userId"
    AND public.current_staff_role() = 'cashier'
  );

DROP POLICY IF EXISTS staff_cashier_sales_insert ON public.sales;
CREATE POLICY staff_cashier_sales_insert
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    public.current_staff_owner_id() IS NOT NULL
    AND public.current_staff_owner_id()::text = "userId"
    AND public.current_staff_role() = 'cashier'
  );

COMMIT;

-- Deliberately no staff policies are added to settings, staff, staff_logins
-- (beyond reading their own active login), expenses, cheques, actualDrawerCash,
-- or electronicTxs. Those remain owner-only.
