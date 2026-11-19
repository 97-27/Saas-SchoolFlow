'use client';

import React, { useEffect, useRef } from 'react';

/** Saisie d'un code à N chiffres : une case par chiffre, passage automatique, collage du code complet. */
export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  hasError = false,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
  hasError?: boolean;
  onComplete?: (v: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };

  const setDigit = (i: number, ch: string) => {
    const arr = value.padEnd(length, ' ').slice(0, length).split('');
    arr[i] = ch || ' ';
    commit(arr.join('').replace(/ /g, ''));
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5" role="group" aria-label="Code de confirmation à 6 chiffres">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d.trim()}
          aria-label={`Chiffre ${i + 1}`}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            if (!ch) return;
            setDigit(i, ch);
            if (i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (d.trim()) setDigit(i, '');
              else if (i > 0) {
                setDigit(i - 1, '');
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
            if (!text) return;
            e.preventDefault();
            commit(text);
            refs.current[Math.min(text.length, length - 1)]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-extrabold rounded-xl border-2 bg-slate-50 text-slate-900 outline-none transition-all ${
            hasError
              ? 'border-red-400 bg-red-50'
              : d.trim()
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 focus:border-emerald-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]'
          }`}
        />
      ))}
    </div>
  );
}
