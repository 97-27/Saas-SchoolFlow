'use client';

import React from 'react';

interface SchoolFlowLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'color';
  showTagline?: boolean;
  tagline?: string;
  iconOnly?: boolean;
  className?: string;
}

export function SchoolFlowLogo({
  size = 'md',
  variant = 'color',
  showTagline = true,
  tagline = 'Gestion Scolaire & Pédagogique',
  iconOnly = false,
  className = '',
}: SchoolFlowLogoProps) {
  // Dimensions de l'icône selon la taille
  const iconDimensions = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14',
  }[size];

  const titleSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  }[size];

  const taglineSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-[11px]',
    xl: 'text-xs',
  }[size];

  const isLight = variant === 'light';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Emblème Vectoriel Officiel SchoolFlow */}
      <div className={`relative ${iconDimensions} shrink-0 group`}>
        {/* Halo lumineux au survol */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 opacity-40 blur-xs group-hover:opacity-75 transition-opacity" />
        
        {/* Conteneur principal de l'icône */}
        <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-slate-900 border border-emerald-300/40 p-1.5 shadow-md shadow-emerald-900/30 flex items-center justify-center overflow-hidden">
          {/* Reflet brillant de surface */}
          <div className="absolute -top-6 -right-6 w-12 h-12 bg-white/25 rounded-full blur-xs pointer-events-none" />
          
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="sfGradEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="sfGradGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
              <linearGradient id="sfGradWhite" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>

            {/* Chapeau de diplômé & Toit d'école (Graduation Cap / Academy) */}
            <path
              d="M50 18 L86 33 L50 48 L14 33 Z"
              fill="url(#sfGradGold)"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Gland de diplômé suspendu (Tassel) */}
            <path
              d="M76 37 L76 56 C76 58 73 60 71 60"
              stroke="url(#sfGradGold)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle cx="71" cy="62" r="3.5" fill="#f59e0b" />

            {/* Livre ouvert en Flow dynamique (Open Book Pages / Wings of Growth) */}
            {/* Page Gauche */}
            <path
              d="M50 48 C42 42 26 44 18 50 L18 76 C26 70 42 68 50 74 Z"
              fill="url(#sfGradWhite)"
              opacity="0.95"
            />
            {/* Page Droite */}
            <path
              d="M50 48 C58 42 74 44 82 50 L82 76 C74 70 58 68 50 74 Z"
              fill="url(#sfGradWhite)"
            />

            {/* Courbes de progression "Flow" (Ruban émeraude et or au centre) */}
            <path
              d="M50 48 L50 82"
              stroke="#047857"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M24 64 C34 58 42 62 50 67 C58 72 66 68 76 62"
              stroke="url(#sfGradEmerald)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Étoile d'Excellence scintillante */}
            <polygon
              points="50,22 52,28 58,28 53,32 55,38 50,34 45,38 47,32 42,28 48,28"
              fill="#ffffff"
            />
          </svg>
        </div>
      </div>

      {/* Typographie de la marque SchoolFlow */}
      {!iconOnly && (
        <div className="flex flex-col">
          <div className="flex items-center gap-0.5 leading-none">
            <span
              className={`font-black font-heading tracking-tight ${titleSizes} ${
                isLight ? 'text-white' : 'text-slate-900'
              }`}
            >
              School
            </span>
            <span
              className={`font-black font-heading tracking-tight ${titleSizes} text-emerald-600`}
            >
              Flow
            </span>
            {/* Point d'accent Ambre / Or */}
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block ml-0.5 align-top animate-pulse" />
          </div>

          {showTagline && (
            <span
              className={`font-medium tracking-wide uppercase mt-1 ${taglineSizes} ${
                isLight ? 'text-emerald-200/90' : 'text-slate-500'
              }`}
            >
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
