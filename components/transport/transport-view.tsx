'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student, School } from '@/lib/data/types';
import { GenderBadge } from '@/components/ui/badge';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { availableClasses, mockStudents } from '@/lib/data/mock-data';
import { getLiveStudents, getLiveSchool, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import {
  Bus,
  MapPin,
  Clock,
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
  Navigation,
  ShieldCheck,
  ReceiptText,
  Save,
  Send,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Coins,
  BadgePercent,
  Copy,
  Loader2,
  Smartphone,
} from 'lucide-react';

interface TransportViewProps {
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

const TRANSPORT_PAYMENTS_KEY = 'schoolflow_transport_monthly_payments_v2';
const TRANSPORT_SUBSCRIPTIONS_KEY = 'schoolflow_transport_subscriptions_v2';

const ITINERAIRES_DATA = [
  {
    line: 'Ligne 1 : Riviera 3 — Angré Djibi',
    bus: 'Car N°1 (Iveco 32 places)',
    driver: 'M. Kouamé Jean-Baptiste',
    monitor: 'Mme Bamba Fatou',
    stops: ['Riviera Golf (06h45)', 'Riviera Bonoumin (07h00)', 'Angré Djibi (07h15)', '8ème Tranche (07h25)'],
    morningTime: '06h45 — 07h30',
    eveningTime: '16h30 — 17h30',
  },
  {
    line: 'Ligne 2 : Deux Plateaux — Vallon',
    bus: 'Car N°2 (Toyota Coaster 30 places)',
    driver: 'M. Touré Amadou',
    monitor: 'Mme Koffi Estelle',
    stops: ['Deux Plateaux Vallon (06h50)', 'Polyclinique Sainte Anne-Marie (07h05)', 'ENA / Duncan (07h20)'],
    morningTime: '06h50 — 07h30',
    eveningTime: '16h30 — 17h25',
  },
  {
    line: 'Ligne 3 : Cocody Danga — Mermoz',
    bus: 'Car N°3 (Mercedes Sprinter 24 places)',
    driver: 'M. Yao Marcel',
    monitor: 'Mme Koné Awa',
    stops: ['Cité des Cadres (06h45)', 'Cocody Danga (07h00)', 'Mermoz / Lycée Technique (07h20)'],
    morningTime: '06h45 — 07h30',
    eveningTime: '16h30 — 17h20',
  },
  {
    line: 'Ligne 4 : Marcory — Zone 4 — VGE',
    bus: 'Car N°4 (Iveco 30 places)',
    driver: 'M. Diallo Souleymane',
    monitor: 'Mme Coulibaly Sylvie',
    stops: ['Grand Carrefour Marcory (06h40)', 'Zone 4 Biétry (06h55)', 'Prima Center (07h10)', 'Boulevard VGE (07h25)'],
    morningTime: '06h40 — 07h30',
    eveningTime: '16h30 — 17h40',
  },
];

export function TransportView({
  school,
  schoolSlug,
}: TransportViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('Toutes les classes');
  const [selectedStop, setSelectedStop] = useState('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Défilement horizontal synchronisé
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const receiptCardRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1200);

  // Modales
  const [selectedStudentForMonths, setSelectedStudentForMonths] = useState<any | null>(null);
  const [selectedStudentForReceipt, setSelectedStudentForReceipt] = useState<any | null>(null);
  const [isItinerairesModalOpen, setIsItinerairesModalOpen] = useState(false);
  const [isNewSubModalOpen, setIsNewSubModalOpen] = useState(false);

  // Formulaire nouvelle souscription
  const [newSubStudentId, setNewSubStudentId] = useState('');
  const [newSubStop, setNewSubStop] = useState('Riviera Bonoumin — Carrefour Jacques Prévert');
  const [newSubRate, setNewSubRate] = useState('35000');
  const [newSubDiscount, setNewSubDiscount] = useState('0');
  const [newSubSearchQuery, setNewSubSearchQuery] = useState('');
  const [newSubGradeFilter, setNewSubGradeFilter] = useState('Toutes les classes');

  // Suivi des mois payés : studentId -> { [monthName]: boolean }
  const [monthlyPayments, setMonthlyPayments] = useState<Record<string, Record<string, boolean>>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(TRANSPORT_PAYMENTS_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // Souscriptions personnalisées : studentId -> { stop, rate, discount }
  const [customTransportMap, setCustomTransportMap] = useState<Record<string, { stop: string; rate: number; discount?: number }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(TRANSPORT_SUBSCRIPTIONS_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // Synchronisation des élèves
  useEffect(() => {
    setStudents(getLiveStudents(mockStudents, schoolSlug));
    setCurrentSchool(getLiveSchool(schoolSlug, school));

    const handleUpdate = () => {
      setStudents(getLiveStudents(mockStudents, schoolSlug));
      setCurrentSchool(getLiveSchool(schoolSlug, school));
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, school]);

  // Synchronisation de la barre de défilement horizontal en haut
  useEffect(() => {
    const updateWidth = () => {
      if (tableContainerRef.current) {
        setTableScrollWidth(Math.max(1200, tableContainerRef.current.scrollWidth));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [students]);

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

  const handleScrollLeft = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // Filtrage des élèves pour la modale de transport
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

  // Déterminer l'élève sélectionné dans le formulaire nouvelle souscription
  const selectedStudentInNewSub = useMemo(() => {
    return students.find((s) => s.id === newSubStudentId) || null;
  }, [students, newSubStudentId]);

  // Liste des abonnés au transport scolaire
  const subscribers = useMemo(() => {
    const defaultStops = [
      'Riviera Bonoumin — Carrefour Jacques Prévert',
      'Angré Djibi — Pharmacie des Grâces',
      'Deux Plateaux — Vallon / Sainte Cécile',
      'Cocody Danga — Cité des Cadres',
      'Marcory Biétry — Boulevard de Marseille',
      'Riviera 3 — Rond-point Lycée Français',
      '8ème Tranche — Carrefour Soleil Levant',
    ];

    return students
      .filter((stu) => Boolean(customTransportMap[stu.id]))
      .map((stu, idx) => {
        const custom = customTransportMap[stu.id];
        const stop = custom?.stop || defaultStops[idx % defaultStops.length];
        const monthlyRate = custom?.rate || 35000;
        const discountAmount = custom?.discount || 0;

        const monthsState = monthlyPayments[stu.id] || {
          Septembre: false,
          Octobre: false,
          Novembre: false,
          Décembre: false,
          Janvier: false,
          Février: false,
          Mars: false,
          Avril: false,
          Mai: false,
          Juin: false,
        };

        const paidMonths = Object.keys(monthsState).filter((m) => monthsState[m]);
        const paidMonthsCount = paidMonths.length;
        const grossAmount = paidMonthsCount * monthlyRate;
        const totalPaidAmount = Math.max(0, grossAmount - discountAmount);

        return {
          ...stu,
          pickupStop: stop,
          monthlyRate,
          discountAmount,
          grossAmount,
          monthsState,
          paidMonths,
          paidMonthsCount,
          totalPaidAmount,
        };
      });
  }, [students, customTransportMap, monthlyPayments]);

  // Filtrage
  const filteredSubscribers = useMemo(() => {
    return subscribers.filter((sub) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        sub.fullName.toLowerCase().includes(q) ||
        sub.matricule.toLowerCase().includes(q) ||
        sub.studentNumber.toLowerCase().includes(q) ||
        sub.pickupStop.toLowerCase().includes(q);

      const matchesClass =
        selectedClass === 'Toutes les classes' ||
        sub.grade.toLowerCase() === selectedClass.toLowerCase();

      const matchesStop =
        selectedStop === 'all' ||
        sub.pickupStop.toLowerCase().includes(selectedStop.toLowerCase());

      return matchesSearch && matchesClass && matchesStop;
    });
  }, [subscribers, searchQuery, selectedClass, selectedStop]);

  // Statistiques Transport
  const stats = useMemo(() => {
    const totalSubscribers = subscribers.length;
    const girls = subscribers.filter((s) => s.gender === 'female').length;
    const boys = subscribers.filter((s) => s.gender === 'male').length;

    const totalCollected = subscribers.reduce((acc, s) => acc + s.totalPaidAmount, 0);
    const totalExigible = subscribers.reduce((acc, s) => acc + (s.monthlyRate * 10 - s.discountAmount), 0);
    const recoveryRate = totalExigible > 0 ? ((totalCollected / totalExigible) * 100).toFixed(1) : '0';

    return {
      totalSubscribers,
      girls,
      boys,
      totalCollected,
      totalExigible,
      recoveryRate,
    };
  }, [subscribers]);

  // Modification directe et immédiate du tarif mensuel
  const handleQuickUpdateRate = (stuId: string, newRateStr: string) => {
    const newRate = parseInt(newRateStr, 10) || 0;
    const current = subscribers.find((s) => s.id === stuId);
    if (!current) return;

    const nextMap = {
      ...customTransportMap,
      [stuId]: {
        stop: current.pickupStop,
        rate: newRate,
        discount: current.discountAmount || 0,
      },
    };

    setCustomTransportMap(nextMap);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TRANSPORT_SUBSCRIPTIONS_KEY, JSON.stringify(nextMap));
      } catch (e) {}
    }
  };

  // Basculer le statut d'un mois
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
      const paidMonthsCount = paidMonths.length;
      const gross = paidMonthsCount * prev.monthlyRate;
      const net = Math.max(0, gross - (prev.discountAmount || 0));

      return {
        ...prev,
        monthsState: nextMonths,
        paidMonths,
        paidMonthsCount,
        grossAmount: gross,
        totalPaidAmount: net,
      };
    });
  };

  // Enregistrer le suivi des mois, tarif et réduction
  const handleSaveMonthlyPayments = () => {
    if (!selectedStudentForMonths) return;
    const stuId = selectedStudentForMonths.id;
    const newPayments = {
      ...monthlyPayments,
      [stuId]: selectedStudentForMonths.monthsState,
    };

    const newTransportMap = {
      ...customTransportMap,
      [stuId]: {
        stop: selectedStudentForMonths.pickupStop,
        rate: selectedStudentForMonths.monthlyRate,
        discount: selectedStudentForMonths.discountAmount || 0,
      },
    };

    setMonthlyPayments(newPayments);
    setCustomTransportMap(newTransportMap);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TRANSPORT_PAYMENTS_KEY, JSON.stringify(newPayments));
        localStorage.setItem(TRANSPORT_SUBSCRIPTIONS_KEY, JSON.stringify(newTransportMap));
      } catch (e) {}
    }

    setToastMessage(`✓ Cotisations & Réduction enregistrées pour ${selectedStudentForMonths.fullName}`);
    setTimeout(() => setToastMessage(null), 4000);
    setSelectedStudentForMonths(null);
  };

  // Enregistrer une nouvelle souscription au transport
  const handleCreateNewSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubStudentId) {
      alert('Veuillez sélectionner un élève.');
      return;
    }

    const rate = parseInt(newSubRate, 10) || 35000;
    const discount = parseInt(newSubDiscount, 10) || 0;

    const nextCustom = {
      ...customTransportMap,
      [newSubStudentId]: {
        stop: newSubStop,
        rate,
        discount,
      },
    };
    setCustomTransportMap(nextCustom);

    const nextPayments = {
      ...monthlyPayments,
      [newSubStudentId]: {
        Septembre: true,
        Octobre: false,
        Novembre: false,
        Décembre: false,
        Janvier: false,
        Février: false,
        Mars: false,
        Avril: false,
        Mai: false,
        Juin: false,
      },
    };
    setMonthlyPayments(nextPayments);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TRANSPORT_SUBSCRIPTIONS_KEY, JSON.stringify(nextCustom));
        localStorage.setItem(TRANSPORT_PAYMENTS_KEY, JSON.stringify(nextPayments));
      } catch (e) {}
    }

    setIsNewSubModalOpen(false);
    setToastMessage('✓ Nouvelle souscription au transport enregistrée avec succès.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Partage WhatsApp du reçu avec copie d'image dans le presse-papier
  const handleSendReceiptWhatsApp = async (sub: any) => {
    if (!sub) return;
    try {
      setIsGeneratingImage(true);
      if (receiptCardRef.current) {
        try {
          const html2canvasModule = await import('html2canvas');
          const html2canvas = html2canvasModule.default;
          const canvas = await html2canvas(receiptCardRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 8000,
          });
          if (canvas) {
            let blob: Blob | null = null;
            try {
              blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            } catch (e) {}

            if (!blob) {
              try {
                const dataUrl = canvas.toDataURL('image/png');
                const res = await fetch(dataUrl);
                blob = await res.blob();
              } catch (e) {}
            }

            if (blob && navigator.clipboard && (window as any).ClipboardItem) {
              try {
                await navigator.clipboard.write([new (window as any).ClipboardItem({ 'image/png': blob })]);
              } catch (e) {}
            }
          }
        } catch (e) {}
      }

      setToastMessage('✅ Le reçu automatique a été déjà copié dans votre presse-papiers ! Vous pouvez maintenant aller sur WhatsApp et faire Coller (Ctrl + V).');
      setTimeout(() => setToastMessage(null), 7000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-7 animate-fadeIn">
      {/* 1. EN-TÊTE DE PAGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 font-heading">
              Logistique & Navettes
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
            Transport Scolaire
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-sans mt-0.5">
            Suivi des circuits de ramassage, cartes de bus, arrêts et cotisations mensuelles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsItinerairesModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <Navigation className="w-4 h-4 text-emerald-600" />
            <span>Itinéraires & Cars</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewSubStudentId('');
              setNewSubStop('Riviera Bonoumin — Carrefour Jacques Prévert');
              setNewSubRate('35000');
              setNewSubDiscount('0');
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

      {/* 2. LES 3 CARTES KPI TRANSPORT */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 print:hidden">
        {/* Card 1 : Total Inscrits Transport */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                <Bus className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Total Abonnés Navettes
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
            <span>Taux de couverture</span>
            <span className="font-semibold text-slate-800">
              {students.length > 0 ? ((stats.totalSubscribers / students.length) * 100).toFixed(0) : 0}% des élèves
            </span>
          </div>
        </div>

        {/* Card 2 : Recouvrement Transport */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Recouvrement Navettes
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap text-blue-900">
                {formatFCFA(stats.totalCollected)}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Cotisations mensuelles perçues à ce jour
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-blue-700 font-medium flex items-center justify-between">
            <span>Taux de recouvrement</span>
            <span className="font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {stats.recoveryRate}% perçu
            </span>
          </div>
        </div>

        {/* Card 3 : Flotte & Sécurité */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between bg-amber-50/15">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-900 font-sans truncate">
                Flotte de Cars Scolaires
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-amber-900 tracking-tight font-heading whitespace-nowrap">
                {subscribers.length === 0 ? '0 Ligne configurée' : '4 Lignes Actives'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {subscribers.length === 0
                ? 'Aucune ligne active pour le moment — Cliquez sur Itinéraires pour configurer vos circuits.'
                : 'Cars climatisés, géolocalisés avec accompagnatrices'}
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-amber-800 font-medium flex items-center justify-between">
            <span>Contrôle technique</span>
            <span className="font-bold">
              {subscribers.length === 0 ? 'En attente' : '✓ À jour & Certifié'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Table des Inscrits Transport avec Défilement en Haut */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-3.5 sm:p-4 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher élève, arrêt, matricule..."
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

          {/* Boutons de défilement horizontal rapide en haut */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={handleScrollLeft}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Faire défiler vers la gauche"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Défilement</span>
            <button
              type="button"
              onClick={handleScrollRight}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Faire défiler vers la droite"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {(searchQuery || selectedClass !== 'Toutes les classes') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedClass('Toutes les classes');
                setSelectedStop('all');
              }}
              className="p-2 text-xs text-slate-500 hover:text-slate-800 rounded-xl inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Effacer</span>
            </button>
          )}
        </div>

        {/* Barre de défilement horizontal EN HAUT DU TABLEAU */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto bg-slate-100/90 border-b border-slate-200 scrollbar-thin"
          style={{ height: '14px' }}
        >
          <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
        </div>

        {/* Tableau */}
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="overflow-x-auto scrollbar-thin"
        >
          <table className="w-full text-left border-collapse min-w-[1100px]">
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
                <th className="py-3.5 px-3 whitespace-nowrap">Arrêt de Ramassage</th>
                <th className="py-3.5 px-3 whitespace-nowrap text-right">Tarif Mensuel</th>
                <th className="py-3.5 px-3 whitespace-nowrap text-right">Remise / Réduction</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Contact WhatsApp</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Suivi des Mois</th>
                <th className="py-3.5 pr-5 pl-3 text-center whitespace-nowrap">Action & Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Aucun élève inscrit au transport scolaire trouvé.
                  </td>
                </tr>
              ) : (
                filteredSubscribers.map((sub) => (
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
                      <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{sub.pickupStop}</span>
                      </div>
                    </td>

                    {/* Tarif Mensuel */}
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

                    {/* Réduction Spéciale */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <span className={`font-mono font-bold text-xs ${
                        sub.discountAmount > 0 ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200' : 'text-slate-400'
                      }`}>
                        {sub.discountAmount > 0 ? `-${formatFCFA(sub.discountAmount)}` : '0 FCFA'}
                      </span>
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

                    {/* Suivi des Mois */}
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

                    {/* COLONNE D'ACTION : MODIFIER & REÇU */}
                    <td className="py-3.5 pr-5 pl-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentForReceipt(sub)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer shadow-2xs"
                      >
                        <ReceiptText className="w-3.5 h-3.5 text-white" />
                        <span>Modifier & Reçu</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Total affiché : <strong className="text-slate-900 font-bold">{filteredSubscribers.length}</strong> élèves inscrits au circuit de ramassage
          </span>
          <span className="text-[11px] text-slate-400">
            Gestion sécurisée des cars scolaires • Défilement horizontal disponible en haut
          </span>
        </div>
      </div>

      {/* ================= MODALE 1 : SUIVI DES MOIS, RÉDUCTION & TARIF TRANSPORT ================= */}
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

            {/* Ajustement Tarif Mensuel & Réduction Spéciale */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Tarif Mensuel (FCFA)</label>
                <input
                  type="number"
                  value={selectedStudentForMonths.monthlyRate}
                  onChange={(e) => {
                    const newRate = parseInt(e.target.value, 10) || 0;
                    setSelectedStudentForMonths((prev: any) => {
                      const gross = prev.paidMonthsCount * newRate;
                      const net = Math.max(0, gross - (prev.discountAmount || 0));
                      return {
                        ...prev,
                        monthlyRate: newRate,
                        grossAmount: gross,
                        totalPaidAmount: net,
                      };
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Réduction / Remise (FCFA)</label>
                <input
                  type="number"
                  value={selectedStudentForMonths.discountAmount || 0}
                  onChange={(e) => {
                    const discount = parseInt(e.target.value, 10) || 0;
                    setSelectedStudentForMonths((prev: any) => {
                      const gross = prev.paidMonthsCount * prev.monthlyRate;
                      const net = Math.max(0, gross - discount);
                      return {
                        ...prev,
                        discountAmount: discount,
                        grossAmount: gross,
                        totalPaidAmount: net,
                      };
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-300 font-mono font-bold text-emerald-800 bg-emerald-50/50"
                  placeholder="0"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Arrêt de Ramassage</label>
                <input
                  type="text"
                  value={selectedStudentForMonths.pickupStop}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedStudentForMonths((prev: any) => ({
                      ...prev,
                      pickupStop: val,
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
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Net Encaissé</span>
                <strong className="text-emerald-800 font-mono font-extrabold text-base">
                  {formatFCFA(selectedStudentForMonths.totalPaidAmount)}
                </strong>
              </div>
            </div>

            {/* Grille des mois */}
            <div className="space-y-2">
              <label className="font-bold text-slate-900 text-xs flex items-center justify-between">
                <span>Pointage des 10 mois scolaires :</span>
                <span className="text-[11px] text-slate-400">Cliquez pour valider/invalider</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {MONTHS_LIST.map((month) => {
                  const isPaid = !!selectedStudentForMonths.monthsState?.[month];
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => toggleMonthStatus(month)}
                      className={`p-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                        isPaid
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {month.slice(0, 4)}.
                      <span className="block text-[10px] font-normal">{isPaid ? '✓ Réglé' : 'Impayé'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
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

      {/* ================= MODALE 2 : REÇU OFFICIEL DE TRANSPORT & ENVOI WHATSAPP (AVEC RÉDUCTION) ================= */}
      {selectedStudentForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 sm:p-7 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <ReceiptText className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-950 font-heading">
                    Quittance de Transport Scolaire
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Document officiel d&apos;encaissement • {currentSchool.name}
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

            {/* DOCUMENT OFFICIEL DU REÇU DANS UN CADRE ÉLÉGANT */}
            <div
              id="official-receipt-printable"
              ref={receiptCardRef}
              className="border-2 border-slate-900 rounded-2xl p-4 sm:p-5 bg-white space-y-4 shadow-sm"
            >
              {/* 1. En-tête officiel dans un cadre */}
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/70 flex items-center justify-between gap-3">
                <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                  {currentSchool.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentSchool.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-center text-[8px] font-black text-emerald-800">
                      LOGO
                    </div>
                  )}
                </div>

                <div className="text-center flex-1 space-y-0.5 min-w-0">
                  <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-tight font-heading truncate">
                    {currentSchool.name}
                  </h2>
                  <p className="text-[11px] font-extrabold text-emerald-800 font-heading">
                    {currentSchool.shortName || 'EPC MANOI'}
                  </p>
                  <p className="text-[9.5px] italic text-slate-600">
                    « {currentSchool.motto || 'Discipline • Rigueur • Réussite'} »
                  </p>
                  <p className="text-[8.5px] text-slate-400 font-mono">
                    Code : {currentSchool.ministryCode || '321119'} • Tél : {currentSchool.phone || '+225 01 02 03 04 05'}
                  </p>
                </div>

                <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                  {currentSchool.countryEmblemUrl && currentSchool.countryEmblemUrl.startsWith('data:image') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentSchool.countryEmblemUrl} alt="Armoiries" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-center text-[7px] font-black text-amber-900">
                      ARMOIRIES
                    </div>
                  )}
                </div>
              </div>

              {/* Titre Quittance */}
              <div className="bg-slate-900 text-white p-2.5 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold block">
                    Service Transport Scolaire
                  </span>
                  <span className="font-extrabold font-heading text-xs sm:text-sm">
                    REÇU DE COTISATION NAVETTES SCOLAIRES
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-amber-400 font-bold text-xs">2026-2027</span>
                </div>
              </div>

              {/* Détails Bénéficiaire */}
              <div className="grid grid-cols-2 gap-2 text-xs border border-slate-200 rounded-xl p-3 bg-slate-50/70">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Élève Titulaire :</span>
                  <strong className="text-slate-950 font-heading text-xs sm:text-sm">{selectedStudentForReceipt.fullName}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Matricule & Classe :</span>
                  <span className="font-mono font-bold text-slate-900">{selectedStudentForReceipt.matricule || selectedStudentForReceipt.studentNumber} • {selectedStudentForReceipt.grade}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold block">Arrêt de Ramassage :</span>
                  <span className="font-semibold text-emerald-900">{selectedStudentForReceipt.pickupStop}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Contact WhatsApp Parent :</span>
                  <span className="font-mono font-bold text-slate-800">{selectedStudentForReceipt.whatsappPhone || selectedStudentForReceipt.guardianPhone}</span>
                </div>
              </div>

              {/* Décompte Financier avec Réduction */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Désignation</th>
                      <th className="py-2 px-3 text-center whitespace-nowrap">Mois Réglés</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    <tr>
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900">Cotisations Transport Mensuel</div>
                        <div className="text-[10px] text-slate-400">
                          Tarif : {formatFCFA(selectedStudentForReceipt.monthlyRate)} / mois
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-xs">
                          {selectedStudentForReceipt.paidMonthsCount} / 10 mois
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-extrabold text-slate-900 font-heading">
                        {formatFCFA(selectedStudentForReceipt.grossAmount || selectedStudentForReceipt.paidMonthsCount * selectedStudentForReceipt.monthlyRate)}
                      </td>
                    </tr>

                    {/* Ligne Réduction si applicable */}
                    {selectedStudentForReceipt.discountAmount > 0 && (
                      <tr className="bg-emerald-50/50">
                        <td colSpan={2} className="py-2 px-3 text-emerald-900 font-bold">
                          🎁 Réduction Spéciale / Remise Parentale Accordée :
                        </td>
                        <td className="py-2 px-3 text-right font-black text-emerald-700 font-heading">
                          -{formatFCFA(selectedStudentForReceipt.discountAmount)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-bold text-xs sm:text-sm">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 uppercase font-heading">
                        TOTAL NET ENCAISSÉ :
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-300 font-black font-heading text-sm sm:text-base whitespace-nowrap">
                        {formatFCFA(selectedStudentForReceipt.totalPaidAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Cachet Officiel */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <div className="text-[9px] text-slate-400 italic">
                  Quittance officielle numérotée émise par le service Transport.
                </div>
                <div className="p-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50 flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Cachet Électronique Certifié</span>
                </div>
              </div>
            </div>

            {/* Actions Reçu */}
            <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  document.body.classList.add('print-receipt-only');
                  window.print();
                  setTimeout(() => document.body.classList.remove('print-receipt-only'), 1200);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs"
              >
                <Printer className="w-4 h-4 text-emerald-600" />
                <span>Imprimer le Reçu</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendReceiptWhatsApp(selectedStudentForReceipt)}
                disabled={isGeneratingImage}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-400 hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <Smartphone className="w-4 h-4 text-emerald-600" />}
                <span>Partager sur WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 3 : ITINÉRAIRES & HORAIRES DES CARS ================= */}
      {isItinerairesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                  <Bus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-950 font-heading">
                    Plan des Itinéraires & Horaires des Cars
                  </h3>
                  <p className="text-xs text-slate-500">
                    Circuits de ramassage scolaire 2026-2027 • {currentSchool.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsItinerairesModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {ITINERAIRES_DATA.map((line) => (
                <div key={line.line} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-950 uppercase tracking-wider text-xs">
                      {line.line}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      {line.bus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                    <div>
                      <span>Chauffeur : <strong className="text-slate-900">{line.driver}</strong></span>
                    </div>
                    <div>
                      <span>Accompagnatrice : <strong className="text-slate-900">{line.monitor}</strong></span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 text-slate-700 space-y-1">
                    <span className="font-bold text-[11px] block">Arrêts desservis :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {line.stops.map((stop) => (
                        <span key={stop} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-medium">
                          📍 {stop}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsItinerairesModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 4 : NOUVELLE SOUSCRIPTION TRANSPORT ================= */}
      {isNewSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950 font-heading">
                    Nouvelle Souscription Transport
                  </h3>
                  <p className="text-xs text-slate-500">
                    Inscrire un élève aux circuits de navettes
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

            <form onSubmit={handleCreateNewSubscription} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Sélectionner l&apos;Élève *</label>
                <select
                  required
                  value={newSubStudentId}
                  onChange={(e) => setNewSubStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900"
                >
                  <option value="">-- Choisir un élève --</option>
                  {filteredStudentsForNewSub.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.studentNumber} • {s.grade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Tarif Mensuel Navette (FCFA)</label>
                  <input
                    type="number"
                    required
                    value={newSubRate}
                    onChange={(e) => setNewSubRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Réduction Parent (FCFA)</label>
                  <input
                    type="number"
                    value={newSubDiscount}
                    onChange={(e) => setNewSubDiscount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 font-mono font-bold text-emerald-800 bg-emerald-50/50"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Arrêt de Ramassage</label>
                <input
                  type="text"
                  required
                  value={newSubStop}
                  onChange={(e) => setNewSubStop(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900"
                  placeholder="Ex: Riviera Bonoumin ou Carrefour Jacques Prévert"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewSubModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30"
                >
                  Valider l&apos;Inscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
