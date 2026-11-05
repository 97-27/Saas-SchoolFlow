-- ==============================================================================
-- SCHOOLFLOW — MIGRATION 009 : ÉCRITURE ATOMIQUE DES DONNÉES SERVICES (INTERNAT/CANTINE/TRANSPORT)
-- ==============================================================================
-- Pourquoi : la sauvegarde de la ligne technique "system_services_data" (qui garde entre
-- autres la place limite de l'internat) se faisait en deux temps côté application : lire la
-- ligne existante, PUIS décider s'il fallait l'ajouter ou la modifier. Si deux appareils
-- sauvegardent presque en même temps (ex: un qui modifie l'internat pendant qu'un autre
-- actualise le tableau de bord), les deux peuvent lire "rien n'existe encore" avant que l'un
-- des deux n'ait fini d'écrire — la seconde écriture échoue alors silencieusement (contrainte
-- uq_staff_school_code de la migration 003) ou, si cette contrainte n'a pas encore été
-- exécutée, crée une deuxième ligne technique : selon celle que l'application relit ensuite,
-- la place limite de l'internat (ou une autre donnée de ce bloc) semble avoir disparu.
--
-- Cette migration déplace la lecture + fusion + écriture dans une seule fonction côté base de
-- données (donc une seule opération indivisible), au lieu de deux allers-retours séparés
-- depuis l'application.
--
-- À exécuter APRÈS la migration 003 (uq_staff_school_code doit déjà exister).
-- Script idempotent : il peut être relancé sans danger.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.upsert_services_data(p_school_id uuid, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.staff_users (school_id, role_id, role_title, full_name, auth_code, department, is_active)
  VALUES (p_school_id, 'system_services_data', 'Services Data Sync', 'SYSTEM SERVICES SYNC', 'SYS-SRV-DATA', p_patch::text, true)
  ON CONFLICT (school_id, auth_code) DO UPDATE
    SET department = (
      COALESCE(NULLIF(public.staff_users.department, '')::jsonb, '{}'::jsonb) || p_patch
    )::text;
END;
$$;

-- Vérification
SELECT proname FROM pg_proc WHERE proname = 'upsert_services_data';
