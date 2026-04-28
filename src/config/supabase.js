import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── YOUR SUPABASE PROJECT CREDENTIALS ────────────────────────────────────────
// URL:  https://rsxeuflqdwoeohyvrlgp.supabase.co
// KEY:  Project Settings → API → anon public  (the long eyJ... string)
export const SUPABASE_URL = 'https://rsxeuflqdwoeohyvrlgp.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzeGV1ZmxxZHdvZW9oeXZybGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTQwNzEsImV4cCI6MjA5MjkzMDA3MX0.S4H5q5wqhjMj04Ovnalum48UCZTrzGLEon7Xcn2c99c';
// ──────────────────────────────────────────────────────────────────────────────

export const isSupabaseConfigured =
  typeof SUPABASE_ANON_KEY === 'string' &&
  SUPABASE_ANON_KEY.startsWith('eyJ') &&
  SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

let supabaseClient = null;
try {
  if (isSupabaseConfigured) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
} catch (e) {
  console.error('Supabase init failed:', e.message);
}

export const supabase = supabaseClient;
