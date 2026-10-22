-- ==============================================================================
-- SCHOOLFLOW — MIGRATION 002 : RENOUVELLEMENT DE TOUS LES CODES D'ACCÈS DU PERSONNEL
-- ==============================================================================
-- Pourquoi : jusqu'au verrouillage (migration 001), les codes d'accès étaient lisibles par
-- n'importe qui (base ouverte + diffusion publique sur ntfy.sh). Il faut donc considérer
-- TOUS les codes existants comme compromis et en générer de nouveaux.
--
-- À exécuter APRÈS la migration 001. Les notes diverses de chaque membre, rattachées à son
-- code, sont automatiquement réattribuées au nouveau code.
--
-- Après exécution : transmettre à chaque membre son nouveau code (affiché en fin de script,
-- et visible par la Direction dans la page Administration).
-- ==============================================================================

BEGIN;

CREATE TEMP TABLE sf_code_map ON COMMIT DROP AS
SELECT id,
       school_id,
       auth_code AS old_code,
       (CASE role_id
          WHEN 'directeur' THEN 'DIR'
          WHEN 'fondateur' THEN 'FND'
          WHEN 'comptable' THEN 'CPT'
          WHEN 'secretaire' THEN 'SEC'
          WHEN 'enseignant' THEN 'ENS'
          WHEN 'educateur' THEN 'EDU'
          WHEN 'assistant_direction' THEN 'ASD'
          ELSE 'STF'
        END) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)) AS new_code
FROM public.staff_users
WHERE role_id NOT LIKE 'system_%'
  AND role_id <> 'school_stamp';

UPDATE public.staff_users u
SET auth_code = m.new_code
FROM sf_code_map m
WHERE u.id = m.id;

-- Réattribuer les notes diverses (blob JSON) à leur auteur sous son nouveau code
UPDATE public.staff_users n
SET department = (
  SELECT jsonb_agg(
           CASE WHEN m.new_code IS NOT NULL THEN jsonb_set(e.value, '{authorCode}', to_jsonb(m.new_code)) ELSE e.value END
           ORDER BY e.ord
         )::text
  FROM jsonb_array_elements(n.department::jsonb) WITH ORDINALITY AS e(value, ord)
  LEFT JOIN sf_code_map m
    ON m.school_id = n.school_id
   AND upper(m.old_code) = upper(e.value->>'authorCode')
)
WHERE n.role_id = 'system_diverse_notes'
  AND n.department IS NOT NULL
  AND n.department LIKE '[%'
  AND jsonb_array_length(n.department::jsonb) > 0;

COMMIT;

-- Nouveaux codes, par école
SELECT s.slug, u.role_id, u.full_name, u.auth_code
FROM public.staff_users u
JOIN public.schools s ON s.id = u.school_id
WHERE u.role_id NOT LIKE 'system_%' AND u.role_id <> 'school_stamp'
ORDER BY s.slug, u.role_id, u.full_name;
