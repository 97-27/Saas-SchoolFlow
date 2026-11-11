'use client';

import React, { useEffect, useState } from 'react';
import { installCloudKv, whenCloudKvReady } from '@/lib/data/cloud-kv';
import { whenFirstSyncDone, startCrossDeviceSync } from '@/lib/data/live-store';
import { isSessionVerified, markSessionVerified } from '@/lib/client/session-flag';
import { installGlobalErrorReporting } from '@/lib/client/error-report';
import { syncYearEpoch, wipeLocalSchoolData } from '@/lib/client/year-reset';
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

/**
 * GARDE DE SESSION (côté écran, en plus du contrôle serveur de proxy.ts)
 * Après « Verrouiller la session », la flèche « retour » du navigateur pouvait réafficher l'espace
 * de gestion gardé en mémoire. Désormais rien n'est affiché tant que le serveur n'a pas confirmé
 * que la session (cookie signé) est valide ; la vérification est refaite au retour sur l'onglet,
 * au « retour arrière » du navigateur et quand un autre onglet se déconnecte.
 */

function kickToLogin(slug: string) {
  try {
    localStorage.removeItem('schoolflow_active_session_v2');
    sessionStorage.removeItem('schoolflow_figures_unlocked_until_v1');
  } catch (e) {}
  window.location.replace(`/${slug}/login`);
}

async function verifySession(slug: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/auth/session?slug=${encodeURIComponent(slug)}&t=${Date.now()}`, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (res.status === 401 || res.status === 403) {
      // Nouvelle année scolaire : la copie locale de l'année passée est effacée tout de suite.
      if (json?.yearChanged) wipeLocalSchoolData();
      kickToLogin(slug);
      return false;
    }
    if (res.ok && json?.success && syncYearEpoch(slug, json.yearEpoch)) {
      window.location.reload();
      return false;
    }
    return true; // hors connexion / erreur serveur : on ne bloque pas
  } catch (e) {
    return true;
  }
}

function useSessionGuard(slug: string): boolean {
  const [ok, setOk] = useState(isSessionVerified());
  useEffect(() => {
    let alive = true;
    // Aucune session locale : inutile d'attendre le serveur.
    try {
      if (!localStorage.getItem('schoolflow_active_session_v2')) {
        kickToLogin(slug);
        return;
      }
    } catch (e) {}
    verifySession(slug).then((valid) => {
      if (valid && alive) {
        markSessionVerified();
        setOk(true);
      }
    });
    const recheck = () => verifySession(slug);
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) recheck();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    const onStorage = (e: StorageEvent) => {
      // Autre onglet : passage à l'année suivante → cet onglet repart de zéro lui aussi.
      if (e.key && e.key.startsWith('schoolflow_year_epoch_') && e.newValue !== e.oldValue) {
        window.location.reload();
        return;
      }
      if (e.key === 'schoolflow_logout_at' || (e.key === 'schoolflow_active_session_v2' && !e.newValue)) kickToLogin(slug);
    };
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('popstate', recheck);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      alive = false;
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('popstate', recheck);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [slug]);
  return ok;
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
  const sessionOk = useSessionGuard(schoolSlug);

  // Notes, appel, dépenses, salaires… sont enregistrés en base et partagés entre appareils.
  // La lecture des données démarre tout de suite, en même temps que la vérification de session.
  useEffect(() => {
    installCloudKv(schoolSlug);
    startCrossDeviceSync(schoolSlug);
    installGlobalErrorReporting();
  }, [schoolSlug]);

  if (!sessionOk) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-4 text-center" role="status">
        <div className="w-11 h-11 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
        <p className="text-sm font-bold text-slate-900">Vérification de la session…</p>
      </div>
    );
  }

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
          {/* PC portable (1024–1279 px, souvent agrandi à 125 % par Windows) : marges réduites pour
              laisser la place au contenu à côté du menu ; grandes marges seulement sur grand écran. */}
          <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-5 xl:p-8 w-full max-w-[1600px] mx-auto print:p-0 print:m-0 print:max-w-full">
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
