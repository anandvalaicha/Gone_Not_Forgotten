import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';
// expo-file-system v19 split the API. The legacy import still exposes the
// classic readAsStringAsync / copyAsync / cacheDirectory / documentDirectory
// helpers used by this app.
import * as FileSystem from 'expo-file-system/legacy';

const BUCKET = 'memorials';

const MIME_MAP = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
  mkv: 'video/x-matroska', m4v: 'video/mp4', '3gp': 'video/3gpp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac',
  wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
};

// ── Convert a base64 string → ArrayBuffer (no Buffer dependency) ────────────
const base64ToArrayBuffer = (base64) => {
  // atob is available in Hermes (RN 0.81) and on web
  const binary = typeof atob === 'function'
    ? atob(base64)
    : global.Buffer
      ? global.Buffer.from(base64, 'base64').toString('binary')
      : '';
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export const storageService = {
  /**
   * Upload a local or remote file to the 'memorials' Supabase Storage bucket.
   *
   * @param fileUri  - Local file URI (file://, content://, ph://) or https:// URL
   * @param fileName - Target filename including extension  e.g. "photos-1234.jpg"
   * @param folder   - Folder within the bucket  e.g. memorialId  → bucket/folder/fileName
   * @returns        { success, url, path } | { success: false, error }
   */
  uploadFile: async (fileUri, fileName, folder = 'media') => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase is not configured.' };
    }
    try {
      const ext = fileName.split('.').pop().split('?')[0].toLowerCase();
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
      const storagePath = `${folder}/${fileName}`;

      const isLocalNativeUri =
        Platform.OS !== 'web' &&
        (fileUri.startsWith('file://') ||
          fileUri.startsWith('content://') ||
          fileUri.startsWith('ph://') ||
          fileUri.startsWith('assets-library://'));

      // ── Native path: read file → base64 → ArrayBuffer → Supabase SDK ──────
      // This is more reliable than FileSystem.uploadAsync because:
      //   1. It works for ph:// and assets-library:// URIs without an extra
      //      MediaLibrary lookup.
      //   2. It avoids blob:http://localhost:8081 URIs that RN's networking
      //      layer refuses with "No suitable URL request handler".
      //   3. It uses the Supabase JS SDK which already attaches the user's
      //      auth token automatically.
      if (isLocalNativeUri) {
        let base64;
        try {
          base64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (readErr) {
          // ph:// sometimes needs to be staged into the cache first.
          try {
            const stagedUri = `${FileSystem.cacheDirectory}staged_${Date.now()}.${ext}`;
            await FileSystem.copyAsync({ from: fileUri, to: stagedUri });
            base64 = await FileSystem.readAsStringAsync(stagedUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (copyErr) {
            return {
              success: false,
              error: `Could not read file: ${readErr.message || copyErr.message}`,
            };
          }
        }

        const arrayBuffer = base64ToArrayBuffer(base64);

        const { error } = await supabase.storage.from(BUCKET).upload(
          storagePath,
          arrayBuffer,
          { upsert: true, contentType },
        );
        if (error) {
          return { success: false, error: error.message };
        }
      } else {
        // ── Web / remote URI path: fetch → blob → Supabase SDK ──────────────
        const resp = await fetch(fileUri);
        if (!resp.ok) {
          throw new Error(`Failed to fetch source file (HTTP ${resp.status})`);
        }
        const blob = await resp.blob();
        const { error } = await supabase.storage.from(BUCKET).upload(
          storagePath,
          blob,
          { upsert: true, contentType },
        );
        if (error) return { success: false, error: error.message };
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      return { success: true, url: data.publicUrl, path: storagePath };
    } catch (error) {
      return { success: false, error: error.message || 'Unknown upload error' };
    }
  },

  getFileURL: (filePath) => {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured.' };
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return { success: true, url: data.publicUrl };
  },

  deleteFile: async (filePath) => {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured.' };
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
};