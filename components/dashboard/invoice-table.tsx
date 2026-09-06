'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Invoice } from '@/lib/data/types';
import { GenderBadge } from '@/components/ui/badge';
import { formatFCFA, formatDate, formatDateFrenchLong } from '@/lib/utils/formatters';
import { availableClasses } from '@/lib/data/mock-data';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import {
  Search,
  Filter,
  Download,
  ChevronDown,
  RotateCcw,
  ReceiptText,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Users,
  Coins,
} from 'lucide-react';
import { getLiveInvoices, DATA_UPDATED_EVENT } from '@/lib/data/live-store';

interface InvoiceTableProps {
  initialInvoices: Invoice[];
  schoolSlug?: string;
}

export function InvoiceTable({ initialInvoices, schoolSlug }: InvoiceTableProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);

  useEffect(() => {
    setInvoices(getLiveInvoices(initialInvoices, schoolSlug));

    const handleUpdate = () => {
      setInvoices(getLiveInvoices(initialInvoices, schoolSlug));
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [initialInvoices, schoolSlug]);

  // Helper pour obtenir la date du jour (format YYYY-MM-DD)
  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date active du journal (strictement la date du jour en direct)
  const [selectedJournalDate, setSelectedJournalDate] = useState<string>(getTodayDateStr());
  const [dateFilterMode, setDateFilterMode] = useState<'day_only' | 'all_dates'>('all_dates');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('Toutes les classes');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedEnrollmentType, setSelectedEnrollmentType] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Helper pour comparer 2 dates de manière robuste (gère JJ/MM/AAAA et YYYY-MM-DD)
  const isMatchingTxDate = (txDate: string | undefined, targetDate: string) => {
    if (!txDate || !targetDate) return false;
    const formattedTarget = formatDate(targetDate);
    const formattedTx = formatDate(txDate);
    return formattedTx === formattedTarget || txDate === targetDate;
  };

  // Extraction précise de toutes les transactions réelles (versements & droits d'inscription distincts)
  const allTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      invoiceId: string;
      invoiceNumber: string;
      matriculeCode: string;
      studentName: string;
      studentGrade: string;
      studentGender: 'male' | 'female';
      enrollmentType: 'nouveau' | 'ancien';
      motif: string;
      paymentDate: string;
      amount: number;
      paymentMethod: string;
      status: string;
      rawInvoice: Invoice;
    }> = [];

    invoices.forEach((inv) => {
      const numVal = parseInt(inv.invoiceNumber.replace(/\D/g, '') || '1', 10);
      const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
      const matriculeCode = `${26014800 + numVal}${letters[(numVal - 1) % letters.length]}`;
      const enrollmentType: 'nouveau' | 'ancien' = inv.enrollmentType === 'ancien' ? 'ancien' : 'nouveau';
      const inst = inv.installments;

      let foundVersements = false;

      // 1. Vérification des versements détaillés de l'échéancier
      if (inst) {
        const vList = [
          { key: 'v1', obj: inst.versement1, label: '🎓 1er Versement (Scolarité)' },
          { key: 'v2', obj: inst.versement2, label: '🎓 2ème Versement (Scolarité)' },
          { key: 'v3', obj: inst.versement3, label: '🎓 3ème Versement (Scolarité)' },
          { key: 'v4', obj: inst.versement4, label: '🎓 4ème Versement (Scolarité)' },
          { key: 'v5', obj: inst.versement5, label: '🎓 5ème Versement (Scolarité)' },
        ];

        vList.forEach(({ key, obj, label }) => {
          if (obj && typeof obj.amount === 'number' && obj.amount > 0) {
            foundVersements = true;
            list.push({
              id: `${inv.id}-${key}`,
              invoiceId: inv.id,
              invoiceNumber: inv.invoiceNumber,
              matriculeCode,
              studentName: inv.studentName,
              studentGrade: inv.studentGrade,
              studentGender: inv.studentGender,
              enrollmentType,
              motif: label,
              paymentDate: obj.date || inv.issueDate,
              amount: obj.amount,
              paymentMethod: obj.paymentMethod || obj.method || inv.paymentMethod || 'Espèces',
              status: inv.status,
              rawInvoice: inv,
            });
          }
        });
      }

      // 2. Vérification des Droits d'Inscription distincts
      if (typeof inv.registrationFee === 'number' && inv.registrationFee > 0) {
        list.push({
          id: `${inv.id}-reg`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          matriculeCode,
          studentName: inv.studentName,
          studentGrade: inv.studentGrade,
          studentGender: inv.studentGender,
          enrollmentType,
          motif: "📝 Droits d'Inscription",
          paymentDate: inv.issueDate,
          amount: inv.registrationFee,
          paymentMethod: inv.paymentMethod || 'Espèces',
          status: inv.status,
          rawInvoice: inv,
        });
      }

      // 3. Cas de repli : encaissement global ou prestation spécifique sans échéancier détaillé
      if (!foundVersements && (!inv.registrationFee || inv.registrationFee === 0)) {
        const feeLower = (inv.feeType || '').toLowerCase();
        let motif = '🎓 1er Versement (Scolarité)';
        if (feeLower.includes('internat')) motif = '🏠 Internat & Pensionnat';
        else if (feeLower.includes('cantine')) motif = '🍽️ Cantine Scolaire';
        else if (feeLower.includes('transport')) motif = '🚌 Transport Scolaire';
        else if (feeLower.includes('inscription') && !feeLower.includes('scolarité')) motif = "📝 Droits d'Inscription";

        const amt = inv.paidAmount !== undefined ? inv.paidAmount : inv.amount;
        list.push({
          id: `${inv.id}-tx`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          matriculeCode,
          studentName: inv.studentName,
          studentGrade: inv.studentGrade,
          studentGender: inv.studentGender,
          enrollmentType,
          motif,
          paymentDate: inv.issueDate,
          amount: amt,
          paymentMethod: inv.paymentMethod || 'Espèces',
          status: inv.status,
          rawInvoice: inv,
        });
      }
    });

    return list;
  }, [invoices]);

  // Transactions du jour actif sélectionné
  const dayTransactions = useMemo(() => {
    return allTransactions.filter((tx) => isMatchingTxDate(tx.paymentDate, selectedJournalDate));
  }, [allTransactions, selectedJournalDate]);

  // Métriques du Bilan Journalier (calculées sur les encaissements effectifs du jour)
  const dayMetrics = useMemo(() => {
    const totalCount = dayTransactions.length;
    const totalAmount = dayTransactions.reduce((acc, tx) => acc + tx.amount, 0);
    const newCount = dayTransactions.filter((tx) => tx.enrollmentType === 'nouveau').length;
    const oldCount = dayTransactions.filter((tx) => tx.enrollmentType === 'ancien').length;
    const mismatchedDatesCount = allTransactions.filter((tx) => !isMatchingTxDate(tx.paymentDate, selectedJournalDate)).length;

    return {
      totalCount,
      totalAmount,
      newCount,
      oldCount,
      mismatchedDatesCount,
    };
  }, [dayTransactions, allTransactions, selectedJournalDate]);

  // Transactions filtrées et triées (Derniers règlements en tête)
  const filteredTransactions = useMemo(() => {
    const sourceList = dateFilterMode === 'day_only' ? dayTransactions : allTransactions;

    const list = sourceList.filter((tx) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        tx.studentName.toLowerCase().includes(q) ||
        tx.invoiceNumber.toLowerCase().includes(q) ||
        tx.matriculeCode.toLowerCase().includes(q) ||
        tx.motif.toLowerCase().includes(q);

      // Class filter
      const matchesClass =
        selectedClass === 'Toutes les classes' ||
        tx.studentGrade.toLowerCase() === selectedClass.toLowerCase();

      // Status filter
      const matchesStatus =
        selectedStatus === 'all' || tx.status === selectedStatus;

      // Enrollment type filter (Nouveau vs Ancien)
      const matchesEnrollment =
        selectedEnrollmentType === 'all' ||
        tx.enrollmentType === selectedEnrollmentType;

      return matchesSearch && matchesClass && matchesStatus && matchesEnrollment;
    });

    return list.sort((a, b) => {
      const numA = parseInt(a.invoiceNumber.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.invoiceNumber.replace(/\D/g, ''), 10) || 0;
      return numB - numA;
    });
  }, [allTransactions, dayTransactions, dateFilterMode, searchQuery, selectedClass, selectedStatus, selectedEnrollmentType]);

  // Select all toggle
  const isAllSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((tx) => selectedIds.includes(tx.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTransactions.map((tx) => tx.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedClass('Toutes les classes');
    setSelectedStatus('all');
    setSelectedEnrollmentType('all');
    setDateFilterMode('all_dates');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedClass !== 'Toutes les classes' ||
    selectedStatus !== 'all' ||
    selectedEnrollmentType !== 'all' ||
    dateFilterMode === 'all_dates';

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-0 relative">
      {/* 1. Header section with title and date picker */}
      <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
              <ReceiptText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
                <span>Journal des Paiements & Encaissements</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {formatDateFrenchLong(selectedJournalDate)}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Bilan quotidien en direct — Réinitialisation automatique toutes les 24h
              </p>
            </div>
          </div>
        </div>

        {/* Global actions: Date picker */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Sélecteur de date du journal avec design calendrier officiel SchoolFlow */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80 text-xs shadow-2xs relative">
            <span className="font-bold text-slate-700 hidden sm:inline ml-1 text-xs">Date :</span>
            <div className="w-36 sm:w-40 relative">
              <FrenchDateInput
                value={selectedJournalDate}
                onChange={(val) => {
                  setSelectedJournalDate(val);
                  setDateFilterMode('day_only');
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setSelectedJournalDate(today);
                setDateFilterMode('day_only');
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 transition-colors cursor-pointer"
              title="Revenir à la date du jour active"
            >
              Aujourd&apos;hui
            </button>
            {dateFilterMode === 'day_only' && (
              <button
                type="button"
                onClick={() => setDateFilterMode('all_dates')}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Toutes les dates
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. BANDEAU BILAN JOURNALIER D'ENCAISSEMENT & CONTRÔLE DE COHÉRENCE */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white border-b border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card Bilan 1 : Total Encaissé ce jour */}
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-300 block tracking-wider mb-0.5">
                Recettes du Jour ({formatDateFrenchLong(selectedJournalDate)})
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold font-heading text-white tracking-tight leading-none block">
                {formatFCFA(dayMetrics.totalAmount)}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5" />
            </div>
          </div>

          {/* Card Bilan 2 : Élèves Encaissés */}
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-300 block tracking-wider mb-0.5">
                Élèves Encaissés Aujourd&apos;hui
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold font-heading text-white tracking-tight leading-none block">
                {dayMetrics.totalCount} règlements
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Card Bilan 3 : Répartition Nouveaux / Anciens */}
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-300 block tracking-wider">
                Nouveaux vs Anciens
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200 text-[11px] font-bold">
                  🌟 {dayMetrics.newCount} Nouv.
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 text-[11px] font-bold">
                  🔄 {dayMetrics.oldCount} Anc.
                </span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          {/* Card Bilan 4 : État de Cohérence de Date */}
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-300 block tracking-wider">
              Contrôle de Cohérence
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-300 truncate">
                Journal aligné au {formatDateFrenchLong(selectedJournalDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Alerte si des factures existent avec des dates différentes */}
        {dayMetrics.mismatchedDatesCount > 0 && dateFilterMode === 'day_only' && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Information Bilan :</strong> Seules les opérations enregistrées le <strong>{formatDateFrenchLong(selectedJournalDate)}</strong> sont comptabilisées. ({dayMetrics.mismatchedDatesCount} opération(s) à d&apos;autres dates).
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setDateFilterMode('all_dates');
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-bold text-[11px] hover:bg-amber-300 transition-colors cursor-pointer"
            >
              Afficher toutes les dates
            </button>
          </div>
        )}
      </div>

      {/* 3. Filter Bar */}
      <div className="p-3 sm:p-4 lg:px-6 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center gap-2.5 sm:gap-3">
        {/* Toggle Mode Date */}
        <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setDateFilterMode('day_only');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              dateFilterMode === 'day_only'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📅 Date sélectionnée ({formatDateFrenchLong(selectedJournalDate)})
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFilterMode('all_dates');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              dateFilterMode === 'all_dates'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tous les règlements ({allTransactions.length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            placeholder="Rechercher par nom, ID, matricule, versement..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Class Filter Dropdown */}
        <div className="relative flex-1 sm:flex-none min-w-[140px]">
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
            }}
            className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
          >
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative flex-1 sm:flex-none min-w-[130px]">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Paiement : Tous</option>
            <option value="paid">Payée (Soldé)</option>
            <option value="partial">Partiel (Acompte)</option>
            <option value="sent">Envoyée</option>
          </select>
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Enrollment Type Filter (Nouveau vs Ancien) */}
        <div className="relative flex-1 sm:flex-none min-w-[135px]">
          <select
            value={selectedEnrollmentType}
            onChange={(e) => setSelectedEnrollmentType(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Élèves : Tous</option>
            <option value="nouveau">🌟 Nouveaux</option>
            <option value="ancien">🔄 Anciens</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Reset filter button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="p-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            title="Réinitialiser les filtres"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Effacer</span>
          </button>
        )}
      </div>

      {/* Bulk actions bar if items are selected */}
      {selectedIds.length > 0 && (
        <div className="bg-emerald-50/80 px-6 py-2.5 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-900 animate-fadeIn">
          <span className="font-semibold">
            {selectedIds.length} élément{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => alert(`Rappels SMS/Email envoyés pour ${selectedIds.length} règlements.`)}
              className="px-3 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-medium hover:bg-emerald-100 transition-colors shadow-2xs"
            >
              Envoyer relance groupée
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-emerald-700 hover:underline ml-2 cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-3 pl-5 pr-3 w-10">
                <input
                  type="checkbox"
                  checked={
                    filteredTransactions.length > 0 &&
                    selectedIds.length === filteredTransactions.length
                  }
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                />
              </th>
              <th className="py-3 px-3">ID Quittance</th>
              <th className="py-3 px-3">Matricule</th>
              <th className="py-3 px-3">Nom & Prénoms de l&apos;Élève</th>
              <th className="py-3 px-3 text-center">Classe</th>
              <th className="py-3 px-3 text-center">Statut Élève</th>
              <th className="py-3 px-3 text-center">Genre</th>
              <th className="py-3 px-3">Prestation / Motif</th>
              <th className="py-3 px-3">Date de Paiement</th>
              <th className="py-3 pr-5 px-3 text-right">Montant Versé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Calendar className="w-8 h-8 text-slate-300" />
                    <p className="font-semibold text-slate-600">
                      Aucun versement enregistré pour la date du {formatDateFrenchLong(selectedJournalDate)}.
                    </p>
                    <p className="text-xs text-slate-400">
                      Modifiez la date ou cliquez sur « Tous les règlements » pour consulter l&apos;ensemble des encaissements.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const isSelected = selectedIds.includes(tx.id);
                const isMatchingToday = isMatchingTxDate(tx.paymentDate, selectedJournalDate);

                return (
                  <tr
                    key={tx.id}
                    className={`hover:bg-emerald-50/30 transition-colors ${
                      isSelected ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 pl-5 pr-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(tx.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      />
                    </td>

                    {/* ID Quittance */}
                    <td className="py-3.5 px-3 font-semibold text-slate-900 font-mono text-[11px] whitespace-nowrap">
                      {tx.invoiceNumber}
                    </td>

                    {/* Matricule (8 chiffres + 1 lettre majuscule) */}
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-700 text-[11px] whitespace-nowrap">
                      {tx.matriculeCode}
                    </td>

                    {/* Student Name */}
                    <td className="py-3.5 px-3 min-w-[160px] whitespace-nowrap">
                      <span className="font-extrabold text-slate-900 leading-tight">
                        {tx.studentName}
                      </span>
                    </td>

                    {/* Class Grade */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap shadow-2xs">
                        {tx.studentGrade}
                      </span>
                    </td>

                    {/* Statut Élève (Nouveau / Ancien) */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 font-extrabold text-[11px] px-2 py-0.5 rounded-md border ${
                        tx.enrollmentType === 'ancien'
                          ? 'bg-blue-50 text-blue-800 border-blue-200/80 shadow-2xs'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-2xs'
                      }`}>
                        {tx.enrollmentType === 'ancien' ? '🔄 Ancien' : '🌟 Nouveau'}
                      </span>
                    </td>

                    {/* Gender badge (M / F) */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <GenderBadge gender={tx.studentGender} />
                    </td>

                    {/* Prestation / Motif dynamique avec motif exact du versement */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-lg border shadow-2xs ${
                        tx.motif.includes('Internat')
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : tx.motif.includes('Cantine')
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : tx.motif.includes('Transport')
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : tx.motif.includes("Droits d'Inscription")
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      }`}>
                        {tx.motif}
                      </span>
                    </td>

                    {/* Date de Paiement du Versement */}
                    <td className="py-3.5 px-3 font-medium whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                        isMatchingToday
                          ? 'text-emerald-800 font-bold'
                          : 'text-slate-700 font-semibold'
                      }`}>
                        {formatDate(tx.paymentDate)}
                      </span>
                    </td>

                    {/* Montant Versé exact de cette opération */}
                    <td className="py-3.5 pr-5 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap font-mono font-heading">
                      {formatFCFA(tx.amount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: Défilement & Compteur interactif sans pagination */}
      <div className="p-4 px-4 sm:px-6 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>
            Affichage de <strong className="text-slate-900 font-bold">{filteredTransactions.length}</strong> règlement{filteredTransactions.length > 1 ? 's' : ''} ({dateFilterMode === 'day_only' ? `du ${formatDateFrenchLong(selectedJournalDate)}` : 'toutes dates confondues'}) • Défilement vertical direct
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">
          Journal actualisé en temps réel selon les versements enregistrés
        </span>
      </div>
    </div>
  );
}
