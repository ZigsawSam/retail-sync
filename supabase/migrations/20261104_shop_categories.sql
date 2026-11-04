-- Shop-specific business profile and owner-managed category configuration.
-- Settings rows are already tenant-scoped by id; existing owner-only settings policies
-- remain the authorization boundary. Staff access continues through the narrow RPC context.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS shop_category text,
  ADD COLUMN IF NOT EXISTS shop_subcategory text,
  ADD COLUMN IF NOT EXISTS product_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expense_categories jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.settings.shop_category IS 'Primary business type selected by the shop owner.';
COMMENT ON COLUMN public.settings.shop_subcategory IS 'Business subtype selected by the shop owner.';
COMMENT ON COLUMN public.settings.product_categories IS 'Owner-managed shop-specific product categories and subcategories.';
COMMENT ON COLUMN public.settings.expense_categories IS 'Owner-managed shop-specific expense categories and subcategories.';
