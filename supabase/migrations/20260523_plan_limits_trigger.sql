-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : limites de plan enforced côté serveur (triggers BEFORE INSERT)
-- • chantiers  : Starter → max 3 chantiers par entreprise
-- • profiles   : Starter → max 3 techniciens par entreprise
-- Idempotent (DROP IF EXISTS + CREATE OR REPLACE)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. CHANTIERS ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_chantiers_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan       text;
  v_pro_offert boolean;
  v_count      integer;
BEGIN
  -- Pas de vérification si entreprise_id absent
  IF NEW.entreprise_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan, COALESCE(pro_offert, false)
    INTO v_plan, v_pro_offert
    FROM public.entreprises
   WHERE id = NEW.entreprise_id;

  -- Plan Pro ou pro_offert → aucune limite
  IF v_plan = 'pro' OR v_pro_offert = true THEN
    RETURN NEW;
  END IF;

  -- Compter les chantiers existants
  SELECT COUNT(*) INTO v_count
    FROM public.chantiers
   WHERE entreprise_id = NEW.entreprise_id;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'plan_limit_chantiers';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chantiers_plan_limit ON public.chantiers;
CREATE TRIGGER trg_chantiers_plan_limit
  BEFORE INSERT ON public.chantiers
  FOR EACH ROW EXECUTE FUNCTION public.check_chantiers_plan_limit();


-- ── 2. PROFILES (techniciens uniquement) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_users_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan       text;
  v_pro_offert boolean;
  v_count      integer;
BEGIN
  -- Limiter uniquement l'ajout de techniciens
  IF NEW.role != 'technicien' THEN
    RETURN NEW;
  END IF;

  -- Pas de vérification si entreprise_id absent
  IF NEW.entreprise_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan, COALESCE(pro_offert, false)
    INTO v_plan, v_pro_offert
    FROM public.entreprises
   WHERE id = NEW.entreprise_id;

  -- Plan Pro ou pro_offert → aucune limite
  IF v_plan = 'pro' OR v_pro_offert = true THEN
    RETURN NEW;
  END IF;

  -- Compter les techniciens existants
  SELECT COUNT(*) INTO v_count
    FROM public.profiles
   WHERE entreprise_id = NEW.entreprise_id
     AND role = 'technicien';

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'plan_limit_users';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_plan_limit ON public.profiles;
CREATE TRIGGER trg_profiles_plan_limit
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_users_plan_limit();
