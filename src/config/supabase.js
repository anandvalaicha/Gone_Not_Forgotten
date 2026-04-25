import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── YOUR SUPABASE PROJECT CREDENTIALS ────────────────────────────────────────
// URL:  https://usphkmetleulwsrqcijc.supabase.co
// KEY:  Project Settings → API → anon public  (the long eyJ... string)
export const SUPABASE_URL = 'https://usphkmetleulwsrqcijc.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzcGhrbWV0bGV1bHdzcnFjaWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDM3NDEsImV4cCI6MjA5MTcxOTc0MX0.qTJIwasA1yIw7m62EFt2x7sQqVYj86j-TUgwFCOTcvw'; // ← paste your anon key here
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
