-- Colonne is_dm sur chat_groups
ALTER TABLE public.chat_groups
  ADD COLUMN IF NOT EXISTS is_dm boolean NOT NULL DEFAULT false;

-- SELECT chat_groups : pas de bypass admin pour les DMs
DROP POLICY IF EXISTS "members_see_groups" ON public.chat_groups;
CREATE POLICY "members_see_groups" ON public.chat_groups
  FOR SELECT TO authenticated
  USING (
    is_group_member(id)
    OR is_group_creator(id)
    OR (get_my_role() = 'admin' AND is_dm = false)
  );

-- SELECT chat_group_members : idem
DROP POLICY IF EXISTS "members_see_members" ON public.chat_group_members;
CREATE POLICY "members_see_members" ON public.chat_group_members
  FOR SELECT TO authenticated
  USING (
    is_group_member(group_id)
    OR is_group_creator(group_id)
    OR (
      get_my_role() = 'admin'
      AND EXISTS (SELECT 1 FROM public.chat_groups WHERE id = group_id AND is_dm = false)
    )
  );

-- INSERT chat_group_members
DROP POLICY IF EXISTS "members_add_members" ON public.chat_group_members;
CREATE POLICY "members_add_members" ON public.chat_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    is_group_member(group_id)
    OR is_group_creator(group_id)
    OR (
      get_my_role() = 'admin'
      AND EXISTS (SELECT 1 FROM public.chat_groups WHERE id = group_id AND is_dm = false)
    )
  );

-- SELECT group_messages : pas de bypass admin pour les DMs
DROP POLICY IF EXISTS "members_see_messages" ON public.group_messages;
CREATE POLICY "members_see_messages" ON public.group_messages
  FOR SELECT TO authenticated
  USING (
    is_group_member(group_id)
    OR is_group_creator(group_id)
    OR (
      get_my_role() = 'admin'
      AND EXISTS (SELECT 1 FROM public.chat_groups WHERE id = group_id AND is_dm = false)
    )
  );

-- INSERT group_messages
DROP POLICY IF EXISTS "members_send_messages" ON public.group_messages;
CREATE POLICY "members_send_messages" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      is_group_member(group_id)
      OR is_group_creator(group_id)
      OR (
        get_my_role() = 'admin'
        AND EXISTS (SELECT 1 FROM public.chat_groups WHERE id = group_id AND is_dm = false)
      )
    )
  );

-- DELETE chat_groups : managers ne peuvent pas supprimer les DMs
DROP POLICY IF EXISTS "manager_delete_group" ON public.chat_groups;
CREATE POLICY "manager_delete_group" ON public.chat_groups
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR get_my_role() = 'admin'
    OR (
      get_my_role() = 'manager'
      AND entreprise_id = get_my_entreprise_id()
      AND is_dm = false
    )
  );
