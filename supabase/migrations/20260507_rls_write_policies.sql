-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — Politiques d'écriture côté base de données
-- Principe : les lectures restent ouvertes à tous les authentifiés
--            seules les écritures sont sécurisées pour refléter l'UI
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Fonctions utilitaires ────────────────────────────────────────────────────
-- SECURITY DEFINER : s'exécute avec les droits du owner → bypass RLS des tables internes

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_permission(key text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.is_manager()
  OR EXISTS (
    SELECT 1
    FROM   public.role_permissions rp
    JOIN   public.profiles p ON p.poste = rp.poste
    WHERE  p.id = auth.uid()
    AND    rp.permission_key = key
    AND    rp.allowed = true
  )
$$;

-- ─── CHANTIERS ────────────────────────────────────────────────────────────────
ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chantiers_select"  ON public.chantiers;
DROP POLICY IF EXISTS "chantiers_insert"  ON public.chantiers;
DROP POLICY IF EXISTS "chantiers_update"  ON public.chantiers;
DROP POLICY IF EXISTS "chantiers_delete"  ON public.chantiers;
-- Supprime l'ancienne politique générique si elle existe
DROP POLICY IF EXISTS "authenticated_read_chantiers" ON public.chantiers;

CREATE POLICY "chantiers_select" ON public.chantiers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "chantiers_insert" ON public.chantiers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('creer_chantier'));

CREATE POLICY "chantiers_update" ON public.chantiers
  FOR UPDATE TO authenticated
  USING     (public.has_permission('modifier_chantier'))
  WITH CHECK(public.has_permission('modifier_chantier'));

CREATE POLICY "chantiers_delete" ON public.chantiers
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- ─── ETAPES ───────────────────────────────────────────────────────────────────
ALTER TABLE public.etapes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "etapes_select" ON public.etapes;
DROP POLICY IF EXISTS "etapes_insert" ON public.etapes;
DROP POLICY IF EXISTS "etapes_update" ON public.etapes;
DROP POLICY IF EXISTS "etapes_delete" ON public.etapes;

CREATE POLICY "etapes_select" ON public.etapes
  FOR SELECT TO authenticated USING (true);

-- Créer/supprimer une étape = permission creer_chantier
CREATE POLICY "etapes_insert" ON public.etapes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('creer_chantier'));

-- Avancer ou modifier une étape = permission creer_chantier
CREATE POLICY "etapes_update" ON public.etapes
  FOR UPDATE TO authenticated
  USING     (public.has_permission('creer_chantier'))
  WITH CHECK(public.has_permission('creer_chantier'));

CREATE POLICY "etapes_delete" ON public.etapes
  FOR DELETE TO authenticated
  USING (public.has_permission('creer_chantier'));

-- ─── NOTES ────────────────────────────────────────────────────────────────────
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_select" ON public.notes;
DROP POLICY IF EXISTS "notes_insert" ON public.notes;
DROP POLICY IF EXISTS "notes_delete" ON public.notes;

CREATE POLICY "notes_select" ON public.notes
  FOR SELECT TO authenticated USING (true);

-- Tout le monde peut ajouter une note
CREATE POLICY "notes_insert" ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Supprimer : sa propre note OU permission supprimer_message_autres
CREATE POLICY "notes_delete" ON public.notes
  FOR DELETE TO authenticated
  USING (
    technicien_id = auth.uid()
    OR public.has_permission('supprimer_message_autres')
  );

-- ─── ANOMALIES ────────────────────────────────────────────────────────────────
ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anomalies_select" ON public.anomalies;
DROP POLICY IF EXISTS "anomalies_insert" ON public.anomalies;
DROP POLICY IF EXISTS "anomalies_update" ON public.anomalies;
DROP POLICY IF EXISTS "anomalies_delete" ON public.anomalies;

CREATE POLICY "anomalies_select" ON public.anomalies
  FOR SELECT TO authenticated USING (true);

-- Tout le monde peut signaler une anomalie
CREATE POLICY "anomalies_insert" ON public.anomalies
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Résoudre = permission resoudre_anomalie
CREATE POLICY "anomalies_update" ON public.anomalies
  FOR UPDATE TO authenticated
  USING     (public.has_permission('resoudre_anomalie'))
  WITH CHECK(public.has_permission('resoudre_anomalie'));

CREATE POLICY "anomalies_delete" ON public.anomalies
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- ─── ETAPE_PHOTOS ─────────────────────────────────────────────────────────────
ALTER TABLE public.etape_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "etape_photos_select" ON public.etape_photos;
DROP POLICY IF EXISTS "etape_photos_insert" ON public.etape_photos;
DROP POLICY IF EXISTS "etape_photos_delete" ON public.etape_photos;

CREATE POLICY "etape_photos_select" ON public.etape_photos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "etape_photos_insert" ON public.etape_photos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('creer_chantier'));

CREATE POLICY "etape_photos_delete" ON public.etape_photos
  FOR DELETE TO authenticated
  USING (public.has_permission('creer_chantier'));

-- ─── CHANTIER_TECHNICIENS ─────────────────────────────────────────────────────
ALTER TABLE public.chantier_techniciens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chantier_techniciens_select" ON public.chantier_techniciens;
DROP POLICY IF EXISTS "chantier_techniciens_write"  ON public.chantier_techniciens;

CREATE POLICY "chantier_techniciens_select" ON public.chantier_techniciens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "chantier_techniciens_write" ON public.chantier_techniciens
  FOR ALL TO authenticated
  USING     (public.has_permission('assigner_techniciens'))
  WITH CHECK(public.has_permission('assigner_techniciens'));
