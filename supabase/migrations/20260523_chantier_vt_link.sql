-- Lien entre un chantier et une visite technique associée
ALTER TABLE chantiers
  ADD COLUMN IF NOT EXISTS vt_id UUID NULL REFERENCES visites_techniques(id) ON DELETE SET NULL;
