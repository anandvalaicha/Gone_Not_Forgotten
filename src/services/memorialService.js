import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../config/supabase';

// ─── AsyncStorage demo-mode helpers ──────────────────────────────────────────
const DEMO_KEY = 'gnf_memorials';

async function demoGetAll() {
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function demoSetAll(items) {
  try { await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(items)); } catch {}
}
// ─────────────────────────────────────────────────────────────────────────────

export const memorialService = {
  createMemorial: async (userId, memorialData) => {
    if (!isSupabaseConfigured) {
      const all = await demoGetAll();
      const item = {
        ...memorialData,
        id: `local-${Date.now()}`,
        user_id: userId,
        created_at: new Date().toISOString(),
        photos: memorialData.photos || [],
        videos: memorialData.videos || [],
        audios: memorialData.audios || [],
      };
      await demoSetAll([item, ...all]);
      return { success: true, id: item.id };
    }
    const { data, error } = await supabase
      .from('memorials')
      .insert({ ...memorialData, user_id: userId })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  },

  getUserMemorials: async (userId) => {
    if (!isSupabaseConfigured) {
      const all = await demoGetAll();
      return { success: true, memorials: all };
    }
    const { data, error } = await supabase
      .from('memorials')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, memorials: data };
  },

  getMemorial: async (memorialId) => {
    if (!isSupabaseConfigured) {
      const all = await demoGetAll();
      const found = all.find((m) => m.id === memorialId);
      return found
        ? { success: true, memorial: found }
        : { success: false, error: 'Memorial not found.' };
    }
    const { data, error } = await supabase
      .from('memorials')
      .select('*')
      .eq('id', memorialId)
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, memorial: data };
  },

  updateMemorial: async (memorialId, updateData) => {
    if (!isSupabaseConfigured) {
      const all = await demoGetAll();
      await demoSetAll(
        all.map((m) => (m.id === memorialId ? { ...m, ...updateData } : m)),
      );
      return { success: true };
    }
    const { error } = await supabase
      .from('memorials')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', memorialId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  appendMedia: async (memorialId, mediaType, mediaUrl) => {
    if (!isSupabaseConfigured) {
      const all = await demoGetAll();
      await demoSetAll(
        all.map((m) => {
          if (m.id !== memorialId) return m;
          const existing = Array.isArray(m[mediaType]) ? m[mediaType] : [];
          return { ...m, [mediaType]: [...existing, mediaUrl] };
        }),
      );
      return { success: true };
    }
    const { data, error: fetchError } = await supabase
      .from('memorials')
      .select(mediaType)
      .eq('id', memorialId)
      .single();
    if (fetchError) return { success: false, error: fetchError.message };
    const existing = Array.isArray(data[mediaType]) ? data[mediaType] : [];
    const { error } = await supabase
      .from('memorials')
      .update({ [mediaType]: [...existing, mediaUrl], updated_at: new Date().toISOString() })
      .eq('id', memorialId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deleteMemorial: async (memorialId) => {
    if (!isSupabaseConfigured) {
      const all = await demoGetAll();
      await demoSetAll(all.filter((m) => m.id !== memorialId));
      return { success: true };
    }
    const { error } = await supabase.from('memorials').delete().eq('id', memorialId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
};
