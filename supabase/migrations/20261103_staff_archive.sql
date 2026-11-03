-- Archive staff without deleting payroll/attendance history.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.staff') IS NULL THEN
    RAISE EXCEPTION 'Expected public.staff table was not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff'
      AND column_name = 'id' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'Expected public.staff.id TEXT column was not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff'
      AND column_name = 'userId' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'Expected public.staff."userId" TEXT column was not found';
  END IF;
END
$preflight$;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS staff_active_by_owner_idx
  ON public.staff ("userId", id)
  WHERE archived_at IS NULL;

COMMIT;
