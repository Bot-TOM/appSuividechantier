-- ============================================================
-- Schéma initial — à appliquer AVANT toutes les autres migrations
-- Généré depuis le projet principal le 01/06/2026
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── entreprises ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entreprises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  logo_url text,
  created_at timestamp with time zone DEFAULT now(),
  plan text DEFAULT 'starter',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_status text,
  pro_offert boolean DEFAULT false
);

-- ── profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  avatar_url text,
  poste text,
  entreprise_id uuid REFERENCES entreprises(id),
  welcome_email_sent boolean DEFAULT false,
  onboarding_done boolean DEFAULT false
);

-- ── access_codes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL,
  status text DEFAULT 'available',
  source text DEFAULT 'manual',
  created_by uuid REFERENCES profiles(id),
  used_by uuid REFERENCES profiles(id),
  used_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- ── chantiers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chantiers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  client_nom text NOT NULL,
  client_adresse text NOT NULL,
  client_telephone text,
  type_installation text DEFAULT 'Résidentiel',
  nb_panneaux integer DEFAULT 0,
  date_prevue date NOT NULL,
  statut text DEFAULT 'en_attente',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  type_contrat text,
  date_fin_prevue date,
  puissance_kwc numeric,
  rapport_commentaire text,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id),
  custom_data jsonb DEFAULT '{}',
  template_id uuid
);

-- ── chantier_techniciens ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS chantier_techniciens (
  chantier_id uuid NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  technicien_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entreprise_id uuid REFERENCES entreprises(id),
  PRIMARY KEY (chantier_id, technicien_id)
);

-- ── etapes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etapes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier_id uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  nom text NOT NULL,
  ordre integer NOT NULL,
  statut text DEFAULT 'non_fait',
  updated_at timestamp with time zone DEFAULT now(),
  consigne text,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  photo_url text,
  postes_autorises text[],
  entreprise_id uuid REFERENCES entreprises(id),
  pourcentage integer DEFAULT 0
);

-- ── etape_photos ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etape_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  etape_id uuid NOT NULL REFERENCES etapes(id) ON DELETE CASCADE,
  chantier_id uuid NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  entreprise_id uuid REFERENCES entreprises(id)
);

-- ── notes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier_id uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  technicien_id uuid REFERENCES profiles(id),
  contenu text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  entreprise_id uuid REFERENCES entreprises(id)
);

-- ── rapports ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rapports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier_id uuid NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  auteur_id uuid NOT NULL REFERENCES profiles(id),
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ── rapport_photos ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rapport_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rapport_id uuid NOT NULL REFERENCES rapports(id) ON DELETE CASCADE,
  chantier_id uuid NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ── anomalies ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomalies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier_id uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  technicien_id uuid REFERENCES profiles(id),
  type text NOT NULL,
  description text NOT NULL,
  gravite text NOT NULL,
  statut text DEFAULT 'ouvert',
  photo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  entreprise_id uuid REFERENCES entreprises(id)
);

-- ── autocontrole ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autocontrole (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier_id uuid NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  technicien_id uuid NOT NULL REFERENCES profiles(id),
  checks jsonb DEFAULT '[]',
  commentaire text,
  signe_le timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ── checklist_materiel ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checklist_materiel (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier_id uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  nom text NOT NULL,
  checked boolean DEFAULT false,
  ordre integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  quantite numeric,
  unite text
);

-- ── documents ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier_id uuid NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  nom text NOT NULL,
  url text NOT NULL,
  taille integer,
  created_at timestamp with time zone DEFAULT now()
);

-- ── notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id uuid REFERENCES profiles(id),
  chantier_id uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  lu boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- ── push_subscriptions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  chat_notif_enabled boolean DEFAULT true,
  anomalie_notif_enabled boolean DEFAULT true,
  rapport_notif_enabled boolean DEFAULT true,
  chantier_notif_enabled boolean DEFAULT true,
  autocontrole_notif_enabled boolean DEFAULT true,
  global_messages_notif_enabled boolean DEFAULT true
);

-- ── messages (chat chantier) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier_id uuid NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  content text,
  file_url text,
  file_name text,
  file_type text,
  reply_to_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  edited_at timestamp with time zone,
  entreprise_id uuid REFERENCES entreprises(id)
);

-- ── message_reactions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ── message_reads ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reads (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  read_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- ── chat_groups ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  is_dm boolean DEFAULT false
);

-- ── chat_group_members ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_group_members (
  group_id uuid NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- ── group_messages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  content text,
  file_url text,
  file_name text,
  file_type text,
  reply_to_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- ── group_message_reactions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS group_message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id)
);

-- ── global_messages ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS global_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id),
  content text,
  file_url text,
  file_name text,
  file_type text,
  reply_to_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  entreprise_id uuid REFERENCES entreprises(id)
);

-- ── global_message_reactions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS global_message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES global_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ── chat_last_seen ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_last_seen (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conv_type text NOT NULL,
  conv_id text NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, conv_type, conv_id)
);

-- ── planning_entries ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planning_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  technicien_id uuid NOT NULL REFERENCES profiles(id),
  date date NOT NULL,
  chantier_id uuid REFERENCES chantiers(id) ON DELETE SET NULL,
  type text DEFAULT 'chantier',
  label text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  entreprise_id uuid REFERENCES entreprises(id)
);

-- ── time_entries ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  technicien_id uuid NOT NULL REFERENCES profiles(id),
  date date NOT NULL,
  heure_arrivee time without time zone,
  heure_depart time without time zone,
  pause_minutes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  chantier_id uuid REFERENCES chantiers(id) ON DELETE SET NULL,
  entreprise_id uuid REFERENCES entreprises(id),
  UNIQUE (technicien_id, date)
);

-- ── bug_reports ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bug_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  entreprise_id uuid REFERENCES entreprises(id),
  page_url text,
  description text NOT NULL,
  severite text DEFAULT 'mineur',
  statut text DEFAULT 'ouvert',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  photo_url text
);

-- ── role_permissions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  poste text NOT NULL,
  permission_key text NOT NULL,
  allowed boolean DEFAULT false,
  PRIMARY KEY (poste, permission_key)
);

-- ── chantier_field_definitions ────────────────────────────────
CREATE TABLE IF NOT EXISTS chantier_field_definitions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id),
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL,
  field_options jsonb,
  section text,
  position integer DEFAULT 0,
  required boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- ── document_templates ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id),
  category text NOT NULL,
  name text NOT NULL,
  description text,
  template_data jsonb DEFAULT '{}',
  is_default boolean DEFAULT false,
  position integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- ── visites_techniques ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visites_techniques (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  technicien_id uuid NOT NULL REFERENCES profiles(id),
  type text NOT NULL,
  statut text DEFAULT 'brouillon',
  client_nom text,
  client_adresse text,
  data jsonb DEFAULT '{}',
  valide_par uuid REFERENCES profiles(id),
  valide_le timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  template_id uuid REFERENCES document_templates(id) ON DELETE SET NULL,
  CONSTRAINT visites_techniques_type_check CHECK (type IN ('btoc', 'btob', 'custom'))
);

-- FK différée : chantiers.vt_id → visites_techniques
ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS vt_id uuid REFERENCES visites_techniques(id) ON DELETE SET NULL;
ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES document_templates(id) ON DELETE SET NULL;

-- ── Fonctions RLS utilitaires ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')) $$;

CREATE OR REPLACE FUNCTION public.my_entreprise_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT entreprise_id FROM profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.has_permission(permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT allowed FROM role_permissions rp
     JOIN profiles p ON p.poste = rp.poste
     WHERE p.id = auth.uid() AND rp.permission_key = has_permission.permission_key),
    false
  )
$$;

-- ── RLS de base ───────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapports ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapport_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_materiel ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantier_techniciens ENABLE ROW LEVEL SECURITY;
ALTER TABLE etape_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE autocontrole ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantier_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visites_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Drop policies si elles existent déjà (idempotent)
DO $$ DECLARE pol record; BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Policies de base (accès à sa propre entreprise)
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (is_admin() OR entreprise_id = my_entreprise_id() OR id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "entreprises_select" ON entreprises FOR SELECT TO authenticated
  USING (is_admin() OR id = my_entreprise_id());

CREATE POLICY "chantiers_select" ON chantiers FOR SELECT TO authenticated
  USING (is_admin() OR entreprise_id = my_entreprise_id());

CREATE POLICY "chantiers_insert" ON chantiers FOR INSERT TO authenticated
  WITH CHECK (is_manager());

CREATE POLICY "chantiers_update" ON chantiers FOR UPDATE TO authenticated
  USING (is_manager());

CREATE POLICY "chantiers_delete" ON chantiers FOR DELETE TO authenticated
  USING (is_manager());

CREATE POLICY "etapes_all" ON etapes FOR ALL TO authenticated
  USING (is_admin() OR entreprise_id = my_entreprise_id())
  WITH CHECK (is_admin() OR entreprise_id = my_entreprise_id());

CREATE POLICY "document_templates_select" ON document_templates FOR SELECT TO authenticated
  USING (is_admin() OR entreprise_id = my_entreprise_id());

CREATE POLICY "document_templates_insert" ON document_templates FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR entreprise_id = my_entreprise_id());

CREATE POLICY "document_templates_update" ON document_templates FOR UPDATE TO authenticated
  USING (is_admin() OR entreprise_id = my_entreprise_id());

CREATE POLICY "document_templates_delete" ON document_templates FOR DELETE TO authenticated
  USING (is_admin() OR entreprise_id = my_entreprise_id());

CREATE POLICY "vt_select_own" ON visites_techniques FOR SELECT TO authenticated
  USING (auth.uid() = technicien_id);

CREATE POLICY "vt_select_manager" ON visites_techniques FOR SELECT TO authenticated
  USING (is_manager());

CREATE POLICY "vt_insert" ON visites_techniques FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = technicien_id OR is_manager());

CREATE POLICY "vt_update_own" ON visites_techniques FOR UPDATE TO authenticated
  USING (auth.uid() = technicien_id AND statut <> 'valide');

CREATE POLICY "vt_update_manager" ON visites_techniques FOR UPDATE TO authenticated
  USING (is_manager());

CREATE POLICY "vt_delete" ON visites_techniques FOR DELETE TO authenticated
  USING (auth.uid() = technicien_id AND statut = 'brouillon');

CREATE POLICY "vt_delete_manager" ON visites_techniques FOR DELETE TO authenticated
  USING (is_manager());

-- Policies permissives pour les autres tables (accès entreprise)
CREATE POLICY "notes_all" ON notes FOR ALL TO authenticated
  USING (is_admin() OR entreprise_id = my_entreprise_id())
  WITH CHECK (is_admin() OR entreprise_id = my_entreprise_id());

CREATE POLICY "anomalies_all" ON anomalies FOR ALL TO authenticated
  USING (is_admin() OR entreprise_id = my_entreprise_id())
  WITH CHECK (is_admin() OR entreprise_id = my_entreprise_id());

CREATE POLICY "rapports_all" ON rapports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rapport_photos_all" ON rapport_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "documents_all" ON documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "checklist_all" ON checklist_materiel FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "chantier_tech_all" ON chantier_techniciens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "etape_photos_all" ON etape_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autocontrole_all" ON autocontrole FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notifications_all" ON notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "push_sub_own" ON push_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "messages_all" ON messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "message_reactions_all" ON message_reactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "message_reads_all" ON message_reads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "planning_all" ON planning_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "time_entries_all" ON time_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "chat_groups_all" ON chat_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "chat_group_members_all" ON chat_group_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "group_messages_all" ON group_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "global_messages_all" ON global_messages FOR ALL TO authenticated USING (is_admin() OR entreprise_id = my_entreprise_id()) WITH CHECK (is_admin() OR entreprise_id = my_entreprise_id());
CREATE POLICY "chantier_field_defs_all" ON chantier_field_definitions FOR ALL TO authenticated USING (is_admin() OR entreprise_id = my_entreprise_id()) WITH CHECK (is_admin() OR entreprise_id = my_entreprise_id());
CREATE POLICY "bug_reports_all" ON bug_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
