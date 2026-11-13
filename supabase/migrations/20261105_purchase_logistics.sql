BEGIN;
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS purchase_source text NOT NULL DEFAULT 'Direct',
  ADD COLUMN IF NOT EXISTS delivery_mode text,
  ADD COLUMN IF NOT EXISTS transporter_id uuid,
  ADD COLUMN IF NOT EXISTS transporter_name text,
  ADD COLUMN IF NOT EXISTS freight_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_due_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_freight_balance_check;
ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_freight_balance_check
  CHECK (freight_amount >= 0 AND freight_paid_amount >= 0
    AND freight_due_amount >= 0
    AND freight_paid_amount + freight_due_amount = freight_amount);
CREATE TABLE IF NOT EXISTS public.transporters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL,
  name text NOT NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transporters_user_idx ON public.transporters("userId");
ALTER TABLE public.transporters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transporters_owner_select ON public.transporters;
CREATE POLICY transporters_owner_select ON public.transporters
  FOR SELECT TO authenticated USING ("userId" = auth.uid()::text);
CREATE TABLE IF NOT EXISTS public.transporter_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL,
  transporter_id uuid NOT NULL REFERENCES public.transporters(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL,
  notes text,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transporter_payments_user_idx
  ON public.transporter_payments("userId", "timestamp" DESC);
ALTER TABLE public.transporter_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transporter_payments_owner_select ON public.transporter_payments;
CREATE POLICY transporter_payments_owner_select ON public.transporter_payments
  FOR SELECT TO authenticated USING ("userId" = auth.uid()::text);
NOTIFY pgrst, 'reload schema';
COMMIT;