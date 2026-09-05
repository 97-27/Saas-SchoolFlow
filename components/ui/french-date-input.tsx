'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface FrenchDateInputProps {
  value: string; // Format 'YYYY-MM-DD' or 'DD/MM/YYYY'
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

const MONTHS_NAMES_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const WEEKDAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

export function FrenchDateInput({
  value,
  onChange,
  className = '',
  disabled = false,
  placeholder = 'JJ/MM/AAAA',
}: FrenchDateInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse existing value
  const parsed = useMemo(() => {
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    let d = now.getDate();

    if (value) {
      if (value.includes('-')) {
        const parts = value.split('-');
        if (parts.length === 3) {
          y = parseInt(parts[0], 10) || y;
          m = parseInt(parts[1], 10) || m;
          d = parseInt(parts[2], 10) || d;
        }
      } else if (value.includes('/')) {
        const parts = value.split('/');
        if (parts.length === 3) {
          d = parseInt(parts[0], 10) || d;
          m = parseInt(parts[1], 10) || m;
          y = parseInt(parts[2], 10) || y;
        }
      }
    }
    return { year: y, month: m, day: d };
  }, [value]);

  // View state in calendar (year and month 0-11)
  const [viewYear, setViewYear] = useState<number>(parsed.year);
  const [viewMonth, setViewMonth] = useState<number>(parsed.month - 1);

  // Synchroniser view state quand value change à l'extérieur
  useEffect(() => {
    setViewYear(parsed.year);
    setViewMonth(parsed.month - 1);
  }, [parsed.year, parsed.month]);

  // Fermer quand on clique à l'extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const displayDateStr = useMemo(() => {
    if (!value) return '';
    const dayStr = String(parsed.day).padStart(2, '0');
    const monthStr = String(parsed.month).padStart(2, '0');
    return `${dayStr}/${monthStr}/${parsed.year}`;
  }, [value, parsed]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (dayNum: number, targetMonth: number, targetYear: number) => {
    const formattedMonth = String(targetMonth + 1).padStart(2, '0');
    const formattedDay = String(dayNum).padStart(2, '0');
    const isoString = `${targetYear}-${formattedMonth}-${formattedDay}`;
    onChange(isoString);
    setIsOpen(false);
  };

  const handleSetToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setViewYear(y);
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  // Calcul de la grille des jours du mois
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    // En JS 0 = Dimanche, 1 = Lundi ... 6 = Samedi. Pour commencer Lundi:
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    const now = new Date();
    const isNowSameMonth = now.getFullYear() === viewYear && now.getMonth() === viewMonth;
    const nowDay = now.getDate();

    // Jours du mois précédent
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({
        day: prevDay,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        isSelected:
          parsed.year === prevYear &&
          parsed.month - 1 === prevMonth &&
          parsed.day === prevDay,
        isToday: false,
      });
    }

    // Jours du mois courant
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const isSelected =
        parsed.year === viewYear &&
        parsed.month - 1 === viewMonth &&
        parsed.day === d;
      cells.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        isSelected,
        isToday: isNowSameMonth && nowDay === d,
      });
    }

    // Jours du mois suivant pour compléter les 5 ou 6 semaines (multiples de 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({
        day: n,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        isSelected:
          parsed.year === nextYear &&
          parsed.month - 1 === nextMonth &&
          parsed.day === n,
        isToday: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth, parsed]);

  return (
    <div className={`relative inline-block w-full ${className}`} ref={containerRef}>
      {/* Bouton de Déclencheur Principal */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 hover:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono font-bold text-slate-800 shadow-2xs cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''
        } ${isOpen ? 'ring-2 ring-emerald-500/20 border-emerald-500' : ''}`}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className={displayDateStr ? 'text-slate-900 font-bold' : 'text-slate-400 font-normal'}>
            {displayDateStr || placeholder}
          </span>
        </div>
      </button>

      {/* POPUP DU CALENDRIER STYLE CAPTURE */}
      {isOpen && (
        <div className="absolute right-0 sm:right-auto left-auto sm:left-0 mt-2 z-50 w-80 max-w-[calc(100vw-32px)] p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-800">
          {/* Header Calendrier: < Month Year > */}
          <div className="flex items-center justify-between px-1 mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs sm:text-sm font-bold text-slate-900 font-heading">
              {MONTHS_NAMES_FR[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* En-tête des Jours: Mo Tu We Th Fr Sa Su -> Lu Ma Me Je Ve Sa Di */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {WEEKDAYS_FR.map((wd) => (
              <span key={wd} className="text-[11px] font-bold text-slate-400 py-0.5">
                {wd}
              </span>
            ))}
          </div>

          {/* Grille des Jours avec Cercle Noir (style officiel) */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarGrid.map((c, idx) => (
              <div key={idx} className="flex flex-col items-center justify-center p-0.5">
                <button
                  type="button"
                  onClick={() => handleSelectDay(c.day, c.month, c.year)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all relative cursor-pointer ${
                    c.isSelected
                      ? 'bg-slate-900 text-white font-bold shadow-sm scale-105'
                      : c.isCurrentMonth
                      ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium'
                      : 'text-slate-300 hover:bg-slate-50 font-normal'
                  }`}
                >
                  {c.day}
                  {/* Point indicateur discret */}
                  {(c.isToday || (c.isSelected && !c.isCurrentMonth)) && (
                    <span
                      className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                        c.isSelected ? 'bg-emerald-400' : 'bg-slate-900'
                      }`}
                    />
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Raccourcis bas de calendrier */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleSetToday}
              className="px-2.5 py-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold transition-colors cursor-pointer"
            >
              Aujourd&apos;hui
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
