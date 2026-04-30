import { supabase, isSupabaseConfigured } from '../config/supabase';

export const memorialService = {
  createMemorial: async (userId, memorialData) => {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase is not configured.' };
    const { data, error } = await supabase
      .from('memorials')
      .insert({ ...memorialData, user_id: userId })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  },

  getUserMemorials: async (userId) => {
    if (!isSupabaseConfigured) return { success: true, memorials: [] };
    const { data, error } = await supabase
      .from('memorials')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, memorials: data };
  },

  getMemorial: async (memorialId) => {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase is not configured.' };
    const { data, error } = await supabase
      .from('memorials')
      .select('*')
      .eq('id', memorialId)
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, memorial: data };
  },

  updateMemorial: async (memorialId, updateData) => {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase is not configured.' };
    const { error } = await supabase
      .from('memorials')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', memorialId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  appendMedia: async (memorialId, mediaType, mediaUrl) => {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase is not configured.' };
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
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase is not configured.' };
    const { error } = await supabase.from('memorials').delete().eq('id', memorialId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Fetch another user's public profile + their memorials for the QR scan view
  getPublicProfile: async (userId) => {
    if (!isSupabaseConfigured) return { success: false, error: 'Not configured.' };

    const [profileRes, memorialsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase
        .from('memorials')
        .select('id, title, description, photos, videos, audios, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    if (profileRes.error && !profileRes.data) {
      return { success: false, error: profileRes.error.message };
    }

    const p = profileRes.data || {};
    return {
      success: true,
      profile: {
        userId,
        displayName:
          p.display_name ||
          [p.first_name, p.last_name].filter(Boolean).join(' ') ||
          'Unknown User',
        bio:      p.bio      || '',
        photoURL: p.photo_url || null,
        memorials: (memorialsRes.data || []).map((m) => ({
          id:          m.id,
          title:       m.title,
          description: m.description,
          createdAt:   new Date(m.created_at),
          photos:      m.photos  || [],
          videos:      m.videos  || [],
          audios:      m.audios  || [],
        })),
      },
    };
  },
};
