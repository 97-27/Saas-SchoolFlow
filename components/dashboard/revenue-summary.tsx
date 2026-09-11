'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatFCFA } from '@/lib/utils/formatters';
import { Invoice, Student } from '@/lib/data/types';
import { TrendingUp, PieChart, CheckCircle2, Calendar } from 'lucide-react';
import { DATA_UPDATED_EVENT } from '@/lib/data/live-store';

interface RevenueSummaryProps {
  academicYear?: string;
  invoices?: Invoice[];
  students?: Student[];
  servicesData?: any;
}

export function RevenueSummary({
  academicYear = '2026-2027',
  invoices = [],
  students = [],
  servicesData,
}: RevenueSummaryProps) {
  const [serviceVersion, setServiceVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setServiceVersion((v) => v + 1);
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, []);

  // Calcul dynamique de la structure des encaissements réels
  const breakdownData = useMemo(() => {
    // 1. Droits d'Inscription & Réinscription : calculé strictement sur la somme des frais d'inscription réels perçus par l'école
    const inscriptionAmount = students.reduce((acc, stu) => {
      const fee = typeof stu.registrationFee === 'number' ? stu.registrationFee : 0;
      return acc + fee;
    }, 0);

    // 2. Internat & Pensionnat : calculé sur les souscriptions et paiements effectifs d'internat
    let boardingAmount = 0;
    let boardingStudentsCount = 0;

    // 3. Cantine & Transport scolaires
    let canteenAmount = 0;
    let canteenStudentsCount = 0;
    let transportAmount = 0;
    let transportStudentsCount = 0;

    // Calcul Internat (Strictement synchronisé avec la page Internat & Supabase Cloud)
    try {
      const rawBoardingSubs =
        (typeof window !== 'undefined'
          ? localStorage.getItem('schoolflow_boarding_subscriptions_v3') || localStorage.getItem('schoolflow_boarding_subscriptions_v3_epc-manoi')
          : null) || (servicesData?.boardingSubscriptions ? JSON.stringify(servicesData.boardingSubscriptions) : null);
      const rawBoardingPay =
        (typeof window !== 'undefined' ? localStorage.getItem('schoolflow_boarding_monthly_payments_v3') : null) ||
        (servicesData?.boardingPayments ? JSON.stringify(servicesData.boardingPayments) : null);

      const monthlyPayments: Record<string, Record<string, boolean>> = rawBoardingPay ? JSON.parse(rawBoardingPay) : {};
      const boardingSubsList: Array<{ studentId: string; studentName?: string; matricule?: string; className?: string; monthlyRate: number }> = rawBoardingSubs ? JSON.parse(rawBoardingSubs) : [];

      const seenBoardingIdentifiers = new Set<string>();

      // 1. Calculer à partir de chaque souscription d'internat réelle
      boardingSubsList.forEach((sub) => {
        if (!sub || !sub.studentId) return;
        const stu = students.find(
          (s) => s.id === sub.studentId || s.studentNumber === sub.studentId || (sub.matricule && s.matricule === sub.matricule)
        );

        const idKey = sub.studentId;
        const numKey = stu?.studentNumber;
        const matKey = sub.matricule || stu?.matricule;

        if (seenBoardingIdentifiers.has(idKey) || (numKey && seenBoardingIdentifiers.has(numKey)) || (matKey && seenBoardingIdentifiers.has(matKey))) {
          return;
        }

        seenBoardingIdentifiers.add(idKey);
        if (numKey) seenBoardingIdentifiers.add(numKey);
        if (matKey) seenBoardingIdentifiers.add(matKey);

        boardingStudentsCount += 1;

        const rate = typeof sub.monthlyRate === 'number' && sub.monthlyRate > 0 ? sub.monthlyRate : 25000;
        const months =
          monthlyPayments[sub.studentId] ||
          (stu?.id ? monthlyPayments[stu.id] : {}) ||
          (numKey ? monthlyPayments[numKey] : {}) ||
          (matKey ? monthlyPayments[matKey] : {}) ||
          {};
        const paidCount = Object.values(months).filter(Boolean).length;
        let studentBoardingPaid = paidCount * rate;

        // Vérifier si une quittance d'internat avec versement direct existe
        const directInvoice = invoices.find((inv) =>
          (inv.studentId === sub.studentId || inv.studentId === numKey || (matKey && inv.studentId === matKey)) &&
          ((inv.feeType || '').toLowerCase().includes('internat') || (inv.invoiceNumber || '').startsWith('QUI-INT-'))
        );
        if (directInvoice && directInvoice.paidAmount && directInvoice.paidAmount > studentBoardingPaid) {
          studentBoardingPaid = directInvoice.paidAmount;
        }

        boardingAmount += studentBoardingPaid;
      });

      // 2. Vérifier les élèves inscrits avec option internat active hors customSubscriptions
      students.forEach((stu) => {
        if (!stu) return;
        const idKey = stu.id;
        const numKey = stu.studentNumber;
        const matKey = stu.matricule;

        if (seenBoardingIdentifiers.has(idKey) || (numKey && seenBoardingIdentifiers.has(numKey)) || (matKey && seenBoardingIdentifiers.has(matKey))) {
          return;
        }

        const months =
          monthlyPayments[stu.id] ||
          (numKey ? monthlyPayments[numKey] : {}) ||
          (matKey ? monthlyPayments[matKey] : {}) ||
          {};
        const paidCount = Object.values(months).filter(Boolean).length;

        if (stu.isBoarding || paidCount > 0) {
          seenBoardingIdentifiers.add(idKey);
          if (numKey) seenBoardingIdentifiers.add(numKey);
          if (matKey) seenBoardingIdentifiers.add(matKey);

          boardingStudentsCount += 1;
          const rate = 25000;
          boardingAmount += paidCount * rate;
        }
      });
    } catch (e) {}

    // Calcul Cantine
    try {
      const rawCanteenSubs =
        (typeof window !== 'undefined'
          ? localStorage.getItem('schoolflow_canteen_subscriptions_v3') || localStorage.getItem('schoolflow_canteen_subscriptions_v2')
          : null) || (servicesData?.canteenSubscriptions ? JSON.stringify(servicesData.canteenSubscriptions) : null);
      const rawCanteenPay =
        (typeof window !== 'undefined'
          ? localStorage.getItem('schoolflow_canteen_monthly_payments_v3') || localStorage.getItem('schoolflow_canteen_monthly_payments_v2')
          : null) || (servicesData?.canteenPayments ? JSON.stringify(servicesData.canteenPayments) : null);

      const customDietMap: Record<string, { diet?: string; rate: number; discount?: number }> = rawCanteenSubs ? JSON.parse(rawCanteenSubs) : {};
      const monthlyPayments: Record<string, Record<string, boolean>> = rawCanteenPay ? JSON.parse(rawCanteenPay) : {};
      const seenCanteenIds = new Set<string>();

      Object.keys(customDietMap).forEach((stuId) => {
        const custom = customDietMap[stuId];
        // Même tarif par défaut que la page Cantine elle-même (canteen-view.tsx), sinon un même
        // élève sans tarif personnalisé affichait un total différent selon la page consultée.
        const rate = custom?.rate || 25000;
        const discount = custom?.discount || 0;
        const months = monthlyPayments[stuId] || {};
        const paidCount = Object.values(months).filter(Boolean).length;
        if (paidCount > 0) {
          seenCanteenIds.add(stuId);
          canteenStudentsCount += 1;
          canteenAmount += Math.max(0, paidCount * rate - discount);
        }
      });

      // Factures de cantine directes
      invoices.forEach((inv) => {
        const isCan = (inv.feeType || '').toLowerCase().includes('cantine') || (inv.invoiceNumber || '').startsWith('CAN-');
        if (isCan && inv.paidAmount && inv.paidAmount > 0 && !seenCanteenIds.has(inv.studentId)) {
          seenCanteenIds.add(inv.studentId);
          canteenStudentsCount += 1;
          canteenAmount += inv.paidAmount;
        }
      });
    } catch (e) {}

    // Calcul Transport
    try {
      const rawTransportSubs =
        (typeof window !== 'undefined'
          ? localStorage.getItem('schoolflow_transport_subscriptions_v2') || localStorage.getItem('schoolflow_transport_subscriptions_v3')
          : null) || (servicesData?.transportSubscriptions ? JSON.stringify(servicesData.transportSubscriptions) : null);
      const rawTransportPay =
        (typeof window !== 'undefined'
          ? localStorage.getItem('schoolflow_transport_monthly_payments_v2') || localStorage.getItem('schoolflow_transport_monthly_payments_v3')
          : null) || (servicesData?.transportPayments ? JSON.stringify(servicesData.transportPayments) : null);

      const customTransportMap: Record<string, { stop?: string; rate: number; discount?: number }> = rawTransportSubs ? JSON.parse(rawTransportSubs) : {};
      const monthlyPayments: Record<string, Record<string, boolean>> = rawTransportPay ? JSON.parse(rawTransportPay) : {};
      const seenTransportIds = new Set<string>();

      Object.keys(customTransportMap).forEach((stuId) => {
        const custom = customTransportMap[stuId];
        // Même tarif par défaut que la page Transport elle-même (transport-view.tsx).
        const rate = custom?.rate || 35000;
        const discount = custom?.discount || 0;
        const months = monthlyPayments[stuId] || {};
        const paidCount = Object.values(months).filter(Boolean).length;
        if (paidCount > 0) {
          seenTransportIds.add(stuId);
          transportStudentsCount += 1;
          transportAmount += Math.max(0, paidCount * rate - discount);
        }
      });

      // Factures de transport directes
      invoices.forEach((inv) => {
        const isTrp = (inv.feeType || '').toLowerCase().includes('transport') || (inv.invoiceNumber || '').startsWith('TRP-');
        if (isTrp && inv.paidAmount && inv.paidAmount > 0 && !seenTransportIds.has(inv.studentId)) {
          seenTransportIds.add(inv.studentId);
          transportStudentsCount += 1;
          transportAmount += inv.paidAmount;
        }
      });
    } catch (e) {}

    const totalCollected = inscriptionAmount + boardingAmount + canteenAmount + transportAmount;

    // Calcul précis et équilibré des pourcentages (somme stricte 100.0%)
    const rawPcts = [
      totalCollected > 0 ? (inscriptionAmount / totalCollected) * 100 : 0,
      totalCollected > 0 ? (boardingAmount / totalCollected) * 100 : 0,
      totalCollected > 0 ? (canteenAmount / totalCollected) * 100 : 0,
      totalCollected > 0 ? (transportAmount / totalCollected) * 100 : 0,
    ];

    const formattedPcts = rawPcts.map((p) => p.toFixed(1));

    const items = [
      {
        category: "Droits d'Inscription & Réinscription",
        description: 'Frais de dossier, cartes scolaires et admissions',
        amount: inscriptionAmount,
        countText: `${students.length} élève${students.length > 1 ? 's' : ''}`,
        percentage: formattedPcts[0],
        color: '#10b981', // emerald-500
        bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      {
        category: 'Internat & Pensionnat',
        description: 'Hébergement dortoirs (Pavillon A Garçons & B Filles)',
        amount: boardingAmount,
        countText: `${boardingStudentsCount} pensionnaire${boardingStudentsCount > 1 ? 's' : ''}`,
        percentage: formattedPcts[1],
        color: '#8b5cf6', // purple-500
        bgColor: 'bg-purple-50 text-purple-700 border-purple-200',
      },
      {
        category: 'Cantine Scolaire & Restauration',
        description: 'Formules demi-pension et déjeuners',
        amount: canteenAmount,
        countText: `${canteenStudentsCount} abonné${canteenStudentsCount > 1 ? 's' : ''}`,
        percentage: formattedPcts[2],
        color: '#f59e0b', // amber-500
        bgColor: 'bg-amber-50 text-amber-700 border-amber-200',
      },
      {
        category: 'Transport Scolaire & Bus',
        description: 'Abonnements aux circuits de ramassage',
        amount: transportAmount,
        countText: `${transportStudentsCount} abonné${transportStudentsCount > 1 ? 's' : ''}`,
        percentage: formattedPcts[3],
        color: '#3b82f6', // blue-500
        bgColor: 'bg-blue-50 text-blue-700 border-blue-200',
      },
    ];

    return {
      items,
      totalCollected,
      targetAnnual: totalCollected + (students.reduce((acc, s) => acc + (s.balanceRemaining || 0), 0)),
    };
  }, [students, invoices, serviceVersion]);

  // Recouvrement des 5 Échéances lié STRICTEMENT aux 5 Versements (Indépendant du mois calendaire de saisie)
  // 1er Versement -> Octobre 2026
  // 2ème Versement -> Novembre 2026
  // 3ème Versement -> Janvier 2027
  // 4ème Versement -> Mars 2027
  // 5ème Versement -> Mai 2027
  const monthlyData = useMemo(() => {
    const isEmpty = students.length === 0 && invoices.length === 0;

    let v1 = 0, v2 = 0, v3 = 0, v4 = 0, v5 = 0;

    // Indexer les factures et leurs versements par étudiant
    const studentInvoicesMap = new Map<string, Invoice[]>();
    invoices.forEach((inv) => {
      const sId = inv.studentId || inv.invoiceNumber;
      if (sId) {
        const list = studentInvoicesMap.get(sId) || [];
        list.push(inv);
        studentInvoicesMap.set(sId, list);
      }
    });

    const processedStudentIds = new Set<string>();

    students.forEach((stu) => {
      processedStudentIds.add(stu.id);
      if (stu.studentNumber) processedStudentIds.add(stu.studentNumber);

      const studentInvs = [
        ...(studentInvoicesMap.get(stu.id) || []),
        ...(studentInvoicesMap.get(stu.studentNumber) || []),
      ];

      // Récupérer l'échéancier soit de l'élève, soit de ses factures
      let inst = stu.installments;
      if (!inst || (!inst.versement1 && !inst.versement2 && !inst.versement3 && !inst.versement4 && !inst.versement5)) {
        for (const inv of studentInvs) {
          if (inv.installments && (inv.installments.versement1 || inv.installments.versement2 || inv.installments.versement3 || inv.installments.versement4 || inv.installments.versement5)) {
            inst = inv.installments;
            break;
          }
        }
      }

      let p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0;

      if (inst && (inst.versement1 || inst.versement2 || inst.versement3 || inst.versement4 || inst.versement5)) {
        p1 = inst.versement1?.amount || 0;
        p2 = inst.versement2?.amount || 0;
        p3 = inst.versement3?.amount || 0;
        p4 = inst.versement4?.amount || 0;
        p5 = inst.versement5?.amount || 0;
      }

      // Si aucun échéancier détaillé n'a été trouvé, ne RIEN estimer/répartir : un élève dont
      // le détail par tranche n'a pas encore été ressaisi ne contribue à aucune des 5 tranches
      // tant que cette saisie réelle (via la page Inscriptions) n'a pas eu lieu. Une estimation
      // proportionnelle a été essayée ici, mais elle affichait des montants inventés (y compris
      // sur la 5ème échéance, jamais réellement réglée) au lieu de la vérité du terrain — le
      // Directeur a explicitement demandé qu'une tranche reste à 0 tant qu'aucun versement réel
      // n'y est enregistré, plutôt que de risquer d'afficher un chiffre qui n'existe pas.

      v1 += p1;
      v2 += p2;
      v3 += p3;
      v4 += p4;
      v5 += p5;
    });

    // Prise en compte d'éventuelles factures d'échéances sans objet élève direct
    invoices.forEach((inv) => {
      const sId = inv.studentId || inv.invoiceNumber;
      if (sId && processedStudentIds.has(sId)) return; // Déjà traité ci-dessus

      const inst = inv.installments;
      if (inst) {
        v1 += inst.versement1?.amount || 0;
        v2 += inst.versement2?.amount || 0;
        v3 += inst.versement3?.amount || 0;
        v4 += inst.versement4?.amount || 0;
        v5 += inst.versement5?.amount || 0;
      }
    });

    // Aucune surcharge par un total "cloud consolidé" générique (servicesData.installments) :
    // cette valeur n'est pas propre à chaque élève et pouvait forcer un montant supérieur à la
    // somme réelle des versements individuels — même principe de non-fabrication que ci-dessus,
    // et alignement avec reports-view.tsx qui n'applique aucune surcharge de ce type.

    const getBadgeStyle = (amount: number) => {
      return amount > 0
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';
    };

    return [
      {
        month: 'Octobre 2026',
        label: '1ère Échéance (1er Versement)',
        collected: isEmpty ? 0 : v1,
        badgeColor: getBadgeStyle(isEmpty ? 0 : v1),
      },
      {
        month: 'Novembre 2026',
        label: '2ème Échéance (2ème Versement)',
        collected: isEmpty ? 0 : v2,
        badgeColor: getBadgeStyle(isEmpty ? 0 : v2),
      },
      {
        month: 'Janvier 2027',
        label: '3ème Échéance (3ème Versement)',
        collected: isEmpty ? 0 : v3,
        badgeColor: getBadgeStyle(isEmpty ? 0 : v3),
      },
      {
        month: 'Mars 2027',
        label: '4ème Échéance (4ème Versement)',
        collected: isEmpty ? 0 : v4,
        badgeColor: getBadgeStyle(isEmpty ? 0 : v4),
      },
      {
        month: 'Mai 2027',
        label: '5ème Échéance (5ème Versement)',
        collected: isEmpty ? 0 : v5,
        badgeColor: getBadgeStyle(isEmpty ? 0 : v5),
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
                  Échéances de Scolarité & Recouvrement
                </h3>
                <p className="text-xs text-slate-400">
                  Total des sommes reçues par échéance à partir d’octobre
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              Année {academicYear}
            </span>
          </div>

          {/* Liste épurée des 5 échéances avec sommes nettes */}
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
                    {item.collected > 0 ? 'Encaissé' : 'En attente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total cumulé des encaissements des 5 échéances */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Cumul total des 5 échéances :</span>
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

          {/* Barre proportionnelle segmentée des encaissements */}
          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex mb-3.5 border border-slate-200/60 shadow-2xs">
            {breakdownData.items.map((fee) => {
              const pctNum = parseFloat(fee.percentage) || 0;
              if (pctNum <= 0) return null;
              return (
                <div
                  key={fee.category}
                  style={{ width: `${pctNum}%`, backgroundColor: fee.color }}
                  className="h-full transition-all duration-500 hover:opacity-90"
                  title={`${fee.category}: ${fee.percentage}% (${formatFCFA(fee.amount)})`}
                />
              );
            })}
          </div>

          <div className="space-y-2.5">
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
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {fee.category}
                      </p>
                      {fee.countText && (
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          ({fee.countText})
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {formatFCFA(fee.amount)}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border shrink-0 font-mono ${fee.bgColor}`}>
                  {fee.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Total des encaissements perçus :</span>
          <span className="font-extrabold font-heading text-emerald-700 text-sm sm:text-base">
            {formatFCFA(breakdownData.totalCollected)}
          </span>
        </div>
      </div>
    </div>
  );
}
