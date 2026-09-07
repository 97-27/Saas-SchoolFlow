'use client';

import React, { useEffect } from 'react';
import { RotateCcw, AlertTriangle, ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const ecoleSlug = (params?.ecole as string) || 'college-excellence';

  useEffect(() => {
    console.error('Admin Module Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-[65vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border-2 border-slate-200 shadow-xl p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 font-heading">
            Chargement de la page
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Une interruption temporaire est survenue lors de l&apos;affichage de cette vue. Vos données sont préservées en toute sécurité. Cliquez sur recharger pour reprendre.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              try {
                reset();
              } catch {
                // Ignore reset error
              }
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Recharger la page</span>
          </button>

          <Link
            href={`/${ecoleSlug}/admin/dashboard`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            <Home className="w-4 h-4 text-slate-500" />
            <span>Tableau de bord</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
