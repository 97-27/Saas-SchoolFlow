'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatFCFA } from '@/lib/utils/formatters';
import { Invoice, Student, StudentInstallments } from '@/lib/data/types';
import { TrendingUp, PieChart, CheckCircle2, Calendar } from 'lucide-react';
import { DATA_UPDATED_EVENT, getDeletedStudentIds } from '@/lib/data/live-store';
import { resolveBoarders } from '@/lib/data/boarding';

interface RevenueSummaryProps {
  academicYear?: string;
  invoices?: Invoice[];
  students?: Student[];
  servicesData?: any;
  schoolSlug?: string;
}

export function RevenueSummary({
  academicYear = '2026-2027',
  invoices = [],
  students = [],
  servicesData,
  schoolSlug = 'epc-manoi',
}: RevenueSummaryProps) {
  const [serviceVersion, setServiceVersion] = useState(0);

  // École pilote : clés historiques non suffixées. Toute autre école : clé dédiée — ce
  // composant lisait auparavant des clés globales (dont une contenant littéralement
  // "epc-manoi" en dur), affichant potentiellement les chiffres d'internat/cantine/transport
  // d'une AUTRE école dans "Structure des encaissements". servicesData (déjà correctement
  // scopé par l'appelant via Supabase) est désormais toujours prioritaire sur ce cache local.
  const isPilotRevenue = !schoolSlug || schoolSlug === 'epc-manoi';
  const revBoardingSubKey = isPilotRevenue ? 'schoolflow_boarding_subscriptions_v3' : `schoolflow_boarding_subscriptions_v3_${schoolSlug}`;
  const revBoardingPayKey = isPilotRevenue ? 'schoolflow_boarding_monthly_payments_v3' : `schoolflow_boarding_monthly_payments_v3_${schoolSlug}`;
  const revCanteenSubKey = isPilotRevenue ? 'schoolflow_canteen_subscriptions_v3' : `schoolflow_canteen_subscriptions_v3_${schoolSlug}`;
  const revCanteenPayKey = isPilotRevenue ? 'schoolflow_canteen_monthly_payments_v3' : `schoolflow_canteen_monthly_payments_v3_${schoolSlug}`;
  const revTransportSubKey = isPilotRevenue ? 'schoolflow_transport_subscriptions_v2' : `schoolflow_transport_subscriptions_v2_${schoolSlug}`;
  const revTransportPayKey = isPilotRevenue ? 'schoolflow_transport_monthly_payments_v2' : `schoolflow_transport_monthly_payments_v2_${schoolSlug}`;

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

    // Calcul Internat : MÊME calcul que la page Internat et le Tableau de bord (lib/data/boarding.ts),
    // pour que le nombre de pensionnaires et les montants soient identiques partout.
    try {
      let boardingSubsList: any[] = Array.isArray(servicesData?.boardingSubscriptions) ? [...servicesData.boardingSubscriptions] : [];
      let monthlyPayments: Record<string, Record<string, boolean>> = servicesData?.boardingPayments ? { ...servicesData.boardingPayments } : {};
      let deletedIds = new Set<string>();
      if (typeof window !== 'undefined') {
        deletedIds = getDeletedStudentIds();
        const rawSubs = localStorage.getItem(revBoardingSubKey);
        const rawPay = localStorage.getItem(revBoardingPayKey);
        if (rawSubs) boardingSubsList = [...JSON.parse(rawSubs), ...boardingSubsList];
        if (rawPay) monthlyPayments = { ...monthlyPayments, ...JSON.parse(rawPay) };
      }
      const resolved = resolveBoarders(
        students,
        boardingSubsList.filter((b) => b && !deletedIds.has(b.studentId) && !(b.matricule && deletedIds.has(b.matricule))),
        monthlyPayments,
        invoices
      );
      boardingStudentsCount = resolved.length;
      boardingAmount = resolved.reduce((acc, b) => acc + b.totalPaid, 0);
    } catch (e) {}

    // Calcul Cantine
    try {
      const rawCanteenSubs =
        (servicesData?.canteenSubscriptions ? JSON.stringify(servicesData.canteenSubscriptions) : null) ||
        (typeof window !== 'undefined' ? localStorage.getItem(revCanteenSubKey) : null);
      const rawCanteenPay =
        (servicesData?.canteenPayments ? JSON.stringify(servicesData.canteenPayments) : null) ||
        (typeof window !== 'undefined' ? localStorage.getItem(revCanteenPayKey) : null);

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
        (servicesData?.transportSubscriptions ? JSON.stringify(servicesData.transportSubscriptions) : null) ||
        (typeof window !== 'undefined' ? localStorage.getItem(revTransportSubKey) : null);
      const rawTransportPay =
        (servicesData?.transportPayments ? JSON.stringify(servicesData.transportPayments) : null) ||
        (typeof window !== 'undefined' ? localStorage.getItem(revTransportPayKey) : null);

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
  }, [students, invoices, serviceVersion, servicesData, schoolSlug]);

  // Sommes de scolarité réellement encaissées CHAQUE MOIS (septembre à décembre), d'après la date
  // de paiement de chaque versement. Auparavant, le 1er versement était toujours classé en octobre,
  // le 2e en novembre, etc., quelle que soit sa vraie date : les montants affichés ne
  // correspondaient pas aux sommes réellement entrées dans le mois.
  const monthlyData = useMemo(() => {
    const isEmpty = students.length === 0 && invoices.length === 0;
    const startYear = parseInt((academicYear || '').slice(0, 4), 10) || new Date().getFullYear();
    const MONTHS = [
      { month: 9, name: 'Septembre' },
      { month: 10, name: 'Octobre' },
      { month: 11, name: 'Novembre' },
      { month: 12, name: 'Décembre' },
    ];
    const totals = new Map<number, number>();
    let otherMonths = 0;
    let undated = 0;

    // Dates au format JJ/MM/AAAA ou AAAA-MM-JJ
    const parseMonth = (raw?: string): { month: number; year: number } | null => {
      const s = (raw || '').trim();
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return { year: Number(m[1]), month: Number(m[2]) };
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) return { year: Number(m[3]), month: Number(m[2]) };
      return null;
    };

    const addPayment = (amount: number | undefined, date?: string, fallbackDate?: string) => {
      if (!amount || amount <= 0) return;
      const d = parseMonth(date) || parseMonth(fallbackDate);
      if (!d) {
        undated += amount;
      } else if (d.year === startYear && d.month >= 9 && d.month <= 12) {
        totals.set(d.month, (totals.get(d.month) || 0) + amount);
      } else {
        otherMonths += amount;
      }
    };

    const hasInstallments = (inst?: StudentInstallments) =>
      Boolean(inst && (inst.versement1 || inst.versement2 || inst.versement3 || inst.versement4 || inst.versement5));

    const addInstallments = (inst: StudentInstallments, fallbackDate?: string) => {
      [inst.versement1, inst.versement2, inst.versement3, inst.versement4, inst.versement5].forEach((v) => {
        if (v) addPayment(v.amount, v.date, fallbackDate);
      });
    };

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
      if (!hasInstallments(inst)) {
        inst = studentInvs.find((inv) => hasInstallments(inv.installments))?.installments;
      }

      const fallbackDate = stu.paymentDate || stu.enrollmentDate;
      if (inst && hasInstallments(inst)) {
        addInstallments(inst, fallbackDate);
      } else if (stu.paidAmount && stu.paidAmount > 0) {
        // Aucun détail par versement saisi, mais un montant a bel et bien été encaissé : il est
        // classé au mois de sa date de paiement (jamais inventé, jamais perdu).
        addPayment(stu.paidAmount, stu.paymentDate, stu.enrollmentDate);
      }
    });

    // Prise en compte d'éventuelles factures d'échéances sans objet élève direct
    invoices.forEach((inv) => {
      const sId = inv.studentId || inv.invoiceNumber;
      if (sId && processedStudentIds.has(sId)) return; // Déjà traité ci-dessus
      if (inv.installments && hasInstallments(inv.installments)) addInstallments(inv.installments, inv.issueDate);
    });

    const getBadgeStyle = (amount: number) => {
      return amount > 0
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';
    };

    const rows = MONTHS.map(({ month, name }) => {
      const collected = isEmpty ? 0 : totals.get(month) || 0;
      return {
        month: `${name} ${startYear}`,
        label: `Sommes encaissées en ${name.toLowerCase()}`,
        collected,
        badgeColor: getBadgeStyle(collected),
      };
    });

    // Rien n'est caché : les versements datés hors de ces 4 mois, ou sans date, sont affichés à part.
    if (!isEmpty && otherMonths > 0) {
      rows.push({ month: 'Autres mois', label: 'Versements datés hors septembre – décembre', collected: otherMonths, badgeColor: getBadgeStyle(otherMonths) });
    }
    if (!isEmpty && undated > 0) {
      rows.push({ month: 'Date non renseignée', label: 'Versements enregistrés sans date de paiement', collected: undated, badgeColor: getBadgeStyle(undated) });
    }
    return rows;
  }, [students, invoices, academicYear]);

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
                  Sommes de scolarité réellement encaissées chaque mois
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              Année {academicYear}
            </span>
          </div>

          {/* Encaissements par mois (septembre à décembre) */}
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

        {/* Total cumulé des encaissements */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Cumul des encaissements :</span>
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
