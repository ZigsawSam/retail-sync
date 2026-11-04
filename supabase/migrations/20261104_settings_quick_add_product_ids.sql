-- Add the Quick Add Products preference used by the current camelCase settings schema.
-- Safe for existing shops: existing rows receive an empty JSON array.
BEGIN;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS "quickAddProductIds" jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';

COMMIT;
