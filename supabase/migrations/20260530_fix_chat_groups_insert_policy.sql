-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : ajout des policies INSERT / UPDATE / DELETE manquantes sur chat_groups
--
-- Problème : "new row violates row-level security policy for table chat_groups"
-- Cause    : seule la policy SELECT existait → impossible de créer un groupe
-- ─────────────────────────────────────────────────────────────────────────────

-- INSERT : tout utilisateur authentifié peut créer un groupe (il doit être created_by)
DROP POLICY IF EXISTS "users_create_groups" ON public.chat_groups;
CREATE POLICY "users_create_groups" ON public.chat_groups
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE : seul le créateur peut renommer / modifier le groupe
DROP POLICY IF EXISTS "creator_update_group" ON public.chat_groups;
CREATE POLICY "creator_update_group" ON public.chat_groups
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- DELETE : seul le créateur peut dissoudre le groupe
DROP POLICY IF EXISTS "creator_delete_group" ON public.chat_groups;
CREATE POLICY "creator_delete_group" ON public.chat_groups
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
