-- ==============================================================================
-- SCHOOLFLOW — MIGRATION 003 : INTERDIRE LES DOUBLONS
-- ==============================================================================
-- Pourquoi : sans contrainte d'unicité, des enregistrements simultanés depuis plusieurs
-- appareils créaient des doublons (15 élèves en double, 4 fiches Directeur, 4 fiches
-- Fondateur, 767 copies de la ligne des données Transport / Cantine / Internat).
--
-- À exécuter APRÈS le nettoyage des doublons existants : si un doublon subsiste, la création
-- de l'index échoue avec un message « could not create unique index » et rien n'est modifié.
-- Script idempotent : il peut être relancé sans danger.
-- ==============================================================================

-- Un seul élève par numéro de dossier dans une école
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_school_number
  ON public.students (school_id, student_number);

-- Un seul encaissement par numéro de reçu dans une école
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_school_number
  ON public.invoices (school_id, invoice_number);

-- Un seul code d'accès par école (et donc une seule ligne technique de chaque type)
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_school_code
  ON public.staff_users (school_id, auth_code);

-- Un seul Directeur et un seul Fondateur par école
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_school_leader
  ON public.staff_users (school_id, role_id)
  WHERE role_id IN ('directeur', 'fondateur');

-- Vérification
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('uq_students_school_number', 'uq_invoices_school_number', 'uq_staff_school_code', 'uq_staff_school_leader')
ORDER BY indexname;
