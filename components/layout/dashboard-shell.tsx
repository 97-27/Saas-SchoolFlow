'use client';

import React, { useEffect, useState } from 'react';
import { installCloudKv, whenCloudKvReady } from '@/lib/data/cloud-kv';
import { whenFirstSyncDone, startCrossDeviceSync, getLiveSchool } from '@/lib/data/live-store';
import { isSessionVerified, markSessionVerified } from '@/lib/client/session-flag';
import { installGlobalErrorReporting } from '@/lib/client/error-report';
import { syncYearEpoch, wipeLocalSchoolData } from '@/lib/client/year-reset';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { ReadOnlyGuard } from './read-only-guard';
import { RealtimeNotifier } from './realtime-notifier';
import { FiguresPrivacyHost } from '@/components/ui/masked-figure';
import { PwaBanners } from './pwa-banners';
import { SetupReminder } from './setup-reminder';
import { BrandLoader } from '@/components/ui/brand-loader';
import { useSingleTab } from '@/lib/client/single-tab';
import { AppWindow } from 'lucide-react';
import { NoticeModal } from '@/components/ui/notice-modal';
import { termEndInfo } from '@/lib/data/school-calendar';

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
  return <BrandLoader compact />;
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
      if (json?.blocked) {
        try {
          sessionStorage.setItem('sf_blocked_msg', String(json.error || ''));
        } catch (e) {}
      }
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

/**
 * Alertes de la plateforme : échéance d'abonnement dans 3 jours ou moins, suppression
 * programmée (compte à rebours). Le serveur est interrogé toutes les 30 s ; un blocage
 * décidé par la plateforme déconnecte l'école et affiche le motif à la reconnexion.
 */
function usePlatformNotices(slug: string, enabled: boolean) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [deleteAtMs, setDeleteAtMs] = useState<number | null>(null);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled || slug === 'epc-manoi') return;
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/auth/session?slug=${encodeURIComponent(slug)}&t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (res.status === 401 || res.status === 403 || res.status === 402) {
          if (json?.blocked) {
            try {
              sessionStorage.setItem('sf_blocked_msg', String(json.error || ''));
            } catch (e) {}
          }
          kickToLogin(slug);
          return;
        }
        if (res.ok && json?.success) {
          setDaysLeft(typeof json.daysRemaining === 'number' ? json.daysRemaining : null);
          setEndDate(json.endDate || null);
          setDeleteAtMs(json.deleteAt ? new Date(json.deleteAt).getTime() : null);
          if (typeof json.serverNow === 'number') setSkew(json.serverNow - Date.now());
        }
      } catch (e) {}
    };
    poll();
    const t = setInterval(poll, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [slug, enabled]);

  useEffect(() => {
    if (deleteAtMs === null) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deleteAtMs]);

  const remainingMs = deleteAtMs === null ? null : deleteAtMs - (now + skew);
  useEffect(() => {
    if (remainingMs !== null && remainingMs <= -1500) kickToLogin(slug);
  }, [remainingMs, slug]);

  return { daysLeft, endDate, remainingMs, dismissed, dismiss: () => setDismissed(true) };
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
  const tab = useSingleTab();
  const notices = usePlatformNotices(schoolSlug, sessionOk);
  const [termAlert, setTermAlert] = useState<ReturnType<typeof termEndInfo>>(null);

  // Rappel 3 jours avant la fin du trimestre (dates saisies dans Paramètres).
  useEffect(() => {
    if (!sessionOk) return;
    try {
      const role = JSON.parse(localStorage.getItem('schoolflow_active_session_v2') || '{}').roleId;
      if (!['fondateur', 'fondateur_adjoint', 'directeur'].includes(role)) return;
      const info = termEndInfo(getLiveSchool(schoolSlug)?.termEnds);
      if (!info || info.daysLeft > 3 || info.daysLeft < 0) return;
      if (sessionStorage.getItem(`sf_term_alert_${schoolSlug}_${info.endDate}`)) return;
      setTermAlert(info);
    } catch (e) {}
  }, [sessionOk, schoolSlug]);

  // Notes, appel, dépenses, salaires… sont enregistrés en base et partagés entre appareils.
  // La lecture des données démarre tout de suite, en même temps que la vérification de session.
  useEffect(() => {
    installCloudKv(schoolSlug);
    startCrossDeviceSync(schoolSlug);
    installGlobalErrorReporting();
  }, [schoolSlug]);

  // Un seul onglet à la fois : un deuxième onglet attend, il ne duplique pas l'application.
  if (tab.state === 'blocked') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-5">
        <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AppWindow className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-extrabold text-slate-900 font-heading">{getLiveSchool(schoolSlug)?.shortName || 'School Flow Africa'} est déjà ouvert</h1>
            <p className="text-xs text-slate-500">
              Il tourne déjà dans un autre onglet ou une autre fenêtre de ce navigateur. Fermez l’autre pour éviter les doublons,
              ou travaillez ici.
            </p>
          </div>
          <button
            type="button"
            onClick={tab.takeOver}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 cursor-pointer"
          >
            Utiliser cet onglet
          </button>
          <p className="text-[10px] text-slate-400">Cet onglet reprend tout seul dès que l’autre est fermé.</p>
        </div>
      </div>
    );
  }

  if (!sessionOk) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <BrandLoader title="Vérification de la session…" />
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
          <PwaBanners />
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
            <DataReadyGate>
              <SetupReminder schoolSlug={schoolSlug} />
              {children}
            </DataReadyGate>
          </main>
        </div>

        {/* Fin de trimestre proche (3 jours) : rappel, une fois par jour et par appareil */}
        {termAlert && (
          <NoticeModal
            title="Fin de trimestre proche"
            message={`${termAlert.term} se termine ${termAlert.daysLeft <= 0 ? 'aujourd’hui' : `dans ${termAlert.daysLeft} jour${termAlert.daysLeft > 1 ? 's' : ''}`}.\n${
              termAlert.next ? `Le logiciel passera automatiquement au ${termAlert.next}.` : 'C’est le dernier trimestre de l’année.'
            }\nPour prolonger, repoussez la date de fin dans Paramètres › Année & calendrier.`}
            showContact={false}
            onClose={() => {
              try {
                sessionStorage.setItem(`sf_term_alert_${schoolSlug}_${termAlert.endDate}`, '1');
              } catch (e) {}
              setTermAlert(null);
            }}
            closeLabel="Compris"
          />
        )}
        {/* Suppression programmée par la plateforme : compte à rebours impossible à fermer */}
        {notices.remainingMs !== null && (
          <NoticeModal
            title="Établissement supprimé par SchoolFlow Africa"
            message={'Cet établissement va être supprimé de la plateforme.\nVous allez être déconnecté et les données vont disparaître dans :'}
            countdown={`${Math.max(0, Math.ceil(notices.remainingMs / 1000))} s`}
          />
        )}
        {/* Échéance d'abonnement dans 3 jours ou moins */}
        {notices.remainingMs === null && !notices.dismissed && notices.daysLeft !== null && notices.daysLeft <= 3 && notices.daysLeft >= 0 && (
          <NoticeModal
            title="Abonnement bientôt expiré"
            message={
              notices.daysLeft === 0
                ? 'Votre abonnement SchoolFlow Africa expire AUJOURD’HUI.\nRenouvelez-le pour ne pas perdre l’accès.'
                : `Votre abonnement SchoolFlow Africa expire dans ${notices.daysLeft} jour${notices.daysLeft > 1 ? 's' : ''}${
                    notices.endDate ? ` (le ${new Date(notices.endDate).toLocaleDateString('fr-FR')})` : ''
                  }.\nRenouvelez-le pour ne pas perdre l’accès.`
            }
            onClose={notices.dismiss}
          />
        )}

        {/* Notificateur Universel Temps Réel Multi-Appareils */}
        <RealtimeNotifier schoolSlug={schoolSlug} />

        {/* Chiffres globaux masqués sauf pour le Fondateur (code demandé au Directeur) */}
        <FiguresPrivacyHost />
      </div>
    </ReadOnlyGuard>
  );
}
