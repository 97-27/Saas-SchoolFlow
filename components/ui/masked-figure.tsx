'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Lock, Eye, EyeOff, X } from 'lucide-react';
import {
  MASK,
  useFiguresState,
  requestFiguresUnlock,
  closeFiguresDialog,
  clearFiguresNotice,
  lockFigures,
  submitFiguresCode,
  refreshFiguresSession,
} from '@/lib/client/figures-privacy';

/**
 * Affiche un chiffre global en clair pour le Fondateur, sinon « •••••• » cliquable.
 *   <Figure>{formatFCFA(total)}</Figure>
 */
export function Figure({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { visible } = useFiguresState();
  if (visible) return <>{children}</>;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        requestFiguresUnlock();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          requestFiguresUnlock();
        }
      }}
      title="Chiffre masqué — cliquez pour l’afficher (code du Fondateur)"
      className={`inline-flex items-center gap-1 align-baseline cursor-pointer select-none tracking-widest hover:opacity-70 transition-opacity ${className}`}
    >
      <span aria-hidden="true">{MASK}</span>
      <Lock className="w-[0.7em] h-[0.7em] opacity-60 shrink-0" aria-hidden="true" />
      <span className="sr-only">Chiffre masqué</span>
    </span>
  );
}

/** Page entièrement composée de chiffres globaux (Rapport financier) : verrouillée d'un bloc. */
export function FiguresGate({ children, title }: { children: React.ReactNode; title: string }) {
  const { visible, canUnlock } = useFiguresState();
  if (visible) return <>{children}</>;
  return (
    <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
        <Lock className="w-5 h-5" />
      </div>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500">
        Les chiffres globaux de l’établissement sont réservés au Fondateur.
        {canUnlock ? ' Saisissez le code du Fondateur pour les afficher.' : ''}
      </p>
      {canUnlock && (
        <button
          type="button"
          onClick={requestFiguresUnlock}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          Afficher les chiffres
        </button>
      )}
    </div>
  );
}

/** Variante texte (attribut title, message…) : renvoie la chaîne ou le masque. */
export function useFigureText() {
  const { visible } = useFiguresState();
  return (text: string) => (visible ? text : MASK);
}

/**
 * Fenêtre de saisie du code (Directeur), message « réservé au Fondateur » (autres postes) et
 * bouton « Masquer les chiffres ». Montée UNE seule fois, dans DashboardShell.
 */
export function FiguresPrivacyHost() {
  const { dialogOpen, notice, canUnlock, isFounder, visible } = useFiguresState();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshFiguresSession();
  }, []);

  useEffect(() => {
    if (dialogOpen) {
      setCode('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearFiguresNotice, 2600);
    return () => clearTimeout(t);
  }, [notice]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    const err = await submitFiguresCode(code);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <>
      {notice && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-lg flex items-center gap-2 print:hidden">
          <Lock className="w-3.5 h-3.5 text-amber-300" />
          {notice}
        </div>
      )}

      {canUnlock && visible && !isFounder && (
        <button
          type="button"
          onClick={lockFigures}
          className="fixed bottom-5 right-5 z-[150] px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-lg flex items-center gap-2 hover:bg-slate-800 cursor-pointer print:hidden"
        >
          <EyeOff className="w-3.5 h-3.5" />
          Masquer les chiffres
        </button>
      )}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-[210] bg-slate-950/50 flex items-center justify-center p-4 print:hidden"
          onClick={closeFiguresDialog}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Afficher les chiffres</h3>
                  <p className="text-[11px] text-slate-500">Saisissez le code du Fondateur.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeFiguresDialog}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type={show ? 'text' : 'password'}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError('');
                }}
                autoComplete="off"
                placeholder="Code du Fondateur"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                title={show ? 'Cacher le code' : 'Voir le code'}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold cursor-pointer"
            >
              {busy ? 'Vérification…' : 'Afficher pendant 30 minutes'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
