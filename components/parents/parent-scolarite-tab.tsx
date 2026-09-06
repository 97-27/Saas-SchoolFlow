'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student, School } from '@/lib/data/types';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Receipt,
  UtensilsCrossed,
  Bus,
  BedDouble,
  Printer,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Building2,
  User,
  Calendar,
  Sparkles,
  Info,
  Phone,
  FileText,
} from 'lucide-react';

interface ParentScolariteTabProps {
  schoolSlug?: string;
  currentSchool: School;
  activeChild: Student;
  allFamilyChildren: Student[];
  onSelectChild: (childId: string) => void;
  activeFamily?: any;
}

const MONTHS_ORDER_10 = [
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
];

const MONTHS_ORDER_9 = [
  'Octobre',
  'Novembre',
  'Décembre',
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
];

export function ParentScolariteTab({
  schoolSlug = 'epc-manoi',
  currentSchool,
  activeChild,
  allFamilyChildren,
  onSelectChild,
  activeFamily,
}: ParentScolariteTabProps) {
  const [canteenSubs, setCanteenSubs] = useState<Record<string, any>>({});
  const [canteenPayments, setCanteenPayments] = useState<Record<string, Record<string, boolean>>>({});

  const [transportSubs, setTransportSubs] = useState<Record<string, any>>({});
  const [transportPayments, setTransportPayments] = useState<Record<string, Record<string, boolean>>>({});

  const [boardingSubs, setBoardingSubs] = useState<any[]>([]);
  const [boardingPayments, setBoardingPayments] = useState<Record<string, Record<string, boolean>>>({});

  // Charger les données de prestations en temps réel depuis le localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // 1. Cantine
      const rawCanteenSubs = localStorage.getItem('schoolflow_canteen_subscriptions_v3');
      if (rawCanteenSubs) setCanteenSubs(JSON.parse(rawCanteenSubs));

      const rawCanteenPay = localStorage.getItem('schoolflow_canteen_monthly_payments_v3');
      if (rawCanteenPay) setCanteenPayments(JSON.parse(rawCanteenPay));

      // 2. Transport
      const rawTransportSubs = localStorage.getItem('schoolflow_transport_subscriptions_v2');
      if (rawTransportSubs) setTransportSubs(JSON.parse(rawTransportSubs));

      const rawTransportPay = localStorage.getItem('schoolflow_transport_monthly_payments_v2');
      if (rawTransportPay) setTransportPayments(JSON.parse(rawTransportPay));

      // 3. Internat
      const rawBoardingSubs = localStorage.getItem('schoolflow_boarding_subscriptions_v3');
      if (rawBoardingSubs) setBoardingSubs(JSON.parse(rawBoardingSubs));

      const rawBoardingPay = localStorage.getItem('schoolflow_boarding_monthly_payments_v3');
      if (rawBoardingPay) setBoardingPayments(JSON.parse(rawBoardingPay));
    } catch (e) {
      console.error('Erreur lecture données scolarité/prestations:', e);
    }
  }, [schoolSlug, activeChild?.id]);

  // Données financières de la scolarité annuelle de l'enfant actif
  const tuitionStats = useMemo(() => {
    if (!activeChild) {
      return {
        initialTuition: 0,
        discount: 0,
        netTuition: 0,
        paid: 0,
        remaining: 0,
        progressPercent: 0,
        isFullyPaid: false,
        registrationFee: 0,
        installmentsList: [],
      };
    }

    const initialTuition = activeChild.tuitionAmount || 0;
    const discount = activeChild.discountAmount || 0;
    const netTuition =
      activeChild.netAmount !== undefined ? activeChild.netAmount : Math.max(0, initialTuition - discount);
    const paid = activeChild.paidAmount || 0;
    const remaining =
      activeChild.balanceRemaining !== undefined
        ? activeChild.balanceRemaining
        : Math.max(0, netTuition - paid);
    const progressPercent = netTuition > 0 ? Math.min(100, Math.round((paid / netTuition) * 100)) : 100;
    const isFullyPaid = remaining <= 0;
    const registrationFee = activeChild.registrationFee || 0;

    // Décomposer les versements 1 à 5
    const installments = activeChild.installments || {};
    const instList = [
      { key: 'versement1', label: '1er Versement', rec: installments.versement1, defaultAmount: netTuition * 0.4 },
      { key: 'versement2', label: '2ème Versement', rec: installments.versement2, defaultAmount: netTuition * 0.2 },
      { key: 'versement3', label: '3ème Versement', rec: installments.versement3, defaultAmount: netTuition * 0.2 },
      { key: 'versement4', label: '4ème Versement', rec: installments.versement4, defaultAmount: netTuition * 0.1 },
      { key: 'versement5', label: '5ème Versement (Solde)', rec: installments.versement5, defaultAmount: netTuition * 0.1 },
    ].map((inst) => {
      const isPaid = Boolean(inst.rec && inst.rec.amount && inst.rec.amount > 0);
      return {
        key: inst.key,
        label: inst.label,
        amount: isPaid ? inst.rec!.amount : inst.defaultAmount,
        isPaid,
        method: inst.rec?.paymentMethod || inst.rec?.method || 'Espèces',
        date: inst.rec?.date || activeChild.paymentDate || '—',
        receiptNumber: inst.rec?.receiptNumber || `REC-${activeChild.studentNumber || activeChild.id.slice(-4)}`,
      };
    });

    return {
      initialTuition,
      discount,
      netTuition,
      paid,
      remaining,
      progressPercent,
      isFullyPaid,
      registrationFee,
      installmentsList: instList,
    };
  }, [activeChild]);

  // Données Cantine
  const canteenData = useMemo(() => {
    if (!activeChild) return null;
    const childId = activeChild.id;
    const custom = canteenSubs[childId];
    const isSubscribed = Boolean(activeChild.isCanteen || custom);

    if (!isSubscribed) {
      return { isSubscribed: false };
    }

    const monthlyRate = custom?.rate || 25000;
    const discount = custom?.discount || 0;
    const diet = custom?.diet || 'Standard (Sans allergie)';
    const monthsState = canteenPayments[childId] || {};

    const paidMonths = MONTHS_ORDER_10.filter((m) => monthsState[m]);
    const paidMonthsCount = paidMonths.length;
    const grossTotal = paidMonthsCount * monthlyRate;
    const totalPaid = Math.max(0, grossTotal - discount);
    const totalDue = Math.max(0, monthlyRate * 10 - discount);
    const remaining = Math.max(0, totalDue - totalPaid);

    return {
      isSubscribed: true,
      monthlyRate,
      discount,
      diet,
      paidMonths,
      paidMonthsCount,
      totalPaid,
      totalDue,
      remaining,
      isFullyPaid: remaining === 0,
      monthsState,
    };
  }, [activeChild, canteenSubs, canteenPayments]);

  // Données Transport
  const transportData = useMemo(() => {
    if (!activeChild) return null;
    const childId = activeChild.id;
    const custom = transportSubs[childId];
    const isSubscribed = Boolean(activeChild.isTransport || custom);

    if (!isSubscribed) {
      return { isSubscribed: false };
    }

    const monthlyRate = custom?.rate || 35000;
    const discount = custom?.discount || 0;
    const stop = custom?.stop || 'Arrêt Principal (Circuit Établissement)';
    const monthsState = transportPayments[childId] || {};

    const paidMonths = MONTHS_ORDER_10.filter((m) => monthsState[m]);
    const paidMonthsCount = paidMonths.length;
    const grossTotal = paidMonthsCount * monthlyRate;
    const totalPaid = Math.max(0, grossTotal - discount);
    const totalDue = Math.max(0, monthlyRate * 10 - discount);
    const remaining = Math.max(0, totalDue - totalPaid);

    return {
      isSubscribed: true,
      monthlyRate,
      discount,
      stop,
      paidMonths,
      paidMonthsCount,
      totalPaid,
      totalDue,
      remaining,
      isFullyPaid: remaining === 0,
      monthsState,
    };
  }, [activeChild, transportSubs, transportPayments]);

  // Données Internat
  const boardingData = useMemo(() => {
    if (!activeChild) return null;
    const childId = activeChild.id;
    const customSub = boardingSubs.find(
      (b) => b.studentId === childId || b.matricule === activeChild.matricule
    );
    const isSubscribed = Boolean(activeChild.isBoarding || customSub);

    if (!isSubscribed) {
      return { isSubscribed: false };
    }

    const monthlyRate = customSub?.monthlyRate || 75000;
    const pavilion =
      customSub?.pavilion ||
      (activeChild.gender === 'female'
        ? 'Pavillon Marie Curie (Filles)'
        : 'Pavillon Nelson Mandela (Garçons)');
    const roomNumber = customSub?.roomNumber || 'Ch. B-12';
    const monthsState = boardingPayments[childId] || {};

    const paidMonths = MONTHS_ORDER_9.filter((m) => monthsState[m]);
    const paidMonthsCount = paidMonths.length;
    const totalPaid = paidMonthsCount * monthlyRate;
    const totalDue = monthlyRate * 9;
    const remaining = Math.max(0, totalDue - totalPaid);

    return {
      isSubscribed: true,
      monthlyRate,
      pavilion,
      roomNumber,
      paidMonths,
      paidMonthsCount,
      totalPaid,
      totalDue,
      remaining,
      isFullyPaid: remaining === 0,
      monthsState,
    };
  }, [activeChild, boardingSubs, boardingPayments]);

  // Synthèse globale consolidée (Scolarité + Cantine + Transport + Internat)
  const consolidated = useMemo(() => {
    let totalAnnual = tuitionStats.netTuition;
    let totalPaid = tuitionStats.paid;
    let totalRemaining = tuitionStats.remaining;

    if (canteenData?.isSubscribed) {
      totalAnnual += canteenData.totalDue;
      totalPaid += canteenData.totalPaid;
      totalRemaining += canteenData.remaining;
    }

    if (transportData?.isSubscribed) {
      totalAnnual += transportData.totalDue;
      totalPaid += transportData.totalPaid;
      totalRemaining += transportData.remaining;
    }

    if (boardingData?.isSubscribed) {
      totalAnnual += boardingData.totalDue;
      totalPaid += boardingData.totalPaid;
      totalRemaining += boardingData.remaining;
    }

    const progress = totalAnnual > 0 ? Math.min(100, Math.round((totalPaid / totalAnnual) * 100)) : 100;

    return {
      totalAnnual,
      totalPaid,
      totalRemaining,
      progress,
      isFullySettled: totalRemaining <= 0,
    };
  }, [tuitionStats, canteenData, transportData, boardingData]);

  const handlePrintFinancialStatement = () => {
    window.print();
  };

  if (!activeChild) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Aucun élève sélectionné</h3>
        <p className="text-sm text-slate-500 mt-1">
          Veuillez sélectionner un élève rattaché à votre compte famille.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 1. SÉLECTEUR MULTI-ENFANTS (POUR LES FAMILLES AYANT PLUSIEURS ENFANTS) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {allFamilyChildren.length > 1 && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Enfants rattachés à votre dossier ({allFamilyChildren.length}) :
            </span>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {allFamilyChildren.map((child) => {
              const isSelected = child.id === activeChild.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onSelectChild(child.id)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>
                    {child.firstName} {child.lastName}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      isSelected ? 'bg-emerald-800 text-emerald-200' : 'bg-white text-slate-600'
                    }`}
                  >
                    {child.grade}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 2. BANDEAU SUPÉRIEUR CONSOLIDÉ : TOTAL GÉNÉRAL & PROGRESSION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 text-white shadow-xl relative overflow-hidden">
        {/* Éléments décoratifs en arrière-plan */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                💳 Relevé de Scolarité & Prestations
              </span>
              <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-white/10 text-slate-200 font-bold border border-white/10">
                Matricule : {activeChild.matricule}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 font-bold">
                Classe : {activeChild.grade}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-white">
              {activeChild.lastName} {activeChild.firstName}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-200/90 mt-1">
              Tuteur légal enregistré : <span className="font-bold text-white">{activeChild.guardianName}</span>
              {activeChild.guardianPhone ? ` • Contact : ${activeChild.guardianPhone}` : ''}
            </p>
          </div>

          {/* Bouton d'impression du relevé */}
          <div className="shrink-0 flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrintFinancialStatement}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-white/20 shadow-xs"
            >
              <Printer className="w-4 h-4 text-emerald-300" />
              <span>Imprimer le Relevé</span>
            </button>
          </div>
        </div>

        {/* 3 Cartes Métriques Clés : Frais de Scolarité Annuels Officiels de l'Élève */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/15">
          {/* Montant Scolarité Annuelle Exigible */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-emerald-300/80 uppercase tracking-wide block">
              1. Frais Annuels de Scolarité
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-white mt-1 block">
              {formatFCFA(tuitionStats.netTuition)}
            </span>
            <span className="text-[11px] text-slate-300 mt-1 block">
              Montant officiel scolarité (base de données école)
            </span>
          </div>

          {/* Scolarité Déjà Versée */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide">
                2. Scolarité Déjà Versée
              </span>
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                {tuitionStats.progressPercent}% réglé
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-300 mt-1 block">
              {formatFCFA(tuitionStats.paid)}
            </span>
            <span className="text-[11px] text-emerald-200/80 mt-1 block">
              Versements certifiés sur le reçu de l&apos;élève
            </span>
          </div>

          {/* Reste à Payer Scolarité */}
          <div
            className={`p-4 rounded-2xl border backdrop-blur-xs ${
              tuitionStats.isFullyPaid
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-amber-500/10 border-amber-400/30 text-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-white">
                3. Reste à Payer Scolarité
              </span>
              {tuitionStats.isFullyPaid ? (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Soldé à 100%
                </span>
              ) : (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  En cours
                </span>
              )}
            </div>
            <span
              className={`text-xl sm:text-2xl font-black font-mono mt-1 block ${
                tuitionStats.isFullyPaid ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {formatFCFA(tuitionStats.remaining)}
            </span>
            <span className="text-[11px] text-slate-300 mt-1 block">
              {tuitionStats.isFullyPaid
                ? 'Scolarité annuelle entièrement soldée'
                : 'Reste exact figurant sur le dossier de l’élève'}
            </span>
          </div>
        </div>

        {/* Barre de Progression Visuelle Scolarité */}
        <div className="mt-5">
          <div className="w-full bg-white/15 h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${tuitionStats.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 3. SECTION SCOLARITÉ PRINCIPALE (DROITS D'INSCRIPTION & ÉCHÉANCES) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 shadow-xs">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 font-heading">
                Scolarité Annuelle & Inscription
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Suivi des 5 versements périodiques et historique des paiements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                tuitionStats.isFullyPaid
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {tuitionStats.isFullyPaid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Scolarité Soldée</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Reste : {formatFCFA(tuitionStats.remaining)}</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* 4 Cartes Scolarité */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
              Frais Annuels Nets
            </span>
            <span className="text-lg sm:text-xl font-black font-mono text-slate-900 mt-1 block">
              {formatFCFA(tuitionStats.netTuition)}
            </span>
            {tuitionStats.discount > 0 && (
              <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
                Réduction : -{formatFCFA(tuitionStats.discount)}
              </span>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide block">
              Somme Déjà Versée
            </span>
            <span className="text-lg sm:text-xl font-black font-mono text-emerald-900 mt-1 block">
              {formatFCFA(tuitionStats.paid)}
            </span>
            <span className="text-[10px] text-emerald-700 font-bold mt-1 block">
              {tuitionStats.progressPercent}% acquitté
            </span>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              tuitionStats.isFullyPaid
                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50/60 border-amber-200/80 text-amber-900'
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wide block text-slate-600">
              Reste à Payer
            </span>
            <span className="text-lg sm:text-xl font-black font-mono mt-1 block">
              {formatFCFA(tuitionStats.remaining)}
            </span>
            <span className="text-[10px] font-bold mt-1 block">
              {tuitionStats.isFullyPaid ? '✓ Aucun arriéré' : 'À régulariser'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
              Droits d'Inscription
            </span>
            <span className="text-lg sm:text-xl font-black font-mono text-slate-900 mt-1 block">
              {tuitionStats.registrationFee > 0 ? formatFCFA(tuitionStats.registrationFee) : 'Inclus'}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold mt-1 block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Réglé à l'inscription
            </span>
          </div>
        </div>

        {/* Échéancier détaillé des 5 versements */}
        <div className="mt-6">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Détail de l'échéancier des versements (5 tranches) :</span>
          </h4>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">Échéance</th>
                  <th className="py-3 px-4">Montant Tranche</th>
                  <th className="py-3 px-4">Mode de Paiement</th>
                  <th className="py-3 px-4">Date de Règlement</th>
                  <th className="py-3 px-4">Réf. Reçu</th>
                  <th className="py-3 px-4 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tuitionStats.installmentsList.map((item, idx) => (
                  <tr
                    key={item.key}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      item.isPaid ? 'bg-white' : 'bg-slate-50/30'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span>{item.label}</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {formatFCFA(item.amount)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {item.isPaid ? item.method : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {item.isPaid ? item.date : 'Échéance à venir'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {item.isPaid ? item.receiptNumber : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Encaissé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-400" />
                          En attente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 4. SECTION PRESTATIONS SOUSCRITES (CANTINE, TRANSPORT, INTERNAT) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base sm:text-lg font-black text-slate-900 font-heading">
              Prestations Scolaires & Services Annexes
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Suivi des abonnements optionnels souscrits pour l’élève
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 🍽️ CARTE 1 : CANTINE SCOLAIRE */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                    <UtensilsCrossed className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">Cantine Scolaire</h4>
                    <p className="text-[11px] text-slate-500">Restauration midi</p>
                  </div>
                </div>

                {canteenData?.isSubscribed ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Souscrit
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                    Non souscrit
                  </span>
                )}
              </div>

              {canteenData?.isSubscribed ? (
                <div className="space-y-3.5 mt-4">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Régime Alimentaire :</span>
                      <span className="font-bold text-slate-900 truncate max-w-[150px]">
                        {canteenData.diet}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 mt-1.5 pt-1.5 border-t border-slate-200/60">
                      <span>Tarif Mensuel :</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatFCFA(canteenData.monthlyRate)} / mois
                      </span>
                    </div>
                  </div>

                  {/* Sommes Cantine */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                        Somme Avancée
                      </span>
                      <span className="font-mono font-black text-emerald-900 text-sm mt-0.5 block">
                        {formatFCFA(canteenData.totalPaid)}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold">
                        {canteenData.paidMonthsCount} / 10 mois réglés
                      </span>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border ${
                        canteenData.remaining <= 0
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                          : 'bg-amber-50 border-amber-100 text-amber-900'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase block text-slate-600">
                        Reste à Payer
                      </span>
                      <span className="font-mono font-black text-sm mt-0.5 block">
                        {formatFCFA(canteenData.remaining)}
                      </span>
                      <span className="text-[10px] font-bold">
                        {canteenData.remaining <= 0 ? '✓ Soldé' : `${10 - canteenData.paidMonthsCount} mois restants`}
                      </span>
                    </div>
                  </div>

                  {/* Pastilles des 10 mois */}
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                      Statut mensuel (Septembre à Juin) :
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {MONTHS_ORDER_10.map((m) => {
                        const isMthPaid = Boolean(canteenData.monthsState[m]);
                        return (
                          <span
                            key={m}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              isMthPaid
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-400 border border-slate-200/60'
                            }`}
                            title={`${m}: ${isMthPaid ? 'Payé' : 'En attente'}`}
                          >
                            {m.slice(0, 3)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center mt-4 space-y-2">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Votre enfant n’est actuellement pas souscrit au service de restauration scolaire.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Pour inscrire votre enfant à la cantine, contactez le Secrétariat de l'école.
                  </p>
                </div>
              )}
            </div>

            {canteenData?.isSubscribed && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Total Annuel Exigible :</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatFCFA(canteenData.totalDue)}
                </span>
              </div>
            )}
          </div>

          {/* 🚌 CARTE 2 : TRANSPORT SCOLAIRE */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                    <Bus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">Transport Scolaire</h4>
                    <p className="text-[11px] text-slate-500">Ramassage sécurisé</p>
                  </div>
                </div>

                {transportData?.isSubscribed ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Souscrit
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                    Non souscrit
                  </span>
                )}
              </div>

              {transportData?.isSubscribed ? (
                <div className="space-y-3.5 mt-4">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Circuit / Arrêt :</span>
                      <span className="font-bold text-slate-900 truncate max-w-[150px]" title={transportData.stop}>
                        {transportData.stop}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 mt-1.5 pt-1.5 border-t border-slate-200/60">
                      <span>Tarif Mensuel :</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatFCFA(transportData.monthlyRate)} / mois
                      </span>
                    </div>
                  </div>

                  {/* Sommes Transport */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                        Somme Avancée
                      </span>
                      <span className="font-mono font-black text-emerald-900 text-sm mt-0.5 block">
                        {formatFCFA(transportData.totalPaid)}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold">
                        {transportData.paidMonthsCount} / 10 mois réglés
                      </span>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border ${
                        transportData.remaining <= 0
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                          : 'bg-amber-50 border-amber-100 text-amber-900'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase block text-slate-600">
                        Reste à Payer
                      </span>
                      <span className="font-mono font-black text-sm mt-0.5 block">
                        {formatFCFA(transportData.remaining)}
                      </span>
                      <span className="text-[10px] font-bold">
                        {transportData.remaining <= 0
                          ? '✓ Soldé'
                          : `${10 - transportData.paidMonthsCount} mois restants`}
                      </span>
                    </div>
                  </div>

                  {/* Pastilles des 10 mois */}
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                      Statut mensuel (Septembre à Juin) :
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {MONTHS_ORDER_10.map((m) => {
                        const isMthPaid = Boolean(transportData.monthsState[m]);
                        return (
                          <span
                            key={m}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              isMthPaid
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-400 border border-slate-200/60'
                            }`}
                            title={`${m}: ${isMthPaid ? 'Payé' : 'En attente'}`}
                          >
                            {m.slice(0, 3)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center mt-4 space-y-2">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Votre enfant n’est actuellement pas souscrit au circuit de bus scolaire.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Pour enregistrer votre arrêt de ramassage, contactez la Direction des Transports.
                  </p>
                </div>
              )}
            </div>

            {transportData?.isSubscribed && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Total Annuel Exigible :</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatFCFA(transportData.totalDue)}
                </span>
              </div>
            )}
          </div>

          {/* 🛏️ CARTE 3 : INTERNAT & PENSIONNAT */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                    <BedDouble className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">Internat / Pensionnat</h4>
                    <p className="text-[11px] text-slate-500">Hébergement & études</p>
                  </div>
                </div>

                {boardingData?.isSubscribed ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Souscrit
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                    Non souscrit
                  </span>
                )}
              </div>

              {boardingData?.isSubscribed ? (
                <div className="space-y-3.5 mt-4">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Pavillon / Chambre :</span>
                      <span className="font-bold text-slate-900 truncate max-w-[150px]">
                        {boardingData.roomNumber} ({boardingData.pavilion.split(' ')[0]})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 mt-1.5 pt-1.5 border-t border-slate-200/60">
                      <span>Tarif Mensuel :</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatFCFA(boardingData.monthlyRate)} / mois
                      </span>
                    </div>
                  </div>

                  {/* Sommes Internat */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                        Somme Avancée
                      </span>
                      <span className="font-mono font-black text-emerald-900 text-sm mt-0.5 block">
                        {formatFCFA(boardingData.totalPaid)}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold">
                        {boardingData.paidMonthsCount} / 9 mois réglés
                      </span>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border ${
                        boardingData.remaining <= 0
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                          : 'bg-amber-50 border-amber-100 text-amber-900'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase block text-slate-600">
                        Reste à Payer
                      </span>
                      <span className="font-mono font-black text-sm mt-0.5 block">
                        {formatFCFA(boardingData.remaining)}
                      </span>
                      <span className="text-[10px] font-bold">
                        {boardingData.remaining <= 0
                          ? '✓ Soldé'
                          : `${9 - boardingData.paidMonthsCount} mois restants`}
                      </span>
                    </div>
                  </div>

                  {/* Pastilles des 9 mois stricts */}
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                      Statut mensuel (Octobre à Juin - 9 mois) :
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {MONTHS_ORDER_9.map((m) => {
                        const isMthPaid = Boolean(boardingData.monthsState[m]);
                        return (
                          <span
                            key={m}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              isMthPaid
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-400 border border-slate-200/60'
                            }`}
                            title={`${m}: ${isMthPaid ? 'Payé' : 'En attente'}`}
                          >
                            {m.slice(0, 3)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center mt-4 space-y-2">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Votre enfant est en régime externe / demi-pensionnaire et n'occupe pas de chambre d'internat.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Pour toute demande d’admission en pensionnat, rapprochez-vous de la Direction.
                  </p>
                </div>
              )}
            </div>

            {boardingData?.isSubscribed && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Total Annuel Exigible :</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatFCFA(boardingData.totalDue)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 5. AVIS DE SÉCURITÉ ET ATTESTATION OFFICIELLE */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900 block">
              Données financières certifiées en temps réel
            </span>
            <span className="text-[11px] text-slate-500">
              Ce relevé reflète les encaissements enregistrés à la caisse de l'établissement ({currentSchool.name}). Tout paiement effectué par Wave, Orange Money ou virement bancaire est automatiquement synchronisé.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrintFinancialStatement}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-600" />
          <span>Télécharger le Reçu Officiel</span>
        </button>
      </div>
    </div>
  );
}
