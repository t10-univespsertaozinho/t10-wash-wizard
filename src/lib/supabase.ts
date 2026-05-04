import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Inicializa a configuração lendo do localStorage ou do .env
export function getSupabaseConfig(): SupabaseConfig {
  return {
    url: localStorage.getItem('t10_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: localStorage.getItem('t10_supabase_anonKey') || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  };
}

export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    throw new Error('Supabase configuration missing');
  }

  supabaseInstance = createClient(config.url, config.anonKey);
  return supabaseInstance;
}
