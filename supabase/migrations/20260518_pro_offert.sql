-- Ajout du champ pro_offert sur les entreprises
-- Permet au super-admin de donner l'accès Pro manuellement sans paiement Stripe

ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS pro_offert boolean NOT NULL DEFAULT false;
