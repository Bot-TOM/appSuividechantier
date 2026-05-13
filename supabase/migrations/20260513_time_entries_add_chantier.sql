-- Ajoute chantier_id (optionnel) sur time_entries
-- pour permettre le récapitulatif d'heures par chantier

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS chantier_id uuid
  REFERENCES public.chantiers(id) ON DELETE SET NULL;
