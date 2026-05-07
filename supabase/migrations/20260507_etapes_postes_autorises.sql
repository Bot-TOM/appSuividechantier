-- Ajout de la colonne postes_autorises sur etapes
-- NULL = tout le monde peut valider l'étape
-- Tableau de postes = seuls ces postes peuvent valider
ALTER TABLE etapes
  ADD COLUMN IF NOT EXISTS postes_autorises TEXT[] DEFAULT NULL;
