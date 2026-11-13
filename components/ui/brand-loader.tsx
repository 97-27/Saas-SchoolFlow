'use client';

import React, { useEffect, useState } from 'react';
import { SchoolFlowLogo } from '@/components/ui/schoolflow-logo';

const MESSAGES = [
  'Ouverture de votre espace…',
  'Lecture des données de l’établissement…',
  'Vérification de la session…',
  'Presque prêt…',
];

/**
 * Écran de chargement aux couleurs de SchoolFlow (navigation entre pages, première lecture de
 * la base). Messages qui tournent + conseil réseau si cela dure (connexion lente).
 */
export function BrandLoader({ title, compact = false }: { title?: string; compact?: boolean }) {
  const [i, setI] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % MESSAGES.length), 1800);
    const s = setTimeout(() => setSlow(true), 8000);
    return () => {
      clearInterval(t);
      clearTimeout(s);
    };
  }, []);
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-5 ${compact ? 'py-16' : 'min-h-[60vh] py-20'}`}
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        <div className="absolute -inset-4 rounded-full bg-emerald-400/20 blur-xl animate-pulse" />
        <div className="relative">
          <SchoolFlowLogo size="xl" iconOnly showTagline={false} />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-extrabold text-slate-900 font-heading">{title || MESSAGES[i]}</p>
        <p className="text-[11px] font-bold text-emerald-700">School Flow Africa</p>
        <div className="flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-slate-900 animate-bounce" />
        </div>
        {slow && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 inline-block">
            Connexion lente : un instant encore, vos données arrivent.
          </p>
        )}
      </div>
    </div>
  );
}
