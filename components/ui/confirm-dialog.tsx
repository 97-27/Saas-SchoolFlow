'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Remplace les boîtes grises de Chrome (confirm) par une fenêtre aux couleurs du logiciel.
 * Usage : `if (!(await askConfirm('Supprimer ce reçu ?'))) return;` — <ConfirmHost /> est monté
 * une seule fois dans app/layout.tsx.
 */

type Req = { id: number; message: string; confirmLabel: string; danger: boolean; resolve: (ok: boolean) => void };
const EVT = 'sf-confirm-request';
let seq = 0;

export function askConfirm(message: string, opts?: { confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const req: Req = { id: ++seq, message, confirmLabel: opts?.confirmLabel || 'Confirmer', danger: opts?.danger ?? true, resolve };
    window.dispatchEvent(new CustomEvent(EVT, { detail: req }));
  });
}

export function ConfirmHost() {
  const [queue, setQueue] = useState<Req[]>([]);

  useEffect(() => {
    const onReq = (e: Event) => setQueue((q) => [...q, (e as CustomEvent<Req>).detail]);
    window.addEventListener(EVT, onReq);
    return () => window.removeEventListener(EVT, onReq);
  }, []);

  const cur = queue[0];
  const close = (ok: boolean) => {
    if (!cur) return;
    cur.resolve(ok);
    setQueue((q) => q.slice(1));
  };

  useEffect(() => {
    if (!cur) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id]);

  if (!cur) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px] print:hidden" onClick={() => close(false)}>
      <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cur.danger ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold text-slate-800 leading-snug whitespace-pre-line pt-1">{cur.message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => close(false)} className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white ${cur.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {cur.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
