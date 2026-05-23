-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : activation RLS sur les tables sans protection
-- Tables concernées : planning_entries, time_entries, entreprises,
--                     autocontrole, documents, push_subscriptions
-- Toutes les opérations sont idempotentes (DROP IF EXISTS + IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. PLANNING_ENTRIES ───────────────────────────────────────────────────────
-- Les policies existent déjà dans les migrations précédentes :
--   • planning_tech_select  (20260515_planning_time_select_fix.sql)
--   • planning_manager_all  (20260515_multitenant_entreprise_id.sql)
--   • planning_tech_write   (20260515_planning_rls_fix.sql)
-- Il manquait uniquement l'activation de RLS sur la table.

ALTER TABLE public.planning_entries ENABLE ROW LEVEL SECURITY;


-- ── 2. TIME_ENTRIES ───────────────────────────────────────────────────────────
-- La policy time_manager_select existe déjà (20260515_planning_time_select_fix.sql).
-- Il manque : activation RLS + policy permettant au technicien de lire/écrire
-- ses propres entrées d'heures.

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_tech_own" ON public.time_entries;
CREATE POLICY "time_tech_own" ON public.time_entries
  FOR ALL TO authenticated
  USING (technicien_id = auth.uid())
  WITH CHECK (technicien_id = auth.uid());


-- ── 3. ENTREPRISES ────────────────────────────────────────────────────────────
-- Chaque utilisateur voit uniquement son entreprise.
-- L'admin voit toutes les entreprises (nécessaire pour AdminEntreprisesTab).
-- Pas d'INSERT/UPDATE direct depuis le client — géré par service role.

ALTER TABLE public.entreprises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entreprises_select" ON public.entreprises;
CREATE POLICY "entreprises_select" ON public.entreprises
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR id = public.get_my_entreprise_id()
  );


-- ── 4. AUTOCONTROLE ───────────────────────────────────────────────────────────
-- Filtré par chantier → entreprise du demandeur.
-- SELECT : tous ceux qui accèdent au chantier.
-- INSERT/UPDATE : tous les membres de l'entreprise du chantier.

ALTER TABLE public.autocontrole ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autocontrole_select" ON public.autocontrole;
CREATE POLICY "autocontrole_select" ON public.autocontrole
  FOR SELECT TO authenticated
  USING (
    chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = public.get_my_entreprise_id()
    )
  );

DROP POLICY IF EXISTS "autocontrole_insert" ON public.autocontrole;
CREATE POLICY "autocontrole_insert" ON public.autocontrole
  FOR INSERT TO authenticated
  WITH CHECK (
    chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = public.get_my_entreprise_id()
    )
  );

DROP POLICY IF EXISTS "autocontrole_update" ON public.autocontrole;
CREATE POLICY "autocontrole_update" ON public.autocontrole
  FOR UPDATE TO authenticated
  USING (
    chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = public.get_my_entreprise_id()
    )
  );


-- ── 5. DOCUMENTS ──────────────────────────────────────────────────────────────
-- SELECT : tous les membres de l'entreprise du chantier.
-- INSERT : membres de l'entreprise du chantier.
-- DELETE : l'uploader lui-même ou un manager de l'entreprise.
--          (uploaded_by peut être NULL après suppression de compte → seul manager peut supprimer)

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated
  USING (
    chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = public.get_my_entreprise_id()
    )
  );

DROP POLICY IF EXISTS "documents_insert" ON public.documents;
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = public.get_my_entreprise_id()
    )
  );

DROP POLICY IF EXISTS "documents_delete" ON public.documents;
CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.is_manager()
  );


-- ── 6. PUSH_SUBSCRIPTIONS ─────────────────────────────────────────────────────
-- Chaque utilisateur ne peut lire/écrire/supprimer que ses propres souscriptions.
-- Les Edge Functions (send-push, weekly-recap) utilisent le service role → bypass RLS.

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_own" ON public.push_subscriptions;
CREATE POLICY "push_own" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
