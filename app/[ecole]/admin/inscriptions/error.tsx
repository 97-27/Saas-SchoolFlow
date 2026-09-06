'use client';

import React, { useEffect } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function InscriptionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Inscriptions Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border-2 border-slate-200 shadow-xl p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 font-heading">
            Récupération du formulaire d&apos;inscription
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Une interruption temporaire est survenue lors du chargement des coordonnées du reçu. Cliquez sur recharger pour reprendre votre saisie.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Recharger le formulaire</span>
          </button>
        </div>
      </div>
    </div>
  );
}
