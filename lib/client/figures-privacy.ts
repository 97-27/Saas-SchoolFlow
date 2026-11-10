'use client';

import { useSyncExternalStore } from 'react';
import { FIGURES_UNLOCK_ROLES, FIGURES_VISIBLE_ROLES } from '@/lib/auth/roles';

/**
 * Masquage des chiffres globaux (totaux encaissés, recettes du jour, structure des
 * encaissements, masse salariale…).
 *  - Fondateur et Fondateur adjoint : tout est visible.
 *  - Comptable : chiffres masqués « •••••• » ; un clic demande le code du Fondateur (vérifié
 *    par le serveur, /api/auth/figures ; 3 essais puis 30 min de blocage) et affiche les
 *    chiffres pendant 30 minutes dans cet onglet.
 *  - Tous les autres postes : toujours masqués.
 *
 * C'est un masquage d'AFFICHAGE : les montants détaillés restent nécessaires au travail du
 * Comptable (reçus, caisse), ils ne sont donc pas retirés des données de la page.
 */

const UNLOCK_KEY = 'schoolflow_figures_unlocked_until_v1';
const UNLOCK_MS = 30 * 60 * 1000;
export const MASK = '••••••';

type State = { roleId: string; unlockedUntil: number; dialogOpen: boolean; notice: string; lockedUntil: number };

let state: State = { roleId: '', unlockedUntil: 0, dialogOpen: false, notice: '', lockedUntil: 0 };
const listeners = new Set<() => void>();
let initialized = false;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

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

function init() {
  if (initialized || typeof window === 'undefined') return;
  refreshFiguresSession();
}

/** Relit le poste et le déverrouillage (appelé à chaque montage de l'espace de gestion :
 *  après une déconnexion puis une connexion sous un autre poste, rien n'est conservé). */
export function refreshFiguresSession() {
  if (typeof window === 'undefined') return;
  initialized = true;
  let until = 0;
  try {
    until = Number(sessionStorage.getItem(UNLOCK_KEY) || 0);
  } catch (e) {}
  setState({ roleId: readLocalRole(), unlockedUntil: until > Date.now() ? until : 0 });
  scheduleExpiry();
  // Le serveur a le dernier mot sur le poste (on ne se fie pas à la copie du navigateur).
  fetch('/api/auth/figures', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (j?.success && typeof j.roleId === 'string') setState({ roleId: j.roleId, lockedUntil: Number(j.lockedUntil) || 0 });
    })
    .catch(() => {});
}

function subscribe(listener: () => void) {
  init();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverSnapshot: State = { roleId: '', unlockedUntil: 0, dialogOpen: false, notice: '', lockedUntil: 0 };

export function useFiguresState() {
  const s = useSyncExternalStore(subscribe, () => state, () => serverSnapshot);
  const isFounder = FIGURES_VISIBLE_ROLES.includes(s.roleId);
  const canUnlock = FIGURES_UNLOCK_ROLES.includes(s.roleId);
  const visible = isFounder || (canUnlock && s.unlockedUntil > Date.now());
  return { ...s, visible, isFounder, canUnlock };
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
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch (e) {}
  setState({ unlockedUntil: 0 });
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
