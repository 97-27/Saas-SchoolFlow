'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  DATA_UPDATED_EVENT,
  startCrossDeviceSync,
  CLIENT_INSTANCE_ID,
  getLiveInvoices,
  whenFirstSyncDone,
} from '@/lib/data/live-store';
import { CheckCircle2, Bell, X } from 'lucide-react';
import { playCashSound } from '@/lib/utils/audio';
import { formatFCFA } from '@/lib/utils/formatters';
import { useFiguresState } from '@/lib/client/figures-privacy';
import { POINTAGE_VIEW_ALL_ROLES } from '@/lib/auth/roles';
import { ensurePushSubscription, pushSupported, subscribeToPush } from '@/lib/client/push';

/** Reçoivent l'alerte « versement reçu ». */
const PAYMENT_ALERT_ROLES = ['fondateur', 'fondateur_adjoint', 'comptable'];
/** Reçoivent l'alerte « pointage » (arrivée / départ / absence d'un membre du personnel). */
const POINTAGE_ALERT_ROLES = POINTAGE_VIEW_ALL_ROLES;
const NOTIF_PROMPT_KEY = 'schoolflow_payment_notif_prompt_v2';

interface RealtimeNotifierProps {
  schoolSlug?: string;
}

interface RealtimeToast {
  id: number;
  type: 'student' | 'payment';
  title: string;
  message: string;
  subInfo?: string;
}

export function RealtimeNotifier({ schoolSlug = 'epc-manoi' }: RealtimeNotifierProps) {
  // File d'attente façon carrousel : si plusieurs collaborateurs (comptable, secrétaire,
  // directeur...) enregistrent des reçus au même moment, chaque notification passe l'une
  // après l'autre au lieu d'écraser silencieusement la précédente.
  const [queue, setQueue] = useState<RealtimeToast[]>([]);
  const [toast, setToast] = useState<RealtimeToast | null>(null);

  useEffect(() => {
    // 1. Démarrer la synchronisation multi-appareils dès le chargement de l'espace administration
    startCrossDeviceSync(schoolSlug);

    // 2. Écouter tous les événements de mise à jour reçus en direct
    const handleUpdate = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;

      // N'afficher CETTE notification que pour l'action d'un AUTRE appareil/onglet — jamais pour
      // sa propre sauvegarde. broadcastLiveUpdate() diffuse d'abord l'événement localement dans
      // l'onglet qui vient d'enregistrer (avec son propre senderId), avant de le relayer aux
      // autres appareils : sans cette vérification, l'auteur de l'enregistrement voyait toujours
      // apparaître cette même alerte "Un reçu vient d'être enregistré" chez lui aussi, en plus de
      // son propre message de confirmation.
      if (!detail.senderId || detail.senderId === CLIENT_INSTANCE_ID) return;

      // On affiche une notification si l'action provient d'un autre appareil ou d'un autre onglet
      if (detail.action === 'student_registered' && detail.student) {
        const student = detail.student;
        const name = student.fullName || `${student.lastName || ''} ${student.firstName || ''}`.trim() || 'Nouvel élève';
        const num = student.studentNumber || student.id || 'Nouveau';

        setQueue((q) => [
          ...q,
          {
            id: Date.now() + Math.random(),
            type: 'student',
            title: '🔔 Un Reçu vient d\'être enregistré !',
            message: `${name.toUpperCase()} (${num}) a été enregistré.`,
            subInfo: 'Passage automatique à l’ID suivant sur tous les écrans.',
          },
        ]);
      } else if (detail.action === 'payment_recorded' && detail.invoice) {
        const inv = detail.invoice;
        const num = inv.invoiceNumber || 'Quittance';
        const studentName = inv.studentName || 'Élève';

        setQueue((q) => [
          ...q,
          {
            id: Date.now() + Math.random(),
            type: 'payment',
            title: '💳 Nouveau Paiement Enregistré !',
            message: `Règlement validé pour ${studentName} (${num}).`,
            subInfo: 'Journal des encaissements actualisé en direct.',
          },
        ]);
      }
    };

    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug]);

  // ─── VERSEMENTS REÇUS SUR UN AUTRE APPAREIL : notification + sonnerie « argent » ───
  // Le signal temps réel ne transporte aucune donnée (sécurité) : chaque appareil compare donc
  // les reçus avant / après chaque relecture de la base. Un montant payé qui augmente = un
  // versement vient d'être encaissé ailleurs. Fondateur, DGA et Comptable seulement.
  const paidSnapshot = useRef<Map<string, number> | null>(null);
  const [canHearPayments, setCanHearPayments] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>('unsupported');
  const [notifPromptDismissed, setNotifPromptDismissed] = useState(true);
  const figures = useFiguresState();

  const [canHearPointage, setCanHearPointage] = useState(false);

  useEffect(() => {
    let role = '';
    try {
      role = String(JSON.parse(localStorage.getItem('schoolflow_active_session_v2') || '{}').roleId || '');
    } catch (e) {}
    const eligible = PAYMENT_ALERT_ROLES.includes(role);
    const pointageEligible = POINTAGE_ALERT_ROLES.includes(role);
    setCanHearPayments(eligible);
    setCanHearPointage(pointageEligible);
    if (typeof Notification !== 'undefined') setNotifPermission(Notification.permission);
    try {
      setNotifPromptDismissed(localStorage.getItem(NOTIF_PROMPT_KEY) === '1');
    } catch (e) {}
    // Notifications déjà autorisées : l'abonnement en arrière-plan suit le compte connecté.
    if (eligible || pointageEligible) ensurePushSubscription();

    // Alerte reçue par le service worker pendant que l'onglet est ouvert : sonnerie + bandeau.
    const onSwMessage = (e: MessageEvent) => {
      const p = e?.data?.type === 'sf-push' ? e.data.payload : null;
      if (!p) return;
      if (p.sound === 'cash') playCashSound();
      setQueue((q) => [...q, { id: Date.now() + Math.random(), type: 'payment', title: String(p.title || 'SchoolFlow'), message: String(p.body || '') }]);
    };
    try {
      navigator.serviceWorker?.addEventListener('message', onSwMessage);
    } catch (e) {}
    const cleanupSw = () => {
      try {
        navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      } catch (e) {}
    };
    if (!eligible) return cleanupSw;

    const snapshot = () => {
      const m = new Map<string, number>();
      for (const inv of getLiveInvoices([], schoolSlug)) {
        if (inv?.id) m.set(inv.id, Number(inv.paidAmount) || 0);
      }
      return m;
    };
    whenFirstSyncDone().then(() => {
      paidSnapshot.current = snapshot();
    });

    const onData = (e: any) => {
      if (!paidSnapshot.current) return;
      const before = paidSnapshot.current;
      const invoices = getLiveInvoices([], schoolSlug);
      const now = new Map<string, number>();
      const received: { inv: any; delta: number }[] = [];
      for (const inv of invoices) {
        if (!inv?.id) continue;
        const paid = Number(inv.paidAmount) || 0;
        now.set(inv.id, paid);
        const delta = paid - (before.get(inv.id) ?? 0);
        if (delta > 0) received.push({ inv, delta });
      }
      paidSnapshot.current = now;
      // Seulement ce qui vient de la base (autre appareil) : pas sa propre saisie.
      if (e?.detail?.action !== 'server_hydrated' || received.length === 0) return;
      announcePayments(received);
    };
    window.addEventListener(DATA_UPDATED_EVENT, onData);
    return () => {
      window.removeEventListener(DATA_UPDATED_EVENT, onData);
      cleanupSw();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolSlug]);

  const announcePayments = (received: { inv: any; delta: number }[]) => {
    playCashSound();
    const showAmounts = figuresVisibleRef.current;
    const shown = received.slice(0, 3);
    const items: RealtimeToast[] = shown.map(({ inv, delta }) => ({
      id: Date.now() + Math.random(),
      type: 'payment',
      title: '💰 Versement reçu',
      message: `${String(inv.studentName || 'Élève').toUpperCase()}${inv.studentGrade ? ` (${inv.studentGrade})` : ''}${
        showAmounts ? ` — ${formatFCFA(delta)}` : ''
      }`,
      subInfo: `${inv.feeType || 'Scolarité'} • Reçu ${inv.invoiceNumber || ''}`.trim(),
    }));
    if (received.length > shown.length) {
      items.push({
        id: Date.now() + Math.random(),
        type: 'payment',
        title: '💰 Autres versements',
        message: `+ ${received.length - shown.length} autre(s) versement(s) enregistrés.`,
      });
    }
    setQueue((q) => [...q, ...items]);

    // Notification du téléphone / de l'ordinateur (si autorisée), utile quand l'onglet est en arrière-plan.
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        for (const it of items) {
          new Notification(it.title, { body: `${it.message}${it.subInfo ? `\n${it.subInfo}` : ''}`, tag: String(it.id) });
        }
      }
    } catch (e) {}
  };

  const figuresVisibleRef = useRef(false);
  figuresVisibleRef.current = figures.visible;

  // Fait avancer le carrousel : dès qu'aucun toast n'est affiché, prendre le suivant dans la file.
  useEffect(() => {
    if (toast || queue.length === 0) return;
    const [next, ...rest] = queue;
    setToast(next);
    setQueue(rest);
  }, [toast, queue]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showNotifPrompt = (canHearPayments || canHearPointage) && notifPermission === 'default' && !notifPromptDismissed;
  const dismissPrompt = () => {
    setNotifPromptDismissed(true);
    try {
      localStorage.setItem(NOTIF_PROMPT_KEY, '1');
    } catch (e) {}
  };

  const prompt = showNotifPrompt ? (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm z-[140] bg-white border border-emerald-200 rounded-2xl shadow-2xl p-4 space-y-3 print:hidden animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 font-heading">
            {canHearPayments ? 'Alertes de versements et de pointage' : 'Alertes de pointage'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {canHearPayments
              ? 'Être prévenu sur cet appareil, même application fermée, à chaque versement encaissé (avec sonnerie) et à chaque pointage du personnel ?'
              : 'Être prévenu sur cet appareil, même application fermée, à chaque pointage du personnel ?'}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              const p = await Notification.requestPermission();
              setNotifPermission(p);
              if (p === 'granted') {
                if (canHearPayments) playCashSound();
                // Abonnement en arrière-plan (téléphone verrouillé, application fermée).
                if (pushSupported()) subscribeToPush();
              }
            } catch (e) {}
            dismissPrompt();
          }}
          className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
        >
          Activer
        </button>
        <button
          type="button"
          onClick={dismissPrompt}
          className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
        >
          Plus tard
        </button>
      </div>
    </div>
  ) : null;

  if (!toast) return prompt;

  return (
    <>
    {prompt}
    <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[99999] max-w-md w-[92vw] sm:w-auto animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-auto">
      <div className="bg-slate-900/95 backdrop-blur-md border-2 border-emerald-500/80 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-start gap-3">
        <div className="relative p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5">
          <Bell className="w-5 h-5 animate-bounce" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xs sm:text-sm text-emerald-300">
              {toast.title}
            </span>
            {queue.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0">
                +{queue.length}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-100 mt-0.5 leading-snug">
            {toast.message}
          </p>
          {toast.subInfo && (
            <p className="text-[10px] sm:text-xs text-emerald-400/90 font-mono mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              {toast.subInfo}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setToast(null)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
    </>
  );
}
