-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : bypass admin + visibilité créateur sur les groupes de chat
--
-- Problèmes corrigés :
--   1. Admin ne voit aucun groupe (aucun bypass dans les policies)
--   2. Créateur ne voit pas les membres de son groupe (is_group_member = false
--      car il n'était pas encore dans chat_group_members)
--   3. INSERT policy chat_group_members utilisait un EXISTS avec chaîne RLS
--      → remplacé par is_group_creator() SECURITY DEFINER
--   4. Réparation du groupe "Test" : Tom (créateur) ajouté comme membre
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Fonction SECURITY DEFINER pour le check créateur ───────────────────────
CREATE OR REPLACE FUNCTION public.is_group_creator(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_groups
    WHERE id = gid AND created_by = auth.uid()
  )
$$;

-- ── 2. chat_groups SELECT — créateur + bypass admin ───────────────────────────
DROP POLICY IF EXISTS "members_see_groups" ON public.chat_groups;
CREATE POLICY "members_see_groups" ON public.chat_groups
  FOR SELECT TO authenticated
  USING (
    is_group_member(id)
    OR is_group_creator(id)
    OR get_my_role() = 'admin'
  );

-- ── 3. chat_group_members SELECT — créateur + bypass admin ────────────────────
DROP POLICY IF EXISTS "members_see_members" ON public.chat_group_members;
CREATE POLICY "members_see_members" ON public.chat_group_members
  FOR SELECT TO authenticated
  USING (
    is_group_member(group_id)
    OR is_group_creator(group_id)
    OR get_my_role() = 'admin'
  );

-- ── 4. chat_group_members INSERT — SECURITY DEFINER, sans chaîne RLS ──────────
DROP POLICY IF EXISTS "members_add_members" ON public.chat_group_members;
CREATE POLICY "members_add_members" ON public.chat_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    is_group_member(group_id)
    OR is_group_creator(group_id)
    OR get_my_role() = 'admin'
  );

-- ── 5. group_messages SELECT/INSERT — bypass admin ────────────────────────────
DROP POLICY IF EXISTS "members_see_messages" ON public.group_messages;
CREATE POLICY "members_see_messages" ON public.group_messages
  FOR SELECT TO authenticated
  USING (
    is_group_member(group_id)
    OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "members_send_messages" ON public.group_messages;
CREATE POLICY "members_send_messages" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (is_group_member(group_id) OR get_my_role() = 'admin')
  );

-- ── 6. Réparation du groupe "Test" : ajoute Tom (créateur) comme membre ───────
INSERT INTO public.chat_group_members (group_id, user_id)
VALUES ('b4033b40-7c23-4f1d-895f-816941e94af7', '652b9bc3-59a1-4cb4-8406-98cf0da950f7')
ON CONFLICT DO NOTHING;
