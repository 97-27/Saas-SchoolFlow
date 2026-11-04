-- ═══════════════════════════════════════════════════════════════════════
-- 008 — TOUT DANS LA BASE (plus rien seulement dans le navigateur)
-- Notes, appel de présence, bulletins validés, dépenses, salaires, réductions,
-- santé, documents, fiches du personnel… n'étaient enregistrés que dans le
-- navigateur de l'appareil utilisé. Cette table les garde dans la base :
-- ils sont partagés entre tous les appareils et ne se perdent plus.
-- Chaque modification est aussi notée dans l'historique (school_kv_history).
-- À lancer une seule fois dans Supabase > SQL Editor (peut être relancé sans risque).
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.school_kv (
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  key        text NOT NULL,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT '',
  PRIMARY KEY (school_id, key)
);
CREATE INDEX IF NOT EXISTS school_kv_updated_idx ON public.school_kv (school_id, updated_at);
ALTER TABLE public.school_kv ENABLE ROW LEVEL SECURITY;

-- Historique : l'ancienne valeur est gardée à chaque modification (récupération possible).
CREATE TABLE IF NOT EXISTS public.school_kv_history (
  id         bigserial PRIMARY KEY,
  school_id  uuid NOT NULL,
  key        text NOT NULL,
  old_value  text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS school_kv_history_idx ON public.school_kv_history (school_id, key, changed_at DESC);
ALTER TABLE public.school_kv_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.school_kv_keep_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.value IS DISTINCT FROM NEW.value THEN
    INSERT INTO public.school_kv_history (school_id, key, old_value, changed_by)
    VALUES (OLD.school_id, OLD.key, OLD.value, NEW.updated_by);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS school_kv_history_trg ON public.school_kv;
CREATE TRIGGER school_kv_history_trg
  BEFORE UPDATE ON public.school_kv
  FOR EACH ROW EXECUTE FUNCTION public.school_kv_keep_history();

COMMIT;

-- Vérification : doit afficher 2 lignes (school_kv et school_kv_history)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('school_kv', 'school_kv_history');
