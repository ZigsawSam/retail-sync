BEGIN;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS unit_conversions jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
COMMIT;
