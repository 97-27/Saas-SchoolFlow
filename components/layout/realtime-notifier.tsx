'use client';

import React, { useEffect, useState } from 'react';
import { DATA_UPDATED_EVENT, startCrossDeviceSync } from '@/lib/data/live-store';
import { CheckCircle2, Bell, X } from 'lucide-react';

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
  const [toast, setToast] = useState<RealtimeToast | null>(null);

  useEffect(() => {
    // 1. Démarrer la synchronisation multi-appareils dès le chargement de l'espace administration
    startCrossDeviceSync(schoolSlug);

    // 2. Écouter tous les événements de mise à jour reçus en direct
    const handleUpdate = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;

      // On affiche une notification si l'action provient d'un autre appareil ou d'un autre onglet
      if (detail.action === 'student_registered' && detail.student) {
        const student = detail.student;
        const name = student.fullName || `${student.lastName || ''} ${student.firstName || ''}`.trim() || 'Nouvel élève';
        const num = student.studentNumber || student.id || 'Nouveau';

        setToast({
          id: Date.now(),
          type: 'student',
          title: '🔔 Un Reçu vient d\'être enregistré !',
          message: `${name.toUpperCase()} (${num}) a été enregistré.`,
          subInfo: 'Données synchronisées automatiquement sur tous les écrans.',
        });
      } else if (detail.action === 'payment_recorded' && detail.invoice) {
        const inv = detail.invoice;
        const num = inv.invoiceNumber || 'Quittance';
        const studentName = inv.studentName || 'Élève';

        setToast({
          id: Date.now(),
          type: 'payment',
          title: '💳 Nouveau Paiement Enregistré !',
          message: `Règlement validé pour ${studentName} (${num}).`,
          subInfo: 'Journal des encaissements actualisé en direct.',
        });
      }
    };

    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
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
  );
}
