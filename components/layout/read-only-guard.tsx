'use client';

import React, { useState, useEffect } from 'react';
import { DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import { ShieldAlert, Lock, X } from 'lucide-react';

interface ReadOnlyGuardProps {
  children: React.ReactNode;
}

export function ReadOnlyGuard({ children }: ReadOnlyGuardProps) {
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockedActionName, setBlockedActionName] = useState('Saisie ou Modification');

  useEffect(() => {
    const checkSession = () => {
      try {
        const stored = localStorage.getItem('schoolflow_active_session_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.roleId === 'fondateur' || parsed.isReadOnly === true) {
            setIsReadOnly(true);
            return;
          }
        }
        setIsReadOnly(false);
      } catch (e) {
        setIsReadOnly(false);
      }
    };

    checkSession();
    window.addEventListener(DATA_UPDATED_EVENT, checkSession);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, checkSession);
  }, []);

  // Intercepteur non bloquant : n'interfère JAMAIS avec la navigation, les liens, les onglets ou les tables
  useEffect(() => {
    if (!isReadOnly) return;

    // 1. Bloquer la soumission de formulaires de modification
    const handleFormSubmit = (e: SubmitEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Laisser passer les formulaires de recherche et filtres
      const isSearchOrFilter =
        target.classList.contains('search-form') ||
        target.getAttribute('role') === 'search';

      if (!isSearchOrFilter) {
        e.preventDefault();
        e.stopPropagation();
        setBlockedActionName('Enregistrement / Validation de formulaire');
        setShowBlockModal(true);
      }
    };

    document.addEventListener('submit', handleFormSubmit, true);
    return () => {
      document.removeEventListener('submit', handleFormSubmit, true);
    };
  }, [isReadOnly]);

  return (
    <>
      {/* Contenu de la page avec fluidité maximale */}
      {children}

      {/* MODALE D'INTERCEPTION : ACTION BLOQUÉE POUR LE FONDATEUR */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-amber-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-4 animate-in zoom-in-95">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-950 font-heading">
                    Action Non Autorisée
                  </h3>
                  <p className="text-xs text-amber-800 font-medium">
                    Profil Fondateur / Fondatrice (Supervision)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Mode Consultation & Supervision Uniquement</span>
              </div>
              <p className="leading-relaxed">
                Le profil <strong>Fondateur / Fondatrice</strong> est en <strong>Supervision Globale</strong>. Vous pouvez observer l&apos;intégralité des tableaux de bord, effectifs, finances et bulletins, mais aucune modification ne peut être effectuée sans les droits d&apos;administration.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Compris, continuer en consultation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
