import { createClient } from '@supabase/supabase-js';

// Load Supabase configuration from environment variables (Vite uses import.meta.env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-public-key')
);

// Initialize Supabase Client
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

export type OAuthProvider = 'google' | 'apple' | 'github';

/**
 * Initiates Social OAuth Authentication (Google, Apple, GitHub)
 * Works seamlessly in Browser on Vercel and inside Capacitor Mobile APK.
 */
export async function signInWithSocialOAuth(provider: OAuthProvider) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase is not configured yet. Returning demo response.');
    return { data: null, error: new Error('Supabase credentials not configured in .env') };
  }

  const redirectUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
    },
  });

  return { data, error };
}

/**
 * Sign Out helper
 */
export async function signOutUser() {
  if (!isSupabaseConfigured) {
    return { error: null };
  }
  return supabase.auth.signOut();
}
