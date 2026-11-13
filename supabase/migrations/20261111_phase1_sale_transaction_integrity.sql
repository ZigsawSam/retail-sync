BEGIN;

-- Phase 1: correct owner/product tenant comparisons.
-- In this schema, settings.id and products."userId" are text, while auth.uid()
-- returns uuid. Comparing text directly to uuid causes PostgreSQL operator errors.
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
  v_total numeric;
  v_paid numeric;
  v_due numeric;
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
    IF NOT EXISTS (
      SELECT 1 FROM public.settings WHERE id = v_owner_id::text
    ) THEN
      RAISE EXCEPTION 'Shop owner account not found';
    END IF;
  END IF;

  IF jsonb_typeof(p_sale->'items') <> 'array'
     OR jsonb_array_length(p_sale->'items') = 0 THEN
    RAISE EXCEPTION 'A sale must contain at least one item';
  END IF;

  v_total := COALESCE((p_sale->>'totalAmount')::numeric, 0);
  v_paid := COALESCE((p_sale->>'paidAmount')::numeric, v_total);
  v_due := COALESCE((p_sale->>'dueAmount')::numeric, v_total - v_paid);

  IF v_total < 0 OR v_paid < 0 OR v_due < 0
     OR round(v_paid + v_due, 2) <> round(v_total, 2) THEN
    RAISE EXCEPTION 'Sale total, paid amount and due amount do not reconcile';
  END IF;

  -- Aggregate duplicate cart lines before decrementing. Each UPDATE is atomic,
  -- so concurrent checkouts cannot both consume the same available stock.
  FOR v_item IN
    SELECT item->>'productId' AS product_id,
           SUM((item->>'quantity')::integer)::integer AS quantity
    FROM jsonb_array_elements(p_sale->'items') AS item
    GROUP BY item->>'productId'
    ORDER BY item->>'productId'
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL
       OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid product or sale quantity';
    END IF;

    UPDATE public.products
       SET quantity = quantity - v_item.quantity
     WHERE id::text = v_item.product_id
       AND "userId" = v_owner_id::text
       AND quantity >= v_item.quantity;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'Insufficient stock or product unavailable (product ID: %)',
        v_item.product_id;
    END IF;
  END LOOP;

  INSERT INTO public.sales
  SELECT (jsonb_populate_record(
    NULL::public.sales,
    p_sale || jsonb_build_object(
      'userId', v_owner_id::text,
      'paidAmount', v_paid,
      'dueAmount', v_due,
      'clearanceStatus', CASE
        WHEN v_due = 0 THEN 'Cleared'
        ELSE 'Pending'
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
