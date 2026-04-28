import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured, SUPABASE_URL } from '../config/supabase';

const DEMO_USER = {
  id: 'demo-user-001',
  uid: 'demo-user-001',
  email: 'demo@gonenotforgotten.com',
  displayName: 'Demo User',
};

let demoSessionUser = null;
const demoAuthListeners = new Set();

const notifyDemoAuthListeners = () => {
  demoAuthListeners.forEach((listener) => listener(demoSessionUser));
};

// Normalize Supabase user shape to match app's expected format
const normalizeUser = (supabaseUser) => {
  if (!supabaseUser) return null;
  return {
    id: supabaseUser.id,
    uid: supabaseUser.id,
    email: supabaseUser.email,
    displayName:
      supabaseUser.user_metadata?.display_name ||
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.email?.split('@')[0]?.replace(/[._]/g, ' ') ||
      'User',
  };
};

// Module-level cache so getCurrentUser() can stay synchronous
let currentUser = null;

export const authService = {
  signUp: async (email, password) => {
    if (!isSupabaseConfigured) {
      if (
        email.trim().toLowerCase() === DEMO_USER.email &&
        password === 'Demo@1234'
      ) {
        demoSessionUser = DEMO_USER;
        currentUser = DEMO_USER;
        notifyDemoAuthListeners();
        return { success: true, user: DEMO_USER, demo: true };
      }
      return {
        success: false,
        error: 'Supabase is not configured yet.\n\nTemporary demo login:\nEmail: demo@gonenotforgotten.com\nPassword: Demo@1234',
      };
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { success: false, error: error.message };
    const user = normalizeUser(data.user);
    currentUser = user;
    return { success: true, user };
  },

  signIn: async (email, password) => {
    if (!isSupabaseConfigured) {
      if (
        email.trim().toLowerCase() === DEMO_USER.email &&
        password === 'Demo@1234'
      ) {
        demoSessionUser = DEMO_USER;
        currentUser = DEMO_USER;
        notifyDemoAuthListeners();
        return { success: true, user: DEMO_USER, demo: true };
      }
      return {
        success: false,
        error: 'Use the temporary demo login:\nEmail: demo@gonenotforgotten.com\nPassword: Demo@1234',
      };
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
      demoSessionUser = null;
      currentUser = null;
      notifyDemoAuthListeners();
      return { success: true };
    }

    // ── Step 1: Remove the auth token key directly (exact key from storage) ──
    const AUTH_STORAGE_KEY = 'sb-usphkmetleulwsrqcijc-auth-token';
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
      if (!demoSessionUser) return { success: false, error: 'Not signed in.' };
      demoSessionUser = { ...demoSessionUser, ...data };
      currentUser = demoSessionUser;
      notifyDemoAuthListeners();
      return { success: true, user: demoSessionUser };
    }
    const { data: updated, error } = await supabase.auth.updateUser({
      data: {
        display_name: data.displayName,
        photo_url: data.photoURL,
      },
    });
    if (error) return { success: false, error: error.message };
    const user = normalizeUser(updated.user);
    currentUser = user;
    return { success: true, user };
  },

  onAuthStateChange: (callback) => {
    if (!isSupabaseConfigured) {
      demoAuthListeners.add(callback);
      callback(demoSessionUser);
      return () => demoAuthListeners.delete(callback);
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
