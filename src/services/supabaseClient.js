import { createClient } from '@supabase/supabase-js';

/**
 * Single shared team database, configured ONLY through build-time env variables
 * on the host where the frontend is deployed:
 *
 *   VITE_SUPABASE_URL=https://your-project.supabase.co
 *   VITE_SUPABASE_ANON_KEY=your-anon-public-key
 */
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const PLACEHOLDERS = ['https://your-project.supabase.co', 'your-anon-public-key'];

export const isSupabaseConfigured =
  Boolean(url && anonKey) && !PLACEHOLDERS.includes(url) && !PLACEHOLDERS.includes(anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,      // keeps the dispatcher signed in across reloads
        autoRefreshToken: true
      },
      realtime: {
        params: { eventsPerSecond: 10 }
      }
    })
  : null;

export function getSupabaseClient() {
  return supabase;
}
