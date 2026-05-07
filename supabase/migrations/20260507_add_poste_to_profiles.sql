-- Ajout du champ "poste" dans les profils utilisateurs
-- Exemples : 'Technicien', 'Chef d''équipe', 'Chef de chantier', 'Conducteur de travaux'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS poste text;
