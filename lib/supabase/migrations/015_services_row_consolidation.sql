-- ==============================================================================
-- 015 — Regroupement des lignes techniques « system_services_data »
-- ------------------------------------------------------------------------------
-- Pourquoi : certaines écoles ont plusieurs lignes techniques (role_id = system_services_data).
-- La place limite de l'internat (et d'autres réglages) était écrite dans une ligne et relue dans
-- une autre : elle semblait disparaître puis réapparaître.
--
-- Ce script copie, pour chaque école, toutes les valeurs de ces lignes dans la ligne canonique
-- (auth_code = 'SYS-SRV-DATA', celle où l'application écrit). Les lignes en trop NE SONT PAS
-- supprimées : c'est volontaire, aucune donnée n'est perdue. Le script est idempotent.
-- À exécuter APRÈS la migration 009.
-- ==============================================================================

DO $$
DECLARE
  s record;
  rw record;
  merged jsonb;
BEGIN
  FOR s IN
    SELECT DISTINCT school_id FROM public.staff_users WHERE role_id = 'system_services_data'
  LOOP
    merged := '{}'::jsonb;
    -- Lignes anciennes d'abord, la plus récente ensuite (elle l'emporte en cas de conflit).
    FOR rw IN
      SELECT department, auth_code FROM public.staff_users
      WHERE school_id = s.school_id AND role_id = 'system_services_data'
      ORDER BY (auth_code = 'SYS-SRV-DATA') ASC, created_at ASC
    LOOP
      BEGIN
        merged := merged || COALESCE(NULLIF(rw.department, '')::jsonb, '{}'::jsonb);
      EXCEPTION WHEN others THEN
        NULL; -- ligne illisible : ignorée, les autres sont conservées
      END;
    END LOOP;

    -- Écriture dans la ligne canonique (créée si besoin, grâce à la contrainte d'unicité).
    INSERT INTO public.staff_users (school_id, role_id, role_title, full_name, auth_code, department, is_active)
    VALUES (s.school_id, 'system_services_data', 'Services Data Sync', 'SYSTEM SERVICES SYNC', 'SYS-SRV-DATA', merged::text, true)
    ON CONFLICT (school_id, auth_code) DO UPDATE
      SET department = merged::text;
  END LOOP;
END $$;

-- Vérification : une seule ligne canonique par école, avec la place limite si elle existe.
SELECT s.school_id,
       (s.department::jsonb ->> 'boardingCapacity') AS place_limite_internat
FROM public.staff_users s
WHERE s.role_id = 'system_services_data' AND s.auth_code = 'SYS-SRV-DATA';
