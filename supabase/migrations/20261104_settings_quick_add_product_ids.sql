-- Restore the Quick Add Products preference used by Settings.
-- Existing shop settings are preserved; current rows default to no quick-add products.
BEGIN;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS quick_add_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';

COMMIT;
