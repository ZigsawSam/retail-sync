-- Expose only the shop's category configuration to authenticated staff.
-- Staff cannot write settings; the owner-only settings policies remain unchanged.
CREATE OR REPLACE FUNCTION public.staff_get_shop_categories()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_role text;
  v_result jsonb;
BEGIN
  v_owner_id := public.current_staff_owner_id();
  v_role := public.current_staff_role();

  IF v_owner_id IS NULL OR v_role NOT IN ('cashier', 'inventory_manager') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'shopCategory', COALESCE(shop_category, ''),
    'shopSubcategory', COALESCE(shop_subcategory, ''),
    'productCategories', COALESCE(product_categories, '[]'::jsonb),
    'expenseCategories', COALESCE(expense_categories, '[]'::jsonb)
  )
  INTO v_result
  FROM public.settings
  WHERE id = v_owner_id;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_get_shop_categories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_get_shop_categories() TO authenticated;

NOTIFY pgrst, 'reload schema';
