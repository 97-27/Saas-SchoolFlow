'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface FrenchDateInputProps {
  value: string; // Format 'YYYY-MM-DD' or 'DD/MM/YYYY'
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  align?: 'left' | 'right' | 'auto';
  showDirectInput?: boolean;
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
  align = 'auto',
  showDirectInput = true,
}: FrenchDateInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse existing value into year, month, day
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

  // Formatted display string DD/MM/YYYY
  const displayDateStr = useMemo(() => {
    if (!value) return '';
    const dayStr = String(parsed.day).padStart(2, '0');
    const monthStr = String(parsed.month).padStart(2, '0');
    return `${dayStr}/${monthStr}/${parsed.year}`;
  }, [value, parsed]);

  // Local text input state for direct keyboard typing
  const [inputText, setInputText] = useState(displayDateStr);

  useEffect(() => {
    setInputText(displayDateStr);
  }, [displayDateStr]);

  // View state in calendar (year and month 0-11)
  const [viewYear, setViewYear] = useState<number>(parsed.year);
  const [viewMonth, setViewMonth] = useState<number>(parsed.month - 1);

  // Synchroniser view state quand value change
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
    const isoString = `${y}-${m}-${d}`;
    onChange(isoString);
    setViewYear(y);
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  // Traitement de la saisie manuelle au clavier (supporte JJ/MM/AAAA ou JJ-MM-AAAA)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputText(raw);

    // Format JJ/MM/AAAA ou JJ-MM-AAAA
    const frMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (frMatch) {
      const d = parseInt(frMatch[1], 10);
      const m = parseInt(frMatch[2], 10);
      const y = parseInt(frMatch[3], 10);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1970 && y <= 2100) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        onChange(iso);
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }

    // Format AAAA-MM-JJ
    const isoMatch = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1970 && y <= 2100) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        onChange(iso);
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  };

  const handleInputBlur = () => {
    // Si la saisie n'a pas été validée, rétablir la dernière date valide
    if (!inputText.trim()) {
      setInputText(displayDateStr);
      return;
    }
    const frMatch = inputText.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (frMatch) {
      const d = parseInt(frMatch[1], 10);
      const m = parseInt(frMatch[2], 10);
      const y = parseInt(frMatch[3], 10);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1970 && y <= 2100) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        onChange(iso);
        return;
      }
    }
    setInputText(displayDateStr);
  };

  // Calcul de la grille des jours du mois
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
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

    // Jours du mois suivant
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

  // Positionnement du popup pour éviter tout rognage
  const popupAlignmentClass = useMemo(() => {
    if (align === 'right') return 'right-0 left-auto';
    if (align === 'left') return 'left-0 right-auto';
    // auto : aligne à droite sur grand écran pour éviter de déborder d'une colonne de droite
    return 'right-0 sm:right-0 left-auto';
  }, [align]);

  return (
    <div className={`relative inline-block w-full ${className}`} ref={containerRef}>
      {/* Champ de saisie direct + bouton d'ouverture de calendrier */}
      <div
        className={`w-full flex items-center justify-between rounded-xl bg-white border border-slate-200 transition-all shadow-2xs ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'hover:border-emerald-500/70 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500'
        } ${isOpen ? 'ring-2 ring-emerald-500/20 border-emerald-500' : ''}`}
      >
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={inputText}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          title="Ouvrir le calendrier"
          className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-r-xl transition-colors cursor-pointer shrink-0"
        >
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>

      {/* POPUP DU CALENDRIER SÉCURISÉ CONTRE LE ROGNAGE */}
      {isOpen && (
        <div
          className={`absolute ${popupAlignmentClass} mt-1.5 z-50 w-72 max-w-[calc(100vw-24px)] p-3 bg-white rounded-2xl border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-800`}
          style={{ minWidth: '260px' }}
        >
          {/* Header Calendrier: < Mois Année > */}
          <div className="flex items-center justify-between px-1 mb-2.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold text-slate-900 font-heading">
              {MONTHS_NAMES_FR[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* En-tête des Jours: Lu Ma Me Je Ve Sa Di */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS_FR.map((wd) => (
              <span key={wd} className="text-[10px] font-bold text-slate-400 py-0.5">
                {wd}
              </span>
            ))}
          </div>

          {/* Grille des Jours */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarGrid.map((c, idx) => (
              <div key={idx} className="flex flex-col items-center justify-center p-0.5">
                <button
                  type="button"
                  onClick={() => handleSelectDay(c.day, c.month, c.year)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] transition-all relative cursor-pointer ${
                    c.isSelected
                      ? 'bg-slate-900 text-white font-bold shadow-xs scale-105'
                      : c.isCurrentMonth
                      ? 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 font-medium'
                      : 'text-slate-300 hover:bg-slate-50 font-normal'
                  }`}
                >
                  {c.day}
                  {(c.isToday || (c.isSelected && !c.isCurrentMonth)) && (
                    <span
                      className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                        c.isSelected ? 'bg-emerald-400' : 'bg-emerald-600'
                      }`}
                    />
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Raccourcis bas de calendrier */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleSetToday}
              className="px-2 py-0.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold transition-colors cursor-pointer"
            >
              Aujourd&apos;hui
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2 py-0.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
