-- Table des permissions par poste
CREATE TABLE IF NOT EXISTS role_permissions (
  poste         text NOT NULL,
  permission_key text NOT NULL,
  allowed       boolean NOT NULL DEFAULT false,
  PRIMARY KEY (poste, permission_key)
);

-- RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_permissions" ON role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers_write_permissions" ON role_permissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- Valeurs par défaut selon la matrice définie
INSERT INTO role_permissions (poste, permission_key, allowed) VALUES
  -- Technicien : accès terrain uniquement
  ('Technicien', 'voir_tous_chantiers',      false),
  ('Technicien', 'creer_chantier',           false),
  ('Technicien', 'modifier_chantier',        false),
  ('Technicien', 'assigner_techniciens',     false),
  ('Technicien', 'resoudre_anomalie',        false),
  ('Technicien', 'ajouter_document',         false),
  ('Technicien', 'supprimer_message_autres', false),
  ('Technicien', 'voir_rapports',            false),
  ('Technicien', 'exporter_pdf',             false),

  -- Chef d''équipe : peut résoudre anomalies et ajouter docs
  ('Chef d''équipe', 'voir_tous_chantiers',      false),
  ('Chef d''équipe', 'creer_chantier',           false),
  ('Chef d''équipe', 'modifier_chantier',        false),
  ('Chef d''équipe', 'assigner_techniciens',     false),
  ('Chef d''équipe', 'resoudre_anomalie',        true),
  ('Chef d''équipe', 'ajouter_document',         true),
  ('Chef d''équipe', 'supprimer_message_autres', false),
  ('Chef d''équipe', 'voir_rapports',            false),
  ('Chef d''équipe', 'exporter_pdf',             false),

  -- Chef de chantier : accès élargi, voit tout
  ('Chef de chantier', 'voir_tous_chantiers',      true),
  ('Chef de chantier', 'creer_chantier',           false),
  ('Chef de chantier', 'modifier_chantier',        true),
  ('Chef de chantier', 'assigner_techniciens',     false),
  ('Chef de chantier', 'resoudre_anomalie',        true),
  ('Chef de chantier', 'ajouter_document',         true),
  ('Chef de chantier', 'supprimer_message_autres', true),
  ('Chef de chantier', 'voir_rapports',            true),
  ('Chef de chantier', 'exporter_pdf',             true),

  -- Conducteur de travaux : quasi-manager
  ('Conducteur de travaux', 'voir_tous_chantiers',      true),
  ('Conducteur de travaux', 'creer_chantier',           true),
  ('Conducteur de travaux', 'modifier_chantier',        true),
  ('Conducteur de travaux', 'assigner_techniciens',     true),
  ('Conducteur de travaux', 'resoudre_anomalie',        true),
  ('Conducteur de travaux', 'ajouter_document',         true),
  ('Conducteur de travaux', 'supprimer_message_autres', true),
  ('Conducteur de travaux', 'voir_rapports',            true),
  ('Conducteur de travaux', 'exporter_pdf',             true)
ON CONFLICT (poste, permission_key) DO NOTHING;
