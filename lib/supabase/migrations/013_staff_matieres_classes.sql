-- ═══════════════════════════════════════════════════════════════════════════
-- 013 : MATIÈRES ET CLASSES DU PERSONNEL (fiche « Administration & Codes »)
-- À lancer UNE fois dans Supabase → SQL Editor → New query → Run.
-- Ajoute seulement deux colonnes (sans effacer quoi que ce soit). Sans elles, la connexion
-- du personnel échoue : le code les lit à chaque connexion.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS subject_or_grade text;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS assigned_classes text;

-- Contrôle : chaque membre et ses matières / classes (vide = pas encore renseigné).
SELECT s.slug, u.role_id, u.full_name, u.matricule, u.subject_or_grade, u.assigned_classes
FROM public.staff_users u
JOIN public.schools s ON s.id = u.school_id
WHERE u.role_id NOT LIKE 'system_%' AND u.role_id <> 'school_stamp'
ORDER BY s.slug, u.role_id, u.full_name;
