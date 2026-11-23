'use client';

import React from 'react';

type Mode = 'open' | 'closed' | 'scheduled';

/**
 * Réglage « Ouvert / Fermé / Programmé (dates) » d'une fonction réservée à la Direction.
 * Les enseignants voient seulement l'état ; seuls Fondateur, DGA et Directeur peuvent le changer.
 */
export function WindowControl({
  label,
  mode,
  start,
  end,
  isOpen,
  canEdit,
  openLabel = 'OUVERT',
  closedLabel = 'FERMÉ',
  onChange,
}: {
  label: string;
  mode: Mode;
  start?: string;
  end?: string;
  isOpen: boolean;
  canEdit: boolean;
  openLabel?: string;
  closedLabel?: string;
  onChange: (patch: { mode?: Mode; start?: string; end?: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-extrabold text-slate-800 font-heading">{label} :</span>
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          isOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
        {isOpen ? openLabel : closedLabel}
        {mode === 'scheduled' ? ' · programmé' : ''}
      </span>
      {canEdit && (
        <>
          <select
            value={mode}
            onChange={(e) => onChange({ mode: e.target.value as Mode })}
            className="px-2 py-1 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-800 cursor-pointer"
            aria-label={label}
          >
            <option value="open">Ouvert</option>
            <option value="closed">Fermé</option>
            <option value="scheduled">Programmé (dates)</option>
          </select>
          {mode === 'scheduled' && (
            <>
              <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                Début
                <input
                  type="datetime-local"
                  value={start || ''}
                  onChange={(e) => onChange({ start: e.target.value })}
                  className="px-2 py-1 rounded-lg border border-slate-300 text-[11px] font-semibold text-slate-800"
                />
              </label>
              <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                Fin
                <input
                  type="datetime-local"
                  value={end || ''}
                  onChange={(e) => onChange({ end: e.target.value })}
                  className="px-2 py-1 rounded-lg border border-slate-300 text-[11px] font-semibold text-slate-800"
                />
              </label>
            </>
          )}
        </>
      )}
    </div>
  );
}
