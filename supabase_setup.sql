-- ============================================================
-- Gone Not Forgotten — Supabase Setup
-- Run this entire file in the Supabase SQL Editor:
--   https://supabase.com/dashboard → your project → SQL Editor
-- ============================================================


-- ── 1. Memorials table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memorials (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  visibility  TEXT        NOT NULL DEFAULT 'public',
  photos      TEXT[]      NOT NULL DEFAULT '{}',
  videos      TEXT[]      NOT NULL DEFAULT '{}',
  audios      TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index so getUserMemorials() is fast
CREATE INDEX IF NOT EXISTS memorials_user_id_idx ON public.memorials (user_id);


-- ── 2. Row Level Security (RLS) for memorials table ──────────
ALTER TABLE public.memorials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "Users can read own memorials"   ON public.memorials;
DROP POLICY IF EXISTS "Users can insert own memorials" ON public.memorials;
DROP POLICY IF EXISTS "Users can update own memorials" ON public.memorials;
DROP POLICY IF EXISTS "Users can delete own memorials" ON public.memorials;

CREATE POLICY "Users can read own memorials"
  ON public.memorials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memorials"
  ON public.memorials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memorials"
  ON public.memorials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memorials"
  ON public.memorials FOR DELETE
  USING (auth.uid() = user_id);


-- ── 3. Storage bucket ─────────────────────────────────────────
-- Create the 'memorials' bucket (public = files readable without auth token)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'memorials',
  'memorials',
  true,
  104857600,   -- 100 MB per file
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
    'video/mp4', 'video/3gpp',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/ogg',
    'audio/flac', 'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ── 4. Storage RLS policies ───────────────────────────────────
-- Note: storage.objects RLS is managed by Supabase internally — no ALTER TABLE needed

-- Drop existing policies before recreating
DROP POLICY IF EXISTS "Anyone can view memorials bucket"          ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload memorials"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update memorials"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete memorials"  ON storage.objects;

-- Public read — anyone (including unauthenticated) can view uploaded media
CREATE POLICY "Anyone can view memorials bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'memorials');

-- Authenticated users can upload new files
CREATE POLICY "Authenticated users can upload memorials"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'memorials'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can overwrite (upsert) their files
CREATE POLICY "Authenticated users can update memorials"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'memorials'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can delete their files
CREATE POLICY "Authenticated users can delete memorials"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'memorials'
    AND auth.role() = 'authenticated'
  );
