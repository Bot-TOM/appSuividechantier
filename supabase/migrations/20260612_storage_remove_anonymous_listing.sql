-- Bloque le listage ANONYME des buckets de stockage (risque RGPD signalé par
-- le Security Advisor). L'app n'utilise que getPublicUrl (accès direct fichier,
-- qui ne passe pas par ces policies) : aucun impact sur l'affichage.
--
-- ⚠️ Le client Supabase Storage exige SELECT en plus de DELETE pour .remove(),
-- et SELECT pour .upload(upsert:true) : on conserve donc SELECT pour les
-- utilisateurs CONNECTÉS sur les buckets où l'app supprime/écrase des fichiers
-- (documents, rapport-photos, chantier-photos, avatars).

-- 1) Suppression de toutes les policies SELECT larges (dont celles ouvertes au public/anonyme)
DROP POLICY IF EXISTS "Read documents" ON storage.objects;
DROP POLICY IF EXISTS "Read rapport-photos" ON storage.objects;
DROP POLICY IF EXISTS "allow_read" ON storage.objects;
DROP POLICY IF EXISTS "anomalies_select_public" ON storage.objects;
DROP POLICY IF EXISTS "bug_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_select" ON storage.objects;
DROP POLICY IF EXISTS "public_read_chantier_photos" ON storage.objects;
DROP POLICY IF EXISTS "public_read_documents" ON storage.objects;
DROP POLICY IF EXISTS "read avatars" ON storage.objects;
DROP POLICY IF EXISTS "vt_photos_select" ON storage.objects;

-- 2) La policy ALL sur chantier-photos incluait SELECT (listing) : remplacée
--    par INSERT + DELETE uniquement.
DROP POLICY IF EXISTS "authenticated_full_access_chantier_photos" ON storage.objects;
CREATE POLICY "chantier_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chantier-photos');
CREATE POLICY "chantier_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chantier-photos');

-- 3) Rétablissement du SELECT pour utilisateurs connectés uniquement,
--    là où l'app en a besoin (remove/upsert).
CREATE POLICY "documents_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "rapport_photos_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rapport-photos');

CREATE POLICY "chantier_photos_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chantier-photos');

CREATE POLICY "avatars_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
