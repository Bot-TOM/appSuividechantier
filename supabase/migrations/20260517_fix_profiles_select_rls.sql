-- Fix RLS profiles : permet de toujours lire son propre profil
-- Avant : USING (entreprise_id = get_my_entreprise_id())
-- Problème : si entreprise_id est null (ex: compte admin/test), la lecture est bloquée
-- Fix : id = auth.uid() OR entreprise_id = get_my_entreprise_id()

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR entreprise_id = get_my_entreprise_id()
  );
