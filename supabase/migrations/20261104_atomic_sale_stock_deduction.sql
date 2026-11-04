BEGIN;

-- Atomically record a sale and deduct stock. Cash sales are considered received
-- at checkout so they are included in the cash drawer's cleared-cash total.
CREATE OR REPLACE FUNCTION public.create_sale_and_deduct_stock(p_sale jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_staff_owner_id uuid;
  v_staff_role text;
  v_item record;
  v_sale public.sales%ROWTYPE;
  v_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_staff_owner_id := public.current_staff_owner_id();
  v_staff_role := public.current_staff_role();

  IF v_staff_owner_id IS NOT NULL THEN
    IF v_staff_role <> 'cashier' THEN
      RAISE EXCEPTION 'Only cashiers can create sales';
    END IF;
    v_owner_id := v_staff_owner_id;
  ELSE
    v_owner_id := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id = v_owner_id) THEN
      RAISE EXCEPTION 'Shop owner account not found';
    END IF;
  END IF;

  IF jsonb_typeof(p_sale->'items') <> 'array'
     OR jsonb_array_length(p_sale->'items') = 0 THEN
    RAISE EXCEPTION 'A sale must contain at least one item';
  END IF;

  -- Group duplicate cart lines for the same product before checking/decrementing.
  FOR v_item IN
    SELECT product_id, SUM(quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_sale->'items')
      AS item(product_id text, quantity integer)
    GROUP BY product_id
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid product or sale quantity';
    END IF;

    UPDATE public.products
       SET quantity = quantity - v_item.quantity
     WHERE id::text = v_item.product_id
       AND "userId" = v_owner_id
       AND quantity >= v_item.quantity;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'Insufficient stock or product unavailable (product ID: %)', v_item.product_id;
    END IF;
  END LOOP;

  INSERT INTO public.sales
  SELECT (jsonb_populate_record(
    NULL::public.sales,
    p_sale || jsonb_build_object(
      'userId', v_owner_id,
      'clearanceStatus', CASE
        WHEN p_sale->>'paymentMethod' = 'Cash' THEN 'Cleared'
        ELSE COALESCE(p_sale->>'clearanceStatus', 'Pending')
      END,
      'timestamp', COALESCE(p_sale->>'timestamp', now()::text)
    )
  )).*
  RETURNING * INTO v_sale;

  RETURN to_jsonb(v_sale);
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale_and_deduct_stock(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale_and_deduct_stock(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
