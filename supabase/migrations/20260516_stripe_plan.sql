-- Ajoute les colonnes Stripe sur la table entreprises
ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text;
