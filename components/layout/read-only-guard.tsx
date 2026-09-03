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

  // Intercepteur universel : bloque toute saisie (touches, lettres, chiffres) et modifications pour le Fondateur
  useEffect(() => {
    if (!isReadOnly) return;

    // 1. Bloquer la frappe au clavier dans les formulaires et champs
    const handleKeyDownCapture = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Touches de navigation autorisées
      const navigationKeys = ['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'];
      if (navigationKeys.includes(e.key)) return;

      // Autoriser la recherche (lecture / filtrage de tableau)
      const isSearchField =
        target.getAttribute('type') === 'search' ||
        target.getAttribute('placeholder')?.toLowerCase().includes('recherch') ||
        target.classList.contains('search-input');

      if (isSearchField) return;

      if (isInputElement) {
        e.preventDefault();
        e.stopPropagation();
        setBlockedActionName('Saisie de données (chiffre ou lettre)');
        setShowBlockModal(true);
      }
    };

    // 2. Bloquer le collage (paste)
    const handlePasteCapture = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isSearch = target.getAttribute('placeholder')?.toLowerCase().includes('recherch');
      if (isSearch) return;

      e.preventDefault();
      e.stopPropagation();
      setBlockedActionName('Collage de texte / données');
      setShowBlockModal(true);
    };

    // 3. Bloquer la soumission de formulaire
    const handleFormSubmit = (e: SubmitEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setBlockedActionName('Enregistrement / Validation de formulaire');
      setShowBlockModal(true);
    };

    // 4. Bloquer les clics sur les boutons d'action d'écriture
    const handleClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const clickable = target.closest('button, a[role="button"], input[type="submit"], input[type="checkbox"], input[type="radio"]');
      if (!clickable) return;

      // Autoriser les cases à cocher de sélection de tableau de visualisation si besoin, mais bloquer l'appel de présence
      if (clickable.tagName === 'INPUT' && (clickable as HTMLInputElement).type === 'checkbox') {
        const isAttendance = clickable.closest('[data-attendance]') || clickable.classList.contains('attendance-checkbox');
        if (isAttendance) {
          e.preventDefault();
          e.stopPropagation();
          setBlockedActionName('Prise des présences & appels');
          setShowBlockModal(true);
          return;
        }
      }

      const buttonText = (clickable.textContent || '').trim().toLowerCase();
      const isMutationAction =
        buttonText.includes('ajouter') ||
        buttonText.includes('créer') ||
        buttonText.includes('enregistrer') ||
        buttonText.includes('supprimer') ||
        buttonText.includes('modifier') ||
        buttonText.includes('valider') ||
        buttonText.includes('inscrire') ||
        buttonText.includes('sauvegarder') ||
        buttonText.includes('encaisser') ||
        buttonText.includes('payer') ||
        buttonText.includes('marquer') ||
        clickable.classList.contains('mutation-action');

      // Boutons de navigation/consultation autorisés
      const isDismissOrNav =
        buttonText.includes('annuler') ||
        buttonText.includes('fermer') ||
        buttonText.includes('suivant') ||
        buttonText.includes('précédent') ||
        buttonText.includes('exporter') ||
        buttonText.includes('imprimer') ||
        buttonText.includes('filtrer') ||
        buttonText.includes('tous') ||
        buttonText.includes('copier') ||
        clickable.getAttribute('aria-label')?.toLowerCase().includes('fermer') ||
        clickable.getAttribute('aria-label')?.toLowerCase().includes('menu');

      if (isMutationAction && !isDismissOrNav) {
        e.preventDefault();
        e.stopPropagation();
        setBlockedActionName((clickable.textContent || 'Action').trim());
        setShowBlockModal(true);
      }
    };

    document.addEventListener('keydown', handleKeyDownCapture, true);
    document.addEventListener('paste', handlePasteCapture, true);
    document.addEventListener('submit', handleFormSubmit, true);
    document.addEventListener('click', handleClickCapture, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDownCapture, true);
      document.removeEventListener('paste', handlePasteCapture, true);
      document.removeEventListener('submit', handleFormSubmit, true);
      document.removeEventListener('click', handleClickCapture, true);
    };
  }, [isReadOnly]);

  return (
    <>
      {/* Contenu de la page */}
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
                <span>Action bloquée : &quot;{blockedActionName}&quot;</span>
              </div>
              <p className="text-[11.5px] text-amber-900/90 leading-relaxed font-sans">
                Le profil <strong>Fondateur / Fondatrice</strong> est en <strong>Supervision Globale</strong>. Vous pouvez observer l&apos;intégralité des tableaux de bord, effectifs, finances et bulletins, mais aucune saisie, modification, appel ou inscription ne peut être effectuée sur la plateforme.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/30 transition-all cursor-pointer"
              >
                Compris, continuer la consultation
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
