-- ═══════════════════════════════════════════════════════════════════════
-- 005 — LISTE DES REÇUS SUPPRIMÉS
-- Un appareil qui gardait une vieille copie d'un reçu supprimé le recréait à la
-- synchronisation suivante (cas du reçu d'internat QUI-INT-003). Chaque reçu
-- supprimé est désormais noté ici, et le serveur refuse qu'un envoi automatique
-- le recrée. Un nouveau reçu saisi volontairement à l'écran reste possible.
-- À lancer une seule fois dans Supabase > SQL Editor (peut être relancé sans risque).
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.deleted_invoices (
  school_id      uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id     uuid NOT NULL,
  fee_type       text NOT NULL DEFAULT '',
  invoice_number text NOT NULL DEFAULT '',
  deleted_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, student_id, fee_type, invoice_number)
);
ALTER TABLE public.deleted_invoices ENABLE ROW LEVEL SECURITY;

-- Le reçu d'internat de COULIBALY Doh Tariq Imram (ID-003), retiré de l'internat
-- le 04/11 puis recréé par une vieille copie : on le supprime et on le note.
WITH ecole AS (SELECT id FROM public.schools WHERE slug = 'epc-manoi'),
cible AS (
  SELECT i.id, i.school_id, i.student_id, i.fee_type, i.invoice_number
  FROM public.invoices i
  JOIN public.students s ON s.id = i.student_id
  JOIN ecole e ON e.id = i.school_id
  WHERE s.student_number = 'ID-003' AND i.fee_type ILIKE '%internat%'
),
note AS (
  INSERT INTO public.deleted_invoices (school_id, student_id, fee_type, invoice_number)
  SELECT school_id, student_id, COALESCE(fee_type, ''), COALESCE(invoice_number, '') FROM cible
  ON CONFLICT DO NOTHING
)
DELETE FROM public.invoices WHERE id IN (SELECT id FROM cible);

COMMIT;

-- Vérification : doit afficher 1 ligne (le reçu QUI-INT-003 noté comme supprimé)
SELECT invoice_number, fee_type, deleted_at FROM public.deleted_invoices;
