'use client';

import { useEffect, useState } from 'react';

/**
 * Un seul onglet de SchoolFlow à la fois (par navigateur).
 * Chaque onglet écrit un « battement de cœur » dans localStorage toutes les 2 s. Un nouvel onglet
 * voit un battement récent d'un autre onglet → il affiche « déjà ouvert ailleurs » et attend. Dès
 * que l'autre onglet est fermé (battement périmé), il prend la main tout seul. Le bouton
 * « Utiliser cet onglet » lui laisse la main à la place de l'autre, qui affiche alors le même message.
 */
const KEY = 'schoolflow_open_tab_v1';
const BEAT_MS = 2000;
const STALE_MS = 5000;

type Beat = { id: string; ts: number };

function readBeat(): Beat | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && typeof v.id === 'string' && typeof v.ts === 'number' ? v : null;
  } catch {
    return null;
  }
}

export function useSingleTab(): { state: 'checking' | 'owner' | 'blocked'; takeOver: () => void } {
  const [state, setState] = useState<'checking' | 'owner' | 'blocked'>('checking');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let owner = false;

    const isOther = (b: Beat | null) => !!b && b.id !== id && Date.now() - b.ts < STALE_MS;
    const write = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ id, ts: Date.now() }));
      } catch {}
    };
    const claim = () => {
      owner = true;
      write();
      setState('owner');
    };
    const check = () => {
      const cur = readBeat();
      if (owner) {
        if (isOther(cur)) {
          owner = false;
          setState('blocked');
        } else write();
      } else if (!isOther(cur)) {
        claim();
      }
    };

    check();
    if (!owner) setState('blocked');
    const timer = setInterval(check, BEAT_MS);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) check();
    };
    const onLeave = () => {
      if (owner) {
        try {
          localStorage.removeItem(KEY);
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('pagehide', onLeave);
    (window as any).__sfTakeOver = claim;
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pagehide', onLeave);
      onLeave();
    };
  }, []);

  const takeOver = () => {
    const fn = (window as any).__sfTakeOver;
    if (typeof fn === 'function') fn();
  };

  return { state, takeOver };
}
