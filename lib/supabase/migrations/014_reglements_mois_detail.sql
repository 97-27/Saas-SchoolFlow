-- ==============================================================================
-- SCHOOLFLOW — MIGRATION 014 : DÉTAIL DE CHAQUE RÈGLEMENT MENSUEL (cantine, transport, internat)
-- ==============================================================================
-- Pourquoi : une ligne de service_month_payments (un élève, un service, un mois) ne gardait que
-- l'heure d'insertion en base. Le journal du jour affichait donc les mois à la date du clic, et
-- jamais la date saisie, le montant du mois, le moyen de paiement ni le numéro de reçu.
-- Cette migration ajoute ces colonnes. Les anciennes lignes restent telles quelles (date inconnue) :
-- elles comptent dans les totaux mais n'apparaissent plus dans le journal du jour.
--
-- Idempotent (IF NOT EXISTS) et tout-ou-rien. À exécuter dans Supabase > SQL Editor.
-- ==============================================================================

BEGIN;

ALTER TABLE public.service_month_payments
  ADD COLUMN IF NOT EXISTS payment_date   date,
  ADD COLUMN IF NOT EXISTS amount         integer,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS receipt_number text;

COMMIT;

-- VÉRIFICATION : les quatre colonnes doivent apparaître (sinon, relancer le script).
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'service_month_payments'
  AND column_name IN ('payment_date', 'amount', 'payment_method', 'receipt_number')
ORDER BY column_name;
