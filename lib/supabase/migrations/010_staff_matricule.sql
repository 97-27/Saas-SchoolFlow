-- ═══════════════════════════════════════════════════════════════════════════
-- 010 : MATRICULE D'EMBAUCHE DU PERSONNEL
-- À lancer UNE fois dans Supabase → SQL Editor → New query → Run.
-- Sans risque : ajoute une colonne, ne modifie ni ne supprime aucune donnée existante.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Colonne « matricule » sur les fiches du personnel. Avant, le matricule saisi en
--    Administration & Codes n'était jamais enregistré : un numéro fabriqué (EMP-xxxxxx)
--    s'affichait à la place.
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS matricule TEXT;

-- 2) Un même matricule ne peut appartenir qu'à UN membre dans une même école
--    (le personnel se connecte avec son matricule + son code).
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_school_matricule
  ON public.staff_users (school_id, upper(matricule))
  WHERE matricule IS NOT NULL AND matricule <> '';

-- 3) Vérification : liste du personnel et de son matricule (vide = à saisir en Administration).
SELECT s.slug, u.role_id, u.full_name, u.matricule
FROM public.staff_users u
JOIN public.schools s ON s.id = u.school_id
WHERE u.role_id NOT LIKE 'system_%' AND u.role_id <> 'school_stamp'
ORDER BY s.slug, u.role_id, u.full_name;
