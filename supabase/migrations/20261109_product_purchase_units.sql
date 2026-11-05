BEGIN;

-- Product stock is always stored in the smallest/base unit. Purchase units are
-- metadata used to convert supplier quantities into that stock unit.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_unit text NOT NULL DEFAULT 'Piece',
  ADD COLUMN IF NOT EXISTS base_unit text NOT NULL DEFAULT 'Piece',
  ADD COLUMN IF NOT EXISTS units_per_purchase_unit integer NOT NULL DEFAULT 1;

UPDATE public.products
SET purchase_unit = COALESCE(NULLIF(trim(purchase_unit), ''), 'Piece'),
    base_unit = COALESCE(NULLIF(trim(base_unit), ''), 'Piece'),
    units_per_purchase_unit = GREATEST(COALESCE(units_per_purchase_unit, 1), 1);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_units_per_purchase_unit_positive,
  ADD CONSTRAINT products_units_per_purchase_unit_positive
    CHECK (units_per_purchase_unit > 0),
  DROP CONSTRAINT IF EXISTS products_purchase_unit_not_blank,
  ADD CONSTRAINT products_purchase_unit_not_blank
    CHECK (length(trim(purchase_unit)) > 0),
  DROP CONSTRAINT IF EXISTS products_base_unit_not_blank,
  ADD CONSTRAINT products_base_unit_not_blank
    CHECK (length(trim(base_unit)) > 0);

NOTIFY pgrst, 'reload schema';
COMMIT;
