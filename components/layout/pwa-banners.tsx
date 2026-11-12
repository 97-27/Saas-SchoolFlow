'use client';

import React, { useEffect, useState } from 'react';
import { Download, Share, WifiOff, X, Smartphone } from 'lucide-react';
import { registerServiceWorker } from '@/lib/client/push';

const INSTALL_DISMISS_KEY = 'schoolflow_install_prompt_dismissed_v1';
const DISMISS_DAYS = 7;

/**
 * 1) Bandeau « Installer SchoolFlow » (en haut) : Android / Chrome / Edge → bouton d'installation
 *    natif ; iPhone / iPad (Safari) → marche à suivre « Partager → Sur l'écran d'accueil ».
 *    Fermé → ne revient pas avant 7 jours ; disparaît pour de bon une fois installé.
 * 2) Bandeau « hors connexion » : dès que le réseau est coupé, et jusqu'à son retour.
 */
export function PwaBanners() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    registerServiceWorker();
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream;
    setIsIos(ios);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setStandalone(isStandalone);
    try {
      const until = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
      setDismissed(until > Date.now());
    } catch {
      setDismissed(false);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    } catch {}
  };

  const install = async () => {
    if (installEvent) {
      try {
        installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice?.outcome === 'accepted') setStandalone(true);
      } catch {}
      setInstallEvent(null);
      return;
    }
    if (isIos) setShowIosHelp(true);
  };

  const canOffer = !standalone && !dismissed && (installEvent || isIos);

  return (
    <>
      {offline && (
        <div className="sticky top-0 z-[120] bg-slate-900 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 print:hidden">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Hors connexion — vos saisies sont gardées sur cet appareil et seront envoyées dès le retour du réseau.
          </span>
        </div>
      )}

      {canOffer && (
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-4 py-2.5 print:hidden">
          <div className="max-w-[1600px] mx-auto flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-extrabold leading-tight">Installez SchoolFlow sur votre écran d’accueil</p>
              <p className="text-[11px] text-emerald-50/90 leading-tight hidden sm:block">
                Ouverture en un clic, plein écran, notifications — sans passer par le lien.
              </p>
            </div>
            <button
              type="button"
              onClick={install}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-emerald-700 text-xs font-bold hover:bg-emerald-50 cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> Installer
            </button>
            <button type="button" onClick={dismiss} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer shrink-0" title="Plus tard">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showIosHelp && (
        <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setShowIosHelp(false)}>
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-extrabold text-slate-900 font-heading">Installer sur iPhone / iPad</p>
            <ol className="text-xs text-slate-700 space-y-2 list-decimal pl-4">
              <li>
                Touchez le bouton <span className="inline-flex items-center gap-1 font-bold text-slate-900"><Share className="w-3.5 h-3.5" /> Partager</span> en bas de Safari.
              </li>
              <li>
                Choisissez <span className="font-bold text-slate-900">« Sur l’écran d’accueil »</span>.
              </li>
              <li>
                Touchez <span className="font-bold text-slate-900">Ajouter</span>. SchoolFlow apparaît comme une application.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => {
                setShowIosHelp(false);
                dismiss();
              }}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
