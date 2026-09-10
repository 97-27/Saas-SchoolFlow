'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { StatCard } from '@/components/dashboard/stat-card';
import { RevenueSummary } from '@/components/dashboard/revenue-summary';
import { InvoiceTable } from '@/components/dashboard/invoice-table';
import { Student, Invoice, School, DashboardKPIs } from '@/lib/data/types';
import { formatFCFA } from '@/lib/utils/formatters';
import {
  Users,
  UserCheck,
  UserPlus,
  Building2,
  PlusCircle,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  Share2,
  Check,
  AlertTriangle,
  X,
} from 'lucide-react';
import Link from 'next/link';
import {
  getLiveStudents,
  getLiveInvoices,
  getLiveSchool,
  getDeletedStudentIds,
  DATA_UPDATED_EVENT,
  startCrossDeviceSync,
} from '@/lib/data/live-store';
import {
  getSchoolFromSupabase,
  getStudentsFromSupabase,
  getInvoicesFromSupabase,
  getServicesDataFromSupabase,
  saveServicesDataToSupabase,
} from '@/lib/supabase/services';

interface DashboardViewProps {
  school: School;
  schoolSlug: string;
  initialStudents: Student[];
  initialInvoices: Invoice[];
  initialKPIs: DashboardKPIs;
  initialServices?: any;
}

export function DashboardView({
  school,
  schoolSlug,
  initialStudents,
  initialInvoices,
  initialKPIs,
  initialServices,
}: DashboardViewProps) {
  const cleanSlug = (schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug) || 'epc-manoi';
  const [students, setStudents] = useState<Student[]>(() => getLiveStudents(initialStudents, cleanSlug));
  const [invoices, setInvoices] = useState<Invoice[]>(() => getLiveInvoices(initialInvoices, cleanSlug));
  const [schoolState, setSchoolState] = useState<School>(() => getLiveSchool(cleanSlug, school));
  const [servicesData, setServicesData] = useState<any>(() => initialServices || null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [activeRoleId, setActiveRoleId] = useState<string>('directeur');
  const [setupBannerDismissed, setSetupBannerDismissed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('schoolflow_active_session_v2');
      if (stored) setActiveRoleId(JSON.parse(stored).roleId || 'directeur');
    } catch (e) {}
  }, []);

  // Éléments d'identité de l'établissement à renseigner avant qu'ils n'apparaissent sur les
  // reçus et documents officiels (logo, emblème, cachet, devise, slogan, code/agrément). Une
  // nouvelle école qui vient de souscrire démarre avec tous ces champs vides — les reçus les
  // omettent déjà proprement (aucune image cassée), mais rien ne signale qu'ils restent à
  // compléter tant que ce n'est pas fait.
  const missingSetupItems = useMemo(() => {
    const items: string[] = [];
    if (!schoolState.logoUrl) items.push('Logo de l’établissement');
    if (!schoolState.countryEmblemUrl) items.push('Emblème / Armoiries officielles');
    if (!schoolState.stampUrl) items.push('Cachet officiel');
    if (!schoolState.motto) items.push('Devise de l’établissement');
    if (!schoolState.slogan) items.push('Slogan');
    if (!schoolState.ministryCode) items.push('Code du Ministère');
    if (!schoolState.approvalNumber) items.push('Numéro d’agrément');
    return items;
  }, [schoolState]);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SchoolFlow - ${schoolState.name}`,
          text: `Accès direct au tableau de bord de ${schoolState.name}`,
          url: shareUrl,
        });
        return;
      } catch (e) {}
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    }
  };

  // Synchronisation en direct avec le stockage local, l'API et événements SSE
  useEffect(() => {
    const activeSlug = (schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug) || 'epc-manoi';

    // Démarrer immédiatement la synchronisation SSE universelle et le rafraîchissement serveur
    startCrossDeviceSync(activeSlug);

    const handleUpdate = () => {
      setStudents(getLiveStudents(initialStudents, activeSlug));
      setInvoices(getLiveInvoices(initialInvoices, activeSlug));
      setSchoolState(getLiveSchool(activeSlug, school));
    };

    handleUpdate();

    // 1. Récupération directe et prioritaire depuis Supabase Cloud
    Promise.all([
      getStudentsFromSupabase(activeSlug),
      getInvoicesFromSupabase(activeSlug),
      getSchoolFromSupabase(activeSlug),
      getServicesDataFromSupabase(activeSlug),
    ])
      .then(([sbStudents, sbInvoices, sbSchool, sbServices]) => {
        let hasNewData = false;
        if (sbStudents && sbStudents.length > 0) {
          const liveStus = getLiveStudents(sbStudents, activeSlug);
          setStudents(liveStus);
          try {
            localStorage.setItem(`schoolflow_registered_students_v1_${activeSlug}`, JSON.stringify(liveStus));
            localStorage.setItem('schoolflow_registered_students_v1', JSON.stringify(liveStus));
          } catch (e) {}
          hasNewData = true;
        }
        if (sbInvoices && sbInvoices.length > 0) {
          const liveInvs = getLiveInvoices(sbInvoices, activeSlug);
          setInvoices(liveInvs);
          try {
            localStorage.setItem(`schoolflow_registered_invoices_v1_${activeSlug}`, JSON.stringify(liveInvs));
            localStorage.setItem('schoolflow_registered_invoices_v1', JSON.stringify(liveInvs));
          } catch (e) {}
          hasNewData = true;
        }
        if (sbSchool) {
          setSchoolState(sbSchool);
          try {
            localStorage.setItem(`schoolflow_school_settings_v1_${activeSlug}`, JSON.stringify(sbSchool));
          } catch (e) {}
          hasNewData = true;
        }
        if (sbServices) {
          setServicesData(sbServices);
          if (sbServices.boardingSubscriptions) {
            localStorage.setItem('schoolflow_boarding_subscriptions_v3', JSON.stringify(sbServices.boardingSubscriptions));
            localStorage.setItem(`schoolflow_boarding_subscriptions_v3_${activeSlug}`, JSON.stringify(sbServices.boardingSubscriptions));
          }
          if (sbServices.boardingPayments) {
            localStorage.setItem('schoolflow_boarding_monthly_payments_v3', JSON.stringify(sbServices.boardingPayments));
          }
          if (sbServices.canteenSubscriptions) {
            localStorage.setItem('schoolflow_canteen_subscriptions_v3', JSON.stringify(sbServices.canteenSubscriptions));
            localStorage.setItem('schoolflow_canteen_subscriptions_v2', JSON.stringify(sbServices.canteenSubscriptions));
            localStorage.setItem(`schoolflow_canteen_subscriptions_v3_${activeSlug}`, JSON.stringify(sbServices.canteenSubscriptions));
          }
          if (sbServices.canteenPayments) {
            localStorage.setItem('schoolflow_canteen_monthly_payments_v3', JSON.stringify(sbServices.canteenPayments));
            localStorage.setItem('schoolflow_canteen_monthly_payments_v2', JSON.stringify(sbServices.canteenPayments));
          }
          if (sbServices.transportSubscriptions) {
            localStorage.setItem('schoolflow_transport_subscriptions_v2', JSON.stringify(sbServices.transportSubscriptions));
            localStorage.setItem(`schoolflow_transport_subscriptions_v2_${activeSlug}`, JSON.stringify(sbServices.transportSubscriptions));
          }
          if (sbServices.transportPayments) {
            localStorage.setItem('schoolflow_transport_monthly_payments_v2', JSON.stringify(sbServices.transportPayments));
          }
          hasNewData = true;
        }
        if (hasNewData) {
          window.dispatchEvent(new Event(DATA_UPDATED_EVENT));
        }
      })
      .catch(() => {});

    // 2. Auto-récupération d'appoint depuis l'API pour éliminer tout cache résiduel sur les nouveaux terminaux
    fetch(`/api/sync?slug=${activeSlug}&t=${Date.now()}`)
      .then((res) => res.json())
      .then((res) => {
        if (res && res.success && res.data) {
          if (res.data.students && Array.isArray(res.data.students) && res.data.students.length > 0) {
            const liveStus = getLiveStudents(res.data.students, activeSlug);
            setStudents(liveStus);
            try {
              localStorage.setItem(`schoolflow_registered_students_v1_${activeSlug}`, JSON.stringify(liveStus));
              localStorage.setItem('schoolflow_registered_students_v1', JSON.stringify(liveStus));
            } catch (e) {}
          }
          if (res.data.invoices && Array.isArray(res.data.invoices) && res.data.invoices.length > 0) {
            const liveInvs = getLiveInvoices(res.data.invoices, activeSlug);
            setInvoices(liveInvs);
            try {
              localStorage.setItem(`schoolflow_registered_invoices_v1_${activeSlug}`, JSON.stringify(liveInvs));
              localStorage.setItem('schoolflow_registered_invoices_v1', JSON.stringify(liveInvs));
            } catch (e) {}
          }
          if (res.data.boardingSubscriptions || res.data.canteenSubscriptions || res.data.transportSubscriptions || res.data.installments) {
            setServicesData(res.data);
          }
          if (res.data.boardingSubscriptions) {
            localStorage.setItem('schoolflow_boarding_subscriptions_v3', JSON.stringify(res.data.boardingSubscriptions));
          }
          if (res.data.boardingPayments) {
            localStorage.setItem('schoolflow_boarding_monthly_payments_v3', JSON.stringify(res.data.boardingPayments));
          }
          if (res.data.canteenSubscriptions) {
            localStorage.setItem('schoolflow_canteen_subscriptions_v3', JSON.stringify(res.data.canteenSubscriptions));
            localStorage.setItem('schoolflow_canteen_subscriptions_v2', JSON.stringify(res.data.canteenSubscriptions));
          }
          if (res.data.canteenPayments) {
            localStorage.setItem('schoolflow_canteen_monthly_payments_v3', JSON.stringify(res.data.canteenPayments));
            localStorage.setItem('schoolflow_canteen_monthly_payments_v2', JSON.stringify(res.data.canteenPayments));
          }
          if (res.data.transportSubscriptions) {
            localStorage.setItem('schoolflow_transport_subscriptions_v2', JSON.stringify(res.data.transportSubscriptions));
          }
          if (res.data.transportPayments) {
            localStorage.setItem('schoolflow_transport_monthly_payments_v2', JSON.stringify(res.data.transportPayments));
          }
          window.dispatchEvent(new Event(DATA_UPDATED_EVENT));
        }
      })
      .catch(() => {});

    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [initialStudents, initialInvoices, schoolSlug, school]);

  const handleForceSync = async () => {
    const activeSlug = cleanSlug;
    setIsSyncing(true);

    // 1. Envoyer d'abord les données et suppressions locales actuelles pour ne jamais les
    // écraser. Isolé dans son propre try/catch : si UNE des lectures/écritures locales ci-
    // dessous échoue (ex: une entrée localStorage corrompue), l'étape 2 (la vraie raison
    // d'être du bouton "Actualiser Cloud" : aller chercher la vérité depuis Supabase) doit
    // s'exécuter quand même plutôt que d'être bloquée silencieusement par la même exception.
    try {
      const currentLocalStudents = getLiveStudents([], activeSlug);
      const currentLocalInvoices = getLiveInvoices([], activeSlug);
      const currentDeletedIds = Array.from(getDeletedStudentIds());

      let rawBoardingSubs = localStorage.getItem('schoolflow_boarding_subscriptions_v3') || localStorage.getItem(`schoolflow_boarding_subscriptions_v3_${activeSlug}`);
      let rawBoardingPay = localStorage.getItem('schoolflow_boarding_monthly_payments_v3');
      let rawCanteenSubs = localStorage.getItem('schoolflow_canteen_subscriptions_v3') || localStorage.getItem('schoolflow_canteen_subscriptions_v2') || localStorage.getItem(`schoolflow_canteen_subscriptions_v3_${activeSlug}`);
      let rawCanteenPay = localStorage.getItem('schoolflow_canteen_monthly_payments_v3') || localStorage.getItem('schoolflow_canteen_monthly_payments_v2');
      let rawTransportSubs = localStorage.getItem('schoolflow_transport_subscriptions_v2') || localStorage.getItem(`schoolflow_transport_subscriptions_v2_${activeSlug}`);
      let rawTransportPay = localStorage.getItem('schoolflow_transport_monthly_payments_v2');

      const boardingSubscriptions = rawBoardingSubs ? JSON.parse(rawBoardingSubs) : (servicesData?.boardingSubscriptions || []);
      const boardingPayments = rawBoardingPay ? JSON.parse(rawBoardingPay) : (servicesData?.boardingPayments || {});
      const canteenSubscriptions = rawCanteenSubs ? JSON.parse(rawCanteenSubs) : (servicesData?.canteenSubscriptions || {});
      const canteenPayments = rawCanteenPay ? JSON.parse(rawCanteenPay) : (servicesData?.canteenPayments || {});
      const transportSubscriptions = rawTransportSubs ? JSON.parse(rawTransportSubs) : (servicesData?.transportSubscriptions || {});
      const transportPayments = rawTransportPay ? JSON.parse(rawTransportPay) : (servicesData?.transportPayments || {});

      const installments = servicesData?.installments || {
        versement1: 65000,
        versement2: 20000,
        versement3: 20000,
        versement4: 15000,
        versement5: 0,
      };

      const consolidatedServices = {
        boardingSubscriptions,
        boardingPayments,
        canteenSubscriptions,
        canteenPayments,
        transportSubscriptions,
        transportPayments,
        installments,
      };

      setServicesData(consolidatedServices);

      // Sauvegarde directe Supabase Cloud
      saveServicesDataToSupabase(activeSlug, consolidatedServices).catch(() => {});

      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: activeSlug,
          students: currentLocalStudents,
          invoices: currentLocalInvoices,
          deletedStudentIds: currentDeletedIds,
          ...consolidatedServices,
        }),
      }).catch(() => {});
    } catch (pushErr) {
      console.error('Erreur envoi local -> cloud (Actualiser Cloud, étape 1/2) :', pushErr);
    }

    try {
      // 2. Récupérer les données fraîches synchronisées. Ce bouton sert précisément à trancher
      // en faveur du cloud : on prend désormais la liste Supabase telle quelle (moins les
      // suppressions locales pas encore synchronisées) au lieu de la refaire passer par la
      // fusion "priorité au local" de getLiveStudents(), qui pouvait laisser une entrée locale
      // périmée (ex: un doublon résiduel de même nom, jamais nettoyé sur cet appareil précis)
      // bloquer silencieusement l'ajout d'un élève pourtant bien présent côté serveur.
      const res = await fetch(`/api/sync?slug=${activeSlug}&forceSupabase=true&t=${Date.now()}`);
      const result = await res.json();
      if (result && result.success && result.data) {
        const delSet = getDeletedStudentIds();
        if (result.data.students && Array.isArray(result.data.students)) {
          const liveStus = result.data.students.filter(
            (s: any) => !delSet.has(s.id) && !delSet.has(s.studentNumber) && !delSet.has(s.matricule)
          );
          localStorage.setItem(`schoolflow_registered_students_v1_${activeSlug}`, JSON.stringify(liveStus));
          localStorage.setItem('schoolflow_registered_students_v1', JSON.stringify(liveStus));
          setStudents(liveStus);
        }
        if (result.data.invoices && Array.isArray(result.data.invoices)) {
          const liveInvs = result.data.invoices.filter(
            (inv: any) => !delSet.has(inv.id) && !delSet.has(inv.studentId) && !delSet.has(inv.invoiceNumber)
          );
          localStorage.setItem(`schoolflow_registered_invoices_v1_${activeSlug}`, JSON.stringify(liveInvs));
          localStorage.setItem('schoolflow_registered_invoices_v1', JSON.stringify(liveInvs));
          setInvoices(liveInvs);
        }
        if (result.data.boardingSubscriptions) {
          localStorage.setItem('schoolflow_boarding_subscriptions_v3', JSON.stringify(result.data.boardingSubscriptions));
        }
        if (result.data.boardingPayments) {
          localStorage.setItem('schoolflow_boarding_monthly_payments_v3', JSON.stringify(result.data.boardingPayments));
        }
        if (result.data.canteenSubscriptions) {
          localStorage.setItem('schoolflow_canteen_subscriptions_v2', JSON.stringify(result.data.canteenSubscriptions));
        }
        if (result.data.canteenPayments) {
          localStorage.setItem('schoolflow_canteen_monthly_payments_v2', JSON.stringify(result.data.canteenPayments));
        }
        if (result.data.transportSubscriptions) {
          localStorage.setItem('schoolflow_transport_subscriptions_v2', JSON.stringify(result.data.transportSubscriptions));
        }
        if (result.data.transportPayments) {
          localStorage.setItem('schoolflow_transport_monthly_payments_v2', JSON.stringify(result.data.transportPayments));
        }
        window.dispatchEvent(new CustomEvent(DATA_UPDATED_EVENT, { detail: { action: 'manual_sync_completed' } }));
      }
    } catch (e) {
      console.error('Erreur synchronisation manuelle:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculs dynamiques et 100% cohérents avec le nombre réel d'élèves
  const metrics = useMemo(() => {
    const totalCount = students.length;
    const girlsCount = students.filter((s) => s.gender === 'female').length;
    const boysCount = students.filter((s) => s.gender === 'male').length;

    const newStudentsList = students.filter(
      (s) => s.enrollmentType === 'nouveau' || !s.enrollmentType
    );
    const newCount = newStudentsList.length;
    const newGirls = newStudentsList.filter((s) => s.gender === 'female').length;
    const newBoys = newStudentsList.filter((s) => s.gender === 'male').length;
    const newPct = totalCount > 0 ? ((newCount / totalCount) * 100).toFixed(1) : '0';

    const returningStudentsList = students.filter(
      (s) => s.enrollmentType === 'ancien'
    );
    const returningCount = returningStudentsList.length;
    const returningGirls = returningStudentsList.filter((s) => s.gender === 'female').length;
    const returningBoys = returningStudentsList.filter((s) => s.gender === 'male').length;
    const returningPct = totalCount > 0 ? ((returningCount / totalCount) * 100).toFixed(1) : '0';

    const seenBoarderKeys = new Set<string>();
    let boardingCount = 0;
    let boardingGirls = 0;
    let boardingBoys = 0;

    if (typeof window !== 'undefined') {
      try {
        const deletedIds = getDeletedStudentIds();
        const rawBoarding = localStorage.getItem('schoolflow_boarding_subscriptions_v3') || localStorage.getItem(`schoolflow_boarding_subscriptions_v3_${cleanSlug}`);
        if (rawBoarding) {
          const subs: any[] = JSON.parse(rawBoarding);
          subs.forEach((b) => {
            if (!deletedIds.has(b.studentId) && !(b.matricule && deletedIds.has(b.matricule))) {
              const key = b.studentId || b.matricule || b.studentName;
              if (key && !seenBoarderKeys.has(key)) {
                seenBoarderKeys.add(key);
                boardingCount++;
                if (b.gender === 'F') boardingGirls++;
                else boardingBoys++;
              }
            }
          });
        }
      } catch (e) {}
    }

    if (servicesData?.boardingSubscriptions && Array.isArray(servicesData.boardingSubscriptions)) {
      servicesData.boardingSubscriptions.forEach((b: any) => {
        const key = b.studentId || b.matricule || b.studentName;
        if (key && !seenBoarderKeys.has(key)) {
          seenBoarderKeys.add(key);
          boardingCount++;
          if (b.gender === 'F') boardingGirls++;
          else boardingBoys++;
        }
      });
    }

    students.forEach((s) => {
      const isBoarder = s.isBoarding || s.notes?.toLowerCase().includes('internat (oui)') || s.address?.toLowerCase().includes('internat (oui)');
      if (isBoarder) {
        const key = s.id || s.studentNumber || s.fullName;
        if (key && !seenBoarderKeys.has(key) && !seenBoarderKeys.has(s.studentNumber) && !seenBoarderKeys.has(s.matricule)) {
          seenBoarderKeys.add(key);
          boardingCount++;
          if (s.gender === 'female') boardingGirls++;
          else boardingBoys++;
        }
      }
    });

    // Calculs financiers réels (Factures + paiements directs d'internat consolidés)
    let totalCollected = invoices.reduce(
      (acc, inv) => acc + (inv.paidAmount || 0),
      0
    );

    if (typeof window !== 'undefined') {
      try {
        const rawBoardingPay = localStorage.getItem('schoolflow_boarding_monthly_payments_v3');
        const rawBoardingSubs = localStorage.getItem('schoolflow_boarding_subscriptions_v3');
        if (rawBoardingPay && rawBoardingSubs) {
          const monthlyPayments: Record<string, Record<string, boolean>> = JSON.parse(rawBoardingPay);
          const subs: Array<{ studentId: string; monthlyRate: number }> = JSON.parse(rawBoardingSubs);
          const rateMap = new Map<string, number>();
          subs.forEach((sub) => rateMap.set(sub.studentId, sub.monthlyRate || 25000));

          const invoiceStudentIdsWithBoarding = new Set(
            invoices.filter((i) => i.feeType?.toLowerCase().includes('internat') || i.id?.includes('boarding')).map((i) => i.studentId)
          );

          Object.entries(monthlyPayments).forEach(([stuId, months]) => {
            if (!invoiceStudentIdsWithBoarding.has(stuId)) {
              const paidCount = Object.values(months).filter(Boolean).length;
              const rate = rateMap.get(stuId) || 25000;
              totalCollected += paidCount * rate;
            }
          });
        }
      } catch (e) {}
    }

    const totalOverdue = invoices.reduce((acc, inv) => {
      if (typeof inv.balanceRemaining === 'number') {
        return acc + inv.balanceRemaining;
      }
      return acc + Math.max(0, inv.amount - (inv.paidAmount || 0));
    }, 0);

    const overdueCount = invoices.filter((inv) => {
      const rem =
        typeof inv.balanceRemaining === 'number'
          ? inv.balanceRemaining
          : inv.amount - (inv.paidAmount || 0);
      return rem > 0;
    }).length;

    const totalExigible = totalCollected + totalOverdue;
    const collectionRate =
      totalExigible > 0 ? ((totalCollected / totalExigible) * 100).toFixed(1) : '100';

    return {
      totalCount,
      girlsCount,
      boysCount,
      newCount,
      newGirls,
      newBoys,
      newPct,
      returningCount,
      returningGirls,
      returningBoys,
      returningPct,
      boardingCount,
      boardingGirls,
      boardingBoys,
      totalCollected,
      totalOverdue,
      overdueCount,
      collectionRate,
    };
  }, [students, invoices]);

  return (
    <div className="space-y-7 pb-12">
      {/* Bannière de configuration à compléter — uniquement visible par le Directeur/Fondateur,
          seuls rôles ayant accès à la page Paramètres pour agir sur ces éléments. */}
      {(activeRoleId === 'directeur' || activeRoleId === 'fondateur') &&
        missingSetupItems.length > 0 &&
        !setupBannerDismissed && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-bold text-amber-900">
                Configuration de l’établissement à compléter avant l’impression des reçus officiels
              </p>
              <p className="text-[11px] sm:text-xs text-amber-700 mt-0.5">
                À renseigner dans les Paramètres : {missingSetupItems.join(' • ')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/${schoolSlug}/admin/parametres`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all shadow-2xs whitespace-nowrap"
              >
                <span>Aller aux Paramètres</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setSetupBannerDismissed(true)}
                className="p-2 rounded-xl text-amber-500 hover:text-amber-800 hover:bg-amber-100 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      {/* En-tête de page Pandhowan. Le sous-titre (qui inclut le nom complet de l'établissement)
          ne doit JAMAIS se couper sur deux lignes : whitespace-nowrap le garantit dès "sm", et
          flex-wrap sur la ligne fait redescendre le groupe de 4 boutons sur sa propre ligne (au
          lieu de forcer le texte à se compresser) si la largeur totale ne suffit pas. Le titre
          garde sa largeur naturelle (pas de min-w-0 qui l'autoriserait à se réduire et donc à
          faire retourner le texte à la ligne). */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Tableau de bord de gestion
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {schoolState.academicYear}
            </span>
          </div>
          <p suppressHydrationWarning className="text-xs sm:text-sm text-slate-500 mt-1 font-sans sm:whitespace-nowrap">
            Suivi des effectifs réels ({metrics.totalCount} élèves inscrits), scolarités en FCFA et reçus — {schoolState.name}
          </p>
        </div>

        {/* Boutons d'actions rapides */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-all shadow-2xs cursor-pointer"
          >
            {shareCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Lien copié !</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Partager l&apos;accès</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleForceSync}
            disabled={isSyncing}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronisation...' : 'Actualiser Cloud'}</span>
          </button>

          <Link
            href={`/${schoolSlug}/admin/rapports`}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Rapport financier</span>
          </Link>

          <Link
            href={`/${schoolSlug}/admin/inscriptions`}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouvelle Inscription</span>
          </Link>
        </div>
      </div>


      {/* 4 Cartes KPI Pandhowan avec répartition Filles / Garçons et Effectifs Réels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Élèves Inscrits */}
        <StatCard
          title="Total Élèves Inscrits"
          value={metrics.totalCount.toLocaleString('fr-FR')}
          icon={Users}
          trend={initialKPIs.totalStudentsTrend !== undefined ? initialKPIs.totalStudentsTrend : 0}
          trendText={metrics.totalCount > 0 ? "confirmés" : "inscrits"}
          genderBreakdown={{
            girls: metrics.girlsCount,
            boys: metrics.boysCount,
          }}
          subtitle={`Effectif global (dont ${metrics.boardingCount} à l'internat)`}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />

        {/* Card 2: Total Anciens Inscrits */}
        <StatCard
          title="Total Anciens Inscrits"
          value={metrics.returningCount.toLocaleString('fr-FR')}
          icon={UserCheck}
          trend={parseFloat(metrics.returningPct)}
          trendText={`${metrics.returningPct}% de l'école`}
          genderBreakdown={{
            girls: metrics.returningGirls,
            boys: metrics.returningBoys,
          }}
          subtitle="Réinscriptions d'anciens élèves"
          iconBgColor="bg-teal-50"
          iconColor="text-teal-600"
        />

        {/* Card 3: Total Nouveaux Inscrits */}
        <StatCard
          title="Total Inscrits Nouveaux"
          value={metrics.newCount.toLocaleString('fr-FR')}
          icon={UserPlus}
          trend={parseFloat(metrics.newPct)}
          trendText={`${metrics.newPct}% de l'école`}
          genderBreakdown={{
            girls: metrics.newGirls,
            boys: metrics.newBoys,
          }}
          subtitle={`Nouvelles admissions ${schoolState.academicYear}`}
          iconBgColor="bg-indigo-50"
          iconColor="text-indigo-600"
        />

        {/* Card 4: Total Inscrits Internat */}
        <StatCard
          title="Total Inscrits Internat"
          value={metrics.boardingCount.toLocaleString('fr-FR')}
          icon={Building2}
          trend={metrics.totalCount > 0 ? Math.round((metrics.boardingCount / metrics.totalCount) * 100) : 0}
          trendText="Pensionnaires"
          genderBreakdown={{
            girls: metrics.boardingGirls,
            boys: metrics.boardingBoys,
          }}
          subtitle={`Pensionnaires inclus dans l'effectif global (${metrics.totalCount})`}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Recouvrement mensuel & Structure des encaissements */}
      <RevenueSummary
        academicYear={schoolState.academicYear}
        invoices={invoices}
        students={students}
        servicesData={servicesData}
      />

      {/* Tableau des factures & encaissements avec colonne Statut Nouveau / Ancien */}
      <InvoiceTable initialInvoices={invoices} schoolSlug={schoolSlug} />
    </div>
  );
}
