'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Invoice, School } from '@/lib/data/types';
import { InvoiceStatusBadge, GenderBadge } from '@/components/ui/badge';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { availableClasses } from '@/lib/data/mock-data';
import {
  Wallet,
  Coins,
  Smartphone,
  AlertTriangle,
  Download,
  PlusCircle,
  Search,
  Filter,
  ChevronDown,
  RotateCcw,
  CheckCircle2,
  Printer,
  TrendingUp,
  ReceiptText,
  Landmark,
  X,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { getLiveInvoices, getLiveSchool, DATA_UPDATED_EVENT } from '@/lib/data/live-store';

interface CaisseViewProps {
  initialInvoices: Invoice[];
  school: School;
  schoolSlug: string;
}

export function CaisseView({
  initialInvoices,
  school,
  schoolSlug,
}: CaisseViewProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [currentSchool, setCurrentSchool] = useState<School>(school);

  useEffect(() => {
    setInvoices(getLiveInvoices(initialInvoices, schoolSlug));
    setCurrentSchool(getLiveSchool(schoolSlug, school));

    const handleUpdate = () => {
      setInvoices(getLiveInvoices(initialInvoices, schoolSlug));
      setCurrentSchool(getLiveSchool(schoolSlug, school));
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [initialInvoices, schoolSlug, school]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('Toutes les classes');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedEnrollmentType, setSelectedEnrollmentType] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showReceiptModal, setShowReceiptModal] = useState<Invoice | null>(null);

  // Synchronized horizontal scroll references
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(2050);

  useEffect(() => {
    const updateWidth = () => {
      if (tableContainerRef.current) {
        setTableScrollWidth(Math.max(2050, tableContainerRef.current.scrollWidth));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [invoices]);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  // Filtered & Sorted Invoices (Toujours du plus récent ID-051, ID-050... vers ID-001)
  const filteredInvoices = useMemo(() => {
    const list = invoices.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        inv.studentName.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.guardianName.toLowerCase().includes(q) ||
        inv.guardianPhone.toLowerCase().includes(q);

      const matchesClass =
        selectedClass === 'Toutes les classes' ||
        inv.studentGrade.toLowerCase() === selectedClass.toLowerCase();

      const matchesStatus =
        selectedStatus === 'all' || inv.status === selectedStatus;

      const matchesMethod =
        selectedPaymentMethod === 'all' ||
        (inv.paymentMethod && inv.paymentMethod.toLowerCase().includes(selectedPaymentMethod.toLowerCase()));

      const matchesEnrollment =
        selectedEnrollmentType === 'all' ||
        (selectedEnrollmentType === 'nouveau' && (inv.enrollmentType === 'nouveau' || !inv.enrollmentType)) ||
        (selectedEnrollmentType === 'ancien' && inv.enrollmentType === 'ancien');

      return matchesSearch && matchesClass && matchesStatus && matchesMethod && matchesEnrollment;
    });

    // Tri par ordre séquentiel décroissant
    return list.sort((a, b) => {
      const numA = parseInt(a.invoiceNumber.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.invoiceNumber.replace(/\D/g, ''), 10) || 0;
      return numB - numA;
    });
  }, [invoices, searchQuery, selectedClass, selectedStatus, selectedPaymentMethod, selectedEnrollmentType]);

  const toggleSelectAll = () => {
    if (filteredInvoices.every((inv) => selectedIds.includes(inv.id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInvoices.map((inv) => inv.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedClass('Toutes les classes');
    setSelectedPaymentMethod('all');
    setSelectedStatus('all');
    setSelectedEnrollmentType('all');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedClass !== 'Toutes les classes' ||
    selectedPaymentMethod !== 'all' ||
    selectedStatus !== 'all';

  // Live KPI metrics computation from invoices
  const totalCollected = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);
  }, [invoices]);

  // 1. Total Encaissé en Espèces / Caisse physique
  const { totalEspeces, especesCount } = useMemo(() => {
    let sum = 0;
    let count = 0;
    invoices.forEach((inv) => {
      const pm = (inv.paymentMethod || '').toLowerCase();
      const isOnline =
        pm.includes('wave') ||
        pm.includes('orange') ||
        pm.includes('mtn') ||
        pm.includes('moov') ||
        pm.includes('vir') ||
        pm.includes('chè') ||
        pm.includes('che') ||
        pm.includes('ligne');

      if (!isOnline && (inv.paidAmount || 0) > 0) {
        sum += inv.paidAmount || 0;
        count++;
      }
    });
    return { totalEspeces: sum, especesCount: count };
  }, [invoices]);

  // 2. Total Encaissé en Ligne & Virements (Mobile Money Wave/Orange/MTN + Virements bancaires)
  const { totalEnLigneEtVirement, enLigneCount } = useMemo(() => {
    let sum = 0;
    let count = 0;
    invoices.forEach((inv) => {
      const pm = (inv.paymentMethod || '').toLowerCase();
      const isOnline =
        pm.includes('wave') ||
        pm.includes('orange') ||
        pm.includes('mtn') ||
        pm.includes('moov') ||
        pm.includes('vir') ||
        pm.includes('chè') ||
        pm.includes('che') ||
        pm.includes('ligne');

      if (isOnline && (inv.paidAmount || 0) > 0) {
        sum += inv.paidAmount || 0;
        count++;
      }
    });
    return { totalEnLigneEtVirement: sum, enLigneCount: count };
  }, [invoices]);

  // 3. Scolarité en Retard : Somme totale restante de tous les élèves du tableau
  const { totalScolariteEnRetard, unpaidCount } = useMemo(() => {
    let sum = 0;
    let count = 0;
    invoices.forEach((inv) => {
      const net = inv.netAmount || (inv.amount - (inv.discountAmount || 0));
      const paid = inv.paidAmount || 0;
      const remaining = inv.balanceRemaining !== undefined ? inv.balanceRemaining : Math.max(0, net - paid);
      if (remaining > 0) {
        sum += remaining;
        count++;
      }
    });
    return { totalScolariteEnRetard: sum, unpaidCount: count };
  }, [invoices]);

  const totalExigible = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + (inv.netAmount || inv.amount), 0);
  }, [invoices]);

  const collectionRate = totalExigible > 0 ? ((totalCollected / totalExigible) * 100).toFixed(1) : '100';

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Comptabilité & Caisse
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Encaissements en direct, quittances FCFA et suivi des versements — {currentSchool.name}
          </p>
        </div>

        {/* Actions rapides */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <Link
            href={`/${schoolSlug}/admin/inscriptions`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Encaisser un Règlement</span>
          </Link>
        </div>
      </div>

      {/* 2. LES 3 BLOCS KPI RÉORGANISÉS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {/* BLOC 1 : TOTAL ENCAISSÉ EN CAISSE (ESPÈCES) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Total Encaissé en Caisse (Espèces)
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap">
                {formatFCFA(totalEspeces)}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Règlements physiques enregistrés au guichet
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Quittances espèces</span>
            <span className="font-semibold text-slate-700">{especesCount} quittances</span>
          </div>
        </div>

        {/* BLOC 2 : TOTAL ENCAISSÉ EN LIGNE OU PAR VIREMENT */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Total Encaissé en Ligne & Virements
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap text-blue-900">
                {formatFCFA(totalEnLigneEtVirement)}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Wave, Orange, MTN, Moov & Virements bancaires
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Transactions numériques</span>
            <span className="font-semibold text-blue-800">{enLigneCount} transactions</span>
          </div>
        </div>

        {/* BLOC 3 : RESTE À PERCEVOIR (SOMME RESTANTE EN FCFA CALCULÉE) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between bg-rose-50/15">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-rose-900 font-sans truncate">
                Reste à Percevoir
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-extrabold text-rose-900 tracking-tight font-heading whitespace-nowrap">
                {formatFCFA(totalScolariteEnRetard)}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Somme restante à payer sur les dossiers élèves
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-rose-700 font-medium flex items-center justify-between">
            <span>Élèves avec solde restant</span>
            <span className="font-bold bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
              {unpaidCount} élèves
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par élève, N° quittance..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="relative flex-1 sm:flex-none min-w-[140px]">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
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

          <div className="relative flex-1 sm:flex-none min-w-[130px]">
            <select
              value={selectedEnrollmentType}
              onChange={(e) => setSelectedEnrollmentType(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Tous les statuts</option>
              <option value="nouveau">🌟 Nouveaux</option>
              <option value="ancien">🔄 Anciens</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative flex-1 sm:flex-none min-w-[140px]">
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Tous les modes</option>
              <option value="Espèces">Espèces</option>
              <option value="Wave">Wave</option>
              <option value="Orange">Orange Money</option>
              <option value="MTN">MTN Money</option>
              <option value="Moov">Moov Money</option>
              <option value="Virement">Virement bancaire</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="p-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Indicateur d'encaissements sélectionnés */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs shadow-2xs ml-auto animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {selectedIds.length} {selectedIds.length > 1 ? 'encaissements sélectionnés' : 'encaissement sélectionné'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-emerald-700 hover:text-emerald-950 underline text-[11px] ml-1 cursor-pointer font-semibold"
              >
                Désélectionner
              </button>
            </div>
          )}
        </div>

        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto bg-slate-100 border-b border-slate-200 scrollbar-thin"
          style={{ overflowX: 'scroll' }}
        >
          <div style={{ width: `${tableScrollWidth}px`, height: '16px' }} className="flex items-center px-3 text-[10px] font-bold text-slate-600">
            <span className="shrink-0 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Barre de défilement horizontale : glissez de gauche à droite pour consulter les 5 versements et modes de règlement →
            </span>
          </div>
        </div>

        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="max-h-[720px] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ overflowX: 'hidden' }}
        >
          <table className="w-full text-left border-collapse min-w-[2250px]">
            <thead className="sticky top-0 z-10 shadow-2xs">
              <tr className="bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 pl-5 pr-3 w-10">
                  <input
                    type="checkbox"
                    checked={
                      filteredInvoices.length > 0 &&
                      filteredInvoices.every((i) => selectedIds.includes(i.id))
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3 whitespace-nowrap">N° Quittance</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Matricule</th>
                <th className="py-3.5 px-3 whitespace-nowrap min-w-[180px]">Élève</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Classe</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Statut Élève</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Genre</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Frais d&apos;inscription</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap font-mono">Date d&apos;inscription</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Réduction</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Somme Nette</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Montant Versé</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Reste à Payer</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Mode de Règlement</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap bg-slate-50/80">1er Versement</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap bg-slate-50/80">2ème Versement</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap bg-slate-50/80">3ème Versement</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap bg-slate-50/80">4ème Versement</th>
                <th className="py-3.5 pr-5 px-3 text-center whitespace-nowrap bg-slate-50/80">5ème Versement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-slate-400">
                    Aucun encaissement ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isSelected = selectedIds.includes(inv.id);
                  const numVal = parseInt(inv.invoiceNumber.replace(/\D/g, '') || '1', 10);
                  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
                  const matriculeStr = `${26014800 + numVal}${letters[(numVal - 1) % letters.length]}`;
                  const initialAmount = inv.amount;
                  const discount = inv.discountAmount || 0;
                  const netAmount = inv.netAmount || Math.max(0, initialAmount - discount);
                  const paidAmount = inv.paidAmount !== undefined ? inv.paidAmount : (inv.status === 'paid' ? netAmount : 0);
                  const balanceRemaining = inv.balanceRemaining !== undefined ? inv.balanceRemaining : Math.max(0, netAmount - paidAmount);
                  const paymentMethod = inv.paymentMethod || 'Espèces en caisse';
                  const inst = inv.installments;
                  const v1 = inst?.versement1 || (paidAmount > 0 ? { amount: Math.min(paidAmount, 100000), paymentMethod: paymentMethod, date: inst?.versement1?.date || inv.issueDate } : null);
                  const v2 = inst?.versement2 || (paidAmount > 100000 ? { amount: Math.min(paidAmount - 100000, 50000), paymentMethod: 'Wave', date: inst?.versement2?.date || inv.issueDate } : null);
                  const v3 = inst?.versement3 || (paidAmount > 150000 ? { amount: Math.min(paidAmount - 150000, 50000), paymentMethod: 'Virement', date: inst?.versement3?.date || inv.issueDate } : null);
                  const v4 = inst?.versement4 || (paidAmount > 200000 ? { amount: Math.min(paidAmount - 200000, 50000), paymentMethod: 'Espèces', date: inst?.versement4?.date || inv.issueDate } : null);
                  const v5 = inst?.versement5 || (paidAmount > 250000 ? { amount: paidAmount - 250000, paymentMethod: 'Orange', date: inst?.versement5?.date || inv.issueDate } : null);

                  return (
                    <tr key={inv.id} className={`hover:bg-emerald-50/30 ${isSelected ? 'bg-emerald-50/40' : ''}`}>
                      <td className="py-3.5 pl-5 pr-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelectOne(inv.id)} className="rounded border-slate-300 text-emerald-600 h-4 w-4 cursor-pointer" />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">{inv.invoiceNumber}</td>
                      <td className="py-3.5 px-3 font-mono text-slate-600 whitespace-nowrap">{matriculeStr}</td>
                      <td className="py-3.5 px-3 font-extrabold uppercase text-slate-900 whitespace-nowrap">{inv.studentName}</td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">{inv.studentGrade}</td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">{inv.enrollmentType === 'ancien' ? '🔄 Ancien' : '🌟 Nouveau'}</td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap"><GenderBadge gender={inv.studentGender} /></td>
                      <td className="py-3.5 px-3 text-right font-medium text-slate-700 font-mono whitespace-nowrap">{formatFCFA(initialAmount)}</td>
                      <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-700 whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {discount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono text-amber-800 bg-amber-50 border border-amber-200 whitespace-nowrap">
                            -{formatFCFA(discount)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-slate-900 font-mono whitespace-nowrap">{formatFCFA(netAmount)}</td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-emerald-800 font-mono whitespace-nowrap">{formatFCFA(paidAmount)}</td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono font-bold">
                        {balanceRemaining > 0 ? (
                          <span className="text-rose-700 whitespace-nowrap">{formatFCFA(balanceRemaining)}</span>
                        ) : (
                          <span className="text-emerald-700 whitespace-nowrap">0 FCFA</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap font-medium text-slate-700">{paymentMethod}</td>
                      <td className="py-3.5 px-3 text-center bg-slate-50/50 whitespace-nowrap">
                        {v1?.amount ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="font-mono font-bold text-slate-900 text-[11px]">{formatFCFA(v1.amount)}</span>
                            <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">{v1.paymentMethod}</span>
                            <span className="text-[9.5px] font-mono text-slate-500">{formatDate(v1.date || inv.issueDate)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center bg-slate-50/50 whitespace-nowrap">
                        {v2?.amount ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="font-mono font-bold text-slate-900 text-[11px]">{formatFCFA(v2.amount)}</span>
                            <span className="text-[9.5px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">{v2.paymentMethod}</span>
                            <span className="text-[9.5px] font-mono text-slate-500">{formatDate(v2.date || inv.issueDate)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center bg-slate-50/50 whitespace-nowrap">
                        {v3?.amount ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="font-mono font-bold text-slate-900 text-[11px]">{formatFCFA(v3.amount)}</span>
                            <span className="text-[9.5px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">{v3.paymentMethod}</span>
                            <span className="text-[9.5px] font-mono text-slate-500">{formatDate(v3.date || inv.issueDate)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center bg-slate-50/50 whitespace-nowrap">
                        {v4?.amount ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="font-mono font-bold text-slate-900 text-[11px]">{formatFCFA(v4.amount)}</span>
                            <span className="text-[9.5px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">{v4.paymentMethod}</span>
                            <span className="text-[9.5px] font-mono text-slate-500">{formatDate(v4.date || inv.issueDate)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-5 px-3 text-center bg-slate-50/50 whitespace-nowrap">
                        {v5?.amount ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="font-mono font-bold text-slate-900 text-[11px]">{formatFCFA(v5.amount)}</span>
                            <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">{v5.paymentMethod}</span>
                            <span className="text-[9.5px] font-mono text-slate-500">{formatDate(v5.date || inv.issueDate)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 px-6 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Total affiché : <strong className="text-slate-900 font-bold">{filteredInvoices.length}</strong> encaissements
          </span>
          <span className="text-[11px] text-slate-400">
            Défilement horizontal complet synchronisé • 5 versements & règlements détaillés
          </span>
        </div>
      </div>

      {/* ================= MODALE REÇU / QUITTANCE OFFICIELLE ================= */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-4 animate-in zoom-in-95 duration-200">
            {/* Header modal */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ReceiptText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-heading">
                    Quittance de Paiement Officielle
                  </h3>
                  <p className="text-xs text-slate-400">
                    Réf : {showReceiptModal.invoiceNumber} • {showReceiptModal.studentName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cadre officiel école avec logos agrandis et nom STRICTEMENT sur une seule ligne */}
            <div className="border-2 border-slate-900 rounded-2xl p-3 sm:p-4 bg-slate-50/50">
              <div className="flex items-center justify-between gap-2.5">
                <div className="shrink-0 text-center w-20 sm:w-24">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentSchool.logoUrl || 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=200&auto=format&fit=crop&q=80'}
                      alt="Logo École"
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0 px-2 overflow-hidden text-center">
                  <h4 className="text-xs sm:text-sm md:text-base font-extrabold text-slate-950 font-heading uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis block w-full leading-tight" title={currentSchool.name}>
                    {currentSchool.name}
                  </h4>
                  <p className="text-[10px] font-bold text-emerald-800 italic mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                    « {currentSchool.motto || 'Discipline • Rigueur • Réussite'} »
                  </p>
                  <p className="text-[9px] text-slate-600 mt-0.5 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {currentSchool.district || `${currentSchool.city} — ${currentSchool.country}`} • {currentSchool.phone || '+225 27 22 44 11 00'}
                  </p>
                </div>

                <div className="shrink-0 text-center w-20 sm:w-24">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentSchool.countryEmblemUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png'}
                      alt="Emblème National"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Élève :</span>
                <span className="font-extrabold text-slate-900 uppercase font-heading">{showReceiptModal.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Statut Élève :</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] border ${
                  showReceiptModal.enrollmentType === 'ancien'
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  {showReceiptModal.enrollmentType === 'ancien' ? '🔄 Ancien Élève' : '🌟 Nouvel Élève'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Classe :</span>
                <span className="font-bold text-slate-800">{showReceiptModal.studentGrade}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mode de versement :</span>
                <span className="font-semibold text-slate-800">{showReceiptModal.paymentMethod || 'Espèces en caisse'}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                <span className="font-bold text-slate-700">Montant Encaissé :</span>
                <span className="font-extrabold text-emerald-800 font-mono text-base">{formatFCFA(showReceiptModal.paidAmount || showReceiptModal.amount)}</span>
              </div>
              {showReceiptModal.balanceRemaining && showReceiptModal.balanceRemaining > 0 ? (
                <div className="flex justify-between text-xs text-rose-700 font-bold">
                  <span>Reste à payer :</span>
                  <span className="font-mono">{formatFCFA(showReceiptModal.balanceRemaining)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-xs text-emerald-700 font-bold">
                  <span>Solde Scolarité :</span>
                  <span className="font-mono">0 FCFA (Soldé)</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReceiptModal(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-all text-center cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md transition-all text-center inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer Reçu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
