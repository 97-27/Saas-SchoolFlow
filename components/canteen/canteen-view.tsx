'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student, School } from '@/lib/data/types';
import { GenderBadge } from '@/components/ui/badge';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { availableClasses, mockStudents } from '@/lib/data/mock-data';
import { getLiveStudents, getLiveSchool, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import {
  UtensilsCrossed,
  Download,
  PlusCircle,
  Search,
  Filter,
  ChevronDown,
  RotateCcw,
  Printer,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  Apple,
  Save,
  Check,
  Sparkles,
  ReceiptText,
  Edit3,
  Send,
  Share2,
} from 'lucide-react';

interface CanteenViewProps {
  initialSubscriptions?: any[];
  school: School;
  schoolSlug: string;
}

const MONTHS_LIST = [
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

const CANTEEN_PAYMENTS_KEY = 'schoolflow_canteen_monthly_payments_v3';
const CANTEEN_SUBSCRIPTIONS_KEY = 'schoolflow_canteen_subscriptions_v3';
const CANTEEN_MENU_KEY = 'schoolflow_canteen_weekly_menu_v2';

const DEFAULT_WEEKLY_MENU = [
  {
    day: 'Lundi',
    title: 'Riz Blanc au Gras & Poulet Braisé Croustillant',
    description: "Riz blanc au gras traditionnel accompagné de poulet fermier braisé croustillant, sauce graine onctueuse à la feuille d'épinard et banane douce en dessert.",
    badge: 'Plat du jour',
  },
  {
    day: 'Mardi',
    title: 'Attiéké Royal & Thon Frit (Garba Doux aux Légumes)',
    description: 'Attiéké de qualité supérieure servi avec pavé de thon frit assaisonné, dés de tomates fraîches, concombres, oignons caramélisés et piments doux non piquants.',
    badge: 'Spécialité Ivoirienne',
  },
  {
    day: 'Mercredi',
    title: "Ragoût d'Igname Traditionnel au Bœuf Tendre",
    description: "Morceaux d'igname fondants mijotés avec viande de bœuf tendre, carottes, haricots verts et sauce tomate douce parfumée aux herbes locales.",
    badge: 'Plat Mijoté',
  },
  {
    day: 'Jeudi',
    title: 'Tchep Rouge Sénégalais au Poisson Carpe',
    description: 'Riz rouge parfumé aux légumes du jardin (choux, manioc, carottes), poisson carpe frais braisé et jus de bissap naturel pasteurisé.',
    badge: 'Cuisine Ouest-Africaine',
  },
  {
    day: 'Vendredi',
    title: 'Alloco Doré & Foutou Banane Sauce Claire au Poulet',
    description: 'Bananes plantains frites dorées (Alloco) ou Foutou banane pilé avec sauce claire au poulet fermier, suivi d’une salade de fruits frais (mangue, ananas, papaye).',
    badge: 'Festin de Clôture',
  },
];

export function CanteenView({
  school,
  schoolSlug,
}: CanteenViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('Toutes les classes');
  const [selectedDiet, setSelectedDiet] = useState('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modales
  const [selectedStudentForMonths, setSelectedStudentForMonths] = useState<any | null>(null);
  const [selectedStudentForReceipt, setSelectedStudentForReceipt] = useState<any | null>(null);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isNewSubModalOpen, setIsNewSubModalOpen] = useState(false);

  // État du menu de la semaine modifiable
  const [weeklyMenu, setWeeklyMenu] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CANTEEN_MENU_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_WEEKLY_MENU;
  });

  // Formulaire nouvelle souscription (complètement vide par défaut)
  const [newSubStudentId, setNewSubStudentId] = useState('');
  const [newSubDiet, setNewSubDiet] = useState('Standard (Sans allergie)');
  const [newSubRate, setNewSubRate] = useState('25000');
  const [newSubSearchQuery, setNewSubSearchQuery] = useState('');
  const [newSubGradeFilter, setNewSubGradeFilter] = useState('Toutes les classes');

  // Suivi des mois payés : studentId -> { [monthName]: boolean }
  const [monthlyPayments, setMonthlyPayments] = useState<Record<string, Record<string, boolean>>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CANTEEN_PAYMENTS_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // Souscriptions personnalisées et tarifs par élève
  const [customDietMap, setCustomDietMap] = useState<Record<string, { diet: string; rate: number }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CANTEEN_SUBSCRIPTIONS_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // Synchronisation des élèves (chargement de tous les élèves de l'école)
  useEffect(() => {
    setStudents(getLiveStudents(mockStudents));
    setCurrentSchool(getLiveSchool(schoolSlug, school));

    const handleUpdate = () => {
      setStudents(getLiveStudents(mockStudents));
      setCurrentSchool(getLiveSchool(schoolSlug, school));
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, school]);

  // Filtrage des élèves pour la modale de souscription
  const filteredStudentsForNewSub = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        !newSubSearchQuery ||
        s.fullName?.toLowerCase().includes(newSubSearchQuery.toLowerCase()) ||
        s.studentNumber?.toLowerCase().includes(newSubSearchQuery.toLowerCase()) ||
        s.matricule?.toLowerCase().includes(newSubSearchQuery.toLowerCase());
      const matchGrade =
        newSubGradeFilter === 'Toutes les classes' || s.grade === newSubGradeFilter;
      return matchSearch && matchGrade;
    });
  }, [students, newSubSearchQuery, newSubGradeFilter]);

  // Déterminer l'élève sélectionné dans le formulaire nouvelle souscription pour affichage automatique
  const selectedStudentInNewSub = useMemo(() => {
    return students.find((s) => s.id === newSubStudentId) || null;
  }, [students, newSubStudentId]);

  // Liste des abonnés cantine adaptée aux données réelles
  const subscribers = useMemo(() => {
    return students
      .filter((stu, idx) => {
        // Est abonné si présent dans customDietMap OU par défaut 3 sur 4 élèves
        return customDietMap[stu.id] || idx % 4 !== 3;
      })
      .map((stu, idx) => {
        const custom = customDietMap[stu.id];
        let defaultDiet = 'Standard (Sans restriction)';
        if (idx === 2) defaultDiet = 'Allergie aux arachides';
        else if (idx === 7) defaultDiet = 'Intolérance au lactose';
        else if (idx === 14) defaultDiet = 'Régime sans gluten';
        else if (idx === 21) defaultDiet = 'Régime végétarien';

        const monthlyRate = custom?.rate || 25000;
        const diet = custom?.diet || defaultDiet;

        // Mois payés par défaut si non enregistrés
        const monthsState = monthlyPayments[stu.id] || {
          Septembre: true,
          Octobre: true,
          Novembre: idx % 3 !== 0,
          Décembre: idx % 2 === 0,
          Janvier: false,
          Février: false,
          Mars: false,
          Avril: false,
          Mai: false,
          Juin: false,
        };

        const paidMonths = Object.keys(monthsState).filter((m) => monthsState[m]);
        const paidMonthsCount = paidMonths.length;
        const totalPaidAmount = paidMonthsCount * monthlyRate;

        return {
          ...stu,
          dietaryRestrictions: diet,
          monthlyRate,
          monthsState,
          paidMonths,
          paidMonthsCount,
          totalPaidAmount,
        };
      });
  }, [students, customDietMap, monthlyPayments]);

  // Filtrage
  const filteredSubscribers = useMemo(() => {
    return subscribers.filter((sub) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        sub.fullName.toLowerCase().includes(q) ||
        sub.matricule.toLowerCase().includes(q) ||
        sub.studentNumber.toLowerCase().includes(q) ||
        sub.dietaryRestrictions.toLowerCase().includes(q);

      const matchesClass =
        selectedClass === 'Toutes les classes' ||
        sub.grade.toLowerCase() === selectedClass.toLowerCase();

      const matchesDiet =
        selectedDiet === 'all' ||
        (selectedDiet === 'standard' && sub.dietaryRestrictions.toLowerCase().includes('standard')) ||
        (selectedDiet === 'specific' && !sub.dietaryRestrictions.toLowerCase().includes('standard'));

      return matchesSearch && matchesClass && matchesDiet;
    });
  }, [subscribers, searchQuery, selectedClass, selectedDiet]);

  // Statistiques globales Cantine (3 Blocs KPI)
  const stats = useMemo(() => {
    const totalSubscribers = subscribers.length;
    const girls = subscribers.filter((s) => s.gender === 'female').length;
    const boys = subscribers.filter((s) => s.gender === 'male').length;
    const specificDietCount = subscribers.filter(
      (s) => !s.dietaryRestrictions.toLowerCase().includes('standard')
    ).length;

    const totalCollected = subscribers.reduce((acc, s) => acc + s.totalPaidAmount, 0);
    const totalExigible = subscribers.reduce((acc, s) => acc + s.monthlyRate * 10, 0);
    const recoveryRate = totalExigible > 0 ? ((totalCollected / totalExigible) * 100).toFixed(1) : '0';

    return {
      totalSubscribers,
      girls,
      boys,
      specificDietCount,
      totalCollected,
      totalExigible,
      recoveryRate,
    };
  }, [subscribers]);

  // Modification directe et immédiate du tarif mensuel dans le tableau
  const handleQuickUpdateRate = (stuId: string, newRateStr: string) => {
    const newRate = parseInt(newRateStr, 10) || 0;
    const current = subscribers.find((s) => s.id === stuId);
    if (!current) return;

    const nextMap = {
      ...customDietMap,
      [stuId]: {
        diet: current.dietaryRestrictions,
        rate: newRate,
      },
    };

    setCustomDietMap(nextMap);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CANTEEN_SUBSCRIPTIONS_KEY, JSON.stringify(nextMap));
      } catch (e) {}
    }
  };

  // Basculer le statut d'un mois pour l'élève sélectionné
  const toggleMonthStatus = (month: string) => {
    if (!selectedStudentForMonths) return;

    setSelectedStudentForMonths((prev: any) => {
      if (!prev) return null;
      const currentMonths = prev.monthsState || {};
      const nextMonths = {
        ...currentMonths,
        [month]: !currentMonths[month],
      };
      const paidMonths = Object.keys(nextMonths).filter((m) => nextMonths[m]);
      return {
        ...prev,
        monthsState: nextMonths,
        paidMonths,
        paidMonthsCount: paidMonths.length,
        totalPaidAmount: paidMonths.length * prev.monthlyRate,
      };
    });
  };

  // Enregistrer le suivi des mois et tarif mensuel modifié
  const handleSaveMonthlyPayments = () => {
    if (!selectedStudentForMonths) return;
    const stuId = selectedStudentForMonths.id;
    const newPayments = {
      ...monthlyPayments,
      [stuId]: selectedStudentForMonths.monthsState,
    };

    const newDietMap = {
      ...customDietMap,
      [stuId]: {
        diet: selectedStudentForMonths.dietaryRestrictions,
        rate: selectedStudentForMonths.monthlyRate,
      },
    };

    setMonthlyPayments(newPayments);
    setCustomDietMap(newDietMap);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CANTEEN_PAYMENTS_KEY, JSON.stringify(newPayments));
        localStorage.setItem(CANTEEN_SUBSCRIPTIONS_KEY, JSON.stringify(newDietMap));
      } catch (e) {}
    }

    setToastMessage(`✓ Cotisations et tarif mis à jour pour ${selectedStudentForMonths.fullName} !`);
    setTimeout(() => setToastMessage(null), 5000);
    setSelectedStudentForMonths(null);
  };

  // Enregistrer le menu de la semaine modifié
  const handleSaveWeeklyMenu = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CANTEEN_MENU_KEY, JSON.stringify(weeklyMenu));
      } catch (e) {}
    }
    setToastMessage('✓ Menu de la semaine enregistré et mis à jour avec succès !');
    setTimeout(() => setToastMessage(null), 5000);
    setIsMenuModalOpen(false);
  };

  // Enregistrer une nouvelle souscription cantine
  const handleCreateSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubStudentId) {
      alert('Veuillez sélectionner un élève.');
      return;
    }

    const rate = parseInt(newSubRate, 10) || 25000;
    const nextDietMap = {
      ...customDietMap,
      [newSubStudentId]: {
        diet: newSubDiet,
        rate,
      },
    };

    setCustomDietMap(nextDietMap);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CANTEEN_SUBSCRIPTIONS_KEY, JSON.stringify(nextDietMap));
      } catch (e) {}
    }

    const stu = students.find((s) => s.id === newSubStudentId);
    setToastMessage(`✓ Nouvel abonnement cantine validé pour ${stu ? stu.fullName : 'l’élève'} !`);
    setTimeout(() => setToastMessage(null), 5000);
    setIsNewSubModalOpen(false);
    setNewSubStudentId('');
  };

  // Envoi WhatsApp direct du reçu cantine
  const handleSendReceiptWhatsApp = (sub: any) => {
    const parentPhone = (sub.whatsappPhone || sub.guardianPhone || '').replace(/[^0-9]/g, '');
    const receiptNum = `QUITTANCE-CANT-${sub.matricule || '001'}-${Date.now().toString().slice(-4)}`;
    const monthsText = sub.paidMonths && sub.paidMonths.length > 0 ? sub.paidMonths.join(', ') : 'Aucun mois pour le moment';

    const message = `*REÇU OFFICIEL DE CANTINE SCOLAIRE — ${currentSchool.name.toUpperCase()}*\n\n` +
      `Bonjour Chers Parents de *${sub.fullName}* (${sub.grade}),\n\n` +
      `Nous vous confirmons la bonne réception du règlement de la restauration scolaire (Cantine & Demi-pension) :\n\n` +
      `📄 *Réf Reçu :* ${receiptNum}\n` +
      `👤 *Élève :* ${sub.fullName} (Matricule : ${sub.matricule || sub.studentNumber})\n` +
      `🏫 *Classe :* ${sub.grade}\n` +
      `📅 *Mois Réglés :* ${monthsText} (${sub.paidMonthsCount}/10 mois)\n` +
      `💰 *Tarif Mensuel :* ${formatFCFA(sub.monthlyRate)}\n` +
      `💵 *Total Encaissé :* ${formatFCFA(sub.totalPaidAmount)}\n` +
      `🥗 *Régime / Allergies :* ${sub.dietaryRestrictions}\n` +
      `🗓️ *Date d'émission :* ${formatDate(new Date().toISOString())}\n\n` +
      `Merci pour votre confiance. — _La Direction & Service Restauration ${currentSchool.shortName || 'EPC'}_`;

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${parentPhone}?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Export Excel CSV
  const handleExportExcel = () => {
    const header = [
      'ID Élève',
      'Matricule',
      'Nom',
      'Prénoms',
      'Classe',
      'Genre',
      'Régime / Allergies',
      'Tarif Mensuel (FCFA)',
      'Mois Réglés',
      'Total Payé (FCFA)',
      'Contact WhatsApp Tuteur',
    ].join(';');

    const rows = filteredSubscribers.map((sub) => [
      sub.studentNumber,
      sub.matricule,
      sub.lastName,
      sub.firstName,
      sub.grade,
      sub.gender === 'female' ? 'Féminin' : 'Masculin',
      sub.dietaryRestrictions,
      sub.monthlyRate,
      `${sub.paidMonthsCount} / 10 mois`,
      sub.totalPaidAmount,
      sub.whatsappPhone || sub.guardianPhone,
    ].join(';'));

    const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SchoolFlow_Cantine_Scolaire_${school.shortName || 'EPC'}_2026-2027.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMessage(`✓ Liste des abonnés cantine exportée avec succès (${filteredSubscribers.length} élèves) !`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Cantine Scolaire & Demi-Pension
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Suivi des paiements mensuels, reçus WhatsApp, menus modifiables et régimes alimentaires — {currentSchool.name}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsMenuModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <UtensilsCrossed className="w-4 h-4 text-amber-600" />
            <span>Menu de la Semaine</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter Excel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewSubStudentId('');
              setNewSubDiet('Standard (Sans allergie)');
              setNewSubRate('25000');
              setIsNewSubModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouvelle souscription</span>
          </button>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="text-emerald-700 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* 2. LES 3 CARTES KPI CANTINE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 print:hidden">
        {/* Card 1 : Total Inscrits Cantine */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                <UtensilsCrossed className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Total Inscrits Cantine
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap">
                {stats.totalSubscribers} élèves
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                sur {students.length}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-200 font-semibold text-[11px]">
                ♀ {stats.girls} Filles
              </span>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[11px]">
                ♂ {stats.boys} Garçons
              </span>
            </div>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Taux de demi-pension</span>
            <span className="font-semibold text-slate-800">
              {students.length > 0 ? ((stats.totalSubscribers / students.length) * 100).toFixed(0) : 0}% de l&apos;école
            </span>
          </div>
        </div>

        {/* Card 2 : Recouvrement Cantine */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 shadow-xs">
                <Apple className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Recouvrement Cotisations
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap text-teal-900">
                {formatFCFA(stats.totalCollected)}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Cotisations mensuelles perçues à ce jour
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-teal-700 font-medium flex items-center justify-between">
            <span>Taux de recouvrement</span>
            <span className="font-bold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              {stats.recoveryRate}% perçu
            </span>
          </div>
        </div>

        {/* Card 3 : Régimes & Allergies */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between bg-rose-50/15">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 shadow-xs">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-rose-900 font-sans truncate">
                Régimes & Fiches Médicales
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-rose-900 tracking-tight font-heading whitespace-nowrap">
                {stats.specificDietCount} fiches
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Allergies arachides, lactose, sans gluten & régimes
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-rose-700 font-medium flex items-center justify-between">
            <span>Transmission cuisine</span>
            <span className="font-bold">✓ Conforme MENA</span>
          </div>
        </div>
      </div>

      {/* 3. Table des Inscrits Cantine */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-3.5 sm:p-4 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher élève, matricule, régime..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="relative flex-1 sm:flex-none min-w-[150px]">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 cursor-pointer"
            >
              <option value="Toutes les classes">Toutes les classes</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative flex-1 sm:flex-none min-w-[150px]">
            <select
              value={selectedDiet}
              onChange={(e) => setSelectedDiet(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 cursor-pointer"
            >
              <option value="all">Tous régimes</option>
              <option value="standard">Standard uniquement</option>
              <option value="specific">Régimes / Allergies</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {(searchQuery || selectedClass !== 'Toutes les classes' || selectedDiet !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedClass('Toutes les classes');
                setSelectedDiet('all');
              }}
              className="p-2 text-xs text-slate-500 hover:text-slate-800 rounded-xl inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Effacer</span>
            </button>
          )}
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 pl-5 pr-3 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3 whitespace-nowrap">ID Élève</th>
                <th className="py-3.5 px-3 whitespace-nowrap min-w-[180px]">Matricule & Élève</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Classe</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Régime & Allergies</th>
                <th className="py-3.5 px-3 whitespace-nowrap text-right">Tarif Mensuel</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Contact WhatsApp Tuteur</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Suivi des Mois</th>
                <th className="py-3.5 pr-5 pl-3 text-right whitespace-nowrap">Reçu WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Aucun élève inscrit à la cantine trouvé.
                  </td>
                </tr>
              ) : (
                filteredSubscribers.map((sub) => {
                  const hasAllergy = !sub.dietaryRestrictions.toLowerCase().includes('standard');

                  return (
                    <tr key={sub.id} className="hover:bg-emerald-50/20 transition-colors">
                      <td className="py-3.5 pl-5 pr-3">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 text-[11px] whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {sub.studentNumber}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div>
                            <span className="font-extrabold text-slate-950 uppercase block font-heading">
                              {sub.fullName}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {sub.matricule}
                            </span>
                          </div>
                          <GenderBadge gender={sub.gender} />
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap shadow-2xs">
                          {sub.grade}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {hasAllergy ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3" />
                            {sub.dietaryRestrictions}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">
                            {sub.dietaryRestrictions}
                          </span>
                        )}
                      </td>

                      {/* Tarif Mensuel Directement Modifiable */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <input
                            type="number"
                            defaultValue={sub.monthlyRate}
                            onBlur={(e) => handleQuickUpdateRate(sub.id, e.target.value)}
                            className="w-24 px-2 py-1 text-right font-mono font-bold text-slate-900 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                            title="Cliquez pour modifier directement le tarif mensuel"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">F</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <a
                          href={`https://wa.me/${(sub.whatsappPhone || sub.guardianPhone || '').replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-semibold transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{sub.whatsappPhone || sub.guardianPhone}</span>
                        </a>
                      </td>

                      {/* ACTION 1 : SUIVI DES MOIS */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForMonths(sub)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-900 bg-white border border-slate-300 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-300 transition-all cursor-pointer shadow-2xs"
                        >
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Mois ({sub.paidMonthsCount}/10)</span>
                        </button>
                      </td>

                      {/* ACTION 2 : REÇU WHATSAPP CANTINE */}
                      <td className="py-3.5 pr-5 pl-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForReceipt(sub)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
                        >
                          <ReceiptText className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Reçu Cantine</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Total affiché : <strong className="text-slate-900 font-bold">{filteredSubscribers.length}</strong> élèves inscrits à la cantine
          </span>
          <span className="text-[11px] text-slate-400">
            Cliquez sur « Reçu Cantine » pour transmettre la quittance officielle par WhatsApp
          </span>
        </div>
      </div>

      {/* ================= MODALE 1 : SUIVI DES COTISATIONS & TARIF PAR ÉLÈVE ================= */}
      {selectedStudentForMonths && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-base uppercase">
                  {selectedStudentForMonths.firstName[0]}{selectedStudentForMonths.lastName[0]}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 font-heading uppercase">
                    {selectedStudentForMonths.fullName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedStudentForMonths.studentNumber} • {selectedStudentForMonths.matricule} • {selectedStudentForMonths.grade}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForMonths(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ajustement Tarif Mensuel & Régime */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Tarif Mensuel en FCFA (Modifiable)</label>
                <input
                  type="number"
                  value={selectedStudentForMonths.monthlyRate}
                  onChange={(e) => {
                    const newRate = parseInt(e.target.value, 10) || 0;
                    setSelectedStudentForMonths((prev: any) => ({
                      ...prev,
                      monthlyRate: newRate,
                      totalPaidAmount: prev.paidMonthsCount * newRate,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Régime / Allergies</label>
                <input
                  type="text"
                  value={selectedStudentForMonths.dietaryRestrictions}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedStudentForMonths((prev: any) => ({
                      ...prev,
                      dietaryRestrictions: val,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900"
                />
              </div>
            </div>

            {/* Total réglé calculé */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Mois Validés</span>
                <strong className="text-slate-900 font-heading text-sm">{selectedStudentForMonths.paidMonthsCount} sur 10 mois</strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Cotisations Réglées</span>
                <strong className="text-emerald-800 font-heading text-base">{formatFCFA(selectedStudentForMonths.totalPaidAmount)}</strong>
              </div>
            </div>

            {/* Grille des Mois Scolaires (Septembre à Juin) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Pointage des Mois de Cantine (Cliquer pour basculer) :
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {MONTHS_LIST.map((month) => {
                  const isPaid = !!selectedStudentForMonths.monthsState?.[month];

                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => toggleMonthStatus(month)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-2xs font-bold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-xs">{month}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isPaid
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isPaid ? 'Payé ✓' : 'Non payé'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedStudentForMonths(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleSaveMonthlyPayments}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les Cotisations & Tarif</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 2 : REÇU OFFICIEL DE CANTINE & ENVOI WHATSAPP ================= */}
      {selectedStudentForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <ReceiptText className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 font-heading">
                    Reçu de Restauration Scolaire
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Quittance Officielle • {currentSchool.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForReceipt(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corps du Reçu */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Élève Bénéficiaire</span>
                <strong className="text-slate-900 uppercase font-heading">{selectedStudentForReceipt.fullName}</strong>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Matricule & Classe</span>
                <span className="font-mono font-bold text-slate-800">
                  {selectedStudentForReceipt.matricule || selectedStudentForReceipt.studentNumber} • {selectedStudentForReceipt.grade}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Mois de Cantine Réglés</span>
                <span className="font-bold text-emerald-900 text-right max-w-[240px]">
                  {selectedStudentForReceipt.paidMonths && selectedStudentForReceipt.paidMonths.length > 0
                    ? selectedStudentForReceipt.paidMonths.join(', ')
                    : 'Aucun mois validé'}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Tarif Mensuel Unitaire</span>
                <span className="font-mono font-bold text-slate-800">{formatFCFA(selectedStudentForReceipt.monthlyRate)} / mois</span>
              </div>

              <div className="flex justify-between items-center pt-1 text-sm font-extrabold text-slate-950">
                <span>TOTAL COTISATIONS PERÇUES</span>
                <span className="text-emerald-800 font-mono text-base">{formatFCFA(selectedStudentForReceipt.totalPaidAmount)}</span>
              </div>

              <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-200">
                <span>Contact WhatsApp Parent :</span>
                <strong className="text-emerald-800 font-mono">{selectedStudentForReceipt.whatsappPhone || selectedStudentForReceipt.guardianPhone}</strong>
              </div>
            </div>

            {/* Actions Reçu */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Imprimer</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendReceiptWhatsApp(selectedStudentForReceipt)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Envoyer le Reçu par WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 3 : MENU DE LA SEMAINE ENTIÈREMENT MODIFIABLE ================= */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-950 font-heading">
                    Menu de la Semaine — Édition & Consultation
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modifiez librement les plats et descriptions des repas pour chaque jour
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWeeklyMenu} className="space-y-4 text-xs">
              {weeklyMenu.map((item: any, idx: number) => (
                <div key={item.day} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-950 uppercase tracking-wider text-xs">
                      {item.day}
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 text-[11px] block">Titre du Plat :</label>
                    <input
                      type="text"
                      required
                      value={item.title}
                      onChange={(e) => {
                        const next = [...weeklyMenu];
                        next[idx].title = e.target.value;
                        setWeeklyMenu(next);
                      }}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 text-[11px] block">Description & Ingrédients :</label>
                    <textarea
                      rows={2}
                      required
                      value={item.description}
                      onChange={(e) => {
                        const next = [...weeklyMenu];
                        next[idx].description = e.target.value;
                        setWeeklyMenu(next);
                      }}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-medium text-slate-700"
                    />
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer le Menu</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMenuModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Fermer
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    Enregistrer les Modifications
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODALE 4 : NOUVELLE SOUSCRIPTION CANTINE (DÉMARRE ENTIÈREMENT VIDE) ================= */}
      {isNewSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 font-heading">
                    Nouvelle Souscription Cantine
                  </h3>
                  <p className="text-xs text-slate-500">
                    Abonnement à la demi-pension scolaire 2026-2027
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewSubModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} className="space-y-4 text-xs">
              {/* Recherche rapide et filtre de classe parmi TOUS les élèves de l'école */}
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                    Sélectionner l&apos;élève ({filteredStudentsForNewSub.length}/{students.length}) :
                  </label>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    Tous les élèves
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={newSubSearchQuery}
                      onChange={(e) => setNewSubSearchQuery(e.target.value)}
                      placeholder="Nom, prénom, matricule..."
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <select
                    value={newSubGradeFilter}
                    onChange={(e) => setNewSubGradeFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  >
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                <select
                  required
                  value={newSubStudentId}
                  onChange={(e) => setNewSubStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-semibold text-slate-900 cursor-pointer"
                >
                  <option value="">-- Choisir parmi les {filteredStudentsForNewSub.length} élèves --</option>
                  {filteredStudentsForNewSub.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studentNumber} • {s.fullName} ({s.grade})
                    </option>
                  ))}
                </select>
              </div>

              {/* Remplissage automatique des informations dès que l'élève est choisi */}
              {selectedStudentInNewSub && (
                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-950">Matricule & Classe</span>
                    <strong className="text-emerald-950 font-mono">{selectedStudentInNewSub.matricule} • {selectedStudentInNewSub.grade}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-950">Genre de l&apos;Élève</span>
                    <GenderBadge gender={selectedStudentInNewSub.gender} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-950">Contact WhatsApp Parent</span>
                    <span className="font-mono font-bold text-emerald-800">
                      {selectedStudentInNewSub.whatsappPhone || selectedStudentInNewSub.guardianPhone}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Régime diététique / Allergies *</label>
                <input
                  type="text"
                  required
                  value={newSubDiet}
                  onChange={(e) => setNewSubDiet(e.target.value)}
                  placeholder="Ex : Standard, Allergie arachides, Sans lactose..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Tarif Mensuel en FCFA *</label>
                <input
                  type="number"
                  required
                  value={newSubRate}
                  onChange={(e) => setNewSubRate(e.target.value)}
                  placeholder="25000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewSubModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={!newSubStudentId}
                  className={`px-5 py-2.5 rounded-xl font-bold text-white transition-all cursor-pointer ${
                    newSubStudentId
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  Valider l&apos;Abonnement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
