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
  fondateur: 'Fondateur',
  fondateur_adjoint: 'Fondateur adjoint (DGA)',
  directeur: 'Directeur',
  informaticien: 'Informaticien',
  assistant_direction: 'Assistant(e) de Direction',
  secretaire: 'Secrétaire de Direction',
  comptable: 'Comptable / Gestionnaire',
  enseignant: 'Enseignant / Professeur',
  educateur: 'Éducateur / Conseiller d’Éducation',
  parent: 'Parent / Tuteur',
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
  'sante',
  'notes-diverses',
  'corbeille',
  'parametres',
];

const PEDAGOGY = ['classes', 'presences', 'notes', 'bulletins', 'distinctions'];
const SERVICES = ['cantine', 'transport', 'internat'];
const FINANCE = ['versements', 'depenses', 'rapports'];

const ROLE_PAGES: Record<string, string[]> = {
  fondateur: ALL_PAGES,
  fondateur_adjoint: ALL_PAGES,
  informaticien: ALL_PAGES.filter((p) => !['administration', 'parametres', 'corbeille'].includes(p)),
  directeur: ['eleves', 'documents', ...PEDAGOGY, 'communication', 'bulletins-parents', 'personnel', 'sante', 'notes-diverses'],
  comptable: ['dashboard', 'inscriptions', 'eleves', ...SERVICES, ...FINANCE, 'reductions', 'salaires', 'personnel', 'sante', 'notes-diverses'],
  secretaire: ['eleves', 'documents', ...SERVICES],
  assistant_direction: ['eleves', 'documents', 'classes', 'personnel', 'sante', 'notes-diverses'],
  educateur: ['eleves', 'classes', 'presences', 'bulletins', 'distinctions', 'sante', 'notes-diverses'],
  enseignant: [...PEDAGOGY, 'notes-diverses'],
  // « communication » est la boîte de réception de la Direction : les parents ont leur page.
  parent: ['bulletins-parents', 'messagerie-parent', 'notes-diverses'],
};

/** Page d'arrivée de chaque poste. */
const ROLE_HOME: Record<string, string> = {
  directeur: 'eleves',
  secretaire: 'eleves',
  assistant_direction: 'eleves',
  educateur: 'eleves',
  enseignant: 'notes',
  parent: 'bulletins-parents',
};

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

// ─── Chiffres globaux ──────────────────────────────────────────────────────────────────
/** Voient les chiffres globaux en clair. */
export const FIGURES_VISIBLE_ROLES = FOUNDER_ROLES;
/** Peuvent les afficher avec le code du Fondateur (3 essais, puis 30 min de blocage). */
export const FIGURES_UNLOCK_ROLES = ['comptable'];
