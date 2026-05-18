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

  // Save a Plaque QR post (description + media references) keyed by plaqueId.
  savePlaquePost: async (plaqueId, userId, { description, photos, videos, audios }) => {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase is not configured.' };
    const { error } = await supabase.from('plaque_posts').upsert(
      {
        id: plaqueId,
        user_id: userId,
        description: description || null,
        photos: photos || [],
        videos: videos || [],
        audios: audios || [],
      },
      { onConflict: 'id' },
    );
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Fetch a Plaque QR post by its plaqueId (public read).
  getPlaquePost: async (plaqueId) => {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase is not configured.' };
    const { data, error } = await supabase
      .from('plaque_posts')
      .select('*')
      .eq('id', plaqueId)
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, plaquePost: data };
  },

  // Fetch another user's public profile + their memorials for the QR scan view.
  // Always returns success=true so the scanner shows something even if the
  // profiles row doesn't exist yet (user signed up before the profiles table).
  getPublicProfile: async (userId) => {
    if (!isSupabaseConfigured) return { success: false, error: 'Not configured.' };

    const [profileRes, memorialsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase
        .from('memorials')
        .select('id, title, description, photos, videos, audios, created_at')
        .eq('user_id', userId)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false }),
    ]);

    // Log errors to help diagnose DB/RLS issues
    if (profileRes.error) console.warn('[getPublicProfile] profiles error:', profileRes.error.message);
    if (memorialsRes.error) console.warn('[getPublicProfile] memorials error:', memorialsRes.error.message);

    // Profile row is optional — we can still show memorials without it
    const p = profileRes.data || {};
    return {
      success: true,
      profile: {
        userId,
        displayName:
          p.display_name ||
          [p.first_name, p.last_name].filter(Boolean).join(' ') ||
          'User',
        bio:       p.bio        || '',
        photoURL:  p.photo_url  || null,
        birthYear: p.birth_year || '',
        deathYear: p.death_year || '',
        memorials: (memorialsRes.data || []).map((m) => ({
          id:          m.id,
          title:       m.title,
          description: m.description,
          createdAt:   new Date(m.created_at),
          photos:      m.photos || [],
          videos:      m.videos || [],
          audios:      m.audios || [],
        })),
      },
    };
  },
};
