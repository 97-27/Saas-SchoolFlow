/**
 * ══════════════════════════════════════════════════════════════════
 * DROITS PAR POSTE — SOURCE UNIQUE
 * ══════════════════════════════════════════════════════════════════
 * Utilisé par proxy.ts (pages autorisées), sidebar.tsx (menu), et les routes API (écritures).
 * Choix de l'établissement (10/11/2026) :
 *  - Fondateur et Fondateur adjoint (DGA) : toutes les pages, tout modifier, chiffres en clair ;
 *    eux seuls ont Administration & Codes, Paramètres, Corbeille & Journal.
 *  - Informaticien : toutes les pages SAUF Administration & Codes, Paramètres (et Corbeille).
 *  - Directeur : Vue d'ensemble, Documents, Gestion pédagogique, Communication parents,
 *    Enseignants & personnel, Santé, Notes diverses.
 *  - Comptable : Tableau de bord, Inscriptions, Vue d'ensemble, Services, Comptabilité,
 *    Réductions, Salaires, Personnel, Santé, Notes diverses (chiffres masqués, code possible).
 *  - Secrétaire : Vue d'ensemble, Documents, Services (consultation seule).
 * Aucun import serveur ici : ce fichier tourne aussi dans le navigateur et dans proxy.ts.
 */

export const FOUNDER_ROLES = ['fondateur', 'fondateur_adjoint'];

export const ALL_STAFF_ROLES = [
  'fondateur',
  'fondateur_adjoint',
  'directeur',
  'informaticien',
  'assistant_direction',
  'secretaire',
  'comptable',
  'enseignant',
  'educateur',
];

export const ROLE_LABELS: Record<string, string> = {
  fondateur: 'Fondateur (Contrôle Total)',
  fondateur_adjoint: 'Fondateur adjoint (DGA)',
  directeur: 'Directeur des Études (Contrôle)',
  informaticien: 'Informaticien',
  assistant_direction: 'Assistant(e) de Direction',
  secretaire: 'Secrétaire de Direction',
  comptable: 'Comptable / Gestionnaire',
  enseignant: 'Enseignant / Professeur',
  educateur: 'Éducateur / Conseiller d’Éducation',
  parent: 'Parent / Tuteur',
  eleve: 'Élève',
};

/** Toutes les pages /admin/<segment>. */
export const ALL_PAGES = [
  'dashboard',
  'administration',
  'inscriptions',
  'eleves',
  'documents',
  'cantine',
  'transport',
  'internat',
  'versements',
  'depenses',
  'rapports',
  'reductions',
  'salaires',
  'classes',
  'presences',
  'notes',
  'bulletins',
  'distinctions',
  'communication',
  'bulletins-parents',
  'personnel',
  'pointage',
  'cartes',
  'sante',
  'notes-diverses',
  'corbeille',
  'archives',
  'parametres',
  'acces',
];

/** Pages jamais accordables à un autre poste (réservées au Fondateur et au DGA). */
export const FOUNDER_ONLY_PAGES = ['administration', 'parametres', 'corbeille', 'acces'];
/** Postes dont le Fondateur peut régler les pages (jamais les Fondateurs, les parents ni les élèves). */
export const ASSIGNABLE_ROLES = ['directeur', 'informaticien', 'assistant_direction', 'secretaire', 'comptable', 'educateur', 'enseignant'];

/**
 * Réglages de l'école : pages ajoutées / retirées par poste, par rapport aux droits par défaut.
 * Un POSTE CRÉÉ PAR LA DIRECTION (identifiant « poste_… ») est une entrée `custom: true` avec son
 * libellé et ses pages (`add`) ; il est toujours en CONSULTATION SEULE (aucune écriture).
 */
export type PageOverrides = Record<string, { add?: string[]; remove?: string[]; custom?: boolean; label?: string }>;
export const PAGE_ACCESS_KEY = 'schoolflow_page_access_v1';

export const CUSTOM_ROLE_PREFIX = 'poste_';
export function isCustomRole(roleId: string | undefined | null): boolean {
  return String(roleId || '').startsWith(CUSTOM_ROLE_PREFIX);
}
/** Poste du personnel (poste prévu par le logiciel OU créé par la Direction). */
export function isStaffRole(roleId: string | undefined | null): boolean {
  return ALL_STAFF_ROLES.includes(String(roleId || '')) || isCustomRole(roleId);
}
/** Pages qu'un poste créé peut recevoir (jamais les pages réservées ni les Archives). */
export const CUSTOM_ROLE_PAGES = ALL_PAGES.filter((p) => !['administration', 'parametres', 'corbeille', 'acces', 'archives'].includes(p));

/** Postes créés par la Direction : [{ id, label }]. */
export function customRoles(overrides?: PageOverrides | null): { id: string; label: string }[] {
  return Object.entries(overrides || {})
    .filter(([id, o]) => isCustomRole(id) && o?.custom)
    .map(([id, o]) => ({ id, label: String(o.label || id.slice(CUSTOM_ROLE_PREFIX.length)) }));
}

/** Pages d'un poste = droits par défaut + réglages de l'école (clair : Fondateurs inchangés). */
export function effectivePages(roleId: string | undefined | null, overrides?: PageOverrides | null): string[] {
  const role = String(roleId || '');
  if (isCustomRole(role)) {
    const o = overrides?.[role];
    if (!o?.custom) return [];
    return Array.from(new Set((o.add || []).filter((p) => CUSTOM_ROLE_PAGES.includes(p))));
  }
  const base = allowedPages(role);
  if (!overrides || !ASSIGNABLE_ROLES.includes(role)) return base;
  const o = overrides[role];
  if (!o) return base;
  const set = new Set(base);
  for (const p of o.add || []) if (ALL_PAGES.includes(p) && !FOUNDER_ONLY_PAGES.includes(p)) set.add(p);
  for (const p of o.remove || []) set.delete(p);
  return Array.from(set);
}

const PEDAGOGY = ['classes', 'presences', 'notes', 'bulletins', 'distinctions'];
const SERVICES = ['cantine', 'transport', 'internat'];
const FINANCE = ['versements', 'depenses', 'rapports'];

const ROLE_PAGES: Record<string, string[]> = {
  fondateur: ALL_PAGES,
  fondateur_adjoint: ALL_PAGES,
  informaticien: ALL_PAGES.filter((p) => !['administration', 'parametres', 'corbeille', 'archives', 'acces'].includes(p)),
  // « pointage » : chaque membre du personnel pointe son arrivée / son départ (page commune).
  directeur: ['eleves', 'documents', ...PEDAGOGY, 'communication', 'bulletins-parents', 'personnel', 'cartes', 'pointage', 'sante', 'notes-diverses'],
  // « archives » : le Comptable n'y entre qu'avec le code des chiffres (vérifié par /api/archives).
  comptable: ['dashboard', 'inscriptions', 'eleves', ...SERVICES, ...FINANCE, 'reductions', 'salaires', 'personnel', 'pointage', 'sante', 'notes-diverses', 'archives'],
  secretaire: ['eleves', 'documents', ...PEDAGOGY, ...SERVICES, 'cartes', 'pointage'],
  assistant_direction: ['eleves', 'documents', 'classes', 'personnel', 'cartes', 'pointage', 'sante', 'notes-diverses'],
  educateur: ['eleves', 'classes', 'presences', 'bulletins', 'distinctions', 'cartes', 'pointage', 'sante', 'notes-diverses'],
  enseignant: [...PEDAGOGY, 'pointage', 'notes-diverses'],
  // « communication » est la boîte de réception de la Direction : les parents ont leur page.
  parent: ['bulletins-parents', 'messagerie-parent', 'notes-diverses'],
  // Élève : ses notes et bulletins uniquement (même page que les parents, limitée à lui).
  eleve: ['bulletins-parents', 'notes-diverses'],
};

/** Page d'arrivée de chaque poste. */
const ROLE_HOME: Record<string, string> = {
  directeur: 'eleves',
  secretaire: 'eleves',
  assistant_direction: 'eleves',
  educateur: 'eleves',
  enseignant: 'notes',
  parent: 'bulletins-parents',
  eleve: 'bulletins-parents',
};

/** Familles (parent) et élèves : ne voient que leurs propres enfants / leur propre fiche. */
export const FAMILY_ROLES = ['parent', 'eleve'];

export function isFounderRole(roleId: string | undefined | null): boolean {
  return FOUNDER_ROLES.includes(String(roleId || ''));
}

export function allowedPages(roleId: string | undefined | null): string[] {
  return ROLE_PAGES[String(roleId || '')] || [];
}

export function canAccessPage(roleId: string | undefined | null, page: string): boolean {
  return allowedPages(roleId).includes(page);
}

export function homePage(roleId: string | undefined | null): string {
  const r = String(roleId || '');
  return ROLE_HOME[r] || allowedPages(r)[0] || 'dashboard';
}

// ─── Écritures (vérifiées par le serveur) ───────────────────────────────────────────────
/** Créer / modifier élèves et encaissements. */
export const STUDENT_WRITE_ROLES = ['fondateur', 'fondateur_adjoint', 'directeur', 'comptable'];
/** Supprimer élèves ou encaissements. */
export const DELETE_ROLES = ['fondateur', 'fondateur_adjoint', 'directeur', 'comptable'];
/** Internat, cantine, transport, échéanciers et versements : le Comptable (et les Fondateurs). */
export const SERVICES_WRITE_ROLES = ['fondateur', 'fondateur_adjoint', 'comptable'];
/** Consultation seule (aucune écriture ; l'Éducateur garde l'appel de présence). */
export const READ_ONLY_ROLES = ['secretaire', 'assistant_direction', 'educateur', 'informaticien'];

// ─── Messages aux parents ─────────────────────────────────────────────────────────────
/**
 * DÉCISION UTILISATEUR (2026-11-23) : seule la Direction envoie les notes et les alertes d'absence /
 * de retard aux parents (boutons WhatsApp) : Fondateur, DGA, Directeur, Secrétaire, Assistant(e) de
 * Direction et Informaticien. Les Enseignants (et Éducateurs) saisissent seulement.
 */
// L'Éducateur y figure (décision du 2026-11-23) : il utilise le téléphone de la Direction.
export const PARENT_NOTIFY_ROLES = ['fondateur', 'fondateur_adjoint', 'directeur', 'secretaire', 'assistant_direction', 'informaticien', 'educateur'];

export function canNotifyParents(roleId: string | undefined | null, extraRoles: string[] = []): boolean {
  const r = String(roleId || '');
  return PARENT_NOTIFY_ROLES.includes(r) || extraRoles.includes(r);
}

// ─── Pointage du personnel ─────────────────────────────────────────────────────────────
/** Règlent les horaires / la position de l'école et justifient les absences. */
export const POINTAGE_MANAGER_ROLES = ['fondateur', 'fondateur_adjoint', 'directeur'];
/** Voient le tableau de tout le personnel (les autres ne voient que leur propre pointage). */
// DÉCISION UTILISATEUR (2026-11-16) : + Secrétaire et Assistant(e) de Direction. Enseignants et
// Éducateurs ne voient que leur propre pointage.
export const POINTAGE_VIEW_ALL_ROLES = [
  ...POINTAGE_MANAGER_ROLES,
  'comptable',
  'informaticien',
  'secretaire',
  'assistant_direction',
];
/** Ne pointent pas (direction générale). */
export const POINTAGE_EXEMPT_ROLES = FOUNDER_ROLES;

// ─── Chiffres globaux ──────────────────────────────────────────────────────────────────
/** Voient les chiffres globaux en clair. */
export const FIGURES_VISIBLE_ROLES = FOUNDER_ROLES;
/** Peuvent les afficher avec le code du Fondateur (3 essais, puis 30 min de blocage). */
export const FIGURES_UNLOCK_ROLES = ['comptable'];
