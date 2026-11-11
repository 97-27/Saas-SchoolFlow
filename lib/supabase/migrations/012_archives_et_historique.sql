-- ═══════════════════════════════════════════════════════════════════════════
-- 012 : ARCHIVES DES ANNÉES SCOLAIRES + HISTORIQUE DE SÉCURITÉ
-- À lancer UNE fois dans Supabase → SQL Editor → New query → Run.
-- Ne modifie ni ne supprime AUCUNE donnée existante : il ajoute seulement deux tables.
--
-- 1) school_archives : copies complètes et figées des données de l'école (page « Archives
--    des années »). Clôtures d'année et sauvegardes manuelles gardées pour toujours.
-- 2) school_kv_history : avant chaque modification des salaires, dépenses, réductions,
--    rappels de versement, notes et bulletins validés, l'ANCIENNE version est recopiée ici
--    (au plus une copie toutes les 6 heures par donnée, gardée 90 jours). Si une donnée
--    disparaît un jour par erreur, on peut la récupérer.
-- Les deux tables sont fermées aux navigateurs (RLS sans politique) : seul le serveur
-- SchoolFlow (clé service_role) y accède.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Archives ───
CREATE TABLE IF NOT EXISTS public.school_archives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  kind          text NOT NULL DEFAULT 'manuel' CHECK (kind IN ('cloture', 'manuel', 'auto')),
  label         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text,
  summary       jsonb,
  data          text NOT NULL,
  size_bytes    integer
);
CREATE INDEX IF NOT EXISTS idx_school_archives_school ON public.school_archives (school_id, created_at DESC);
ALTER TABLE public.school_archives ENABLE ROW LEVEL SECURITY;

-- Une archive de clôture ou manuelle ne peut JAMAIS être modifiée ni supprimée (même par erreur
-- depuis le code) ; seules les sauvegardes automatiques tournantes peuvent être retirées.
CREATE OR REPLACE FUNCTION public.sf_protect_archives() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Une archive ne peut pas être modifiée.';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.kind <> 'auto' THEN
    RAISE EXCEPTION 'Une archive de clôture ou manuelle ne peut pas être supprimée.';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_protect_archives ON public.school_archives;
CREATE TRIGGER trg_protect_archives
  BEFORE UPDATE OR DELETE ON public.school_archives
  FOR EACH ROW EXECUTE FUNCTION public.sf_protect_archives();

-- ─── 2. Historique de sécurité ───
CREATE TABLE IF NOT EXISTS public.school_kv_history (
  id         bigserial PRIMARY KEY,
  school_id  uuid NOT NULL,
  key        text NOT NULL,
  old_value  text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text,
  operation  text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kv_history_key ON public.school_kv_history (school_id, key, changed_at DESC);
ALTER TABLE public.school_kv_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sf_kv_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.key LIKE 'schoolflow_staff_salaries_v1%'
     OR OLD.key LIKE 'schoolflow_school_expenses_v1%'
     OR OLD.key LIKE 'schoolflow_special_discounts_v1%'
     OR OLD.key LIKE 'schoolflow_versement_reminders_v1%'
     OR OLD.key LIKE 'schoolflow_validated_class_bulletins_v1%'
     OR (OLD.key LIKE 'schoolflow_grades%' AND OLD.key NOT LIKE 'schoolflow_grades_config%' AND OLD.key NOT LIKE 'schoolflow_grades_portal%')
  THEN
    IF TG_OP = 'DELETE' OR NEW.value IS DISTINCT FROM OLD.value THEN
      -- Au plus une copie toutes les 6 heures par donnée (sauf suppression : toujours gardée).
      IF TG_OP = 'DELETE' OR NOT EXISTS (
        SELECT 1 FROM public.school_kv_history h
        WHERE h.school_id = OLD.school_id AND h.key = OLD.key AND h.changed_at > now() - interval '6 hours'
      ) THEN
        INSERT INTO public.school_kv_history (school_id, key, old_value, changed_by, operation)
        VALUES (OLD.school_id, OLD.key, OLD.value, CASE WHEN TG_OP = 'UPDATE' THEN NEW.updated_by ELSE NULL END, TG_OP);
        -- Ménage : copies de plus de 90 jours (les Archives gardent le long terme).
        DELETE FROM public.school_kv_history
        WHERE school_id = OLD.school_id AND key = OLD.key AND changed_at < now() - interval '90 days';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_kv_history ON public.school_kv;
CREATE TRIGGER trg_kv_history
  BEFORE UPDATE OR DELETE ON public.school_kv
  FOR EACH ROW EXECUTE FUNCTION public.sf_kv_history();

-- ─── 3. Contrôle : que reste-t-il des salaires en base ? ───
-- « nb_recus » = nombre de reçus de salaire actuellement enregistrés dans Supabase.
SELECT s.slug, k.key,
       CASE WHEN left(k.value, 1) = '[' THEN jsonb_array_length(k.value::jsonb) ELSE NULL END AS nb_recus,
       k.updated_at, k.updated_by
FROM public.school_kv k
JOIN public.schools s ON s.id = k.school_id
WHERE k.key LIKE 'schoolflow_staff_salaries_v1%'
   OR k.key LIKE 'schoolflow_school_expenses_v1%'
ORDER BY s.slug, k.key;
