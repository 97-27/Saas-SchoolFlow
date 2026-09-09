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

interface DashboardViewProps {
  school: School;
  schoolSlug: string;
  initialStudents: Student[];
  initialInvoices: Invoice[];
  initialKPIs: DashboardKPIs;
}

export function DashboardView({
  school,
  schoolSlug,
  initialStudents,
  initialInvoices,
  initialKPIs,
}: DashboardViewProps) {
  const cleanSlug = (schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug) || 'epc-manoi';
  const [students, setStudents] = useState<Student[]>(() => getLiveStudents(initialStudents, cleanSlug));
  const [invoices, setInvoices] = useState<Invoice[]>(() => getLiveInvoices(initialInvoices, cleanSlug));
  const [schoolState, setSchoolState] = useState<School>(() => getLiveSchool(cleanSlug, school));
  const [isSyncing, setIsSyncing] = useState(false);

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

    // Auto-récupération immédiate depuis l'API pour éliminer tout cache résiduel sur les nouveaux terminaux
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
        }
      })
      .catch(() => {});

    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [initialStudents, initialInvoices, schoolSlug, school]);

  const handleForceSync = async () => {
    const activeSlug = cleanSlug;
    setIsSyncing(true);
    try {
      // 1. Envoyer d'abord les données et suppressions locales actuelles pour ne jamais les écraser
      const currentLocalStudents = getLiveStudents([], activeSlug);
      const currentLocalInvoices = getLiveInvoices([], activeSlug);
      const currentDeletedIds = Array.from(getDeletedStudentIds());

      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: activeSlug,
          students: currentLocalStudents,
          invoices: currentLocalInvoices,
          deletedStudentIds: currentDeletedIds,
        }),
      }).catch(() => {});

      // 2. Récupérer les données fraîches synchronisées
      const res = await fetch(`/api/sync?slug=${activeSlug}&forceSupabase=true&t=${Date.now()}`);
      const result = await res.json();
      if (result && result.success && result.data) {
        if (result.data.students && Array.isArray(result.data.students)) {
          const liveStus = getLiveStudents(result.data.students, activeSlug);
          localStorage.setItem(`schoolflow_registered_students_v1_${activeSlug}`, JSON.stringify(liveStus));
          localStorage.setItem('schoolflow_registered_students_v1', JSON.stringify(liveStus));
          setStudents(liveStus);
        }
        if (result.data.invoices && Array.isArray(result.data.invoices)) {
          const liveInvs = getLiveInvoices(result.data.invoices, activeSlug);
          localStorage.setItem(`schoolflow_registered_invoices_v1_${activeSlug}`, JSON.stringify(liveInvs));
          localStorage.setItem('schoolflow_registered_invoices_v1', JSON.stringify(liveInvs));
          setInvoices(liveInvs);
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
      {/* En-tête de page Pandhowan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Tableau de bord de gestion
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {schoolState.academicYear}
            </span>
          </div>
          <p suppressHydrationWarning className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Suivi des effectifs réels ({metrics.totalCount} élèves inscrits), scolarités en FCFA et factures — {schoolState.name}
          </p>
        </div>

        {/* Boutons d'actions rapides */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">

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
      />

      {/* Tableau des factures & encaissements avec colonne Statut Nouveau / Ancien */}
      <InvoiceTable initialInvoices={invoices} schoolSlug={schoolSlug} />
    </div>
  );
}
