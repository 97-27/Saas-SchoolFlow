'use client';

import React, { useEffect, useState } from 'react';
import { CalendarCheck, X } from 'lucide-react';

/**
 * Trimestre actif : il vient des dates de fin saisies dans Paramètres (school.currentTerm, déjà
 * calculé par getLiveSchool). Quand il change (le lendemain de la fin d'un trimestre), un message
 * s'affiche une fois par appareil : « Aujourd'hui, tout est passé au Trimestre 2 ».
 */
export function useActiveTerm(schoolSlug: string, currentTerm: string | undefined) {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!currentTerm || typeof window === 'undefined') return;
    const key = `schoolflow_term_seen_v1_${schoolSlug}`;
    try {
      const seen = localStorage.getItem(key);
      if (!seen) {
        localStorage.setItem(key, currentTerm);
      } else if (seen !== currentTerm) {
        setNotice(currentTerm);
      }
    } catch {}
  }, [schoolSlug, currentTerm]);

  const dismiss = () => {
    try {
      if (currentTerm) localStorage.setItem(`schoolflow_term_seen_v1_${schoolSlug}`, currentTerm);
    } catch {}
    setNotice(null);
  };
  return { notice, dismiss };
}

export function TermChangeNotice({ term, onClose }: { term: string | null; onClose: () => void }) {
  if (!term) return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-950 print:hidden">
      <CalendarCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-extrabold font-heading">Nouveau trimestre : {term}</p>
        <p className="text-xs text-emerald-800">
          Aujourd’hui, tout est passé au {term} : notes, devoirs, moyennes et bulletins. Les données du trimestre précédent restent consultables en changeant de période.
        </p>
      </div>
      <button type="button" onClick={onClose} className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-100 cursor-pointer" aria-label="Fermer le message">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
