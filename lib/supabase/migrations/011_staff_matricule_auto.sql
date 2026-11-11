-- ═══════════════════════════════════════════════════════════════════════════
-- 011 : MATRICULES ATTRIBUÉS AUTOMATIQUEMENT AU PERSONNEL EXISTANT
-- À lancer UNE fois dans Supabase → SQL Editor → New query → Run (après le script 010).
-- Ne touche QU'AUX fiches dont le matricule est vide ; aucune autre donnée n'est modifiée.
--
-- Format : préfixe du poste + numéro (dans l'ordre de création, par école) :
--   FND-001  Fondateur              (matricule professionnel)
--   DGA-001  Fondateur adjoint      (matricule professionnel)
--   DIR-001  Directeur des Études   ┐
--   CPT-001  Comptable              │
--   SEC-001  Secrétaire             │
--   INF-001  Informaticien          │ matricule d'embauche
--   AST-001  Assistant(e)           │
--   EDU-001  Éducateur              │
--   ENS-001  Enseignant             ┘
-- ═══════════════════════════════════════════════════════════════════════════

WITH a_numeroter AS (
  SELECT
    u.id,
    CASE u.role_id
      WHEN 'fondateur' THEN 'FND'
      WHEN 'fondateur_adjoint' THEN 'DGA'
      WHEN 'directeur' THEN 'DIR'
      WHEN 'comptable' THEN 'CPT'
      WHEN 'secretaire' THEN 'SEC'
      WHEN 'informaticien' THEN 'INF'
      WHEN 'assistant_direction' THEN 'AST'
      WHEN 'educateur' THEN 'EDU'
      WHEN 'enseignant' THEN 'ENS'
      ELSE 'EMP'
    END AS prefixe,
    u.school_id,
    u.created_at
  FROM public.staff_users u
  WHERE (u.matricule IS NULL OR u.matricule = '')
    AND u.role_id NOT LIKE 'system_%'
    AND u.role_id <> 'school_stamp'
),
numeros AS (
  SELECT
    a.id,
    a.prefixe || '-' || lpad(
      (
        -- numéro suivant après les matricules déjà existants du même préfixe dans l'école
        COALESCE((
          SELECT max(NULLIF(regexp_replace(e.matricule, '^' || a.prefixe || '-', ''), '')::int)
          FROM public.staff_users e
          WHERE e.school_id = a.school_id
            AND e.matricule ~ ('^' || a.prefixe || '-[0-9]+$')
        ), 0)
        + row_number() OVER (PARTITION BY a.school_id, a.prefixe ORDER BY a.created_at)
      )::text, 3, '0') AS nouveau
  FROM a_numeroter a
)
UPDATE public.staff_users u
SET matricule = n.nouveau
FROM numeros n
WHERE u.id = n.id;

-- Résultat : NOTEZ votre matricule (colonne « matricule ») pour vous connecter.
SELECT s.slug, u.role_id, u.full_name, u.matricule
FROM public.staff_users u
JOIN public.schools s ON s.id = u.school_id
WHERE u.role_id NOT LIKE 'system_%' AND u.role_id <> 'school_stamp'
ORDER BY s.slug, u.role_id, u.full_name;
