import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowLeft, Clock } from 'lucide-react';

interface ComingSoonProps {
  title?: string;
  description: string;
  moduleNumber?: string;
  schoolSlug?: string;
}

export function ComingSoon({
  title,
  description,
  moduleNumber,
  schoolSlug = 'college-excellence',
}: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] p-6 sm:p-10 text-center bg-white rounded-2xl border border-slate-200/70 shadow-xs">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 sm:mb-5 shadow-2xs border border-emerald-100">
        <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse" />
      </div>

      {moduleNumber && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 mb-3">
          <Clock className="w-3.5 h-3.5" />
          {moduleNumber} — Module en cours de finalisation
        </span>
      )}

      {title && (
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-heading mb-2">
          {title}
        </h2>
      )}

      <p className="text-slate-500 max-w-md text-xs sm:text-sm leading-relaxed mb-6">
        {description}
      </p>

      <div className="flex items-center gap-3">
        <Link
          href={`/${schoolSlug}/admin/dashboard`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour au tableau de bord</span>
        </Link>
      </div>
    </div>
  );
}
