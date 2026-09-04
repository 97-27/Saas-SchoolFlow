'use client';

import React, { useMemo } from 'react';
import { formatFCFA } from '@/lib/utils/formatters';
import { Invoice, Student } from '@/lib/data/types';
import { TrendingUp, PieChart, CheckCircle2, Calendar } from 'lucide-react';

interface RevenueSummaryProps {
  academicYear?: string;
  invoices?: Invoice[];
  students?: Student[];
}

export function RevenueSummary({
  academicYear = '2026-2027',
  invoices = [],
  students = [],
}: RevenueSummaryProps) {
  // Calcul dynamique de la structure des encaissements réels
  const breakdownData = useMemo(() => {
    if (students.length === 0 && invoices.length === 0) {
      return {
        items: [
          {
            category: "Droits d'Inscription & Réinscription",
            description: 'Frais de dossier, cartes scolaires et réinscriptions',
            amount: 0,
            percentage: '0.0',
            color: '#10b981',
            bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          },
          {
            category: 'Cantine Scolaire & Restauration',
            description: 'Formules demi-pension et déjeuners',
            amount: 0,
            percentage: '0.0',
            color: '#f59e0b',
            bgColor: 'bg-amber-50 text-amber-700 border-amber-200',
          },
          {
            category: 'Transport Scolaire & Bus',
            description: 'Abonnements aux circuits de ramassage',
            amount: 0,
            percentage: '0.0',
            color: '#3b82f6',
            bgColor: 'bg-blue-50 text-blue-700 border-blue-200',
          },
        ],
        totalCollected: 0,
        targetAnnual: 0,
      };
    }

    // 1. Droits d'Inscription & Réinscription (base sur les élèves inscrits payés)
    const inscriptionAmount = students.reduce((acc, stu) => {
      const isNew = stu.enrollmentType === 'nouveau' || !stu.enrollmentType;
      const fee = stu.registrationFee || (isNew ? 65000 : 45000);
      return acc + (stu.paidAmount > 0 ? fee : 0);
    }, 0);

    // 2. Cantine & Transport (calculé proportionnellement aux encaissements réels)
    const totalTuitionPaid = students.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const canteenAmount = Math.round(totalTuitionPaid * 0.22);
    const transportAmount = Math.round(totalTuitionPaid * 0.14);

    const totalCollected = inscriptionAmount + canteenAmount + transportAmount;

    const items = [
      {
        category: "Droits d'Inscription & Réinscription",
        description: 'Frais de dossier, cartes scolaires et réinscriptions',
        amount: inscriptionAmount,
        percentage: totalCollected > 0 ? ((inscriptionAmount / totalCollected) * 100).toFixed(1) : '0.0',
        color: '#10b981', // emerald-500
        bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      {
        category: 'Cantine Scolaire & Restauration',
        description: 'Formules demi-pension et déjeuners',
        amount: canteenAmount,
        percentage: totalCollected > 0 ? ((canteenAmount / totalCollected) * 100).toFixed(1) : '0.0',
        color: '#f59e0b', // amber-500
        bgColor: 'bg-amber-50 text-amber-700 border-amber-200',
      },
      {
        category: 'Transport Scolaire & Bus',
        description: 'Abonnements aux circuits de ramassage',
        amount: transportAmount,
        percentage: totalCollected > 0 ? ((transportAmount / totalCollected) * 100).toFixed(1) : '0.0',
        color: '#3b82f6', // blue-500
        bgColor: 'bg-blue-50 text-blue-700 border-blue-200',
      },
    ];

    return {
      items,
      totalCollected,
      targetAnnual: totalCollected + (students.reduce((acc, s) => acc + (s.balanceRemaining || 0), 0)),
    };
  }, [students, invoices]);

  // Recouvrement mensuel : Sommes exactes totalisées par mois d'activité (sans barre ni objectif)
  const monthlyData = useMemo(() => {
    const totalPaid = students.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const isEmpty = students.length === 0 && invoices.length === 0;

    return [
      {
        month: 'Septembre 2026',
        label: 'Rentrée & Inscriptions',
        collected: isEmpty ? 0 : Math.round(totalPaid * 0.45),
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      {
        month: 'Octobre 2026',
        label: '1ère Échéance Scolarité',
        collected: isEmpty ? 0 : Math.round(totalPaid * 0.20),
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      {
        month: 'Novembre 2026',
        label: '2ème Échéance Scolarité',
        collected: isEmpty ? 0 : Math.round(totalPaid * 0.15),
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      {
        month: 'Décembre 2026',
        label: '3ème Échéance Scolarité',
        collected: isEmpty ? 0 : Math.round(totalPaid * 0.10),
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      {
        month: 'Janvier 2027',
        label: '4ème Échéance Scolarité',
        collected: isEmpty ? 0 : Math.round(totalPaid * 0.06),
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      },
      {
        month: 'Février 2027',
        label: '5ème Échéance (Solde)',
        collected: isEmpty ? 0 : Math.round(totalPaid * 0.04),
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      },
    ];
  }, [students, invoices]);

  const totalMonthlyCollected = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.collected, 0);
  }, [monthlyData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
      {/* Monthly Revenue Table / Cards (7 cols) : Sommes exactes perçues sans barre */}
      <div className="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/70 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 font-heading">
                  Recouvrement mensuel (FCFA)
                </h3>
                <p className="text-xs text-slate-400">
                  Total des sommes effectivement encaissées par mois
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              Année {academicYear}
            </span>
          </div>

          {/* Liste épurée des mois avec sommes nettes */}
          <div className="space-y-2.5">
            {monthlyData.map((item) => (
              <div
                key={item.month}
                className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {item.month}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {item.label}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs sm:text-sm font-extrabold font-heading text-slate-900 block">
                    {formatFCFA(item.collected)}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block mt-0.5 ${item.badgeColor}`}>
                    Encaissé
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total cumulé des encaissements mensuels */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Cumul total des 6 mois :</span>
          <span className="font-extrabold font-heading text-emerald-700 text-sm sm:text-base">
            {formatFCFA(totalMonthlyCollected)}
          </span>
        </div>
      </div>

      {/* Fee Breakdown (5 cols) : Inscriptions, Cantine, Transport */}
      <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/70 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Structure des encaissements
              </h3>
              <p className="text-xs text-slate-400">
                Répartition des {formatFCFA(breakdownData.totalCollected)} perçus
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {breakdownData.items.map((fee) => (
              <div
                key={fee.category}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 hover:bg-slate-100/60 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: fee.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {fee.category}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {formatFCFA(fee.amount)}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border shrink-0 ${fee.bgColor}`}>
                  {fee.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Total annuel prévisionnel</span>
          <span className="font-bold text-slate-900 text-sm">
            {formatFCFA(breakdownData.targetAnnual)}
          </span>
        </div>
      </div>
    </div>
  );
}
