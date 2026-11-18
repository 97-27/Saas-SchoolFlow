'use client';

import React from 'react';
import { AlertTriangle, MessageCircle, X } from 'lucide-react';

export const SUPPORT_PHONE_DISPLAY = '+225 01 70 36 36 56';
export const SUPPORT_WHATSAPP_URL = 'https://wa.me/2250170363656';

/**
 * Grande fenêtre rouge au milieu de l'écran : suspension, échéance proche, suppression programmée.
 * Texte et tailles adaptés au téléphone comme à l'ordinateur.
 */
export function NoticeModal({
  title,
  message,
  countdown,
  onClose,
  closeLabel = 'Quitter',
  showContact = true,
}: {
  title: string;
  message: string;
  countdown?: string;
  onClose?: () => void;
  closeLabel?: string;
  showContact?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden border-4 border-red-600">
        <div className="bg-red-600 text-white px-5 py-4 flex items-center justify-center gap-3 text-center">
          <AlertTriangle className="w-8 h-8 shrink-0" />
          <h2 className="text-xl sm:text-2xl font-black leading-tight">{title}</h2>
        </div>
        <div className="p-5 sm:p-7 text-center space-y-4">
          <p className="text-base sm:text-lg font-bold text-red-700 leading-snug whitespace-pre-line">{message}</p>
          {countdown && (
            <div className="mx-auto w-fit rounded-2xl bg-red-50 border-2 border-red-300 px-6 py-3">
              <p className="text-4xl sm:text-5xl font-black tabular-nums text-red-600">{countdown}</p>
            </div>
          )}
          {showContact && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700 space-y-2">
              <p className="font-semibold">Pour toute question, contactez SchoolFlow Africa :</p>
              <a
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp {SUPPORT_PHONE_DISPLAY}
              </a>
            </div>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 w-full rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-base py-3 cursor-pointer"
            >
              <X className="w-4 h-4" />
              {closeLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
