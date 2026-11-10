'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Clock, Check } from 'lucide-react';

/**
 * Sélecteur d'heure « HH:MM » dans le style du calendrier de l'application (FrenchDateInput) :
 * deux colonnes qui défilent (heures, minutes par pas de 5), heure choisie en noir, survol vert.
 * Remplace le champ heure du navigateur, différent d'un téléphone à l'autre et peu lisible.
 */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export function TimePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hourList = useRef<HTMLDivElement>(null);
  const minuteList = useRef<HTMLDivElement>(null);
  const [h, m] = /^\d{2}:\d{2}$/.test(value) ? value.split(':') : ['07', '00'];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    // L'heure choisie est amenée au centre de chaque colonne à l'ouverture.
    // (défilement de la colonne seule, jamais de la page)
    setTimeout(() => {
      for (const list of [hourList.current, minuteList.current]) {
        const sel = list?.querySelector<HTMLElement>('[data-selected="true"]');
        if (list && sel) list.scrollTop = sel.offsetTop - list.clientHeight / 2 + sel.clientHeight / 2;
      }
    }, 0);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const cell = (val: string, selected: boolean, onPick: () => void) => (
    <button
      key={val}
      type="button"
      data-selected={selected}
      onClick={onPick}
      className={`w-full py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
        selected ? 'bg-slate-900 text-white font-bold' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 font-medium'
      }`}
    >
      {val}
    </button>
  );

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between rounded-xl bg-white border px-3 py-2 shadow-2xs transition-all cursor-pointer ${
          open ? 'ring-2 ring-emerald-500/20 border-emerald-500' : 'border-slate-200 hover:border-emerald-500/70'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
      >
        <span className="text-xs font-mono font-bold text-slate-900">{`${h}:${m}`}</span>
        <Clock className="w-4 h-4 text-emerald-600" />
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 z-50 w-[180px] p-2.5 bg-white rounded-2xl border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="grid grid-cols-2 gap-2 text-center mb-1">
            <span className="text-[10px] font-bold text-slate-400">Heure</span>
            <span className="text-[10px] font-bold text-slate-400">Minutes</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div ref={hourList} className="h-44 overflow-y-auto overscroll-contain pr-1 space-y-0.5 [scrollbar-width:thin]">
              {HOURS.map((hh) => cell(hh, hh === h, () => onChange(`${hh}:${m}`)))}
            </div>
            <div ref={minuteList} className="h-44 overflow-y-auto overscroll-contain pr-1 space-y-0.5 [scrollbar-width:thin]">
              {MINUTES.map((mm) => cell(mm, mm === m, () => onChange(`${h}:${mm}`)))}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
            >
              <Check className="w-3 h-3" /> Valider
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
