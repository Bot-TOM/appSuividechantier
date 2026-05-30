-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : fix RLS multi-entreprises
--
-- Problèmes corrigés :
--   1. profiles_select    → pas de bypass admin → 0 utilisateurs affichés dans
--                           AdminEntreprisesTab pour les autres entreprises
--   2. messages_insert    → pas de bypass admin → admin ne peut pas envoyer de
--                           messages dans les chantiers d'une autre entreprise
--   3. global_messages    → 6 policies en conflit dont une USING (true) qui
--                           expose les messages de toutes les entreprises
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. PROFILES — ajouter bypass admin ────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR id = auth.uid()
    OR entreprise_id = get_my_entreprise_id()
  );


-- ── 2. MESSAGES — bypass admin sur l'INSERT ────────────────────────────────────
DROP POLICY IF EXISTS "messages_insert" ON public.messages;

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      get_my_role() = 'admin'
      OR chantier_id IN (
        SELECT id FROM public.chantiers
        WHERE entreprise_id = get_my_entreprise_id()
      )
    )
  );


-- ── 3. GLOBAL_MESSAGES — nettoyage des policies en doublon / insécures ─────────
-- "Tous les utilisateurs connectés peuvent lire..." = USING (true) → fuite de données

DROP POLICY IF EXISTS "Tous les utilisateurs connectés peuvent lire les messages glob" ON public.global_messages;
DROP POLICY IF EXISTS "Utilisateurs connectés peuvent envoyer un message global"       ON public.global_messages;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer leurs propres messages globaux"  ON public.global_messages;
DROP POLICY IF EXISTS "global_messages_delete_own"          ON public.global_messages;
DROP POLICY IF EXISTS "global_messages_insert_by_entreprise" ON public.global_messages;
DROP POLICY IF EXISTS "global_messages_select_by_entreprise" ON public.global_messages;

DROP POLICY IF EXISTS "global_messages_select" ON public.global_messages;
CREATE POLICY "global_messages_select" ON public.global_messages
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR entreprise_id = get_my_entreprise_id()
  );

DROP POLICY IF EXISTS "global_messages_insert" ON public.global_messages;
CREATE POLICY "global_messages_insert" ON public.global_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      get_my_role() = 'admin'
      OR entreprise_id = get_my_entreprise_id()
    )
  );

DROP POLICY IF EXISTS "global_messages_delete" ON public.global_messages;
CREATE POLICY "global_messages_delete" ON public.global_messages
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR has_permission('supprimer_message_autres')
  );
