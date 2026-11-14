-- 015 : regroupement des lignes techniques system_services_data (sans suppression)
-- A executer apres la migration 009. Idempotent.

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
    FOR rw IN
      SELECT department, auth_code FROM public.staff_users
      WHERE school_id = s.school_id AND role_id = 'system_services_data'
      ORDER BY (auth_code = 'SYS-SRV-DATA') ASC, created_at ASC
    LOOP
      BEGIN
        merged := merged || COALESCE(NULLIF(rw.department, '')::jsonb, '{}'::jsonb);
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END LOOP;

    INSERT INTO public.staff_users (school_id, role_id, role_title, full_name, auth_code, department, is_active)
    VALUES (s.school_id, 'system_services_data', 'Services Data Sync', 'SYSTEM SERVICES SYNC', 'SYS-SRV-DATA', merged::text, true)
    ON CONFLICT (school_id, auth_code) DO UPDATE
      SET department = merged::text;
  END LOOP;
END $$;

SELECT s.school_id, (s.department::jsonb ->> 'boardingCapacity') AS place_limite_internat
FROM public.staff_users s
WHERE s.role_id = 'system_services_data' AND s.auth_code = 'SYS-SRV-DATA';
