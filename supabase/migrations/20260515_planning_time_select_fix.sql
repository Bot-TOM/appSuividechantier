-- ─────────────────────────────────────────────────────────────────────────────
-- Migration sécurité : isolation multi-entreprises sur planning et heures
-- Corrige les vulnérabilités 6 (planning_tech_select) et 7 (time_manager_select)
-- À exécuter dans l'éditeur SQL de Supabase
-- ─────────────────────────────────────────────────────────────────────────────

-- ── PLANNING_ENTRIES — SELECT ──────────────────────────────────────────────────
-- Ancienne policy : USING (auth.role() = 'authenticated')
-- → tout utilisateur connecté voyait le planning de TOUTE la plateforme

DROP POLICY IF EXISTS "planning_tech_select" ON public.planning_entries;

CREATE POLICY "planning_tech_select" ON public.planning_entries
  FOR SELECT TO authenticated
  USING (
    technicien_id IN (
      SELECT id FROM public.profiles
      WHERE entreprise_id = get_my_entreprise_id()
    )
  );

-- ── TIME_ENTRIES — SELECT manager ─────────────────────────────────────────────
-- Ancienne policy : USING (is_manager())
-- → tous les managers voyaient les feuilles d'heures de TOUTE la plateforme

DROP POLICY IF EXISTS "time_manager_select" ON public.time_entries;

CREATE POLICY "time_manager_select" ON public.time_entries
  FOR SELECT TO authenticated
  USING (
    public.is_manager()
    AND technicien_id IN (
      SELECT id FROM public.profiles
      WHERE entreprise_id = get_my_entreprise_id()
    )
  );
