-- Corrige les 10 policies RLS "always true" signalées par le Security Advisor.
-- Principe : les policies permissives s'additionnent en OU ; les policies ouvertes
-- court-circuitaient les policies correctement filtrées par entreprise déjà en place.
-- Les triggers BEFORE INSERT trg_*_entreprise remplissent entreprise_id automatiquement,
-- donc les WITH CHECK sur entreprise_id sont évalués après remplissage (comportement Postgres).
-- Vérifié fonctionnellement le 12/06/2026 : isolation inter-entreprises OK, insertions OK.

-- ── anomalies ──────────────────────────────────────────────────────────────
-- anomalies_acces : ALL avec test "manager" non filtré par entreprise → un manager
-- d'une autre entreprise passait. Les policies select/update/delete existantes suffisent.
DROP POLICY IF EXISTS "anomalies_acces" ON public.anomalies;
DROP POLICY IF EXISTS "anomalies_insert" ON public.anomalies;
CREATE POLICY "anomalies_insert" ON public.anomalies
  FOR INSERT TO authenticated
  WITH CHECK (entreprise_id = get_my_entreprise_id());

-- ── autocontrole ───────────────────────────────────────────────────────────
-- Les policies select/insert/update filtrées par chantier→entreprise existent déjà.
DROP POLICY IF EXISTS "autocontrole_access" ON public.autocontrole;

-- ── bug_reports ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bug_reports_insert" ON public.bug_reports;
CREATE POLICY "bug_reports_insert" ON public.bug_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ── documents ──────────────────────────────────────────────────────────────
-- Les policies select/insert/delete filtrées existent déjà ; l'app ne fait pas d'update.
DROP POLICY IF EXISTS "All authenticated" ON public.documents;

-- ── etape_photos ───────────────────────────────────────────────────────────
-- L'ALL-true permettait aux techniciens d'ajouter des photos (la policy insert
-- existante exigeait creer_chantier, trop restrictive). On remplace par un scope entreprise.
DROP POLICY IF EXISTS "etape_photos_access" ON public.etape_photos;
DROP POLICY IF EXISTS "etape_photos_insert" ON public.etape_photos;
CREATE POLICY "etape_photos_insert" ON public.etape_photos
  FOR INSERT TO authenticated
  WITH CHECK (entreprise_id = get_my_entreprise_id());
DROP POLICY IF EXISTS "etape_photos_delete" ON public.etape_photos;
CREATE POLICY "etape_photos_delete" ON public.etape_photos
  FOR DELETE TO authenticated
  USING (entreprise_id = get_my_entreprise_id());

-- ── message_reactions ──────────────────────────────────────────────────────
-- USING true permettait de lire ET supprimer les réactions de tout le monde.
DROP POLICY IF EXISTS "reactions_all" ON public.message_reactions;
CREATE POLICY "reactions_select" ON public.message_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = message_reactions.user_id
      AND p.entreprise_id = get_my_entreprise_id()
  ));
CREATE POLICY "reactions_insert" ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_delete" ON public.message_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── message_reads ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reads_all" ON public.message_reads;
CREATE POLICY "reads_select" ON public.message_reads
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = message_reads.user_id
      AND p.entreprise_id = get_my_entreprise_id()
  ));
CREATE POLICY "reads_insert" ON public.message_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "reads_update" ON public.message_reads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "reads_delete" ON public.message_reads
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── notes ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notes_acces" ON public.notes;
DROP POLICY IF EXISTS "notes_insert" ON public.notes;
CREATE POLICY "notes_insert" ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (entreprise_id = get_my_entreprise_id());

-- ── push_subscriptions ─────────────────────────────────────────────────────
-- Le service role bypass RLS nativement : cette policy "true" n'apportait que du risque.
DROP POLICY IF EXISTS "service role full access" ON public.push_subscriptions;
-- Doublon de push_own
DROP POLICY IF EXISTS "users manage own subscriptions" ON public.push_subscriptions;

-- ── rapport_photos ─────────────────────────────────────────────────────────
-- Seule policy existante : ALL true. Remplacement complet, scope via chantier.
DROP POLICY IF EXISTS "All authenticated" ON public.rapport_photos;
CREATE POLICY "rapport_photos_select" ON public.rapport_photos
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR chantier_id IN (SELECT id FROM public.chantiers WHERE entreprise_id = get_my_entreprise_id())
  );
CREATE POLICY "rapport_photos_insert" ON public.rapport_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    chantier_id IN (SELECT id FROM public.chantiers WHERE entreprise_id = get_my_entreprise_id())
  );
CREATE POLICY "rapport_photos_delete" ON public.rapport_photos
  FOR DELETE TO authenticated
  USING (
    chantier_id IN (SELECT id FROM public.chantiers WHERE entreprise_id = get_my_entreprise_id())
  );
