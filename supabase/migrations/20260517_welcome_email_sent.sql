-- Ajout du flag welcome_email_sent sur les profils
-- Permet de savoir si l'email de bienvenue a déjà été envoyé (évite les doublons)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent boolean NOT NULL DEFAULT false;
