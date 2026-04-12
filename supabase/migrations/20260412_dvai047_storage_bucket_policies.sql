-- DVAI-047: Storage bucket policies nelle migrazioni SQL.
-- Definisce bucket, policy di accesso, validazione file type/size.
-- Prima di eseguire: assicurarsi che l'extension storage sia abilitata.

-- ─── BUCKET: tour-media ───────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'tour-media',
    'tour-media',
    true,           -- pubblico per lettura
    10485760,       -- 10 MB max
    ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── BUCKET: business-media ───────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'business-media',
    'business-media',
    true,
    10485760,       -- 10 MB max
    ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── BUCKET: user-avatars ─────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-avatars',
    'user-avatars',
    true,
    2097152,        -- 2 MB max
    ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── POLICIES: tour-media ─────────────────────────────────────────────────────

-- Lettura pubblica
DROP POLICY IF EXISTS "tour_media_public_read"   ON storage.objects;
CREATE POLICY "tour_media_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'tour-media');

-- Upload solo da guide autenticate
DROP POLICY IF EXISTS "tour_media_guide_insert"  ON storage.objects;
CREATE POLICY "tour_media_guide_insert"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'tour-media'
        AND auth.uid() IS NOT NULL
        -- Il path deve iniziare con l'UID dell'utente
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Modifica/cancellazione solo dal proprietario
DROP POLICY IF EXISTS "tour_media_owner_update"  ON storage.objects;
CREATE POLICY "tour_media_owner_update"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'tour-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "tour_media_owner_delete"  ON storage.objects;
CREATE POLICY "tour_media_owner_delete"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'tour-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─── POLICIES: business-media ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "business_media_public_read"  ON storage.objects;
CREATE POLICY "business_media_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'business-media');

DROP POLICY IF EXISTS "business_media_owner_insert" ON storage.objects;
CREATE POLICY "business_media_owner_insert"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'business-media'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "business_media_owner_update" ON storage.objects;
CREATE POLICY "business_media_owner_update"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'business-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "business_media_owner_delete" ON storage.objects;
CREATE POLICY "business_media_owner_delete"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'business-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─── POLICIES: user-avatars ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "avatars_public_read"   ON storage.objects;
CREATE POLICY "avatars_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'user-avatars');

DROP POLICY IF EXISTS "avatars_owner_insert"  ON storage.objects;
CREATE POLICY "avatars_owner_insert"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'user-avatars'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "avatars_owner_update"  ON storage.objects;
CREATE POLICY "avatars_owner_update"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_delete"  ON storage.objects;
CREATE POLICY "avatars_owner_delete"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
