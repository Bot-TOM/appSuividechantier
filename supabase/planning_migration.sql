-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : Planning équipe + Feuille d'heures
-- À exécuter dans l'éditeur SQL de Supabase
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Table planning_entries
CREATE TABLE IF NOT EXISTS planning_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technicien_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date          date NOT NULL,
  type          text NOT NULL DEFAULT 'libre',
  texte         text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (technicien_id, date)
);

ALTER TABLE planning_entries ENABLE ROW LEVEL SECURITY;

-- Managers : accès total
CREATE POLICY "planning_manager_all" ON planning_entries
  FOR ALL TO authenticated
  USING (is_manager())
  WITH CHECK (is_manager());

-- Techniciens : lecture de toutes les entrées
CREATE POLICY "planning_tech_select" ON planning_entries
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- Techniciens avec permission modifier_planning : écriture
CREATE POLICY "planning_tech_write" ON planning_entries
  FOR ALL TO authenticated
  USING (has_permission('modifier_planning'))
  WITH CHECK (has_permission('modifier_planning'));

-- 2. Table time_entries
CREATE TABLE IF NOT EXISTS time_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technicien_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date          date NOT NULL,
  arrivee       time,
  depart        time,
  pause         int DEFAULT 0,  -- minutes
  created_at    timestamptz DEFAULT now(),
  UNIQUE (technicien_id, date)
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Managers : lecture de toutes les entrées
CREATE POLICY "time_manager_select" ON time_entries
  FOR SELECT TO authenticated
  USING (is_manager());

-- Techniciens : gestion de leurs propres entrées uniquement
CREATE POLICY "time_tech_own" ON time_entries
  FOR ALL TO authenticated
  USING (auth.uid() = technicien_id)
  WITH CHECK (auth.uid() = technicien_id);

-- 3. Nouvelles permissions dans role_permissions
-- (insère avec allowed=false par défaut — le manager active selon besoin)
INSERT INTO role_permissions (poste, permission_key, allowed)
SELECT p.poste, k.key, false
FROM
  (VALUES ('Technicien'), ('Chef d''équipe'), ('Chef de chantier'), ('Conducteur de travaux')) AS p(poste),
  (VALUES ('voir_planning_equipe'), ('modifier_planning')) AS k(key)
ON CONFLICT (poste, permission_key) DO NOTHING;
