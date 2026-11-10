'use client';

import React, { useEffect, useState } from 'react';
import { installCloudKv, whenCloudKvReady } from '@/lib/data/cloud-kv';
import { whenFirstSyncDone } from '@/lib/data/live-store';
import { installGlobalErrorReporting } from '@/lib/client/error-report';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { ReadOnlyGuard } from './read-only-guard';
import { RealtimeNotifier } from './realtime-notifier';
import { FiguresPrivacyHost } from '@/components/ui/masked-figure';

/**
 * Les écrans lisent d'abord la copie gardée dans le navigateur : à l'ouverture, on voyait donc
 * quelques secondes d'anciennes données (ou celles d'un autre compte) avant les vraies. La page
 * n'est maintenant affichée qu'après la première lecture de la base (élèves, reçus, services,
 * notes, appel…). Au-delà de 15 s (réseau très lent), on affiche quand même pour ne pas bloquer.
 */
let dataReadyOnce = false;

function DataReadyGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(dataReadyOnce);

  useEffect(() => {
    if (ready) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      dataReadyOnce = true;
      setReady(true);
    };
    Promise.all([whenFirstSyncDone(), whenCloudKvReady()]).then(finish);
    const t = setTimeout(finish, 15000);
    return () => clearTimeout(t);
  }, [ready]);

  if (ready) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center" role="status" aria-live="polite">
      <div className="w-11 h-11 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
      <div>
        <p className="text-sm font-bold text-slate-900">Chargement des données de l’établissement…</p>
        <p className="text-xs text-slate-500 mt-1">Lecture de la base en cours, un instant.</p>
      </div>
    </div>
  );
}

interface DashboardShellProps {
  children: React.ReactNode;
  schoolSlug?: string;
  breadcrumbs?: string[];
}

export function DashboardShell({
  children,
  schoolSlug = 'epc-manoi',
  breadcrumbs,
}: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Notes, appel, dépenses, salaires… sont enregistrés en base et partagés entre appareils.
  useEffect(() => {
    installCloudKv(schoolSlug);
    installGlobalErrorReporting();
  }, [schoolSlug]);

  return (
    <ReadOnlyGuard>
      <div className="min-h-screen bg-[#f8fafc] print:bg-white print:min-h-0">
        {/* Sidebar */}
        <div className="print:hidden">
          <Sidebar
            schoolSlug={schoolSlug}
            isMobileOpen={isMobileMenuOpen}
            onMobileClose={() => setIsMobileMenuOpen(false)}
          />
        </div>

        {/* Main Content Area */}
        <div className="lg:pl-64 flex flex-col min-h-screen print:pl-0 print:min-h-0">
          <div className="print:hidden">
            <Topbar
              schoolSlug={schoolSlug}
              onMenuClick={() => setIsMobileMenuOpen(true)}
              onMenuToggle={() => setIsMobileMenuOpen(true)}
              breadcrumbs={breadcrumbs}
            />
          </div>
          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto print:p-0 print:m-0 print:max-w-full">
            <DataReadyGate>{children}</DataReadyGate>
          </main>
        </div>

        {/* Notificateur Universel Temps Réel Multi-Appareils */}
        <RealtimeNotifier schoolSlug={schoolSlug} />

        {/* Chiffres globaux masqués sauf pour le Fondateur (code demandé au Directeur) */}
        <FiguresPrivacyHost />
      </div>
    </ReadOnlyGuard>
  );
}
