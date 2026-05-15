-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : isolation multi-entreprises complète
--
-- Stratégie : ajouter entreprise_id directement sur chaque table
--   → backfill des données existantes
--   → triggers BEFORE INSERT pour auto-remplir sans changer le code app
--   → RLS SELECT avec comparaison directe (pas de sous-requêtes → pas de 500)
--
-- Idempotent : safe à re-exécuter
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉTAPE 1 — Ajout des colonnes entreprise_id
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.anomalies          ADD COLUMN IF NOT EXISTS entreprise_id uuid;
ALTER TABLE public.etapes             ADD COLUMN IF NOT EXISTS entreprise_id uuid;
ALTER TABLE public.notes              ADD COLUMN IF NOT EXISTS entreprise_id uuid;
ALTER TABLE public.etape_photos       ADD COLUMN IF NOT EXISTS entreprise_id uuid;
ALTER TABLE public.messages           ADD COLUMN IF NOT EXISTS entreprise_id uuid;
ALTER TABLE public.chantier_techniciens ADD COLUMN IF NOT EXISTS entreprise_id uuid;
ALTER TABLE public.planning_entries   ADD COLUMN IF NOT EXISTS entreprise_id uuid;
ALTER TABLE public.time_entries       ADD COLUMN IF NOT EXISTS entreprise_id uuid;

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉTAPE 2 — Backfill des données existantes
-- Tables liées à un chantier → entreprise_id via chantiers
-- Tables liées à un technicien → entreprise_id via profiles
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.anomalies a
  SET entreprise_id = c.entreprise_id
  FROM public.chantiers c
  WHERE a.chantier_id = c.id AND a.entreprise_id IS NULL;

UPDATE public.etapes e
  SET entreprise_id = c.entreprise_id
  FROM public.chantiers c
  WHERE e.chantier_id = c.id AND e.entreprise_id IS NULL;

UPDATE public.notes n
  SET entreprise_id = c.entreprise_id
  FROM public.chantiers c
  WHERE n.chantier_id = c.id AND n.entreprise_id IS NULL;

UPDATE public.etape_photos ep
  SET entreprise_id = c.entreprise_id
  FROM public.chantiers c
  WHERE ep.chantier_id = c.id AND ep.entreprise_id IS NULL;

UPDATE public.messages m
  SET entreprise_id = c.entreprise_id
  FROM public.chantiers c
  WHERE m.chantier_id = c.id AND m.entreprise_id IS NULL;

UPDATE public.chantier_techniciens ct
  SET entreprise_id = c.entreprise_id
  FROM public.chantiers c
  WHERE ct.chantier_id = c.id AND ct.entreprise_id IS NULL;

UPDATE public.planning_entries pe
  SET entreprise_id = p.entreprise_id
  FROM public.profiles p
  WHERE pe.technicien_id = p.id AND pe.entreprise_id IS NULL;

UPDATE public.time_entries te
  SET entreprise_id = p.entreprise_id
  FROM public.profiles p
  WHERE te.technicien_id = p.id AND te.entreprise_id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉTAPE 3 — Fonctions trigger (SECURITY DEFINER → bypass RLS interne)
-- ═══════════════════════════════════════════════════════════════════════════

-- Pour les tables avec chantier_id
CREATE OR REPLACE FUNCTION public.set_entreprise_from_chantier()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SELECT entreprise_id INTO NEW.entreprise_id
  FROM public.chantiers
  WHERE id = NEW.chantier_id;
  RETURN NEW;
END;
$$;

-- Pour les tables avec technicien_id
CREATE OR REPLACE FUNCTION public.set_entreprise_from_technicien()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SELECT entreprise_id INTO NEW.entreprise_id
  FROM public.profiles
  WHERE id = NEW.technicien_id;
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉTAPE 4 — Triggers BEFORE INSERT (auto-remplissage sans changer le code app)
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_anomalies_entreprise          ON public.anomalies;
DROP TRIGGER IF EXISTS trg_etapes_entreprise             ON public.etapes;
DROP TRIGGER IF EXISTS trg_notes_entreprise              ON public.notes;
DROP TRIGGER IF EXISTS trg_etape_photos_entreprise       ON public.etape_photos;
DROP TRIGGER IF EXISTS trg_messages_entreprise           ON public.messages;
DROP TRIGGER IF EXISTS trg_chantier_tech_entreprise      ON public.chantier_techniciens;
DROP TRIGGER IF EXISTS trg_planning_entreprise           ON public.planning_entries;
DROP TRIGGER IF EXISTS trg_time_entreprise               ON public.time_entries;

CREATE TRIGGER trg_anomalies_entreprise
  BEFORE INSERT ON public.anomalies
  FOR EACH ROW EXECUTE FUNCTION public.set_entreprise_from_chantier();

CREATE TRIGGER trg_etapes_entreprise
  BEFORE INSERT ON public.etapes
  FOR EACH ROW EXECUTE FUNCTION public.set_entreprise_from_chantier();

CREATE TRIGGER trg_notes_entreprise
  BEFORE INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_entreprise_from_chantier();

CREATE TRIGGER trg_etape_photos_entreprise
  BEFORE INSERT ON public.etape_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_entreprise_from_chantier();

CREATE TRIGGER trg_messages_entreprise
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_entreprise_from_chantier();

CREATE TRIGGER trg_chantier_tech_entreprise
  BEFORE INSERT ON public.chantier_techniciens
  FOR EACH ROW EXECUTE FUNCTION public.set_entreprise_from_chantier();

CREATE TRIGGER trg_planning_entreprise
  BEFORE INSERT ON public.planning_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_entreprise_from_technicien();

CREATE TRIGGER trg_time_entreprise
  BEFORE INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_entreprise_from_technicien();

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉTAPE 5 — Mise à jour des RLS SELECT
-- Comparaison directe entreprise_id = get_my_entreprise_id()
-- Pas de sous-requêtes → pas de 500
-- ═══════════════════════════════════════════════════════════════════════════

-- ANOMALIES
DROP POLICY IF EXISTS "anomalies_select" ON public.anomalies;
CREATE POLICY "anomalies_select" ON public.anomalies
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR entreprise_id = get_my_entreprise_id()
  );

-- ETAPES
DROP POLICY IF EXISTS "etapes_select" ON public.etapes;
CREATE POLICY "etapes_select" ON public.etapes
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR entreprise_id = get_my_entreprise_id()
  );

-- NOTES
DROP POLICY IF EXISTS "notes_select" ON public.notes;
CREATE POLICY "notes_select" ON public.notes
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR entreprise_id = get_my_entreprise_id()
  );

-- ETAPE_PHOTOS
DROP POLICY IF EXISTS "etape_photos_select" ON public.etape_photos;
CREATE POLICY "etape_photos_select" ON public.etape_photos
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR entreprise_id = get_my_entreprise_id()
  );

-- MESSAGES
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR entreprise_id = get_my_entreprise_id()
  );

-- CHANTIER_TECHNICIENS
DROP POLICY IF EXISTS "chantier_techniciens_select" ON public.chantier_techniciens;
CREATE POLICY "chantier_techniciens_select" ON public.chantier_techniciens
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR entreprise_id = get_my_entreprise_id()
  );

-- PLANNING_ENTRIES — lecture : techniciens voient leur entreprise, managers idem
DROP POLICY IF EXISTS "planning_tech_select" ON public.planning_entries;
CREATE POLICY "planning_tech_select" ON public.planning_entries
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR entreprise_id = get_my_entreprise_id()
  );

-- PLANNING_ENTRIES — écriture manager : ajouter filtre entreprise
DROP POLICY IF EXISTS "planning_manager_all" ON public.planning_entries;
CREATE POLICY "planning_manager_all" ON public.planning_entries
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (is_manager() AND entreprise_id = get_my_entreprise_id())
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR (is_manager() AND entreprise_id = get_my_entreprise_id())
  );

-- TIME_ENTRIES — managers voient leur entreprise, techniciens voient leurs propres entrées
DROP POLICY IF EXISTS "time_manager_select" ON public.time_entries;
CREATE POLICY "time_manager_select" ON public.time_entries
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (is_manager() AND entreprise_id = get_my_entreprise_id())
    OR technicien_id = auth.uid()
  );

-- GLOBAL_MESSAGES — déjà isolé nativement, on harmonise quand même
DROP POLICY IF EXISTS "global_messages_select" ON public.global_messages;
CREATE POLICY "global_messages_select" ON public.global_messages
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR entreprise_id = get_my_entreprise_id()
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (optionnel — à décommenter pour vérifier le backfill)
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT 'anomalies'        AS table, COUNT(*) FILTER (WHERE entreprise_id IS NULL) AS manquants FROM anomalies
-- UNION ALL
-- SELECT 'etapes'           , COUNT(*) FILTER (WHERE entreprise_id IS NULL) FROM etapes
-- UNION ALL
-- SELECT 'notes'            , COUNT(*) FILTER (WHERE entreprise_id IS NULL) FROM notes
-- UNION ALL
-- SELECT 'etape_photos'     , COUNT(*) FILTER (WHERE entreprise_id IS NULL) FROM etape_photos
-- UNION ALL
-- SELECT 'messages'         , COUNT(*) FILTER (WHERE entreprise_id IS NULL) FROM messages
-- UNION ALL
-- SELECT 'chantier_tech'    , COUNT(*) FILTER (WHERE entreprise_id IS NULL) FROM chantier_techniciens
-- UNION ALL
-- SELECT 'planning_entries' , COUNT(*) FILTER (WHERE entreprise_id IS NULL) FROM planning_entries
-- UNION ALL
-- SELECT 'time_entries'     , COUNT(*) FILTER (WHERE entreprise_id IS NULL) FROM time_entries;
