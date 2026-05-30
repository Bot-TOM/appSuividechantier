-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : le créateur peut voir son groupe juste après l'INSERT
--
-- Problème : après INSERT dans chat_groups, le .select().single() échouait
-- car is_group_member(id) retourne false (créateur pas encore dans
-- chat_group_members) → RETURNING retournait 0 lignes → erreur RLS.
--
-- Fix 1 : SELECT policy chat_groups — ajouter OR created_by = auth.uid()
-- Fix 2 : INSERT policy chat_group_members — le subquery SELECT sur chat_groups
--         était filtré par RLS (is_group_member) → retournait rien pour un
--         nouveau groupe. Remplacé par un EXISTS sans trigger RLS circulaire.
-- ─────────────────────────────────────────────────────────────────────────────

-- Fix 1 : créateur peut lire son groupe même avant d'être dans chat_group_members
DROP POLICY IF EXISTS "members_see_groups" ON public.chat_groups;
CREATE POLICY "members_see_groups" ON public.chat_groups
  FOR SELECT TO authenticated
  USING (
    is_group_member(id)
    OR created_by = auth.uid()
  );

-- Fix 2 : INSERT dans chat_group_members autorisé si créateur du groupe
-- (via SECURITY DEFINER implicite de la fonction is_group_member, mais on
-- remplace aussi le subquery problématique)
DROP POLICY IF EXISTS "members_add_members" ON public.chat_group_members;
CREATE POLICY "members_add_members" ON public.chat_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    is_group_member(group_id)
    OR EXISTS (
      SELECT 1 FROM public.chat_groups
      WHERE id = group_id AND created_by = auth.uid()
    )
  );
