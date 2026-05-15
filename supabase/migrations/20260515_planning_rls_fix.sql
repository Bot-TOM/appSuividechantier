-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : Correction RLS planning_tech_write
-- Ajoute auth.uid() = technicien_id pour empêcher un technicien
-- d'écrire/supprimer les entrées planning d'un autre technicien.
-- ─────────────────────────────────────────────────────────────────────────────

-- Supprimer l'ancienne politique trop permissive
DROP POLICY IF EXISTS "planning_tech_write" ON planning_entries;

-- Recréer avec la restriction sur le propriétaire de la ligne
CREATE POLICY "planning_tech_write" ON planning_entries
  FOR ALL TO authenticated
  USING (
    has_permission('modifier_planning')
    AND auth.uid() = technicien_id
  )
  WITH CHECK (
    has_permission('modifier_planning')
    AND auth.uid() = technicien_id
  );
