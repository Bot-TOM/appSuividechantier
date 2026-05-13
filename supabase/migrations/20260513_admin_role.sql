-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : rôle admin
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Autoriser 'admin' dans la colonne role (dropper la contrainte CHECK si elle existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%role%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.profiles DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name   = 'profiles'
        AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%role%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('manager', 'technicien', 'admin'));

-- 2. is_manager() inclut désormais admin
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('manager', 'admin')
  )
$$;

-- 3. Passer le compte Tom en admin
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'tom.romandmalaure@icloud.com';
