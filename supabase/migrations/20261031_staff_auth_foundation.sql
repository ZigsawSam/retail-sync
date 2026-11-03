-- Retail Sync: staff Auth identity foundation
-- Review-only migration. Do not apply until a current database backup is available.
-- This migration preserves legacy password values and leaves verify_staff_login intact.
-- It does NOT yet grant staff access to business tables; role-specific RLS is a separate cutover.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.staff_logins') IS NULL THEN
    RAISE EXCEPTION 'Expected public.staff_logins table was not found';
  END IF;
  IF to_regclass('public.staff') IS NULL THEN
    RAISE EXCEPTION 'Expected public.staff table was not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff'
      AND column_name = 'id' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'Expected public.staff.id TEXT column was not found; inspect deployed schema before migration';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff'
      AND column_name = 'userId' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'Expected public.staff."userId" TEXT column was not found; inspect deployed schema before migration';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.staff_logins'::regclass
      AND conname = 'staff_logins_user_id_role_is_active_key'
      AND contype = 'u'
  ) THEN
    RAISE EXCEPTION 'Expected legacy staff_logins unique constraint was not found; inspect deployed constraints before migration';
  END IF;
END
$$;

-- Link each login to one employee and one individual Supabase Auth identity.
-- Keep user_id as the shop owner's Auth UUID.
ALTER TABLE public.staff_logins
  ADD COLUMN IF NOT EXISTS staff_id text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- New Auth-based accounts do not need a locally stored password.
-- Existing plaintext values are intentionally retained for the staged transition.
ALTER TABLE public.staff_logins
  ALTER COLUMN password DROP NOT NULL;

-- The previous constraint allowed only one active AND one inactive row per owner/role.
-- Multiple cashiers and multiple inventory managers are now supported.
ALTER TABLE public.staff_logins
  DROP CONSTRAINT staff_logins_user_id_role_is_active_key;

-- One current login per employee; historical inactive rows remain unrestricted.
CREATE UNIQUE INDEX IF NOT EXISTS staff_logins_one_active_login_per_staff
  ON public.staff_logins (user_id, staff_id)
  WHERE staff_id IS NOT NULL AND is_active IS TRUE;

-- One Auth identity must not be attached to multiple login records.
CREATE UNIQUE INDEX IF NOT EXISTS staff_logins_auth_user_id_unique
  ON public.staff_logins (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS staff_logins_owner_role_active_idx
  ON public.staff_logins (user_id, role, is_active);

-- Resolve the shop owner for a signed-in staff Auth identity.
-- SECURITY DEFINER is necessary because staff_logins RLS must not block this lookup.
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

-- Replace the existing PUBLIC-targeted policy with authenticated, tenant-scoped policies.
DROP POLICY IF EXISTS "Users can manage their own staff" ON public.staff_logins;

DROP POLICY IF EXISTS staff_logins_owner_manage ON public.staff_logins;
CREATE POLICY staff_logins_owner_manage
  ON public.staff_logins
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS staff_logins_staff_read_self ON public.staff_logins;
CREATE POLICY staff_logins_staff_read_self
  ON public.staff_logins
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    AND is_active IS TRUE
    AND terminated_at IS NULL
  );

COMMIT;

-- STAGED CUTOVER STATUS (this migration is still not executed):
-- 1. Branch contains owner-only invitation and termination API routes; requires
--    SUPABASE_SERVICE_ROLE_KEY in the server environment and end-to-end testing.
-- 2. Branch contains Supabase Auth sign-in, invitation password setup, and recovery UI.
-- 3. Role-specific RLS is defined in 20261031_staff_role_rls.sql; apply this
--    foundation migration first, then the role migration.
-- 4. Branch queries use the deployed camelCase tenant columns where verified.
-- 5. Keep verify_staff_login(text,text) grants until the Auth cutover is deployed
--    and verified; then revoke PUBLIC, anon, and authenticated execution.
-- 6. Legacy plaintext credential values are intentionally preserved for now;
--    remove them only after verified migration and backup.
