-- ═══════════════════════════════════════════════════════════════
-- RESET BASE DE TEST — À lancer avant chaque session Playwright
-- SQL Editor → projet test → Run
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Supprime toutes les données liées à l'entreprise test ──
DELETE FROM etape_photos       WHERE entreprise_id = 'aaaaaaaa-0000-0000-0000-000000000001';
DELETE FROM etapes             WHERE entreprise_id = 'aaaaaaaa-0000-0000-0000-000000000001';
DELETE FROM chantier_techniciens WHERE entreprise_id = 'aaaaaaaa-0000-0000-0000-000000000001';
DELETE FROM notes              WHERE entreprise_id = 'aaaaaaaa-0000-0000-0000-000000000001';
DELETE FROM anomalies          WHERE entreprise_id = 'aaaaaaaa-0000-0000-0000-000000000001';
DELETE FROM rapports           WHERE chantier_id IN (
  SELECT id FROM chantiers WHERE entreprise_id = 'aaaaaaaa-0000-0000-0000-000000000001'
);
DELETE FROM chantiers          WHERE entreprise_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ── 2. Remet les chantiers de seed ────────────────────────────
INSERT INTO chantiers (id, nom, client_nom, client_adresse, client_telephone, type_installation, nb_panneaux, puissance_kwc, date_prevue, statut, entreprise_id)
VALUES
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'Installation Dupont',
    'M. Jean Dupont',
    '12 rue des Lilas, 83000 Toulon',
    '06 12 34 56 78',
    'Résidentiel', 12, 4.8, '2026-06-15', 'en_cours',
    'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'Installation Martin',
    'Mme Sophie Martin',
    '5 avenue du Soleil, 06000 Nice',
    '06 98 76 54 32',
    'Résidentiel', 8, 3.2, '2026-07-01', 'en_attente',
    'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000003',
    'Entrepôt Brun SA',
    'Brun SA',
    'ZI Nord, 13100 Aix-en-Provence',
    '04 42 00 11 22',
    'Industriel', 120, 48.0, '2026-06-20', 'planifie',
    'aaaaaaaa-0000-0000-0000-000000000001'
  );

-- ── 3. Remet les assignations technicien ──────────────────────
INSERT INTO chantier_techniciens (chantier_id, technicien_id, entreprise_id)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'ca7f68b4-60fe-48ee-bbe3-6b34a659f4ff', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'ca7f68b4-60fe-48ee-bbe3-6b34a659f4ff', 'aaaaaaaa-0000-0000-0000-000000000001');

-- ── 4. Remet les étapes ────────────────────────────────────────
INSERT INTO etapes (chantier_id, nom, ordre, statut, entreprise_id)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Pose des rails',      1, 'fait',     'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Pose des panneaux',   2, 'en_cours', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Câblage DC',          3, 'non_fait', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Installation onduleur',4, 'non_fait', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Mise en service',     5, 'non_fait', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Pose des rails',      1, 'non_fait', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Pose des panneaux',   2, 'non_fait', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Câblage DC',          3, 'non_fait', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Mise en service',     4, 'non_fait', 'aaaaaaaa-0000-0000-0000-000000000001');

SELECT
  (SELECT count(*) FROM chantiers  WHERE entreprise_id = 'aaaaaaaa-0000-0000-0000-000000000001') AS chantiers,
  (SELECT count(*) FROM etapes     WHERE entreprise_id = 'aaaaaaaa-0000-0000-0000-000000000001') AS etapes,
  'Reset OK ✅' AS status;
