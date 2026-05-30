-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : fix infinite recursion in chat_group_members RLS
--
-- Problème : les policies SELECT et INSERT sur chat_group_members contenaient
-- des sous-requêtes sur chat_group_members elle-même → récursion infinie RLS.
-- Erreur : "infinite recursion detected in policy for relation chat_group_members"
--
-- Solution : SECURITY DEFINER function is_group_member() qui bypasse le RLS
-- pour briser le cycle de récursion.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Fonction helper SECURITY DEFINER ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE group_id = gid AND user_id = auth.uid()
  )
$$;

-- ── chat_group_members : SELECT ────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_see_members" ON public.chat_group_members;
CREATE POLICY "members_see_members" ON public.chat_group_members
  FOR SELECT TO authenticated
  USING (is_group_member(group_id));

-- ── chat_group_members : INSERT ────────────────────────────────────────────────
-- Autoriser le créateur du groupe (même si aucun membre n'existe encore)
-- et les membres existants (pour inviter d'autres personnes)
DROP POLICY IF EXISTS "members_add_members" ON public.chat_group_members;
CREATE POLICY "members_add_members" ON public.chat_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    group_id IN (SELECT id FROM public.chat_groups WHERE created_by = auth.uid())
    OR is_group_member(group_id)
  );

-- ── chat_groups : SELECT ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_see_groups" ON public.chat_groups;
CREATE POLICY "members_see_groups" ON public.chat_groups
  FOR SELECT TO authenticated
  USING (is_group_member(id));

-- ── group_messages : SELECT ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_see_messages" ON public.group_messages;
CREATE POLICY "members_see_messages" ON public.group_messages
  FOR SELECT TO authenticated
  USING (is_group_member(group_id));

-- ── group_messages : INSERT ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_send_messages" ON public.group_messages;
CREATE POLICY "members_send_messages" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_group_member(group_id)
  );
