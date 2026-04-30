import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured, SUPABASE_URL } from '../config/supabase';

// Normalize Supabase user shape to match app's expected format
const normalizeUser = (supabaseUser) => {
  if (!supabaseUser) return null;
  const meta = supabaseUser.user_metadata || {};
  return {
    id: supabaseUser.id,
    uid: supabaseUser.id,
    email: supabaseUser.email,
    displayName:
      meta.display_name ||
      meta.full_name ||
      (meta.first_name ? `${meta.first_name} ${meta.last_name || ''}`.trim() : null) ||
      supabaseUser.email?.split('@')[0]?.replace(/[._]/g, ' ') ||
      'User',
    firstName: meta.first_name || '',
    lastName: meta.last_name || '',
    phone: meta.phone || '',
    age: meta.age || '',
    gender: meta.gender || '',
    bio: meta.bio || '',
    birthYear: meta.birth_year || '',
    deathYear: meta.death_year || '',
    photoURL: meta.photo_url || meta.avatar_url || null,
  };
};

// Module-level cache so getCurrentUser() can stay synchronous
let currentUser = null;

// Write public profile fields to the `profiles` table so other users can read them
const syncProfile = async (userId, meta) => {
  if (!isSupabaseConfigured || !userId) return;
  await supabase.from('profiles').upsert(
    {
      id: userId,
      display_name: meta.display_name || null,
      first_name:   meta.first_name  || null,
      last_name:    meta.last_name   || null,
      bio:          meta.bio         || null,
      photo_url:    meta.photo_url   || meta.avatar_url || null,
      age:          meta.age         || null,
      gender:       meta.gender      || null,
      updated_at:   new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
};

export const authService = {
  signUp: async (email, password, profile = {}) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase is not configured.' };
    }
    const meta = {};
    if (profile.firstName) meta.first_name = profile.firstName;
    if (profile.lastName)  meta.last_name  = profile.lastName;
    if (profile.firstName || profile.lastName)
      meta.display_name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    if (profile.phone)  meta.phone  = profile.phone;
    if (profile.age)    meta.age    = profile.age;
    if (profile.gender) meta.gender = profile.gender;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: meta },
    });
    if (error) return { success: false, error: error.message };
    const user = normalizeUser(data.user);
    currentUser = user;
    // Sync public profile so the user is discoverable via QR scan
    if (data.user?.id) syncProfile(data.user.id, meta);
    return { success: true, user };
  },

  signIn: async (email, password) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase is not configured.' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { success: false, error: error.message };
    const user = normalizeUser(data.user);
    currentUser = user;
    return { success: true, user };
  },

  signInWithGoogle: async () => {
    return {
      success: false,
      error: 'Google sign-in requires native OAuth setup with Supabase.',
    };
  },

  signOutUser: async () => {
    if (!isSupabaseConfigured) {
      currentUser = null;
      return { success: true };
    }

    // ── Step 1: Remove the auth token key directly (exact key from storage) ──
    const AUTH_STORAGE_KEY = 'sb-rsxeuflqdwoeohyvrlgp-auth-token';
    try {
      const before = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      console.log('[SignOut] token key exists before removal:', before !== null);
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      const after = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      console.log('[SignOut] token key exists after removal:', after !== null);
    } catch (e) {
      console.warn('[SignOut] AsyncStorage.removeItem failed:', e);
    }

    // ── Step 2: Sweep any other sb- / supabase keys just in case ─────────────
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('[SignOut] all storage keys:', allKeys);
      const supabaseKeys = allKeys.filter(
        (k) => k.startsWith('sb-') || k.toLowerCase().includes('supabase'),
      );
      if (supabaseKeys.length > 0) {
        console.log('[SignOut] removing extra keys:', supabaseKeys);
        await AsyncStorage.multiRemove(supabaseKeys);
      }
    } catch (e) {
      console.warn('[SignOut] sweep error:', e);
    }

    // ── Step 3: Tell the Supabase client to sign out locally ─────────────────
    try {
      console.log('[SignOut] calling supabase.auth.signOut({ scope: local })');
      await supabase.auth.signOut({ scope: 'local' });
      console.log('[SignOut] supabase.auth.signOut completed');
    } catch (e) {
      console.warn('[SignOut] supabase.auth.signOut error (non-fatal):', e);
    }

    currentUser = null;
    console.log('[SignOut] done — currentUser cleared');
    return { success: true };
  },

  updateUserProfile: async (data) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase is not configured.' };
    }
    const metaUpdate = {};
    if (data.firstName !== undefined) metaUpdate.first_name = data.firstName;
    if (data.lastName !== undefined)  metaUpdate.last_name  = data.lastName;
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const first = data.firstName ?? (currentUser?.firstName || '');
      const last  = data.lastName  ?? (currentUser?.lastName  || '');
      metaUpdate.display_name = `${first} ${last}`.trim() || data.displayName || currentUser?.displayName || '';
    } else if (data.displayName !== undefined) {
      metaUpdate.display_name = data.displayName;
    }
    if (data.phone     !== undefined) metaUpdate.phone      = data.phone;
    if (data.age       !== undefined) metaUpdate.age        = data.age;
    if (data.gender    !== undefined) metaUpdate.gender     = data.gender;
    if (data.photoURL  !== undefined) metaUpdate.photo_url  = data.photoURL;
    if (data.bio       !== undefined) metaUpdate.bio        = data.bio;
    if (data.birthYear !== undefined) metaUpdate.birth_year = data.birthYear;
    if (data.deathYear !== undefined) metaUpdate.death_year = data.deathYear;

    const updatePayload = { data: metaUpdate };
    if (data.email !== undefined) updatePayload.email = data.email;

    const { data: updated, error } = await supabase.auth.updateUser(updatePayload);
    if (error) return { success: false, error: error.message };
    const user = normalizeUser(updated.user);
    currentUser = user;
    // Keep public profile in sync
    if (updated.user?.id) syncProfile(updated.user.id, updated.user.user_metadata || {});
    return { success: true, user };
  },

  resetPassword: async (email, redirectTo) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase is not configured.' };
    }
    const opts = redirectTo ? { redirectTo } : {};
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), opts);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  changePassword: async (newPassword) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase is not configured.' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  onAuthStateChange: (callback) => {
    if (!isSupabaseConfigured) {
      callback(null);
      return () => {};
    }
    // Fire immediately with existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = normalizeUser(session?.user ?? null);
      currentUser = user;
      callback(user);
    });
    // Subscribe to future changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = normalizeUser(session?.user ?? null);
      currentUser = user;
      callback(user);
    });
    return () => subscription.unsubscribe();
  },

  getCurrentUser: () => currentUser,
};
