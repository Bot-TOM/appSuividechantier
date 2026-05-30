-- Manager et admin peuvent supprimer n'importe quel groupe de leur entreprise
DROP POLICY IF EXISTS "creator_delete_group" ON public.chat_groups;
CREATE POLICY "manager_delete_group" ON public.chat_groups
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR get_my_role() = 'admin'
    OR (get_my_role() = 'manager' AND entreprise_id = get_my_entreprise_id())
  );
