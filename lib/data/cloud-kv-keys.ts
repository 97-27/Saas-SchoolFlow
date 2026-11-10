/**
 * Données qui n'existaient QUE dans le navigateur (localStorage) et sont désormais enregistrées
 * dans la base (table school_kv, migration 008) : notes, appel, bulletins validés, dépenses,
 * salaires, réductions, santé, documents, etc. Partagé entre le client (lib/data/cloud-kv.ts)
 * et le serveur (app/api/kv/route.ts) pour que les deux appliquent exactement les mêmes règles.
 *
 * Chaque famille = un nom de base de clé localStorage. Une clé appartient à l'école X si elle
 * vaut `${base}_${X}` ou commence par `${base}_${X}_` ; pour l'établissement pilote epc-manoi,
 * la clé « nue » `${base}` (ancien format) est aussi acceptée.
 */

export type KvFamily = {
  base: string;
  label: string;
  /** Rôles autorisés à lire. */
  read: string[];
  /** Rôles autorisés à modifier. */
  write: string[];
};

// Postes : voir lib/auth/roles.ts. L'Informaticien lit tout (consultation), n'écrit rien.
const DIRECTION = ['fondateur', 'fondateur_adjoint', 'directeur'];
/** Documents, santé, fiches du personnel… : pages du Directeur ET du Comptable. */
const GESTION = ['fondateur', 'fondateur_adjoint', 'directeur', 'comptable'];
/** Dépenses, salaires, réductions, rappels de versement : Comptable et Fondateurs seulement. */
const FINANCE = ['fondateur', 'fondateur_adjoint', 'comptable'];
const ALL_STAFF = ['fondateur', 'fondateur_adjoint', 'directeur', 'informaticien', 'comptable', 'secretaire', 'assistant_direction', 'enseignant', 'educateur'];
const PEDAGOGIE = ['fondateur', 'fondateur_adjoint', 'directeur', 'enseignant'];

export const KV_FAMILIES: KvFamily[] = [
  { base: 'schoolflow_grades', label: 'Notes', read: [...ALL_STAFF, 'parent'], write: PEDAGOGIE },
  { base: 'schoolflow_grades_config_v1', label: 'Paramètres des notes', read: [...ALL_STAFF, 'parent'], write: DIRECTION },
  { base: 'schoolflow_grades_portal_status_v1', label: 'Portail des notes', read: [...ALL_STAFF, 'parent'], write: DIRECTION },
  { base: 'schoolflow_validated_class_bulletins_v1', label: 'Bulletins validés', read: [...ALL_STAFF, 'parent'], write: PEDAGOGIE },
  { base: 'schoolflow_attendance_records_v1', label: 'Appel de présence', read: ALL_STAFF, write: [...PEDAGOGIE, 'educateur'] },
  { base: 'schoolflow_attendance_locked', label: 'Verrous d’appel', read: ALL_STAFF, write: [...PEDAGOGIE, 'educateur'] },
  { base: 'schoolflow_school_expenses_v1', label: 'Dépenses', read: [...FINANCE, 'informaticien'], write: FINANCE },
  { base: 'schoolflow_staff_salaries_v1', label: 'Salaires', read: [...FINANCE, 'informaticien'], write: FINANCE },
  { base: 'schoolflow_special_discounts_v1', label: 'Réductions', read: [...FINANCE, 'informaticien'], write: FINANCE },
  { base: 'schoolflow_versement_reminders_v1', label: 'Sommes des rappels de versement', read: [...FINANCE, 'informaticien'], write: FINANCE },
  { base: 'schoolflow_documents_status_v5', label: 'Documents', read: ALL_STAFF, write: GESTION },
  { base: 'schoolflow_health_records_v1', label: 'Santé', read: ALL_STAFF, write: GESTION },
  { base: 'schoolflow_health_incidents_v1', label: 'Incidents santé', read: ALL_STAFF, write: GESTION },
  { base: 'schoolflow_teachers_data_v3', label: 'Fiches du personnel', read: ALL_STAFF, write: GESTION },
  { base: 'schoolflow_transport_lines', label: 'Lignes de transport', read: ALL_STAFF, write: FINANCE },
  { base: 'schoolflow_canteen_meals_history_v2', label: 'Historique cantine', read: ALL_STAFF, write: FINANCE },
  { base: 'schoolflow_broadcast_records_v1', label: 'Annonces envoyées', read: [...DIRECTION, 'informaticien', 'secretaire', 'assistant_direction'], write: DIRECTION },
];

/** Identifiants des éléments d'une valeur enregistrée : clés d'un objet, ou « id » des éléments
 *  d'une liste. null si la valeur n'a pas cette forme (texte, liste sans identifiants). */
export function kvIdsOf(raw: string | null | undefined): string[] | null {
  if (raw === null || raw === undefined) return null;
  let v: any;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.keys(v);
  if (Array.isArray(v)) {
    const ids: string[] = [];
    for (const item of v) {
      const id = item && typeof item === 'object' ? item.id : undefined;
      if (typeof id !== 'string' && typeof id !== 'number') return null;
      ids.push(String(id));
    }
    return ids;
  }
  return null;
}

/** epc-manoi est aussi connu sous son ancien nom college-excellence. */
function slugAliases(slug: string): string[] {
  return slug === 'epc-manoi' ? ['epc-manoi', 'college-excellence'] : [slug];
}

/**
 * Famille d'une clé pour l'école donnée, ou null si la clé n'est pas synchronisée (ou appartient
 * à une autre école). Les familles les plus longues sont testées d'abord pour que
 * « schoolflow_grades_portal_status_v1_x » ne soit jamais pris pour une note.
 */
const FAMILIES_LONGEST_FIRST = [...KV_FAMILIES].sort((a, b) => b.base.length - a.base.length);

export function kvFamilyForKey(key: string, slug: string): KvFamily | null {
  if (!key || !slug || key.length > 300) return null;
  for (const fam of FAMILIES_LONGEST_FIRST) {
    if (slug === 'epc-manoi' && key === fam.base) return fam;
    for (const s of slugAliases(slug)) {
      const scoped = `${fam.base}_${s}`;
      if (key === scoped || key.startsWith(`${scoped}_`)) return fam;
    }
  }
  return null;
}
