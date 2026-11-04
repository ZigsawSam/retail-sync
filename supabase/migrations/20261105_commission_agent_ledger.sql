-- Commission agent master records and sale-linked commission accruals.
BEGIN;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS "commissionAgent" jsonb;

CREATE TABLE IF NOT EXISTS public.commission_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  "totalEarnings" numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);

ALTER TABLE public.commission_agents
  ADD COLUMN IF NOT EXISTS "totalEarnings" numeric(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.commission_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id text NOT NULL,
  agent_name text NOT NULL,
  agent_phone text NOT NULL,
  commission_percent numeric(8,3) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL CHECK (commission_amount > 0),
  paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= commission_amount),
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partially_paid','paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sale_id)
);

CREATE INDEX IF NOT EXISTS commission_agents_user_idx ON public.commission_agents(user_id);
CREATE INDEX IF NOT EXISTS commission_ledger_agent_idx ON public.commission_ledger(user_id, agent_phone, created_at DESC);

ALTER TABLE public.commission_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_agents_owner_select ON public.commission_agents;
CREATE POLICY commission_agents_owner_select ON public.commission_agents
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS commission_ledger_owner_select ON public.commission_ledger;
CREATE POLICY commission_ledger_owner_select ON public.commission_ledger
  FOR SELECT TO authenticated USING (user_id = auth.uid());

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
    SELECT item->>'productId' AS product_id,
           SUM((item->>'quantity')::integer)::integer AS quantity
    FROM jsonb_array_elements(p_sale->'items') AS item
    GROUP BY item->>'productId'
    ORDER BY item->>'productId'
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

  -- Record commission accrual atomically with the invoice and stock deduction.
  IF COALESCE((p_sale->'commissionAgent'->>'commissionAmount')::numeric, 0) > 0 THEN
    INSERT INTO public.commission_ledger (
      user_id, sale_id, agent_name, agent_phone,
      commission_percent, commission_amount, paid_amount, status
    ) VALUES (
      v_owner_id,
      v_sale.id::text,
      p_sale->'commissionAgent'->>'name',
      p_sale->'commissionAgent'->>'phone',
      COALESCE((p_sale->'commissionAgent'->>'commissionPercent')::numeric, 0),
      (p_sale->'commissionAgent'->>'commissionAmount')::numeric,
      0,
      'unpaid'
    );

    UPDATE public.commission_agents
       SET "totalEarnings" = COALESCE("totalEarnings", 0)
           + (p_sale->'commissionAgent'->>'commissionAmount')::numeric
     WHERE user_id = v_owner_id
       AND phone = p_sale->'commissionAgent'->>'phone';
  END IF;

  RETURN to_jsonb(v_sale);
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale_and_deduct_stock(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale_and_deduct_stock(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;


REVOKE ALL ON FUNCTION public.create_sale_and_deduct_stock(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale_and_deduct_stock(jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
