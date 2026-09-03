'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student, School } from '@/lib/data/types';
import { GenderBadge } from '@/components/ui/badge';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { availableClasses, mockStudents } from '@/lib/data/mock-data';
import { getLiveStudents, getLiveSchool, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import {
  BedDouble,
  Building2,
  Phone,
  PlusCircle,
  Search,
  Filter,
  ChevronDown,
  RotateCcw,
  Printer,
  Home,
  CheckCircle2,
  Calendar,
  X,
  MessageCircle,
  ReceiptText,
  Save,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Coins,
  Edit3,
  ShieldCheck,
  User,
  Share2,
  Check,
  CreditCard,
  BadgePercent,
  CheckCheck,
} from 'lucide-react';

interface BoardingViewProps {
  school: School;
  schoolSlug: string;
}

// 9 Mois de l'année scolaire (Octobre à Juin)
const MONTHS_LIST = [
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

const BOARDING_PAYMENTS_KEY = 'schoolflow_boarding_monthly_payments_v3';
const BOARDING_SUBSCRIPTIONS_KEY = 'schoolflow_boarding_subscriptions_v3';

export function BoardingView({
  school,
  schoolSlug,
}: BoardingViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPavilionFilter, setSelectedPavilionFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modale nouvelle admission
  const [isNewAdmissionModalOpen, setIsNewAdmissionModalOpen] = useState(false);
  const [newSubStudentId, setNewSubStudentId] = useState('');
  const [newSubPavilion, setNewSubPavilion] = useState('Pavillon A (Garçons)');
  const [newSubRoom, setNewSubRoom] = useState('');
  const [newSubRate, setNewSubRate] = useState('50000');
  const [newSubSearchQuery, setNewSubSearchQuery] = useState('');
  const [newSubGradeFilter, setNewSubGradeFilter] = useState('Toutes les classes');

  // Suivi des mois payés : studentId -> { [monthName]: boolean }
  const [monthlyPayments, setMonthlyPayments] = useState<Record<string, Record<string, boolean>>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(BOARDING_PAYMENTS_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // Souscriptions personnalisées
  const [customSubscriptions, setCustomSubscriptions] = useState<
    Array<{
      studentId: string;
      pavilion: string;
      roomNumber: string;
      monthlyRate: number;
    }>
  >(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(BOARDING_SUBSCRIPTIONS_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // Synchronisation avec les données globales
  useEffect(() => {
    const liveSchool = getLiveSchool(schoolSlug, school);
    setCurrentSchool(liveSchool);
    const liveStudents = getLiveStudents(mockStudents, schoolSlug);
    setStudents(liveStudents);

    const handleUpdate = () => {
      const updatedSchool = getLiveSchool(schoolSlug, school);
      setCurrentSchool(updatedSchool);
      const updatedStudents = getLiveStudents(mockStudents, schoolSlug);
      setStudents(updatedStudents);

      if (typeof window !== 'undefined') {
        try {
          const savedPayments = localStorage.getItem(BOARDING_PAYMENTS_KEY);
          if (savedPayments) setMonthlyPayments(JSON.parse(savedPayments));
          const savedSubs = localStorage.getItem(BOARDING_SUBSCRIPTIONS_KEY);
          if (savedSubs) setCustomSubscriptions(JSON.parse(savedSubs));
        } catch (e) {}
      }
    };

    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, school]);

  // Sauvegarde persistante des paiements
  const savePaymentsToStorage = (updatedPayments: Record<string, Record<string, boolean>>) => {
    setMonthlyPayments(updatedPayments);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(BOARDING_PAYMENTS_KEY, JSON.stringify(updatedPayments));
        window.dispatchEvent(new CustomEvent(DATA_UPDATED_EVENT, { detail: { action: 'boarding_payment_updated' } }));
      } catch (e) {}
    }
  };

  // Sauvegarde persistante des souscriptions
  const saveSubscriptionsToStorage = (
    updatedSubs: Array<{
      studentId: string;
      pavilion: string;
      roomNumber: string;
      monthlyRate: number;
    }>
  ) => {
    setCustomSubscriptions(updatedSubs);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(BOARDING_SUBSCRIPTIONS_KEY, JSON.stringify(updatedSubs));
        window.dispatchEvent(new CustomEvent(DATA_UPDATED_EVENT, { detail: { action: 'boarding_subscription_updated' } }));
      } catch (e) {}
    }
  };

  // Construction de la liste des pensionnaires
  const boarders = useMemo(() => {
    const customMap = new Map(customSubscriptions.map((cs) => [cs.studentId, cs]));

    return students.map((student, idx) => {
      const custom = customMap.get(student.id);
      const isBoarder = !!custom || idx % 4 === 0; // Démo par défaut si non customisé
      const pavilion = custom ? custom.pavilion : student.gender === 'F' ? 'Pavillon B (Filles)' : 'Pavillon A (Garçons)';
      const roomNumber = custom ? custom.roomNumber : `Chambre ${101 + (idx % 25)}`;
      const monthlyRate = custom ? custom.monthlyRate : 50000;

      const studentMonths = monthlyPayments[student.id] || {};
      const paidMonthsCount = MONTHS_LIST.filter((m) => studentMonths[m]).length;
      const totalPaid = paidMonthsCount * monthlyRate;
      const totalDue = monthlyRate * 9; // Strictement 9 mois
      const remainingBalance = Math.max(0, totalDue - totalPaid);

      return {
        student,
        isBoarder,
        pavilion,
        roomNumber,
        monthlyRate,
        paidMonthsCount,
        totalPaid,
        totalDue,
        remainingBalance,
        isUpToDate: remainingBalance === 0,
      };
    }).filter((b) => b.isBoarder);
  }, [students, customSubscriptions, monthlyPayments]);

  // Filtrage des pensionnaires pour la navigation
  const filteredBoarders = useMemo(() => {
    return boarders.filter((b) => {
      const matchSearch =
        searchQuery === '' ||
        `${b.student.firstName} ${b.student.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.student.studentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.student.className.toLowerCase().includes(searchQuery.toLowerCase());

      const matchPavilion =
        selectedPavilionFilter === 'all' ||
        (selectedPavilionFilter === 'garcons' && b.pavilion.includes('Garçons')) ||
        (selectedPavilionFilter === 'filles' && b.pavilion.includes('Filles'));

      return matchSearch && matchPavilion;
    });
  }, [boarders, searchQuery, selectedPavilionFilter]);

  // Index du pensionnaire actuellement actif dans le reçu
  const [activeBoarderIndex, setActiveBoarderIndex] = useState(0);

  // Pensionnaire actif
  const activeBoarder = useMemo(() => {
    if (filteredBoarders.length === 0) return boarders[0] || null;
    const safeIndex = Math.min(Math.max(0, activeBoarderIndex), filteredBoarders.length - 1);
    return filteredBoarders[safeIndex] || filteredBoarders[0];
  }, [filteredBoarders, activeBoarderIndex]);

  // États du formulaire interactif en direct
  const [formStudentName, setFormStudentName] = useState('');
  const [formMatricule, setFormMatricule] = useState('');
  const [formClassName, setFormClassName] = useState('');
  const [formGender, setFormGender] = useState<'M' | 'F'>('M');
  const [formPavilion, setFormPavilion] = useState('Pavillon A (Garçons)');
  const [formRoom, setFormRoom] = useState('');
  const [formParentContact, setFormParentContact] = useState('');
  const [formMonthlyRate, setFormMonthlyRate] = useState<number>(50000);
  const [formPaymentDate, setFormPaymentDate] = useState('03/09/2026');
  const [formPaymentMethod, setFormPaymentMethod] = useState('Espèces');
  const [formNotes, setFormNotes] = useState('');
  const [activeMonthsChecked, setActiveMonthsChecked] = useState<Record<string, boolean>>({});

  // Synchronisation du formulaire quand le pensionnaire actif change
  useEffect(() => {
    if (activeBoarder) {
      setFormStudentName(`${activeBoarder.student.firstName} ${activeBoarder.student.lastName}`.trim());
      setFormMatricule(activeBoarder.student.studentNumber);
      setFormClassName(activeBoarder.student.className);
      setFormGender(activeBoarder.student.gender);
      setFormPavilion(activeBoarder.pavilion);
      setFormRoom(activeBoarder.roomNumber);
      setFormParentContact(activeBoarder.student.guardianContact || '+225 07 00 00 00 00');
      setFormMonthlyRate(activeBoarder.monthlyRate || 50000);

      const months = monthlyPayments[activeBoarder.student.id] || {};
      setActiveMonthsChecked(months);
    }
  }, [activeBoarder, monthlyPayments]);

  // Calculs financiers réactifs (STRICTEMENT 9 MOIS)
  const activePaidMonthsCount = useMemo(() => {
    return MONTHS_LIST.filter((m) => activeMonthsChecked[m]).length;
  }, [activeMonthsChecked]);

  const activeTotalCollected = useMemo(() => {
    return activePaidMonthsCount * formMonthlyRate;
  }, [activePaidMonthsCount, formMonthlyRate]);

  const activeTotalAnnualExigible = useMemo(() => {
    return formMonthlyRate * 9; // 9 mois
  }, [formMonthlyRate]);

  const activeRemainingBalance = useMemo(() => {
    return Math.max(0, activeTotalAnnualExigible - activeTotalCollected);
  }, [activeTotalAnnualExigible, activeTotalCollected]);

  // Basculer un mois (cocher/décocher)
  const handleToggleMonth = (month: string) => {
    setActiveMonthsChecked((prev) => ({
      ...prev,
      [month]: !prev[month],
    }));
  };

  // Cocher tous les 9 mois
  const handleCheckAllMonths = () => {
    const allChecked: Record<string, boolean> = {};
    MONTHS_LIST.forEach((m) => {
      allChecked[m] = true;
    });
    setActiveMonthsChecked(allChecked);
  };

  // Décocher tous les mois
  const handleUncheckAllMonths = () => {
    setActiveMonthsChecked({});
  };

  // Enregistrement des modifications du reçu
  const handleSaveReceipt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeBoarder) return;

    // Sauvegarder les mois payés
    const updatedPayments = {
      ...monthlyPayments,
      [activeBoarder.student.id]: activeMonthsChecked,
    };
    savePaymentsToStorage(updatedPayments);

    // Sauvegarder les modifications du pensionnaire (chambre, pavillon, tarif)
    const existingIndex = customSubscriptions.findIndex((s) => s.studentId === activeBoarder.student.id);
    let updatedSubs = [...customSubscriptions];
    if (existingIndex >= 0) {
      updatedSubs[existingIndex] = {
        studentId: activeBoarder.student.id,
        pavilion: formPavilion,
        roomNumber: formRoom,
        monthlyRate: formMonthlyRate,
      };
    } else {
      updatedSubs.push({
        studentId: activeBoarder.student.id,
        pavilion: formPavilion,
        roomNumber: formRoom,
        monthlyRate: formMonthlyRate,
      });
    }
    saveSubscriptionsToStorage(updatedSubs);

    setToastMessage(`✓ Quittance d'internat enregistrée avec succès (${activePaidMonthsCount} / 9 mois réglés).`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Navigation Reçu Précédent / Suivant
  const handlePrevReceipt = () => {
    if (filteredBoarders.length === 0) return;
    setActiveBoarderIndex((prev) => (prev > 0 ? prev - 1 : filteredBoarders.length - 1));
  };

  const handleNextReceipt = () => {
    if (filteredBoarders.length === 0) return;
    setActiveBoarderIndex((prev) => (prev < filteredBoarders.length - 1 ? prev + 1 : 0));
  };

  // Impression A4
  const handlePrintReceipt = () => {
    window.print();
  };

  // Partage WhatsApp
  const handleShareWhatsApp = () => {
    if (!activeBoarder) return;
    const paidMonthsNames = MONTHS_LIST.filter((m) => activeMonthsChecked[m]).join(', ') || 'Aucun';
    const message = `*QUITTANCE DE PENSIONNAT & INTERNAT — ${currentSchool.shortName || currentSchool.name}*\n` +
      `--------------------------------------\n` +
      `👤 *Élève* : ${formStudentName} (${formMatricule})\n` +
      `🏫 *Classe* : ${formClassName}\n` +
      `🛏️ *Résidence* : ${formPavilion} — ${formRoom}\n` +
      `📅 *Date* : ${formPaymentDate}\n` +
      `💳 *Règlement* : ${formPaymentMethod}\n` +
      `--------------------------------------\n` +
      `✅ *Mois Réglés (sur 9)* : ${paidMonthsNames}\n` +
      `💰 *Total Versé* : ${formatFCFA(activeTotalCollected)}\n` +
      `⏳ *Solde Restant Annuel* : ${formatFCFA(activeRemainingBalance)}\n` +
      `--------------------------------------\n` +
      `_Document officiel certifié par l'Économe & l'Intendance de l'établissement._`;

    const cleanPhone = (formParentContact || '').replace(/[^0-9]/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Statistiques Globales KPI (Sur 9 Mois)
  const totalBoarders = boarders.length;
  const totalCollected = boarders.reduce((acc, b) => acc + b.totalPaid, 0);
  const totalExigible = boarders.reduce((acc, b) => acc + b.monthlyRate * 9, 0);
  const recoveryRate = totalExigible > 0 ? ((totalCollected / totalExigible) * 100).toFixed(1) : '0';
  const girlsCount = boarders.filter((b) => b.student.gender === 'F').length;
  const boysCount = boarders.filter((b) => b.student.gender === 'M').length;

  return (
    <div className="space-y-6 sm:space-y-7 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-500 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-white/70 hover:text-white ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1 : LES 3 CARTES STATISTIQUES KPI PANDHOWAN
          ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* KPI 1: Effectif Pensionnaires */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
              <BedDouble className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
                Pensionnaires Inscrits
              </h3>
              <p className="text-[11px] text-slate-400">Année scolaire 2026-2027 (9 mois)</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
              {totalBoarders}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Actifs
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-200/70 font-semibold text-[11px]">
              ♀ {girlsCount} Filles
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/70 font-semibold text-[11px]">
              ♂ {boysCount} Garçons
            </span>
          </div>
        </div>

        {/* KPI 2: Recouvrement Total (Sur 9 Mois) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
                Recouvrement Pensionnat
              </h3>
              <p className="text-[11px] text-slate-400">Cumul réel encaissé sur 9 mois</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading">
              {formatFCFA(totalCollected)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Taux de recouvrement :</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70">
              {recoveryRate}%
            </span>
          </div>
        </div>

        {/* KPI 3: Capacité & Occupation */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition-all sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
                Occupation des Dortoirs
              </h3>
              <p className="text-[11px] text-slate-400">Pavillons A (Garçons) & B (Filles)</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
              {totalBoarders} / 200
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
              Places
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Disponibles :</span>
            <span className="font-bold text-slate-900">{Math.max(0, 200 - totalBoarders)} lits</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          BANDEAU DE NAVIGATION & SÉLECTION RAPIDE DES REÇUS
          ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Recherche et Filtres */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un pensionnaire (Nom, Matricule, Chambre)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveBoarderIndex(0);
              }}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
            />
          </div>

          <div className="relative shrink-0">
            <select
              value={selectedPavilionFilter}
              onChange={(e) => {
                setSelectedPavilionFilter(e.target.value);
                setActiveBoarderIndex(0);
              }}
              className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="all">Tous les Pavillons</option>
              <option value="garcons">Pavillon A (Garçons)</option>
              <option value="filles">Pavillon B (Filles)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sélecteur direct de pensionnaire */}
          <div className="relative shrink-0 flex-1 sm:max-w-xs">
            <select
              value={activeBoarder?.student.id || ''}
              onChange={(e) => {
                const targetId = e.target.value;
                const idx = filteredBoarders.findIndex((b) => b.student.id === targetId);
                if (idx >= 0) setActiveBoarderIndex(idx);
              }}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer truncate"
            >
              {filteredBoarders.map((b, idx) => (
                <option key={b.student.id} value={b.student.id}>
                  {idx + 1}. {b.student.firstName} {b.student.lastName} ({b.student.className} • {b.roomNumber})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-emerald-700 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Boutons de Navigation Reçu Précédent / Suivant & Nouveau */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={handlePrevReceipt}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Quittance Précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-extrabold text-slate-700 px-2 font-heading">
              {filteredBoarders.length > 0 ? `${activeBoarderIndex + 1} / ${filteredBoarders.length}` : '0 / 0'}
            </span>
            <button
              type="button"
              onClick={handleNextReceipt}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Quittance Suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsNewAdmissionModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Nouvelle Admission</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2 : LE FORMULAIRE INTERACTIF & LE REÇU OFFICIEL (2 COLS)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLONNE GAUCHE : FORMULAIRE DE SAISIE ET ENREGISTREMENT */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-heading">
                  Coordonnées & Modalités d&apos;Internat
                </h3>
                <p className="text-[11px] text-slate-400">
                  Modifiez les données, cochez les mois et cliquez sur enregistrer
                </p>
              </div>
            </div>

            {/* Badge état paiement */}
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                activeRemainingBalance === 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {activeRemainingBalance === 0 ? '✓ Soldé (9/9 mois)' : `${activePaidMonthsCount}/9 Mois Réglés`}
            </span>
          </div>

          <form onSubmit={handleSaveReceipt} className="space-y-4">
            {/* 1. Coordonnées de l'élève */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Nom & Prénom de l&apos;Élève *</label>
                <input
                  type="text"
                  value={formStudentName}
                  onChange={(e) => setFormStudentName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Matricule</label>
                <input
                  type="text"
                  value={formMatricule}
                  onChange={(e) => setFormMatricule(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Classe</label>
                <input
                  type="text"
                  value={formClassName}
                  onChange={(e) => setFormClassName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Pavillon d&apos;Hébergement</label>
                <select
                  value={formPavilion}
                  onChange={(e) => setFormPavilion(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none"
                >
                  <option value="Pavillon A (Garçons)">Pavillon A (Garçons)</option>
                  <option value="Pavillon B (Filles)">Pavillon B (Filles)</option>
                  <option value="Pavillon Junior">Pavillon Junior (Maternelle/Primaire)</option>
                  <option value="Pavillon Honneur">Pavillon Honneur (Collège 3ème)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">N° de Chambre / Lit</label>
                <input
                  type="text"
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                  placeholder="Ex: Chambre 104"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Contact WhatsApp du Tuteur / Parent</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formParentContact}
                    onChange={(e) => setFormParentContact(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 2. Paramètres Financiers & Modalités */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                <span>Modalités de Règlement (FCFA)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Frais Mensuels (FCFA) *</label>
                  <input
                    type="number"
                    value={formMonthlyRate}
                    onChange={(e) => setFormMonthlyRate(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 font-extrabold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Date du Versement *</label>
                  <FrenchDateInput
                    value={formPaymentDate}
                    onChange={setFormPaymentDate}
                    className="w-full text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Mode de Règlement</label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none"
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Wave">Wave</option>
                    <option value="Orange Money">Orange Money</option>
                    <option value="MTN Money">MTN Money</option>
                    <option value="Moov Money">Moov Money</option>
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Chèque">Chèque</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Grille des 9 Mois Scolaires (Octobre à Juin) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Suivi des 9 Mois Scolaires (Octobre à Juin) :</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCheckAllMonths}
                    className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Tout Cocher
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleUncheckAllMonths}
                    className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Décocher
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
                {MONTHS_LIST.map((month, idx) => {
                  const isChecked = !!activeMonthsChecked[month];
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => handleToggleMonth(month)}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="text-xs truncate">{month}</span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                          isChecked ? 'bg-emerald-600 text-white' : 'border border-slate-300'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Boutons d'Action & Sauvegarde */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer & Actualiser la Quittance</span>
              </button>
            </div>
          </form>
        </div>

        {/* COLONNE DROITE : REÇU OFFICIEL D'INTERNAT EN DIRECT */}
        <div className="lg:col-span-6 bg-white rounded-2xl border-2 border-emerald-600/30 p-5 sm:p-6 shadow-md space-y-4 relative print:border-none print:shadow-none print:p-0">
          {/* Boutons Actions Rapides Reçu (Impression / WhatsApp) */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 print:hidden flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider font-heading">
                Aperçu Direct du Reçu Officiel
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer A4</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer shadow-2xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>

          {/* DOCUMENT OFFICIEL DU REÇU IMPRIMABLE */}
          <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 space-y-4 print:border-none print:p-0">
            {/* 1. En-tête Officiel et Strict */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b-2 border-slate-800">
              {/* Logo Gauche */}
              <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                {currentSchool.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentSchool.logoUrl}
                    alt={currentSchool.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl border border-emerald-300 bg-emerald-50 flex flex-col items-center justify-center text-center p-1">
                    <Building2 className="w-5 h-5 text-emerald-600 mb-0.5" />
                    <span className="text-[7px] font-black text-emerald-800 uppercase leading-none">
                      {currentSchool.shortName || 'LOGO'}
                    </span>
                  </div>
                )}
              </div>

              {/* Centre : Hiérarchie stricte demandée */}
              <div className="text-center flex-1 space-y-0.5 min-w-0">
                <h1 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-tight font-heading truncate">
                  {currentSchool.name || 'ÉTABLISSEMENT SCOLAIRE EPC MANOI'}
                </h1>
                <p className="text-[11px] font-extrabold text-emerald-700">
                  {currentSchool.shortName || 'EPC MANOI'}
                </p>
                <p className="text-[9.5px] italic text-slate-600">
                  « {currentSchool.motto || 'Discipline • Rigueur • Réussite'} »
                </p>
                <p className="text-[9px] font-semibold text-slate-500">
                  {currentSchool.slogan || 'L’Excellence au service de l’Éducation'}
                </p>
                <p className="text-[8.5px] text-slate-400 font-mono">
                  Code Établissement : {currentSchool.ministryCode || '321119'} • Tél : {currentSchool.phone || '+225 01 02 03 04 05'}
                </p>
              </div>

              {/* Emblème Droit */}
              <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                {currentSchool.countryEmblemUrl && currentSchool.countryEmblemUrl.startsWith('data:image') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentSchool.countryEmblemUrl}
                    alt="Armoiries Nationales"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl border border-amber-300 bg-amber-50 flex flex-col items-center justify-center text-center p-1">
                    <Building2 className="w-5 h-5 text-amber-600 mb-0.5" />
                    <span className="text-[7px] font-black text-amber-900 uppercase leading-none">
                      ARMOIRIES
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Titre & Référence de Quittance */}
            <div className="bg-slate-900 text-white p-2.5 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold block">
                  Document Officiel d&apos;Encaissement
                </span>
                <span className="font-extrabold font-heading text-xs sm:text-sm">
                  QUITTANCE DE PAIEMENT D&apos;INTERNAT & PENSIONNAT
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-400 block font-mono">
                  RÉF : QUI-INT-2026-{(activeBoarderIndex + 1).toString().padStart(4, '0')}
                </span>
                <span className="font-bold text-amber-400 text-xs">
                  {formPaymentDate}
                </span>
              </div>
            </div>

            {/* 3. Détails du Pensionnaire */}
            <div className="grid grid-cols-2 gap-2 text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
              <div>
                <span className="text-[10px] text-slate-400 block">Nom & Prénom de l&apos;Élève :</span>
                <span className="font-bold text-slate-900">{formStudentName || 'Non renseigné'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Matricule & Classe :</span>
                <span className="font-bold text-slate-900">{formMatricule} • {formClassName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Pavillon & Chambre :</span>
                <span className="font-bold text-emerald-800">{formPavilion} — {formRoom || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Tuteur / Contact WhatsApp :</span>
                <span className="font-mono text-slate-800">{formParentContact}</span>
              </div>
            </div>

            {/* 4. Tableau du Décompte Financier (9 Mois) */}
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-1.5 px-3">Désignation</th>
                    <th className="py-1.5 px-3 text-center">Mois Réglés (sur 9)</th>
                    <th className="py-1.5 px-3 text-right">Montant Encaissé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr>
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-900">Pension d&apos;Internat Annuelle</div>
                      <div className="text-[10px] text-slate-400">
                        Tarif : {formatFCFA(formMonthlyRate)} / mois • Mode : {formPaymentMethod}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-xs">
                        {activePaidMonthsCount} / 9 mois
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-extrabold text-slate-900 font-heading text-sm">
                      {formatFCFA(activeTotalCollected)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-xs">
                  <tr>
                    <td colSpan={2} className="py-2 px-3 text-slate-600">
                      Reste Annuel à Solder (sur les 9 mois) :
                    </td>
                    <td className="py-2 px-3 text-right text-rose-600 font-extrabold font-heading">
                      {formatFCFA(activeRemainingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 5. Liste des mois réglés */}
            <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200 text-[11px] text-emerald-950">
              <span className="font-bold block mb-1">Mois d&apos;internat validés par cette quittance :</span>
              <div className="flex flex-wrap gap-1">
                {MONTHS_LIST.map((m) => (
                  <span
                    key={m}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      activeMonthsChecked[m]
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-400 border-slate-200 line-through'
                    }`}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* 6. Signatures et Cachet */}
            <div className="pt-3 grid grid-cols-2 gap-4 text-center text-[10px] border-t border-slate-200">
              <div className="space-y-8">
                <span className="font-bold text-slate-600 block">Signature du Parent / Déposant</span>
                <span className="text-slate-400 italic">« Lu et approuvé »</span>
              </div>
              <div className="space-y-8">
                <span className="font-bold text-slate-900 block">
                  L&apos;Intendance & Économe de l&apos;Établissement
                </span>
                <div className="text-slate-400 italic flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cachet & Signature Électronique</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODALE NOUVELLE ADMISSION D'INTERNAT
          ═══════════════════════════════════════════════════════════════ */}
      {isNewAdmissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <BedDouble className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-heading">
                    Nouvelle Admission à l&apos;Internat
                  </h3>
                  <p className="text-xs text-slate-400">Affectation d&apos;une chambre et ouverture de quittance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewAdmissionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Sélectionner l&apos;Élève *</label>
                <select
                  value={newSubStudentId}
                  onChange={(e) => setNewSubStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:outline-none"
                >
                  <option value="">-- Choisir un élève de l&apos;établissement --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.studentNumber} • {s.className})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Pavillon *</label>
                  <select
                    value={newSubPavilion}
                    onChange={(e) => setNewSubPavilion(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:outline-none"
                  >
                    <option value="Pavillon A (Garçons)">Pavillon A (Garçons)</option>
                    <option value="Pavillon B (Filles)">Pavillon B (Filles)</option>
                    <option value="Pavillon Junior">Pavillon Junior</option>
                    <option value="Pavillon Honneur">Pavillon Honneur</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Numéro de Chambre *</label>
                  <input
                    type="text"
                    value={newSubRoom}
                    onChange={(e) => setNewSubRoom(e.target.value)}
                    placeholder="Ex: Chambre 105"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Frais Mensuels d&apos;Internat (FCFA) *</label>
                <input
                  type="number"
                  value={newSubRate}
                  onChange={(e) => setNewSubRate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-extrabold"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsNewAdmissionModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newSubStudentId) {
                    alert('Veuillez sélectionner un élève.');
                    return;
                  }
                  const updated = [
                    ...customSubscriptions,
                    {
                      studentId: newSubStudentId,
                      pavilion: newSubPavilion,
                      roomNumber: newSubRoom || 'Chambre 101',
                      monthlyRate: Number(newSubRate) || 50000,
                    },
                  ];
                  saveSubscriptionsToStorage(updated);
                  setIsNewAdmissionModalOpen(false);
                  setToastMessage('✓ Nouvel élève admis à l’internat avec succès.');
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer"
              >
                Valider l&apos;Admission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
