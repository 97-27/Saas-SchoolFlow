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
}

export function RevenueSummary({
  academicYear = '2026-2027',
  invoices = [],
  students = [],
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

    if (typeof window !== 'undefined') {
      // Calcul Internat
      // Calcul Internat
      try {
        const rawBoardingSubs = localStorage.getItem('schoolflow_boarding_subscriptions_v3');
        const rawBoardingPay = localStorage.getItem('schoolflow_boarding_monthly_payments_v3');
        const monthlyPayments: Record<string, Record<string, boolean>> = rawBoardingPay ? JSON.parse(rawBoardingPay) : {};
        const boardingSubsList: Array<{ studentId: string; matricule?: string; monthlyRate: number }> = rawBoardingSubs ? JSON.parse(rawBoardingSubs) : [];
        const boardingSubsMap = new Map<string, number>();
        boardingSubsList.forEach((sub) => {
          if (sub.studentId) boardingSubsMap.set(sub.studentId, sub.monthlyRate || 50000);
          if (sub.matricule) boardingSubsMap.set(sub.matricule, sub.monthlyRate || 50000);
        });

        const seenBoardingIds = new Set<string>();

        // 1. Tous les élèves inscrits avec option Internat
        students.forEach((stu) => {
          const hasOptedBoarding = Boolean(
            stu.isBoarding ||
            stu.notes?.toLowerCase().includes('internat (oui)') ||
            stu.address?.toLowerCase().includes('internat (oui)') ||
            boardingSubsMap.has(stu.id) ||
            (stu.studentNumber && boardingSubsMap.has(stu.studentNumber)) ||
            (stu.matricule && boardingSubsMap.has(stu.matricule))
          );
          if (hasOptedBoarding) {
            seenBoardingIds.add(stu.id);
            boardingStudentsCount += 1;
            const rate = boardingSubsMap.get(stu.id) || boardingSubsMap.get(stu.studentNumber) || 50000;
            const months = monthlyPayments[stu.id] || (stu.studentNumber ? monthlyPayments[stu.studentNumber] : {}) || {};
            const paidCount = Object.values(months).filter(Boolean).length;
            if (paidCount > 0) {
              boardingAmount += paidCount * rate;
            }
          }
        });

        // 2. Souscriptions manuelles additionnelles
        boardingSubsList.forEach((sub) => {
          if (sub.studentId && !seenBoardingIds.has(sub.studentId)) {
            seenBoardingIds.add(sub.studentId);
            boardingStudentsCount += 1;
            const rate = sub.monthlyRate || 50000;
            const months = monthlyPayments[sub.studentId] || {};
            const paidCount = Object.values(months).filter(Boolean).length;
            if (paidCount > 0) {
              boardingAmount += paidCount * rate;
            }
          }
        });
      } catch (e) {}

      // Calcul Cantine
      try {
        const rawCanteenSubs = localStorage.getItem('schoolflow_canteen_subscriptions_v3');
        const rawCanteenPay = localStorage.getItem('schoolflow_canteen_monthly_payments_v3');
        if (rawCanteenSubs) {
          const customDietMap: Record<string, { diet: string; rate: number; discount?: number }> = JSON.parse(rawCanteenSubs);
          const monthlyPayments: Record<string, Record<string, boolean>> = rawCanteenPay ? JSON.parse(rawCanteenPay) : {};

          Object.keys(customDietMap).forEach((stuId) => {
            const stuExists = students.some((s) => s.id === stuId || s.studentNumber === stuId);
            if (stuExists) {
              const custom = customDietMap[stuId];
              const rate = custom?.rate || 25000;
              const discount = custom?.discount || 0;
              const months = monthlyPayments[stuId] || {};
              const paidCount = Object.values(months).filter(Boolean).length;
              if (paidCount > 0) {
                const total = Math.max(0, paidCount * rate - discount);
                canteenAmount += total;
                canteenStudentsCount += 1;
              }
            }
          });
        }
      } catch (e) {}

      // Calcul Transport
      try {
        const rawTransportSubs = localStorage.getItem('schoolflow_transport_subscriptions_v2');
        const rawTransportPay = localStorage.getItem('schoolflow_transport_monthly_payments_v2');
        if (rawTransportSubs) {
          const customTransportMap: Record<string, { stop?: string; rate: number; discount?: number }> = JSON.parse(rawTransportSubs);
          const monthlyPayments: Record<string, Record<string, boolean>> = rawTransportPay ? JSON.parse(rawTransportPay) : {};

          Object.keys(customTransportMap).forEach((stuId) => {
            const stuExists = students.some((s) => s.id === stuId || s.studentNumber === stuId);
            if (stuExists) {
              const custom = customTransportMap[stuId];
              const rate = custom?.rate || 35000;
              const discount = custom?.discount || 0;
              const months = monthlyPayments[stuId] || {};
              const paidCount = Object.values(months).filter(Boolean).length;
              if (paidCount > 0) {
                const total = Math.max(0, paidCount * rate - discount);
                transportAmount += total;
                transportStudentsCount += 1;
              }
            }
          });
        }
      } catch (e) {}
    }

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

      // Vérifier aussi si des factures distinctes existent pour des versements additionnels
      studentInvs.forEach((inv) => {
        const motifLower = `${inv.feeType || ''} ${inv.notes || ''}`.toLowerCase();
        const amt = inv.paidAmount || 0;
        if (amt > 0) {
          if ((motifLower.includes('2') || motifLower.includes('deuxième') || motifLower.includes('deuxieme')) && motifLower.includes('versement')) {
            if (p2 === 0) p2 = amt;
          } else if ((motifLower.includes('3') || motifLower.includes('troisième') || motifLower.includes('troisieme')) && motifLower.includes('versement')) {
            if (p3 === 0) p3 = amt;
          } else if ((motifLower.includes('4') || motifLower.includes('quatrième') || motifLower.includes('quatrieme')) && motifLower.includes('versement')) {
            if (p4 === 0) p4 = amt;
          } else if ((motifLower.includes('5') || motifLower.includes('cinquième') || motifLower.includes('cinquieme')) && motifLower.includes('versement')) {
            if (p5 === 0) p5 = amt;
          }
        }
      });

      // Repli si aucun échéancier détaillé n'a été trouvé mais que l'élève a payé de la scolarité
      if (p1 === 0 && p2 === 0 && p3 === 0 && p4 === 0 && p5 === 0) {
        const paid = stu.paidAmount || 0;
        const regFee = stu.registrationFee || 0;
        const tuitionPaid = Math.max(0, paid - regFee);
        p1 = tuitionPaid;
      }

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
