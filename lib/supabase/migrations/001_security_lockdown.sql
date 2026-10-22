-- ==============================================================================
-- SCHOOLFLOW — MIGRATION 001 : VERROUILLAGE DE SÉCURITÉ DE LA BASE
-- ==============================================================================
-- ⚠️ À EXÉCUTER UNIQUEMENT APRÈS avoir déployé la nouvelle version du site ET configuré
--    SUPABASE_SERVICE_ROLE_KEY + SESSION_SECRET sur Vercel. Sinon le site ne pourra plus
--    lire ni écrire ses données.
--
-- Avant : chaque table avait la politique « FOR ALL USING (true) » : n'importe qui possédant
-- la clé publique (visible dans le navigateur de tout visiteur) pouvait lire, modifier ou
-- supprimer les données de TOUTES les écoles, y compris les codes d'accès du personnel.
--
-- Après : RLS actif sans aucune politique pour anon/authenticated = aucun accès direct.
-- Seul le serveur SchoolFlow (clé service_role, qui contourne RLS) accède aux données, après
-- avoir vérifié la session et le rôle de l'utilisateur.
--
-- Script idempotent : il peut être relancé sans danger.
-- ==============================================================================

-- 1. Supprimer TOUTES les politiques existantes sur les tables du schéma public
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 2. Activer RLS sur toutes les tables du schéma public (sans politique = accès refusé)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- 3. Défense en profondeur : retirer les privilèges directs des rôles publics
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- 4. Stockage : plus aucune écriture publique. Les buckets publics restent lisibles par leur
--    URL (logos, photos), mais seul le serveur peut téléverser (route /api/upload).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Realtime : les tables ne sont plus diffusées (le site n'utilise plus que des signaux
--    sans données, puis relit les données via le serveur).
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['schools', 'staff_users', 'students', 'invoices'] LOOP
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END IF;
END $$;

-- 6. Plus de codes génériques « FND-2026 / DIR-2026 » : chaque école sans fiche Directeur
--    ou Fondateur en reçoit une, avec un code aléatoire unique.
INSERT INTO public.staff_users (school_id, full_name, role_id, role_title, auth_code, is_active)
SELECT s.id,
       COALESCE(NULLIF(s.director_name, ''), 'Directeur'),
       'directeur',
       'Contrôle',
       'DIR-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)),
       true
FROM public.schools s
WHERE NOT EXISTS (
  SELECT 1 FROM public.staff_users u WHERE u.school_id = s.id AND u.role_id = 'directeur'
);

INSERT INTO public.staff_users (school_id, full_name, role_id, role_title, auth_code, is_active)
SELECT s.id,
       COALESCE(NULLIF(s.founder_name, ''), NULLIF(s.director_name, ''), 'Fondateur'),
       'fondateur',
       'Contrôle Total',
       'FND-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)),
       true
FROM public.schools s
WHERE NOT EXISTS (
  SELECT 1 FROM public.staff_users u WHERE u.school_id = s.id AND u.role_id = 'fondateur'
);

-- 7. Afficher les codes Directeur / Fondateur de chaque école (à noter et à transmettre
--    en main propre aux personnes concernées).
SELECT s.slug, s.name, u.role_id, u.full_name, u.auth_code
FROM public.staff_users u
JOIN public.schools s ON s.id = u.school_id
WHERE u.role_id IN ('fondateur', 'directeur')
ORDER BY s.slug, u.role_id;
