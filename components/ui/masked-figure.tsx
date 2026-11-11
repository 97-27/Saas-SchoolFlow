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
  setFiguresOpenToComptable,
  setFiguresCode,
} from '@/lib/client/figures-privacy';
import { broadcastLiveUpdate } from '@/lib/data/live-store';

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
      title="Chiffre masqué — cliquez pour l’afficher (code des chiffres)"
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
        {canUnlock ? ' Saisissez le code des chiffres pour les afficher.' : ''}
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

/**
 * Administration & Codes (Fondateur / Fondateur adjoint) : interrupteur « Chiffres ouverts au
 * Comptable ». Fermer masque aussitôt les chiffres sur l'écran du Comptable (signal immédiat +
 * relecture toutes les 15 s), y compris un déverrouillage par code en cours.
 */
export function FiguresPolicyCard({ schoolSlug }: { schoolSlug: string }) {
  const { openToComptable, isFounder, figuresCode } = useFiguresState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCode, setShowCode] = useState(false);
  if (!isFounder) return null;

  const saveCode = async (value: string | 'generate') => {
    if (codeBusy) return;
    setCodeBusy(true);
    setCodeMsg(null);
    const err = await setFiguresCode(value);
    setCodeBusy(false);
    if (err) {
      setCodeMsg({ ok: false, text: err });
      return;
    }
    setCodeInput('');
    setShowCode(true);
    setCodeMsg({ ok: true, text: 'Nouveau code enregistré. Donnez-le au Comptable ; l’ancien ne marche plus.' });
    broadcastLiveUpdate({ action: 'figures_policy_changed', schoolSlug });
  };

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const err = await setFiguresOpenToComptable(!openToComptable);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    broadcastLiveUpdate({ action: 'figures_policy_changed', schoolSlug });
  };

  return (
    <div className={`rounded-3xl border shadow-xs ${openToComptable ? 'bg-emerald-50/70 border-emerald-200' : 'bg-white border-slate-200/80'}`}>
    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
            openToComptable ? 'bg-emerald-600 text-white' : 'bg-rose-50 text-rose-600'
          }`}
        >
          {openToComptable ? <Eye className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 font-heading">Chiffres globaux du Comptable</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {openToComptable
              ? 'OUVERTS : le Comptable voit les totaux, recettes et rapports sans code.'
              : 'FERMÉS : chiffres masqués « •••••• » chez le Comptable (code du Fondateur demandé).'}
          </p>
          {error && <p className="text-xs font-semibold text-rose-600 mt-1">{error}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0 ${
          openToComptable ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
        }`}
      >
        {openToComptable ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        {busy ? 'Enregistrement…' : openToComptable ? 'Fermer les chiffres' : 'Ouvrir les chiffres au Comptable'}
      </button>
    </div>

    {/* Code des chiffres (6 chiffres) : le Comptable affiche lui-même les chiffres avec ce code. */}
    <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-4 border-t border-slate-200/70 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-900">Code des chiffres du Comptable (6 chiffres)</p>
          <p className="text-[11px] text-slate-500">
            Avec ce code, le Comptable affiche les chiffres 30 min sans votre intervention. Changez-le quand vous voulez.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-mono font-black tracking-[0.3em] text-sm min-w-[96px] text-center">
            {figuresCode ? (showCode ? figuresCode : '••••••') : '——'}
          </span>
          {figuresCode && (
            <button
              type="button"
              onClick={() => setShowCode((v) => !v)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              title={showCode ? 'Cacher le code' : 'Voir le code'}
            >
              {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Nouveau code (6 chiffres)"
          className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
        <button
          type="button"
          disabled={codeBusy || codeInput.length !== 6}
          onClick={() => saveCode(codeInput)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
        >
          Enregistrer ce code
        </button>
        <button
          type="button"
          disabled={codeBusy}
          onClick={() => saveCode('generate')}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
        >
          {codeBusy ? '…' : 'Générer un code'}
        </button>
      </div>
      {codeMsg && (
        <p className={`text-xs font-semibold ${codeMsg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{codeMsg.text}</p>
      )}
      {!figuresCode && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Aucun code des chiffres pour l’instant : le Comptable doit saisir votre code personnel. Créez-en un pour ne plus avoir à le donner.
        </p>
      )}
    </div>
    </div>
  );
}

/** Variante texte (attribut title, message…) : renvoie la chaîne ou le masque. */
export function useFigureText() {
  const { visible } = useFiguresState();
  return (text: string) => (visible ? text : MASK);
}

/**
 * Fenêtre de saisie du code (Comptable), message « réservé au Fondateur » (autres postes) et
 * bouton « Masquer les chiffres ». Montée UNE seule fois, dans DashboardShell.
 */
export function FiguresPrivacyHost() {
  const { dialogOpen, notice, canUnlock, isFounder, visible, lockedUntil, openByFounder } = useFiguresState();
  const [now, setNow] = useState(() => Date.now());
  const locked = lockedUntil > now;
  const minutesLeft = Math.max(1, Math.ceil((lockedUntil - now) / 60000));

  // Compte à rebours du blocage (3 codes faux → 30 minutes).
  useEffect(() => {
    if (!dialogOpen || lockedUntil <= Date.now()) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [dialogOpen, lockedUntil]);
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
    if (!code.trim() || busy || locked) return;
    setBusy(true);
    const err = await submitFiguresCode(code);
    setBusy(false);
    setNow(Date.now());
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

      {canUnlock && visible && !isFounder && !openByFounder && (
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
                  <p className="text-[11px] text-slate-500">Code des chiffres donné par le Fondateur ou le DGA (3 essais).</p>
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
                disabled={locked}
                placeholder={locked ? 'Saisie bloquée' : 'Code des chiffres'}
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
            {locked ? (
              <p className="text-xs font-semibold text-rose-600">
                Saisie du code bloquée après 3 essais incorrects. Réessayez dans {minutesLeft} minute{minutesLeft > 1 ? 's' : ''}.
              </p>
            ) : (
              error && <p className="text-xs font-semibold text-rose-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy || locked || !code.trim()}
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
