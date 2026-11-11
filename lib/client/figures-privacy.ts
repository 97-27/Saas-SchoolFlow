'use client';

import { useSyncExternalStore } from 'react';
import { FIGURES_UNLOCK_ROLES, FIGURES_VISIBLE_ROLES } from '@/lib/auth/roles';

/**
 * Masquage des chiffres globaux (totaux encaissés, recettes du jour, structure des
 * encaissements, masse salariale…).
 *  - Fondateur et Fondateur adjoint : tout est visible. Ils ont un interrupteur
 *    « Chiffres ouverts au Comptable » (Administration & Codes).
 *  - Comptable : interrupteur OUVERT → chiffres visibles sans code. FERMÉ → masqués « •••••• »
 *    aussitôt ; un clic demande le code du Fondateur (vérifié par le serveur, /api/auth/figures ;
 *    3 essais puis 30 min de blocage) et affiche les chiffres 30 minutes dans cet onglet. Fermer
 *    l'interrupteur annule aussi un déverrouillage par code en cours.
 *  - Tous les autres postes : toujours masqués.
 *
 * C'est un masquage d'AFFICHAGE : les montants détaillés restent nécessaires au travail du
 * Comptable (reçus, caisse), ils ne sont donc pas retirés des données de la page.
 */

const UNLOCK_KEY = 'schoolflow_figures_unlocked_until_v1';
const UNLOCK_MS = 30 * 60 * 1000;
const POLL_MS = 15000;
export const MASK = '••••••';
/** Signal envoyé aux autres appareils quand le Fondateur ouvre / ferme les chiffres. */
export const FIGURES_POLICY_EVENT = 'schoolflow-figures-policy-changed';

type State = {
  roleId: string;
  unlockedUntil: number;
  dialogOpen: boolean;
  notice: string;
  lockedUntil: number;
  openToComptable: boolean;
  policyChangedAt: number;
  /** Code des chiffres (6 chiffres) : connu seulement du Fondateur / DGA. */
  figuresCode: string;
  hasFiguresCode: boolean;
};

const EMPTY: State = {
  figuresCode: '',
  hasFiguresCode: false,
  roleId: '',
  unlockedUntil: 0,
  dialogOpen: false,
  notice: '',
  lockedUntil: 0,
  openToComptable: false,
  policyChangedAt: 0,
};

let state: State = { ...EMPTY };
const listeners = new Set<() => void>();
let initialized = false;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

function readLocalRole(): string {
  try {
    const raw = localStorage.getItem('schoolflow_active_session_v2');
    return raw ? String(JSON.parse(raw)?.roleId || '') : '';
  } catch (e) {
    return '';
  }
}

function scheduleExpiry() {
  if (expiryTimer) clearTimeout(expiryTimer);
  const left = state.unlockedUntil - Date.now();
  if (left > 0) expiryTimer = setTimeout(() => setState({ unlockedUntil: 0 }), left + 50);
}

function clearUnlock() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch (e) {}
}

/** Relit le poste, l'interrupteur du Fondateur et le blocage (serveur = dernier mot). */
function fetchServerState() {
  return fetch('/api/auth/figures', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j?.success || typeof j.roleId !== 'string') return;
      const policyChangedAt = Number(j.policyChangedAt) || 0;
      const open = j.openToComptable === true;
      const patch: Partial<State> = {
        roleId: j.roleId,
        lockedUntil: Number(j.lockedUntil) || 0,
        openToComptable: open,
        policyChangedAt,
        figuresCode: typeof j.figuresCode === 'string' ? j.figuresCode : '',
        hasFiguresCode: j.hasFiguresCode === true,
      };
      // Fermé APRÈS le déverrouillage par code : il est annulé tout de suite.
      const unlockStart = state.unlockedUntil - UNLOCK_MS;
      if (!open && state.unlockedUntil > 0 && policyChangedAt > unlockStart) {
        clearUnlock();
        patch.unlockedUntil = 0;
      }
      setState(patch);
    })
    .catch(() => {});
}

function init() {
  if (initialized || typeof window === 'undefined') return;
  refreshFiguresSession();
}

/** Relit le poste et le déverrouillage (appelé à chaque montage de l'espace de gestion :
 *  après une déconnexion puis une connexion sous un autre poste, rien n'est conservé). */
export function refreshFiguresSession() {
  if (typeof window === 'undefined') return;
  const first = !initialized;
  initialized = true;
  let until = 0;
  try {
    until = Number(sessionStorage.getItem(UNLOCK_KEY) || 0);
  } catch (e) {}
  setState({ roleId: readLocalRole(), unlockedUntil: until > Date.now() ? until : 0 });
  scheduleExpiry();
  fetchServerState();

  if (first) {
    // Le Comptable relit l'interrupteur régulièrement (et dès qu'un signal arrive) : quand le
    // Fondateur ferme les chiffres, ils se masquent en quelques secondes sur son écran.
    pollTimer = setInterval(() => {
      if (!FIGURES_UNLOCK_ROLES.includes(state.roleId)) return;
      if (document.visibilityState !== 'visible') return;
      fetchServerState();
    }, POLL_MS);
    window.addEventListener(FIGURES_POLICY_EVENT, () => fetchServerState());
    window.addEventListener('focus', () => {
      if (FIGURES_UNLOCK_ROLES.includes(state.roleId)) fetchServerState();
    });
  }
}

function subscribe(listener: () => void) {
  init();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverSnapshot: State = { ...EMPTY };

export function useFiguresState() {
  const s = useSyncExternalStore(subscribe, () => state, () => serverSnapshot);
  const isFounder = FIGURES_VISIBLE_ROLES.includes(s.roleId);
  const canUnlock = FIGURES_UNLOCK_ROLES.includes(s.roleId);
  const openByFounder = canUnlock && s.openToComptable;
  const visible = isFounder || openByFounder || (canUnlock && s.unlockedUntil > Date.now());
  return { ...s, visible, isFounder, canUnlock, openByFounder };
}

/** Clic sur un chiffre masqué. */
export function requestFiguresUnlock() {
  init();
  if (FIGURES_UNLOCK_ROLES.includes(state.roleId)) setState({ dialogOpen: true });
  else setState({ notice: 'Chiffres réservés au Fondateur.' });
}

export function closeFiguresDialog() {
  setState({ dialogOpen: false });
}

export function clearFiguresNotice() {
  setState({ notice: '' });
}

export function lockFigures() {
  clearUnlock();
  setState({ unlockedUntil: 0 });
}

async function putPolicy(body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/figures', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.success) return j?.error || 'Enregistrement impossible. Réessayez.';
    setState({
      openToComptable: j.openToComptable === true,
      policyChangedAt: Number(j.policyChangedAt) || Date.now(),
      figuresCode: typeof j.figuresCode === 'string' ? j.figuresCode : '',
      hasFiguresCode: j.hasFiguresCode === true,
    });
    return null;
  } catch (e) {
    return 'Connexion impossible. Réessayez.';
  }
}

/** Fondateur / Fondateur adjoint : ouvre ou ferme les chiffres au Comptable. */
export function setFiguresOpenToComptable(open: boolean): Promise<string | null> {
  return putPolicy({ open });
}

/** Fondateur / Fondateur adjoint : fixe (6 chiffres) ou génère le code des chiffres du Comptable. */
export function setFiguresCode(code: string | 'generate'): Promise<string | null> {
  return putPolicy({ code });
}

/** Vérifie le code auprès du serveur. Renvoie un message d'erreur, ou null si c'est bon. */
export async function submitFiguresCode(code: string): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/figures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const j = await res.json().catch(() => null);
    if (j?.lockedUntil) setState({ lockedUntil: Number(j.lockedUntil) || 0 });
    if (!res.ok || !j?.success) return j?.error || 'Code incorrect.';
    const until = Date.now() + UNLOCK_MS;
    try {
      sessionStorage.setItem(UNLOCK_KEY, String(until));
    } catch (e) {}
    setState({ unlockedUntil: until, dialogOpen: false });
    scheduleExpiry();
    return null;
  } catch (e) {
    return 'Connexion impossible. Réessayez.';
  }
}
