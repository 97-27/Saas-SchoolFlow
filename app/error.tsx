'use client';

import React, { useEffect } from 'react';
import { reportClientError } from '@/lib/client/error-report';

/**
 * Écran de secours de TOUTES les pages (connexion comprise) : au lieu d'un écran blanc, un
 * message clair et un bouton pour réessayer. L'erreur est signalée au serveur.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, 'Page en erreur (racine)');
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-6 text-center space-y-4">
        <h2 className="text-lg font-black text-slate-900">Un petit souci d&apos;affichage</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Vos données sont en sécurité dans la base. Appuyez sur « Réessayer » ; si le problème continue, rechargez la page.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold"
          >
            Recharger la page
          </button>
        </div>
      </div>
    </div>
  );
}
