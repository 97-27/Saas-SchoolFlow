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
  AlertTriangle,
  PlusCircle,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import {
  getLiveStudents,
  getLiveInvoices,
  getLiveSchool,
  DATA_UPDATED_EVENT,
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
  const [students, setStudents] = useState<Student[]>(() => getLiveStudents(initialStudents, schoolSlug));
  const [invoices, setInvoices] = useState<Invoice[]>(() => getLiveInvoices(initialInvoices, schoolSlug));
  const [schoolState, setSchoolState] = useState<School>(() => getLiveSchool(schoolSlug, school));

  // Synchronisation en direct avec le stockage local & événements
  useEffect(() => {
    const handleUpdate = () => {
      setStudents(getLiveStudents(initialStudents, schoolSlug));
      setInvoices(getLiveInvoices(initialInvoices, schoolSlug));
      setSchoolState(getLiveSchool(schoolSlug, school));
    };

    handleUpdate();
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [initialStudents, initialInvoices, schoolSlug, school]);

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

    let boardingSubsSet = new Set<string>();
    if (typeof window !== 'undefined') {
      try {
        const rawBoarding = localStorage.getItem('schoolflow_boarding_subscriptions_v3');
        if (rawBoarding) {
          const subs: any[] = JSON.parse(rawBoarding);
          subs.forEach((b) => {
            if (b.studentId) boardingSubsSet.add(b.studentId);
            if (b.matricule) boardingSubsSet.add(b.matricule);
          });
        }
      } catch (e) {}
    }

    const boardingList = students.filter(
      (s) =>
        s.isBoarding ||
        boardingSubsSet.has(s.id) ||
        (s.studentNumber && boardingSubsSet.has(s.studentNumber)) ||
        (s.matricule && boardingSubsSet.has(s.matricule))
    );
    const boardingCount = boardingList.length;
    const boardingGirls = boardingList.filter((s) => s.gender === 'female').length;
    const boardingBoys = boardingList.filter((s) => s.gender === 'male').length;

    // Calculs financiers réels
    const totalCollected = invoices.reduce(
      (acc, inv) => acc + (inv.paidAmount || 0),
      0
    );

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

      {/* Bannière d'invitation à la configuration initiale (si sigles ou logo non encore configurés) */}
      {(!schoolState.shortName || !schoolState.logoUrl || !schoolState.city) && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 font-heading">
                ⚙️ Configuration initiale de l'établissement requise
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                Vos sigles officiels, logo, armoiries nationales, ville et fondateurs sont en attente de personnalisation. Configurez-les pour qu'ils s'affichent automatiquement sur vos reçus et bulletins officiels.
              </p>
            </div>
          </div>
          <Link
            href={`/${schoolSlug}/admin/parametres`}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm transition-all"
          >
            <span>Configurer dans Paramètres</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 5 Cartes KPI Pandhowan avec répartition Filles / Garçons et Effectifs Réels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
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

        {/* Card 5: Reste à Percevoir (FCFA) */}
        <StatCard
          title="Reste à Percevoir (FCFA)"
          value={formatFCFA(metrics.totalOverdue)}
          icon={AlertTriangle}
          trend={-parseFloat((100 - parseFloat(metrics.collectionRate)).toFixed(1))}
          isPositiveGood={false}
          trendText={`${metrics.overdueCount} en attente`}
          subtitle={`Taux d'encaissement : ${metrics.collectionRate}%`}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
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
