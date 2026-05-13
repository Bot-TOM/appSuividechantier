-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : correction colonnes planning_entries
-- Renomme texte → label si besoin, ajoute chantier_id si absent
-- Idempotent (DO NOTHING si les colonnes existent déjà)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Renommer l'ancienne colonne texte → label (si elle s'appelle encore texte)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'planning_entries'
      AND column_name  = 'texte'
  ) THEN
    ALTER TABLE public.planning_entries RENAME COLUMN texte TO label;
  END IF;
END $$;

-- 2. Ajouter la colonne label si elle n'existe toujours pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'planning_entries'
      AND column_name  = 'label'
  ) THEN
    ALTER TABLE public.planning_entries ADD COLUMN label text;
  END IF;
END $$;

-- 3. Ajouter la colonne chantier_id si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'planning_entries'
      AND column_name  = 'chantier_id'
  ) THEN
    ALTER TABLE public.planning_entries
      ADD COLUMN chantier_id uuid REFERENCES public.chantiers(id) ON DELETE SET NULL;
  END IF;
END $$;
