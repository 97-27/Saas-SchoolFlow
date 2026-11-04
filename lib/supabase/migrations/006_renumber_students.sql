-- ═══════════════════════════════════════════════════════════════════════
-- 006 — NUMÉROTATION SANS TROU DES ÉLÈVES (choix de l'établissement, 04/11/2026)
-- Après chaque suppression, les élèves suivants reculent d'un numéro : ID-001,
-- ID-002… sans trou. Les reçus de chaque élève renuméroté suivent son nouveau
-- numéro (ID-046 → ID-045, QUI-INT-046 → QUI-INT-045, REC-2026-046 → REC-2026-045).
-- Seule la BASE numérote : l'application appelle cette fonction après chaque
-- suppression d'élève. Ce script crée la fonction puis comble tout de suite les
-- trous actuels (ID-044, 131, 179, 181, 185) pour EPC MANOI.
-- À lancer une fois dans Supabase > SQL Editor. Peut être relancé sans risque.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.renumber_students(p_school uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed integer;
BEGIN
  -- Une seule renumérotation à la fois par école.
  PERFORM pg_advisory_xact_lock(hashtext('schoolflow_renumber_' || p_school::text));

  DROP TABLE IF EXISTS _sf_map;
  CREATE TEMP TABLE _sf_map ON COMMIT DROP AS
  SELECT id, old_num, 'ID-' || lpad(rn::text, 3, '0') AS new_num
  FROM (
    SELECT id,
           student_number AS old_num,
           row_number() OVER (
             ORDER BY NULLIF(regexp_replace(COALESCE(student_number, ''), '\D', '', 'g'), '')::bigint NULLS LAST,
                      created_at, id
           ) AS rn
    FROM public.students
    WHERE school_id = p_school
  ) t;
  DELETE FROM _sf_map WHERE old_num IS NOT DISTINCT FROM new_num;
  SELECT count(*) INTO changed FROM _sf_map;
  IF changed = 0 THEN
    RETURN 0;
  END IF;

  -- Élèves : en deux temps pour ne jamais avoir deux élèves avec le même numéro.
  UPDATE public.students s SET student_number = 'TMP-' || s.id::text
  FROM _sf_map m WHERE s.id = m.id;
  UPDATE public.students s SET student_number = m.new_num, updated_at = now()
  FROM _sf_map m WHERE s.id = m.id;

  -- Reçus des élèves renumérotés : même préfixe, nouveau numéro.
  DROP TABLE IF EXISTS _sf_inv;
  CREATE TEMP TABLE _sf_inv ON COMMIT DROP AS
  SELECT i.id,
         regexp_replace(i.invoice_number, '\d+$', '') || lpad(regexp_replace(m.new_num, '\D', '', 'g'), 3, '0') AS new_number
  FROM public.invoices i
  JOIN _sf_map m ON m.id = i.student_id
  WHERE i.school_id = p_school AND i.invoice_number ~ '\d+$';
  UPDATE public.invoices i SET invoice_number = 'TMP-' || i.id::text
  FROM _sf_inv x WHERE i.id = x.id;
  UPDATE public.invoices i SET invoice_number = x.new_number
  FROM _sf_inv x WHERE i.id = x.id;

  RETURN changed;
END;
$$;

-- Seul le serveur de l'application (clé secrète) peut lancer la renumérotation.
REVOKE ALL ON FUNCTION public.renumber_students(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.renumber_students(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renumber_students(uuid) TO service_role;

-- Combler tout de suite les trous actuels d'EPC MANOI.
SELECT public.renumber_students(id) AS eleves_renumerotes
FROM public.schools WHERE slug = 'epc-manoi';

-- Vérification : plus grand numéro = nombre d'élèves, et aucun numéro en double.
SELECT COUNT(*) AS eleves,
       MAX(regexp_replace(student_number, '\D', '', 'g')::int) AS plus_grand_numero,
       COUNT(*) - COUNT(DISTINCT student_number) AS doublons
FROM public.students s JOIN public.schools sc ON sc.id = s.school_id
WHERE sc.slug = 'epc-manoi';
