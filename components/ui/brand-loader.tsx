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
 * Écran de chargement School Flow Africa : des points partent du bord, tournent autour du logo
 * puis s'y enroulent (boucle), avec un halo qui respire. Messages qui tournent et avertissement
 * si la connexion est lente. Animation CSS seule (pas de bibliothèque).
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

  const dots = [
    { color: 'bg-emerald-500', delay: '0s' },
    { color: 'bg-amber-400', delay: '-0.9s' },
    { color: 'bg-slate-900', delay: '-1.8s' },
    { color: 'bg-emerald-300', delay: '-2.7s' },
  ];

  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-5 ${compact ? 'py-16' : 'min-h-[60vh] py-20'}`}
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes sf-orbit {
          0%   { transform: rotate(0deg) translateX(74px) rotate(0deg) scale(1); opacity: 0; }
          10%  { opacity: 1; }
          70%  { transform: rotate(260deg) translateX(46px) rotate(-260deg) scale(1); opacity: 1; }
          100% { transform: rotate(360deg) translateX(0px) rotate(-360deg) scale(0.4); opacity: 0; }
        }
        @keyframes sf-halo {
          0%, 100% { transform: scale(0.92); opacity: 0.35; }
          50% { transform: scale(1.12); opacity: 0.6; }
        }
        @keyframes sf-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>

      <div className="relative w-40 h-40 flex items-center justify-center">
        <div
          className="absolute inset-2 rounded-full bg-gradient-to-br from-emerald-300 to-amber-200 blur-xl"
          style={{ animation: 'sf-halo 2.4s ease-in-out infinite' }}
        />
        {dots.map((d, k) => (
          <span
            key={k}
            className={`absolute left-1/2 top-1/2 -ml-[5px] -mt-[5px] w-2.5 h-2.5 rounded-full ${d.color} shadow-sm`}
            style={{ animation: `sf-orbit 3.6s cubic-bezier(.45,.05,.55,.95) ${d.delay} infinite` }}
          />
        ))}
        <div className="relative" style={{ animation: 'sf-bob 2.8s ease-in-out infinite' }}>
          <SchoolFlowLogo size="xl" iconOnly showTagline={false} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-extrabold text-slate-900 font-heading">{title || MESSAGES[i]}</p>
        <p className="text-[11px] font-bold text-emerald-700">School Flow Africa</p>
        {slow && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 inline-block">
            Connexion lente : un instant encore, vos données arrivent.
          </p>
        )}
      </div>
    </div>
  );
}
