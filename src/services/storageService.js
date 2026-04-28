import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';
import * as FileSystem from 'expo-file-system';

const BUCKET = 'memorials';

const MIME_MAP = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg',
};

export const storageService = {
  uploadFile: async (fileUri, fileName, folder = 'media') => {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured.' };
    try {
      const ext = fileName.split('.').pop().split('?')[0].toLowerCase();
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
      const path = `${folder}/${fileName}`;

      const isLocalUri =
        fileUri.startsWith('file://') || fileUri.startsWith('content://');

      if (isLocalUri) {
        // Stream local file directly to Supabase — no in-memory buffering, safe for large videos
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token ?? SUPABASE_ANON_KEY;

        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
        const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
          httpMethod: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            'Content-Type': contentType,
            'x-upsert': 'true',
          },
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        });

        if (result.status >= 300) {
          return {
            success: false,
            error: `Upload failed (${result.status}): ${result.body}`,
          };
        }
      } else {
        // Remote URI (e.g. https://) — fetch as blob and upload via Supabase client
        const resp = await fetch(fileUri);
        if (!resp.ok) throw new Error(`fetch status ${resp.status}`);
        const blob = await resp.blob();
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
          upsert: true,
          contentType,
        });
        if (error) return { success: false, error: error.message };
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return { success: true, url: data.publicUrl, path };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getFileURL: async (filePath) => {
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
