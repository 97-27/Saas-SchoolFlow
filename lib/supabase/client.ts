import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ztraizfnpmxibsxlnlpz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_wasAtS8ITrbdcLvY2L3D7g_mF6XAuRu';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder')
);

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
      },
    },
  }
);
