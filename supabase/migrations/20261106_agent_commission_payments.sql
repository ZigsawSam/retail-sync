-- Record agent commission payouts against the agent's oldest unpaid sale commissions.
BEGIN;

CREATE OR REPLACE FUNCTION public.record_agent_commission_payment(
  p_agent_phone text,
  p_amount numeric,
  p_method text DEFAULT 'Cash',
  p_notes text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_remaining numeric := p_amount;
  v_due numeric;
  v_alloc numeric;
  v_row record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_owner := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE id = v_owner::text) THEN
    RAISE EXCEPTION 'Only the shop owner can pay commission agents';
  END IF;
  IF nullif(trim(p_agent_phone),'') IS NULL THEN RAISE EXCEPTION 'Agent phone is required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Payment must be greater than zero'; END IF;
  IF nullif(trim(COALESCE(p_method,'')),'') IS NULL THEN RAISE EXCEPTION 'Payment method is required'; END IF;

  SELECT COALESCE(sum(commission_amount-paid_amount),0)
    INTO v_due
    FROM public.commission_ledger
   WHERE user_id=v_owner AND agent_phone=p_agent_phone;

  IF p_amount > v_due THEN RAISE EXCEPTION 'Payment exceeds this agent outstanding commission (% remaining)', v_due; END IF;

  FOR v_row IN
    SELECT id, commission_amount, paid_amount
      FROM public.commission_ledger
     WHERE user_id=v_owner AND agent_phone=p_agent_phone
       AND commission_amount > paid_amount
     ORDER BY created_at, id
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_alloc := least(v_remaining, v_row.commission_amount-v_row.paid_amount);
    UPDATE public.commission_ledger
       SET paid_amount=paid_amount+v_alloc,
           status=CASE WHEN paid_amount+v_alloc >= commission_amount THEN 'paid' ELSE 'partially_paid' END
     WHERE id=v_row.id;
    v_remaining := v_remaining-v_alloc;
  END LOOP;

  UPDATE public.commission_agents
     SET "totalEarnings" = GREATEST(0, COALESCE("totalEarnings",0))
   WHERE user_id=v_owner AND phone=p_agent_phone;

  INSERT INTO public.account_payments("userId",party_type,party_id,direction,amount,payment_method,notes)
  VALUES(v_owner::text,'agent',p_agent_phone,'paid',p_amount,trim(p_method),
    COALESCE(nullif(trim(p_notes),''),'Commission payout to '||p_agent_phone));

  RETURN v_due-p_amount;
END;
$$;

-- Allow the existing account payment journal to identify agent payouts.
ALTER TABLE public.account_payments DROP CONSTRAINT IF EXISTS account_payments_party_type_check;
ALTER TABLE public.account_payments ADD CONSTRAINT account_payments_party_type_check
  CHECK (party_type IN ('customer','supplier','agent'));

GRANT EXECUTE ON FUNCTION public.record_agent_commission_payment(text,numeric,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
