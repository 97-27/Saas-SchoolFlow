-- ═══════════════════════════════════════════════════════════════════════
-- 007 — CORBEILLE ET JOURNAL DES ACTIONS
-- Chaque suppression, modification ou création d'un élève, d'un reçu, d'un
-- abonnement (internat / cantine / transport) ou d'un mois payé est notée ici
-- PAR LA BASE ELLE-MÊME, avec la ligne complète d'avant : quel que soit l'écran,
-- l'appareil ou le script qui agit, rien ne peut plus disparaître sans trace.
-- La fonction restore_journal() remet en place une suppression (avec tout ce qui
-- a été supprimé en même temps) ou annule une modification, en un clic depuis la
-- page « Corbeille & Journal ».
-- Les renumérotations (numéros d'élèves et de reçus) ne sont pas notées : ce ne
-- sont pas des actions de l'utilisateur.
-- À lancer une fois dans Supabase > SQL Editor. Peut être relancé sans risque.
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.data_journal (
  id          bigserial PRIMARY KEY,
  school_id   uuid,
  at          timestamptz NOT NULL DEFAULT now(),
  op          text NOT NULL,              -- INSERT / UPDATE / DELETE
  table_name  text NOT NULL,
  row_id      uuid,
  student_id  uuid,
  old_row     jsonb,
  new_row     jsonb,
  actor       text,                       -- « rôle|identifiant du membre » (jamais un code d'accès)
  restored_at timestamptz,
  restored_by text
);
CREATE INDEX IF NOT EXISTS data_journal_school_at ON public.data_journal (school_id, at DESC);
CREATE INDEX IF NOT EXISTS data_journal_student ON public.data_journal (student_id);
ALTER TABLE public.data_journal ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.journal_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o jsonb;
  n jsonb;
  r jsonb;
  ign text[] := ARRAY['updated_at', 'student_number', 'invoice_number', 'paid_at'];
  hdr text;
  who text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    o := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    o := to_jsonb(OLD);
    n := to_jsonb(NEW);
    -- Rien de réel n'a changé (renvoi identique, renumérotation) : on ne note pas.
    IF (o - ign) = (n - ign) THEN
      RETURN NULL;
    END IF;
  ELSE
    n := to_jsonb(NEW);
  END IF;
  r := COALESCE(o, n);

  hdr := NULLIF(current_setting('request.headers', true), '');
  IF hdr IS NOT NULL THEN
    BEGIN
      who := hdr::json ->> 'x-sf-actor';
    EXCEPTION WHEN others THEN
      who := NULL;
    END;
  END IF;

  INSERT INTO public.data_journal (school_id, op, table_name, row_id, student_id, old_row, new_row, actor)
  VALUES (
    NULLIF(r ->> 'school_id', '')::uuid,
    TG_OP,
    TG_TABLE_NAME,
    NULLIF(r ->> 'id', '')::uuid,
    CASE WHEN TG_TABLE_NAME = 'students' THEN NULLIF(r ->> 'id', '')::uuid ELSE NULLIF(r ->> 'student_id', '')::uuid END,
    o,
    n,
    COALESCE(who, 'base')
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS journal_students ON public.students;
CREATE TRIGGER journal_students AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.journal_row_change();
DROP TRIGGER IF EXISTS journal_invoices ON public.invoices;
CREATE TRIGGER journal_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.journal_row_change();
DROP TRIGGER IF EXISTS journal_service_subscriptions ON public.service_subscriptions;
CREATE TRIGGER journal_service_subscriptions AFTER INSERT OR UPDATE OR DELETE ON public.service_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.journal_row_change();
DROP TRIGGER IF EXISTS journal_service_month_payments ON public.service_month_payments;
CREATE TRIGGER journal_service_month_payments AFTER INSERT OR UPDATE OR DELETE ON public.service_month_payments
  FOR EACH ROW EXECUTE FUNCTION public.journal_row_change();

-- ─── Restauration ───────────────────────────────────────────────────────
-- Remet une ligne supprimée (et ce qui a été supprimé avec elle), ou rétablit
-- les valeurs d'avant une modification. Renvoie {ok, restored, message}.
CREATE OR REPLACE FUNCTION public.restore_journal(p_school uuid, p_id bigint, p_actor text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.data_journal%ROWTYPE;
  g public.data_journal%ROWTYPE;
  ids bigint[] := ARRAY[]::bigint[];
  cnt integer := 0;
  svc text;
  cols text;
  student_restored boolean := false;
BEGIN
  SELECT * INTO e FROM public.data_journal WHERE id = p_id AND school_id = p_school;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Action introuvable.');
  END IF;
  IF e.restored_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Déjà restauré le ' || to_char(e.restored_at AT TIME ZONE 'Africa/Abidjan', 'DD/MM/YYYY à HH24:MI') || '.');
  END IF;

  -- ── Annuler une MODIFICATION : remettre les valeurs d'avant ──
  IF e.op = 'UPDATE' THEN
    SELECT string_agg(format('%I = src.%I', column_name, column_name), ', ')
      INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = e.table_name
       AND column_name NOT IN ('id', 'school_id', 'student_number', 'invoice_number', 'created_at', 'updated_at');
    EXECUTE format(
      'UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I, $1) src WHERE t.id = $2 AND t.school_id = $3',
      e.table_name, cols, e.table_name
    ) USING e.old_row, e.row_id, p_school;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    IF cnt = 0 THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Cette fiche n''existe plus : restaurez d''abord sa suppression.');
    END IF;
    UPDATE public.data_journal SET restored_at = now(), restored_by = p_actor WHERE id = e.id;
    RETURN jsonb_build_object('ok', true, 'restored', cnt, 'message', 'Modification annulée.');
  END IF;

  IF e.op <> 'DELETE' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Seules les suppressions et les modifications peuvent être annulées.');
  END IF;

  -- ── Restaurer une SUPPRESSION, avec tout ce qui a été supprimé en même temps ──
  IF e.table_name = 'students' THEN
    -- L'élève + ses reçus, abonnements et mois payés supprimés dans les 15 minutes autour.
    SELECT array_agg(id) INTO ids FROM public.data_journal
     WHERE school_id = p_school AND op = 'DELETE' AND restored_at IS NULL
       AND student_id = e.student_id
       AND at BETWEEN e.at - interval '15 minutes' AND e.at + interval '15 minutes';
  ELSIF e.table_name = 'service_subscriptions' THEN
    -- Le retrait d'un service : l'abonnement, ses mois payés et ses reçus de ce service.
    svc := e.old_row ->> 'service';
    SELECT array_agg(id) INTO ids FROM public.data_journal
     WHERE school_id = p_school AND op = 'DELETE' AND restored_at IS NULL
       AND student_id = e.student_id
       AND at BETWEEN e.at - interval '15 minutes' AND e.at + interval '15 minutes'
       AND (
         (table_name IN ('service_subscriptions', 'service_month_payments') AND old_row ->> 'service' = svc)
         OR (table_name = 'invoices' AND (old_row ->> 'fee_type') ILIKE '%' || svc || '%')
       );
  ELSE
    ids := ARRAY[e.id];
  END IF;
  IF ids IS NULL OR array_length(ids, 1) IS NULL THEN
    ids := ARRAY[e.id];
  END IF;

  -- Un reçu, abonnement ou mois ne peut revenir que si son élève existe encore.
  IF e.table_name <> 'students' AND NOT EXISTS (SELECT 1 FROM public.students WHERE id = e.student_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'L''élève de cette ligne a été supprimé : restaurez d''abord l''élève (il reviendra avec ses reçus).');
  END IF;

  -- Ordre : élève, puis abonnements, reçus, mois payés.
  FOR g IN
    SELECT * FROM public.data_journal WHERE id = ANY(ids)
     ORDER BY CASE table_name WHEN 'students' THEN 1 WHEN 'service_subscriptions' THEN 2 WHEN 'invoices' THEN 3 ELSE 4 END, id
  LOOP
    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1) ON CONFLICT DO NOTHING',
      g.table_name, g.table_name
    ) USING g.old_row;
    cnt := cnt + 1;
    IF g.table_name = 'students' THEN
      student_restored := true;
    END IF;
    IF g.table_name = 'invoices' THEN
      DELETE FROM public.deleted_invoices
       WHERE school_id = p_school AND student_id = g.student_id AND fee_type = COALESCE(g.old_row ->> 'fee_type', '');
    END IF;
  END LOOP;

  UPDATE public.data_journal SET restored_at = now(), restored_by = p_actor WHERE id = ANY(ids);

  -- L'élève restauré reprend sa place dans la numérotation (les suivants avancent d'un numéro).
  IF student_restored THEN
    PERFORM public.renumber_students(p_school);
  END IF;

  RETURN jsonb_build_object('ok', true, 'restored', cnt, 'message', cnt || ' élément(s) restauré(s).');
END;
$$;

REVOKE ALL ON FUNCTION public.journal_row_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_journal(uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_journal(uuid, bigint, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_journal(uuid, bigint, text) TO service_role;

COMMIT;

-- Vérification : 4 déclencheurs installés.
SELECT event_object_table AS table_suivie, COUNT(*) AS declencheurs
FROM information_schema.triggers
WHERE trigger_name LIKE 'journal_%'
GROUP BY event_object_table
ORDER BY 1;
