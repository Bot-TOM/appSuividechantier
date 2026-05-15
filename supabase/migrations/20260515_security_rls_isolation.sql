-- ─────────────────────────────────────────────────────────────────────────────
-- Migration sécurité : isolation multi-entreprises + RLS profiles
-- Corrige les vulnérabilités 1, 2, 4 (profiles), 5 (fetchEquipe)
-- À exécuter dans l'éditeur SQL de Supabase
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Fonctions utilitaires ──────────────────────────────────────────────────
-- SECURITY DEFINER : s'exécute avec les droits du owner → bypass RLS
-- Évite la récursivité infinie quand les policies de profiles se lisent elles-mêmes

CREATE OR REPLACE FUNCTION public.get_my_entreprise_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT entreprise_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ── PROFILES — RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select"         ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_manager" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"   ON public.profiles;

-- Lecture : uniquement les profils de la même entreprise
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (entreprise_id = get_my_entreprise_id());

-- Mise à jour propre : chacun peut modifier ses propres infos SAUF son rôle
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = get_my_role()
    AND entreprise_id = get_my_entreprise_id()
  );

-- Mise à jour manager : peut changer le poste des techniciens de son entreprise
-- (pas le rôle — WITH CHECK force role = 'technicien')
CREATE POLICY "profiles_update_manager" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'manager'
    AND entreprise_id = get_my_entreprise_id()
    AND id <> auth.uid()
    AND role = 'technicien'
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND entreprise_id = get_my_entreprise_id()
    AND role = 'technicien'
  );

-- Mise à jour admin : peut tout modifier dans son entreprise (y compris les rôles)
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    AND entreprise_id = get_my_entreprise_id()
  )
  WITH CHECK (
    get_my_role() = 'admin'
    AND entreprise_id = get_my_entreprise_id()
  );

-- ── CHANTIERS — isolation par entreprise ──────────────────────────────────────

DROP POLICY IF EXISTS "chantiers_select" ON public.chantiers;
DROP POLICY IF EXISTS "chantiers_insert" ON public.chantiers;

CREATE POLICY "chantiers_select" ON public.chantiers
  FOR SELECT TO authenticated
  USING (entreprise_id = get_my_entreprise_id());

-- L'INSERT vérifie aussi que l'entreprise_id fournie est bien celle de l'utilisateur
CREATE POLICY "chantiers_insert" ON public.chantiers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('creer_chantier')
    AND entreprise_id = get_my_entreprise_id()
  );

-- ── ETAPES ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "etapes_select" ON public.etapes;

CREATE POLICY "etapes_select" ON public.etapes
  FOR SELECT TO authenticated
  USING (
    chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = get_my_entreprise_id()
    )
  );

-- ── NOTES ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "notes_select" ON public.notes;

CREATE POLICY "notes_select" ON public.notes
  FOR SELECT TO authenticated
  USING (
    chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = get_my_entreprise_id()
    )
  );

-- ── ANOMALIES ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anomalies_select" ON public.anomalies;

CREATE POLICY "anomalies_select" ON public.anomalies
  FOR SELECT TO authenticated
  USING (
    chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = get_my_entreprise_id()
    )
  );

-- ── ETAPE_PHOTOS ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "etape_photos_select" ON public.etape_photos;

CREATE POLICY "etape_photos_select" ON public.etape_photos
  FOR SELECT TO authenticated
  USING (
    chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = get_my_entreprise_id()
    )
  );

-- ── CHANTIER_TECHNICIENS ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chantier_techniciens_select" ON public.chantier_techniciens;

CREATE POLICY "chantier_techniciens_select" ON public.chantier_techniciens
  FOR SELECT TO authenticated
  USING (
    chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = get_my_entreprise_id()
    )
  );

-- ── MESSAGES (chat par chantier) ──────────────────────────────────────────────

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_delete" ON public.messages;

CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = get_my_entreprise_id()
    )
  );

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND chantier_id IN (
      SELECT id FROM public.chantiers
      WHERE entreprise_id = get_my_entreprise_id()
    )
  );

CREATE POLICY "messages_delete" ON public.messages
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_permission('supprimer_message_autres')
  );

-- ── GLOBAL_MESSAGES ───────────────────────────────────────────────────────────

ALTER TABLE public.global_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "global_messages_select" ON public.global_messages;
DROP POLICY IF EXISTS "global_messages_insert" ON public.global_messages;
DROP POLICY IF EXISTS "global_messages_delete" ON public.global_messages;

CREATE POLICY "global_messages_select" ON public.global_messages
  FOR SELECT TO authenticated
  USING (entreprise_id = get_my_entreprise_id());

CREATE POLICY "global_messages_insert" ON public.global_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND entreprise_id = get_my_entreprise_id()
  );

CREATE POLICY "global_messages_delete" ON public.global_messages
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_permission('supprimer_message_autres')
  );
