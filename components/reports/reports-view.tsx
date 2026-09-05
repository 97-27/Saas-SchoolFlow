'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student, Invoice, School } from '@/lib/data/types';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { getLiveStudents, getLiveInvoices, getLiveSchool, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import {
  BarChart3,
  TrendingUp,
  Coins,
  Wallet,
  Users,
  Calendar,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  PieChart,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  GraduationCap,
  Sparkles,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface ReportsViewProps {
  initialStudents: Student[];
  initialInvoices: Invoice[];
  school: School;
  schoolSlug: string;
}

export function ReportsView({
  initialStudents,
  initialInvoices,
  school,
  schoolSlug,
}: ReportsViewProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [schoolState, setSchoolState] = useState<School>(school);
  const [selectedCycle, setSelectedCycle] = useState<'all' | 'maternelle' | 'primaire' | 'college' | 'lycee'>('all');

  useEffect(() => {
    setStudents(getLiveStudents(initialStudents, schoolSlug));
    setInvoices(getLiveInvoices(initialInvoices, schoolSlug));
    setSchoolState(getLiveSchool(schoolSlug, school));

    const handleUpdate = () => {
      setStudents(getLiveStudents(initialStudents, schoolSlug));
      setInvoices(getLiveInvoices(initialInvoices, schoolSlug));
      setSchoolState(getLiveSchool(schoolSlug, school));
    };

    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [initialStudents, initialInvoices, schoolSlug, school]);

  // Classification par cycles (Maternelle jusqu'au Lycée)
  const isMaternelle = (grade: string) => {
    if (!grade) return false;
    const g = grade.toLowerCase();
    return (
      g.includes('maternelle') ||
      g.includes('p.s.') ||
      g.includes('m.s.') ||
      g.includes('g.s.') ||
      g.includes('petite') ||
      g.includes('moyenne') ||
      g.includes('grande')
    );
  };

  const isPrimaire = (grade: string) => {
    if (!grade) return false;
    const g = grade.toUpperCase();
    return ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'].some((p) => g.includes(p));
  };

  const isCollege = (grade: string) => {
    if (!grade) return false;
    const g = grade.toLowerCase();
    return (
      g.includes('6ème') ||
      g.includes('6eme') ||
      g.includes('6e') ||
      g.includes('5ème') ||
      g.includes('5eme') ||
      g.includes('5e') ||
      g.includes('4ème') ||
      g.includes('4eme') ||
      g.includes('4e') ||
      g.includes('3ème') ||
      g.includes('3eme') ||
      g.includes('3e')
    );
  };

  const isLycee = (grade: string) => {
    if (!grade) return false;
    const g = grade.toLowerCase();
    return (
      g.includes('2nde') ||
      g.includes('1ère') ||
      g.includes('1ere') ||
      g.includes('terminale') ||
      g.includes('tle')
    );
  };

  // Filtrage des données
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedCycle === 'maternelle') return isMaternelle(s.grade);
      if (selectedCycle === 'primaire') return isPrimaire(s.grade);
      if (selectedCycle === 'college') return isCollege(s.grade);
      if (selectedCycle === 'lycee') return isLycee(s.grade);
      return true;
    });
  }, [students, selectedCycle]);

  // Indicateurs Financiers Dynamiques Annuels (Strictement sur toute l'année scolaire)
  const stats = useMemo(() => {
    // Calcul par tranche de versement
    let v1Total = 0, v2Total = 0, v3Total = 0, v4Total = 0, v5Total = 0;

    filteredStudents.forEach((stu) => {
      const inst = stu.installments;
      const paid = stu.paidAmount || 0;

      const p1 = inst?.versement1?.amount !== undefined ? inst.versement1.amount : (paid > 0 ? Math.min(paid, 100000) : 0);
      const p2 = inst?.versement2?.amount !== undefined ? inst.versement2.amount : (paid > 100000 ? Math.min(paid - 100000, 50000) : 0);
      const p3 = inst?.versement3?.amount !== undefined ? inst.versement3.amount : (paid > 150000 ? Math.min(paid - 150000, 40000) : 0);
      const p4 = inst?.versement4?.amount !== undefined ? inst.versement4.amount : (paid > 190000 ? Math.min(paid - 190000, 35000) : 0);
      const p5 = inst?.versement5?.amount !== undefined ? inst.versement5.amount : (paid > 225000 ? Math.min(paid - 225000, 25000) : 0);

      v1Total += p1;
      v2Total += p2;
      v3Total += p3;
      v4Total += p4;
      v5Total += p5;
    });

    const periodLabel = 'Bilan Financier Annuel (2026-2027)';
    const periodSub = 'Recouvrement cumulé de toutes les échéances sur toute l’année scolaire (Septembre à Juin)';

    const totalExigible = filteredStudents.reduce((acc, s) => acc + (s.netAmount !== undefined ? s.netAmount : s.tuitionAmount), 0);
    const totalCollected = filteredStudents.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const totalOverdue = filteredStudents.reduce((acc, s) => {
      const net = s.netAmount !== undefined ? s.netAmount : s.tuitionAmount;
      const paid = s.paidAmount || 0;
      return acc + (s.balanceRemaining !== undefined ? s.balanceRemaining : Math.max(0, net - paid));
    }, 0);
    const rate = totalExigible > 0 ? ((totalCollected / totalExigible) * 100).toFixed(1) : '100';

    const girlsCount = filteredStudents.filter((s) => s.gender === 'female').length;
    const boysCount = filteredStudents.filter((s) => s.gender === 'male').length;
    const newCount = filteredStudents.filter((s) => s.enrollmentType === 'nouveau' || !s.enrollmentType).length;
    const returningCount = filteredStudents.filter((s) => s.enrollmentType === 'ancien').length;

    // Détail par cycle calculé directement sur les données élèves réelles
    const cyclesData = [
      { name: 'Maternelle (P.S. à G.S.)', check: isMaternelle, icon: Sparkles, color: 'emerald' },
      { name: 'Primaire (CP1 à CM2)', check: isPrimaire, icon: GraduationCap, color: 'blue' },
      { name: 'Collège (6ème à 3ème)', check: isCollege, icon: Building2, color: 'amber' },
    ].map((c) => {
      const cycStus = students.filter((s) => c.check(s.grade));
      
      const cycExigible = cycStus.reduce((acc, s) => acc + (s.netAmount !== undefined ? s.netAmount : s.tuitionAmount), 0);
      const cycCollected = cycStus.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
      const cycRemaining = cycStus.reduce((acc, s) => {
        const net = s.netAmount !== undefined ? s.netAmount : s.tuitionAmount;
        const paid = s.paidAmount || 0;
        return acc + (s.balanceRemaining !== undefined ? s.balanceRemaining : Math.max(0, net - paid));
      }, 0);
      const cycRate = cycExigible > 0 ? ((cycCollected / cycExigible) * 100).toFixed(1) : '100';

      return {
        ...c,
        studentsCount: cycStus.length,
        girls: cycStus.filter((s) => s.gender === 'female').length,
        boys: cycStus.filter((s) => s.gender === 'male').length,
        exigible: cycExigible,
        collected: cycCollected,
        remaining: cycRemaining,
        rate: cycRate,
      };
    });

    return {
      periodLabel,
      periodSub,
      totalStudents: filteredStudents.length,
      girlsCount,
      boysCount,
      newCount,
      returningCount,
      totalExigible,
      totalCollected,
      totalOverdue,
      rate,
      v1Total,
      v2Total,
      v3Total,
      v4Total,
      v5Total,
      cyclesData,
    };
  }, [filteredStudents, students]);

  return (
    <div className="space-y-6 pb-12">
      {/* 0. Section Imprimable A4 Spécifique (Visible uniquement lors du Ctrl+P ou clic sur Imprimer) */}
      <div className="hidden print:block bg-white text-slate-900 p-6 font-sans space-y-5">
        {/* Entête Officiel */}
        <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
              RÉPUBLIQUE DE CÔTE D&apos;IVOIRE • MINISTÈRE DE L&apos;ÉDUCATION NATIONALE
            </span>
            <h1 className="text-xl font-black font-heading uppercase text-slate-950 mt-0.5">
              {schoolState.name}
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              {schoolState.shortName || 'Établissement'} • {schoolState.city || 'Abidjan'} — Contact : {schoolState.phone || '+225 27 22 44 11 00'}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 font-bold text-xs rounded-lg uppercase">
              Année Scolaire {schoolState.academicYear}
            </span>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">
              Édité le {formatDate(new Date().toISOString().split('T')[0])}
            </p>
          </div>
        </div>

        {/* Titre */}
        <div className="text-center py-2 bg-slate-50 border border-slate-300 rounded-lg">
          <h2 className="text-sm font-black uppercase tracking-wide font-heading text-slate-900">
            BILAN FINANCIER & STATISTIQUE D&apos;ACTIVITÉ
          </h2>
          <p className="text-[11px] text-slate-600">
            Recouvrement global des scolarités et effectifs par cycle
          </p>
        </div>

        {/* 4 Indicateurs Clés */}
        <div className="grid grid-cols-4 gap-2.5">
          <div className="border border-slate-300 p-2.5 rounded-lg text-center bg-slate-50">
            <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Effectif Total</span>
            <span className="text-base font-black font-heading text-slate-900 block">{stats.totalStudents} Élèves</span>
            <span className="text-[9.5px] text-slate-500">♀ {stats.girlsCount} • ♂ {stats.boysCount}</span>
          </div>
          <div className="border border-slate-300 p-2.5 rounded-lg text-center bg-slate-50">
            <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Budget Exigible</span>
            <span className="text-base font-black font-heading text-slate-900 block">{formatFCFA(stats.totalExigible)}</span>
            <span className="text-[9.5px] text-slate-500">Scolarités nettes</span>
          </div>
          <div className="border border-emerald-400 p-2.5 rounded-lg text-center bg-emerald-50/50">
            <span className="text-[9.5px] font-bold text-emerald-800 uppercase block">Total Encaissé</span>
            <span className="text-base font-black font-heading text-emerald-950 block">{formatFCFA(stats.totalCollected)}</span>
            <span className="text-[9.5px] text-emerald-800 font-bold">Taux : {stats.rate}%</span>
          </div>
          <div className="border border-rose-300 p-2.5 rounded-lg text-center bg-rose-50/50">
            <span className="text-[9.5px] font-bold text-rose-800 uppercase block">Reste à Percevoir</span>
            <span className="text-base font-black font-heading text-rose-950 block">{formatFCFA(stats.totalOverdue)}</span>
            <span className="text-[9.5px] text-rose-800">Soldes en attente</span>
          </div>
        </div>

        {/* Tableau des Cycles */}
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
            1. Répartition Financière par Cycle Pédagogique
          </h3>
          <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[9.5px]">
                <th className="p-1.5 border-r border-slate-300">Cycle d&apos;Enseignement</th>
                <th className="p-1.5 border-r border-slate-300 text-center">Effectif</th>
                <th className="p-1.5 border-r border-slate-300 text-center">F / M</th>
                <th className="p-1.5 border-r border-slate-300 text-right">Montant Exigible</th>
                <th className="p-1.5 border-r border-slate-300 text-right">Montant Encaissé</th>
                <th className="p-1.5 border-r border-slate-300 text-right">Reste à Percevoir</th>
                <th className="p-1.5 text-center">Taux</th>
              </tr>
            </thead>
            <tbody>
              {stats.cyclesData.map((c, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="p-1.5 border-r border-slate-300 font-bold">{c.name}</td>
                  <td className="p-1.5 border-r border-slate-300 text-center font-mono">{c.studentsCount}</td>
                  <td className="p-1.5 border-r border-slate-300 text-center text-[9.5px]">♀ {c.girls} • ♂ {c.boys}</td>
                  <td className="p-1.5 border-r border-slate-300 text-right font-mono font-bold">{formatFCFA(c.exigible)}</td>
                  <td className="p-1.5 border-r border-slate-300 text-right font-mono font-bold text-emerald-900">{formatFCFA(c.collected)}</td>
                  <td className="p-1.5 border-r border-slate-300 text-right font-mono font-bold text-rose-900">{formatFCFA(c.remaining)}</td>
                  <td className="p-1.5 text-center font-bold">{c.rate}%</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-black border-t-2 border-slate-400">
                <td className="p-1.5 border-r border-slate-300 uppercase">TOTAL GÉNÉRAL</td>
                <td className="p-1.5 border-r border-slate-300 text-center font-mono">{stats.totalStudents}</td>
                <td className="p-1.5 border-r border-slate-300 text-center text-[9.5px]">♀ {stats.girlsCount} • ♂ {stats.boysCount}</td>
                <td className="p-1.5 border-r border-slate-300 text-right font-mono">{formatFCFA(stats.totalExigible)}</td>
                <td className="p-1.5 border-r border-slate-300 text-right font-mono text-emerald-950">{formatFCFA(stats.totalCollected)}</td>
                <td className="p-1.5 border-r border-slate-300 text-right font-mono text-rose-950">{formatFCFA(stats.totalOverdue)}</td>
                <td className="p-1.5 text-center text-emerald-950">{stats.rate}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tableau des 5 Tranches */}
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
            2. Ventilation par Tranche de Versement
          </h3>
          <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[9.5px]">
                <th className="p-1.5 border-r border-slate-300">Échéance</th>
                <th className="p-1.5 border-r border-slate-300 text-right">Montant Perçu</th>
                <th className="p-1.5 text-center">Part du Total Encaissé</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: '1er Versement (Rentrée scolaire)', amount: stats.v1Total },
                { label: '2ème Versement (Trimestre 1)', amount: stats.v2Total },
                { label: '3ème Versement (Trimestre 2 début)', amount: stats.v3Total },
                { label: '4ème Versement (Trimestre 2 fin)', amount: stats.v4Total },
                { label: '5ème Versement (Trimestre 3 Solde)', amount: stats.v5Total },
              ].map((v, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="p-1.5 border-r border-slate-300 font-medium">{v.label}</td>
                  <td className="p-1.5 border-r border-slate-300 text-right font-mono font-bold">{formatFCFA(v.amount)}</td>
                  <td className="p-1.5 text-center font-bold">
                    {stats.totalCollected > 0 ? ((v.amount / stats.totalCollected) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
          <div className="space-y-12">
            <p className="font-bold uppercase text-slate-700">L&apos;Agent Comptable / Économe</p>
            <p className="text-[10px] text-slate-400 italic">Signature & Date</p>
          </div>
          <div className="space-y-12">
            <p className="font-bold uppercase text-slate-700">Le Chef d&apos;Établissement</p>
            <div className="border border-slate-300 border-dashed rounded-full w-20 h-20 mx-auto flex items-center justify-center text-[9px] text-slate-400">
              Cachet Officiel
            </div>
          </div>
        </div>
      </div>

      {/* 1. Header principal Écran (Masqué à l'impression) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Rapports & Statistiques Financières
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {schoolState.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Bilan d&apos;activité, taux de recouvrement FCFA, répartition par cycles et versements — {schoolState.name}
          </p>
        </div>

        {/* Actions Rapides */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-600" />
            <span>Imprimer le Bilan</span>
          </button>
        </div>
      </div>

      {/* 2. Barre de Filtres de Cycle */}
      <div className="print:hidden bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Filtre Cycles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Cycle :</span>
          </span>
          {[
            { id: 'all', label: 'Tous les Cycles' },
            { id: 'maternelle', label: 'Maternelle' },
            { id: 'primaire', label: 'Primaire' },
            { id: 'college', label: 'Collège' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCycle(c.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedCycle === c.id
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Année Scolaire Complète (2026-2027)
          </span>
        </div>
      </div>

      {/* 3. Cartes KPI Principales (Pandhowan Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Total Scolarités Exigibles */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
                Budget Exigible Total
              </h3>
              <p className="text-[11px] text-slate-400">Scolarités nettes attendues</p>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-950 font-heading">
              {formatFCFA(stats.totalExigible)}
            </span>
            <div className="text-[11px] text-slate-500 font-medium">
              Sur {stats.totalStudents} élèves inscrits
            </div>
          </div>
        </div>

        {/* Total Encaissé en Caisse */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200/80 shadow-xs flex flex-col justify-between bg-gradient-to-b from-white to-emerald-50/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 font-sans">
                Total Encaissé ce jour
              </h3>
              <p className="text-[11px] text-emerald-700">Versements certifiés</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-900 font-heading">
                {formatFCFA(stats.totalCollected)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
              <span>Taux de recouvrement :</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300">
                {stats.rate}%
              </span>
            </div>
          </div>
        </div>

        {/* Effectifs & Répartition F/M */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans">
                Effectifs Inscrits
              </h3>
              <p className="text-[11px] text-slate-400">Répertoire nominatif</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-950 font-heading">
                {stats.totalStudents}
              </span>
              <span className="text-xs text-slate-500 font-medium">élèves inscrits</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-200 font-bold text-[11px]">
                ♀ {stats.girlsCount} Filles
              </span>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px]">
                ♂ {stats.boysCount} Garçons
              </span>
              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[11px]">
                🏠 {students.filter(s => s.isBoarding).length} Internes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tableau Détaillé par Cycle (Maternelle, Primaire, Collège, Lycée) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 font-heading">
                {stats.periodLabel} — Recouvrement par Cycle
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {stats.periodSub}
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto shadow-2xs">
            4 Cycles Actifs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 pl-6 pr-3">Cycle d&apos;Enseignement</th>
                <th className="py-3.5 px-3 text-center">Effectif</th>
                <th className="py-3.5 px-3 text-center">Répartition F / M</th>
                <th className="py-3.5 px-3 text-right">Montant Exigible</th>
                <th className="py-3.5 px-3 text-right">Montant Encaissé</th>
                <th className="py-3.5 px-3 text-right">Reste à Payer</th>
                <th className="py-3.5 pr-6 px-3 text-center">Taux Recouvrement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {stats.cyclesData.map((cyc, idx) => {
                const Icon = cyc.icon;
                return (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 pl-6 pr-3 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold block text-slate-950 font-heading">{cyc.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">Programme officiel MENA</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-center font-mono font-bold text-slate-900">
                      {cyc.studentsCount}
                    </td>
                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 font-semibold text-[10.5px]">
                          ♀ {cyc.girls}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10.5px]">
                          ♂ {cyc.boys}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-right font-mono font-bold text-slate-900">
                      {formatFCFA(cyc.exigible)}
                    </td>
                    <td className="py-4 px-3 text-right font-mono font-black text-emerald-800">
                      {formatFCFA(cyc.collected)}
                    </td>
                    <td className="py-4 px-3 text-right font-mono font-black text-rose-700">
                      {cyc.remaining > 0 ? formatFCFA(cyc.remaining) : '0 FCFA'}
                    </td>
                    <td className="py-4 pr-6 px-3 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                          parseFloat(cyc.rate) >= 80
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}>
                          {cyc.rate}%
                        </span>
                        <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, parseFloat(cyc.rate))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/90 font-black text-slate-950 border-t-2 border-slate-300">
                <td className="py-3.5 pl-6 pr-3 font-heading uppercase text-xs">
                  TOTAL GÉNÉRAL (ANNUEL)
                </td>
                <td className="py-3.5 px-3 text-center font-mono">{stats.totalStudents}</td>
                <td className="py-3.5 px-3 text-center text-[11px]">
                  ♀ {stats.girlsCount} • ♂ {stats.boysCount}
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-sm">{formatFCFA(stats.totalExigible)}</td>
                <td className="py-3.5 px-3 text-right font-mono text-sm text-emerald-900">{formatFCFA(stats.totalCollected)}</td>
                <td className="py-3.5 px-3 text-right font-mono text-sm text-rose-800">{formatFCFA(stats.totalOverdue)}</td>
                <td className="py-3.5 pr-6 px-3 text-center text-sm text-emerald-900">{stats.rate}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 5. Suivi des 5 Tranches de Versements */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-600" />
              <span>Répartition des Encaissements par Tranche de Versement</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ventilation des montants perçus pour chaque échéance échelonnée de scolarité
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
            5 Échéances Annuelles
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {[
            { label: '1ère Échéance (Octobre)', amount: stats.v1Total },
            { label: '2ème Échéance (Novembre)', amount: stats.v2Total },
            { label: '3ème Échéance (Janvier)', amount: stats.v3Total },
            { label: '4ème Échéance (Mars)', amount: stats.v4Total },
            { label: '5ème Échéance (Mai / Solde)', amount: stats.v5Total },
          ].map((v, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl border bg-slate-50/90 border-emerald-300 shadow-xs space-y-1.5"
            >
              <span className="text-[11px] font-bold text-slate-800 block truncate">{v.label}</span>
              <span className="text-base sm:text-lg font-black font-mono text-slate-950 block">
                {formatFCFA(v.amount)}
              </span>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/70">
                <span>Part du total :</span>
                <span className="font-bold text-slate-800">
                  {stats.totalCollected > 0 ? ((v.amount / stats.totalCollected) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
