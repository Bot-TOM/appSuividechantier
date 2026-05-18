-- Flag onboarding : indique si le manager a vu l'écran de bienvenue
-- false par défaut → modale affichée au premier login, jamais plus après

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_done boolean NOT NULL DEFAULT false;
