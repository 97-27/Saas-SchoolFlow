-- ==============================================================================
-- SCHOOLFLOW — MIGRATION 004 : INTERNAT, CANTINE, TRANSPORT EN VRAIES TABLES
-- ==============================================================================
-- Pourquoi : les abonnements et les mois payés des trois services étaient rangés dans UN SEUL
-- bloc de texte (staff_users, ligne « system_services_data »), réécrit en entier par chaque
-- poste. Le dernier qui enregistrait écrasait le travail des autres (suppressions et coches qui
-- « revenaient »). Désormais : une ligne par abonnement, une ligne par mois payé ; chaque action
-- ne touche que sa ligne. La suppression d'un élève supprime automatiquement ses lignes.
--
-- Ajoute aussi un compteur de version par école, augmenté à chaque modification : les écrans le
-- consultent toutes les 15 s et se mettent à jour dès qu'il change.
--
-- Le script recopie les données existantes du bloc. Il est idempotent (relançable sans danger)
-- et tout-ou-rien (BEGIN … COMMIT). L'ancien bloc n'est PAS effacé (sauvegarde).
-- À exécuter dans Supabase > SQL Editor.
-- ==============================================================================

BEGIN;

-- 1. TABLES -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.service_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  service      text NOT NULL CHECK (service IN ('internat', 'cantine', 'transport')),
  monthly_rate integer NOT NULL DEFAULT 0,
  discount     integer NOT NULL DEFAULT 0,
  details      jsonb NOT NULL DEFAULT '{}'::jsonb, -- pavillon, chambre, régime, arrêt…
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, service)
);

CREATE TABLE IF NOT EXISTS public.service_month_payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  service    text NOT NULL CHECK (service IN ('internat', 'cantine', 'transport')),
  month      text NOT NULL CHECK (month IN ('Septembre','Octobre','Novembre','Décembre','Janvier','Février','Mars','Avril','Mai')),
  paid_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, service, month)
);

CREATE INDEX IF NOT EXISTS idx_service_subs_school ON public.service_subscriptions (school_id, service);
CREATE INDEX IF NOT EXISTS idx_service_pay_school ON public.service_month_payments (school_id, service);

-- Accès réservé au serveur (clé secrète), comme les autres tables depuis la migration 001.
ALTER TABLE public.service_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_month_payments ENABLE ROW LEVEL SECURITY;

-- 2. COMPTEUR DE VERSION PAR ÉCOLE ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.school_data_versions (
  school_id  uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  version    bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.school_data_versions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bump_school_data_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN sid := OLD.school_id; ELSE sid := NEW.school_id; END IF;
  IF sid IS NOT NULL THEN
    INSERT INTO public.school_data_versions (school_id, version, updated_at)
    VALUES (sid, 1, now())
    ON CONFLICT (school_id) DO UPDATE
      SET version = public.school_data_versions.version + 1, updated_at = now();
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_version_students ON public.students;
CREATE TRIGGER trg_version_students AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.bump_school_data_version();

DROP TRIGGER IF EXISTS trg_version_invoices ON public.invoices;
CREATE TRIGGER trg_version_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.bump_school_data_version();

DROP TRIGGER IF EXISTS trg_version_service_subs ON public.service_subscriptions;
CREATE TRIGGER trg_version_service_subs AFTER INSERT OR UPDATE OR DELETE ON public.service_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.bump_school_data_version();

DROP TRIGGER IF EXISTS trg_version_service_pay ON public.service_month_payments;
CREATE TRIGGER trg_version_service_pay AFTER INSERT OR UPDATE OR DELETE ON public.service_month_payments
  FOR EACH ROW EXECUTE FUNCTION public.bump_school_data_version();

DROP TRIGGER IF EXISTS trg_version_staff ON public.staff_users;
CREATE TRIGGER trg_version_staff AFTER INSERT OR UPDATE OR DELETE ON public.staff_users
  FOR EACH ROW EXECUTE FUNCTION public.bump_school_data_version();

INSERT INTO public.school_data_versions (school_id, version)
SELECT id, 1 FROM public.schools
ON CONFLICT (school_id) DO NOTHING;

-- 3. RECOPIE DES DONNÉES DU BLOC -----------------------------------------------------------------

-- Retrouve l'élève d'une clé du bloc : identifiant, numéro de dossier (« ID-003 ») ou matricule.
CREATE OR REPLACE FUNCTION pg_temp.sf_resolve_student(p_school uuid, p_key text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT s.id
  FROM public.students s
  WHERE s.school_id = p_school
    AND (s.id::text = p_key OR s.student_number = p_key OR (COALESCE(s.matricule, '') <> '' AND s.matricule = p_key))
  ORDER BY (s.id::text = p_key) DESC, (s.student_number = p_key) DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION pg_temp.sf_int(p text, p_default integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' THEN round(p::numeric)::integer ELSE p_default END
$$;

CREATE TEMP TABLE sf_blob ON COMMIT DROP AS
SELECT su.school_id, su.department::jsonb AS d
FROM public.staff_users su
WHERE su.role_id = 'system_services_data'
  AND su.department LIKE '{%';

-- 3a. Abonnements d'internat (tableau)
INSERT INTO public.service_subscriptions (school_id, student_id, service, monthly_rate, discount, details)
SELECT b.school_id, r.st, 'internat',
       pg_temp.sf_int(e->>'monthlyRate', 25000), 0,
       jsonb_strip_nulls(jsonb_build_object(
         'pavilion', e->>'pavilion',
         'roomNumber', e->>'roomNumber',
         'paymentDate', e->>'paymentDate',
         'parentContact', e->>'parentContact'))
FROM sf_blob b
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(b.d->'boardingSubscriptions') = 'array' THEN b.d->'boardingSubscriptions' ELSE '[]'::jsonb END) e
CROSS JOIN LATERAL (SELECT pg_temp.sf_resolve_student(b.school_id, e->>'studentId') AS st) r
WHERE r.st IS NOT NULL
ON CONFLICT (school_id, student_id, service) DO NOTHING;

-- 3b. Abonnements de cantine et de transport (dictionnaires « élève -> détails »)
INSERT INTO public.service_subscriptions (school_id, student_id, service, monthly_rate, discount, details)
SELECT b.school_id, r.st, svc.service,
       pg_temp.sf_int(p.value->>'rate', 0),
       pg_temp.sf_int(p.value->>'discount', 0),
       (p.value - 'rate' - 'discount' - 'studentName')
FROM sf_blob b
CROSS JOIN (VALUES ('cantine', 'canteenSubscriptions'), ('transport', 'transportSubscriptions')) AS svc(service, k)
CROSS JOIN LATERAL jsonb_each(
  CASE WHEN jsonb_typeof(b.d->svc.k) = 'object' THEN b.d->svc.k ELSE '{}'::jsonb END) p
CROSS JOIN LATERAL (SELECT pg_temp.sf_resolve_student(b.school_id, p.key) AS st) r
WHERE r.st IS NOT NULL AND jsonb_typeof(p.value) = 'object'
ON CONFLICT (school_id, student_id, service) DO NOTHING;

-- 3c. Mois payés des trois services (doublons « identifiant / numéro » fusionnés)
INSERT INTO public.service_month_payments (school_id, student_id, service, month)
SELECT DISTINCT b.school_id, r.st, svc.service, m.key
FROM sf_blob b
CROSS JOIN (VALUES ('internat', 'boardingPayments'), ('cantine', 'canteenPayments'), ('transport', 'transportPayments')) AS svc(service, k)
CROSS JOIN LATERAL jsonb_each(
  CASE WHEN jsonb_typeof(b.d->svc.k) = 'object' THEN b.d->svc.k ELSE '{}'::jsonb END) p
CROSS JOIN LATERAL jsonb_each_text(
  CASE WHEN jsonb_typeof(p.value) = 'object' THEN p.value ELSE '{}'::jsonb END) m
CROSS JOIN LATERAL (SELECT pg_temp.sf_resolve_student(b.school_id, p.key) AS st) r
WHERE r.st IS NOT NULL
  AND m.value = 'true'
  AND m.key IN ('Septembre','Octobre','Novembre','Décembre','Janvier','Février','Mars','Avril','Mai')
ON CONFLICT (school_id, student_id, service, month) DO NOTHING;

-- 3d. Pensionnaires qui n'avaient que des mois cochés, sans abonnement (13 à EPC MANOI) :
--     l'application les comptait déjà comme pensionnaires au tarif par défaut (25 000 F).
INSERT INTO public.service_subscriptions (school_id, student_id, service, monthly_rate)
SELECT DISTINCT p.school_id, p.student_id, 'internat', 25000
FROM public.service_month_payments p
WHERE p.service = 'internat'
ON CONFLICT (school_id, student_id, service) DO NOTHING;

COMMIT;

-- 4. VÉRIFICATION (EPC MANOI attendu : internat 16, cantine 1, transport 2) ---------------------
SELECT sc.slug, s.service, COUNT(*) AS abonnes
FROM public.service_subscriptions s
JOIN public.schools sc ON sc.id = s.school_id
GROUP BY sc.slug, s.service
ORDER BY sc.slug, s.service;

SELECT sc.slug, p.service, COUNT(*) AS mois_payes
FROM public.service_month_payments p
JOIN public.schools sc ON sc.id = p.school_id
GROUP BY sc.slug, p.service
ORDER BY sc.slug, p.service;
