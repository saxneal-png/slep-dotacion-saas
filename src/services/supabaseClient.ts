import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rvvyjfgiwalqsdtpidxz.supabase.co';

// Clave pública anónima (Legacy JWT y nueva Publishable Key de Supabase)
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dnlqZmdpd2FscXNkdHBpZHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyODIxMDgsImV4cCI6MjEwODg1ODEwOH0.pOmloOsCiuvio12ypVnQYfI_SnqBbCRpAEnFmoEQw9M';

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable__Zg2jncC_unufwdJIIiEPg_mp40vyPM';

// Cliente principal Supabase (Navegador, React y Electron Renderer)
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export function isSupabaseEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof process !== 'undefined' && (process.env as any)?.VITEST) return false;
  return Boolean(SUPABASE_URL && (SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY));
}
