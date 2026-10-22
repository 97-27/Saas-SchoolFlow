import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase SERVEUR (clé service_role). C'est le seul client autorisé à lire et écrire les
 * tables une fois les politiques RLS verrouillées (voir migrations/001_security_lockdown.sql) :
 * il ne doit JAMAIS être importé par un composant 'use client'. Les composants navigateur
 * passent par lib/supabase/remote.ts, qui appelle les routes API protégées par session.
 */
if (typeof window !== 'undefined') {
  throw new Error('lib/supabase/admin.ts ne doit jamais être chargé dans le navigateur.');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ztraizfnpmxibsxlnlpz.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  // Repli transitoire sur la clé publique, uniquement tant que les politiques RLS ouvertes
  // existent encore : après application du verrouillage, toute lecture/écriture échouera.
  console.error(
    '[SchoolFlow] SUPABASE_SERVICE_ROLE_KEY absente : configurez-la dans .env.local et sur Vercel avant de verrouiller la base.'
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_wasAtS8ITrbdcLvY2L3D7g_mF6XAuRu',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
      },
    },
  }
);
