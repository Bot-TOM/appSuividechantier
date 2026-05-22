CREATE TABLE IF NOT EXISTS public.visites_techniques (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  technicien_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('btoc', 'btob')),
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'complete', 'valide')),
  client_nom text,
  client_adresse text,
  data jsonb NOT NULL DEFAULT '{}',
  valide_par uuid REFERENCES auth.users(id),
  valide_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.visites_techniques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vt_select_own" ON public.visites_techniques FOR SELECT
  USING (auth.uid() = technicien_id);

CREATE POLICY "vt_select_manager" ON public.visites_techniques FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager','admin')));

CREATE POLICY "vt_insert" ON public.visites_techniques FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = technicien_id);

CREATE POLICY "vt_update_own" ON public.visites_techniques FOR UPDATE
  USING (auth.uid() = technicien_id AND statut != 'valide');

CREATE POLICY "vt_update_manager" ON public.visites_techniques FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager','admin')));

CREATE POLICY "vt_delete" ON public.visites_techniques FOR DELETE
  USING (auth.uid() = technicien_id AND statut = 'brouillon');
