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

  // Modales
  const [selectedStudentForMonths, setSelectedStudentForMonths] = useState<any | null>(null);
  const [selectedStudentForReceipt, setSelectedStudentForReceipt] = useState<any | null>(null);
  const [isItinerairesModalOpen, setIsItinerairesModalOpen] = useState(false);
  const [isNewSubModalOpen, setIsNewSubModalOpen] = useState(false);

  // Synchronized horizontal scroll references
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1200);

  // Formulaire nouvelle souscription (démarre complètement vide)
  const [newSubStudentId, setNewSubStudentId] = useState('');
  const [newSubStop, setNewSubStop] = useState('');
  const [newSubRate, setNewSubRate] = useState('35000');
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

  // Souscriptions personnalisées et arrêts par élève
  const [customTransportMap, setCustomTransportMap] = useState<Record<string, { stop: string; rate: number }>>(() => {
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
    setStudents(getLiveStudents(mockStudents));
    setCurrentSchool(getLiveSchool(schoolSlug, school));

    const handleUpdate = () => {
      setStudents(getLiveStudents(mockStudents));
      setCurrentSchool(getLiveSchool(schoolSlug, school));
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, school]);

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

  // Déterminer l'élève sélectionné dans le formulaire nouvelle souscription
  const selectedStudentInNewSub = useMemo(() => {
    return students.find((s) => s.id === newSubStudentId) || null;
  }, [students, newSubStudentId]);

  // Liste des abonnés au transport scolaire adaptée aux données réelles (~50% des élèves)
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
      .filter((stu, idx) => {
        return customTransportMap[stu.id] || idx % 2 === 0;
      })
      .map((stu, idx) => {
        const custom = customTransportMap[stu.id];
        const stop = custom?.stop || defaultStops[idx % defaultStops.length];
        const monthlyRate = custom?.rate || 35000;

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
          pickupStop: stop,
          monthlyRate,
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

  // Statistiques Transport (3 Blocs KPI Réalistes)
  const stats = useMemo(() => {
    const totalSubscribers = subscribers.length;
    const girls = subscribers.filter((s) => s.gender === 'female').length;
    const boys = subscribers.filter((s) => s.gender === 'male').length;

    const totalCollected = subscribers.reduce((acc, s) => acc + s.totalPaidAmount, 0);
    const totalExigible = subscribers.reduce((acc, s) => acc + s.monthlyRate * 10, 0);
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

  // Modification directe et immédiate du tarif mensuel dans le tableau
  const handleQuickUpdateRate = (stuId: string, newRateStr: string) => {
    const newRate = parseInt(newRateStr, 10) || 0;
    const current = subscribers.find((s) => s.id === stuId);
    if (!current) return;

    const nextMap = {
      ...customTransportMap,
      [stuId]: {
        stop: current.pickupStop,
        rate: newRate,
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
      return {
        ...prev,
        monthsState: nextMonths,
        paidMonths,
        paidMonthsCount: paidMonths.length,
        totalPaidAmount: paidMonths.length * prev.monthlyRate,
      };
    });
  };

  // Enregistrer le suivi des mois et tarif transport
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

    setToastMessage(`✓ Cotisations de transport et tarif mis à jour pour ${selectedStudentForMonths.fullName} !`);
    setTimeout(() => setToastMessage(null), 5000);
    setSelectedStudentForMonths(null);
  };

  // Enregistrer un nouvel abonnement transport
  const handleCreateSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubStudentId) {
      alert('Veuillez sélectionner un élève.');
      return;
    }

    const rate = parseInt(newSubRate, 10) || 35000;
    const nextTransportMap = {
      ...customTransportMap,
      [newSubStudentId]: {
        stop: newSubStop || 'Riviera 3 — Arrêt Principal',
        rate,
      },
    };

    setCustomTransportMap(nextTransportMap);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TRANSPORT_SUBSCRIPTIONS_KEY, JSON.stringify(nextTransportMap));
      } catch (e) {}
    }

    const stu = students.find((s) => s.id === newSubStudentId);
    setToastMessage(`✓ Nouvel abonnement transport validé pour ${stu ? stu.fullName : 'l’élève'} !`);
    setTimeout(() => setToastMessage(null), 5000);
    setIsNewSubModalOpen(false);
    setNewSubStudentId('');
    setNewSubStop('');
  };

  // Envoi WhatsApp direct du reçu transport
  const handleSendReceiptWhatsApp = (sub: any) => {
    const parentPhone = (sub.whatsappPhone || sub.guardianPhone || '').replace(/[^0-9]/g, '');
    const receiptNum = `QUITTANCE-TRANS-${sub.matricule || '001'}-${Date.now().toString().slice(-4)}`;
    const monthsText = sub.paidMonths && sub.paidMonths.length > 0 ? sub.paidMonths.join(', ') : 'Aucun mois pour le moment';

    const message = `*REÇU OFFICIEL DE TRANSPORT SCOLAIRE — ${currentSchool.name.toUpperCase()}*\n\n` +
      `Bonjour Chers Parents de *${sub.fullName}* (${sub.grade}),\n\n` +
      `Nous vous confirmons la bonne réception du règlement des navettes de transport scolaire (Cars Scolaires) :\n\n` +
      `📄 *Réf Quittance :* ${receiptNum}\n` +
      `👤 *Élève :* ${sub.fullName} (Matricule : ${sub.matricule || sub.studentNumber})\n` +
      `🏫 *Classe :* ${sub.grade}\n` +
      `🚌 *Arrêt de Ramassage :* ${sub.pickupStop}\n` +
      `📅 *Mois Réglés :* ${monthsText} (${sub.paidMonthsCount}/10 mois)\n` +
      `💰 *Tarif Mensuel :* ${formatFCFA(sub.monthlyRate)}\n` +
      `💵 *Total Encaissé :* ${formatFCFA(sub.totalPaidAmount)}\n` +
      `🗓️ *Date d'émission :* ${formatDate(new Date().toISOString())}\n\n` +
      `Merci pour votre confiance. — _La Direction & Service Transport ${currentSchool.shortName || 'EPC'}_`;

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
      'Arrêt de Ramassage',
      'Tarif Mensuel (FCFA)',
      'Mois Réglés',
      'Total Payé (FCFA)',
      'Contact WhatsApp Parent',
    ].join(';');

    const rows = filteredSubscribers.map((sub) => [
      sub.studentNumber,
      sub.matricule,
      sub.lastName,
      sub.firstName,
      sub.grade,
      sub.gender === 'female' ? 'Féminin' : 'Masculin',
      sub.pickupStop,
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
    link.setAttribute('download', `SchoolFlow_Transport_Scolaire_${school.shortName || 'EPC'}_2026-2027.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMessage(`✓ Liste des abonnés transport exportée avec succès (${filteredSubscribers.length} élèves) !`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Transport Scolaire & Navettes
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Suivi des abonnements, arrêts de ramassage, reçus WhatsApp et cotisations mensuelles — {currentSchool.name}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsItinerairesModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Itinéraires & Horaires</span>
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
              setNewSubStop('');
              setNewSubRate('35000');
              setIsNewSubModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouvel abonnement car</span>
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

      {/* 2. LES 3 CARTES KPI TRANSPORT (Effectifs et montants adaptés aux vrais élèves) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 print:hidden">
        {/* Card 1 : Total Abonnés Bus */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                <Bus className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Total Abonnés Bus
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
            <span>Taux d&apos;adhésion au car</span>
            <span className="font-semibold text-slate-800">
              {students.length > 0 ? ((stats.totalSubscribers / students.length) * 100).toFixed(0) : 0}% de l&apos;école
            </span>
          </div>
        </div>

        {/* Card 2 : Recouvrement Transport */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 shadow-xs">
                <Navigation className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Recouvrement Transport
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

        {/* Card 3 : Flotte Active & Sécurité */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Flotte Active & Sécurité
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap text-amber-900">
                4 Lignes • 6 Cars
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                GPS actif
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Assurances tous risques & accompagnateurs qualifiés
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Ponctualité</span>
            <span className="font-semibold text-emerald-700">98.5% à l&apos;heure</span>
          </div>
        </div>
      </div>

      {/* 3. Table des Abonnés au Transport */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
        {/* Toolbar avec barre de recherche et filtres */}
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

          <div className="relative flex-1 sm:flex-none min-w-[160px]">
            <select
              value={selectedStop}
              onChange={(e) => setSelectedStop(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 cursor-pointer"
            >
              <option value="all">Tous les arrêts</option>
              <option value="Riviera">Secteur Riviera</option>
              <option value="Angré">Secteur Angré</option>
              <option value="Deux Plateaux">Secteur Deux Plateaux</option>
              <option value="Cocody">Secteur Cocody Danga</option>
              <option value="Marcory">Secteur Marcory / Biétry</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {(searchQuery || selectedClass !== 'Toutes les classes' || selectedStop !== 'all') && (
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

        {/* BARRE DE DÉFILEMENT HORIZONTAL SYNCHRONISÉE EN HAUT */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto bg-slate-100/80 border-b border-slate-200 h-3"
        >
          <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
        </div>

        {/* Tableau */}
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="overflow-x-auto"
        >
          <table className="w-full text-left border-collapse min-w-[1000px]">
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
                <th className="py-3.5 px-3 whitespace-nowrap min-w-[200px]">Arrêt de Ramassage</th>
                <th className="py-3.5 px-3 whitespace-nowrap text-right">Tarif Mensuel</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Contact WhatsApp Parent</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Suivi des Mois</th>
                <th className="py-3.5 pr-5 pl-3 text-right whitespace-nowrap">Reçu WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Aucun élève abonné au transport trouvé.
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

                    {/* ACTION 1 : SUIVI DES MOIS TRANSPORT */}
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

                    {/* ACTION 2 : REÇU WHATSAPP TRANSPORT */}
                    <td className="py-3.5 pr-5 pl-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentForReceipt(sub)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
                      >
                        <ReceiptText className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Reçu Transport</span>
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

      {/* ================= MODALE 1 : SUIVI DES MOIS & TARIF TRANSPORT ================= */}
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

            {/* Ajustement Tarif Mensuel & Arrêt */}
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
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Mois de Transport Validés</span>
                <strong className="text-slate-900 font-heading text-sm">{selectedStudentForMonths.paidMonthsCount} sur 10 mois</strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Cotisations Transport</span>
                <strong className="text-emerald-800 font-heading text-base">{formatFCFA(selectedStudentForMonths.totalPaidAmount)}</strong>
              </div>
            </div>

            {/* Grille des Mois Scolaires (Septembre à Juin) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Pointage des Mois de Transport (Cliquer pour basculer) :
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
                <span>Enregistrer les Cotisations</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 2 : REÇU OFFICIEL DE TRANSPORT & ENVOI WHATSAPP ================= */}
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
                    Reçu de Transport Scolaire
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Quittance Officielle des Navettes • {currentSchool.name}
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
                <span className="text-slate-500 font-medium">Élève Titulaire de la Carte</span>
                <strong className="text-slate-900 uppercase font-heading">{selectedStudentForReceipt.fullName}</strong>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Matricule & Classe</span>
                <span className="font-mono font-bold text-slate-800">
                  {selectedStudentForReceipt.matricule || selectedStudentForReceipt.studentNumber} • {selectedStudentForReceipt.grade}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Arrêt de Ramassage</span>
                <span className="font-bold text-slate-900 text-right max-w-[240px]">
                  {selectedStudentForReceipt.pickupStop}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Mois de Transport Réglés</span>
                <span className="font-bold text-emerald-900 text-right max-w-[240px]">
                  {selectedStudentForReceipt.paidMonths && selectedStudentForReceipt.paidMonths.length > 0
                    ? selectedStudentForReceipt.paidMonths.join(', ')
                    : 'Aucun mois validé'}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Tarif Mensuel Navette</span>
                <span className="font-mono font-bold text-slate-800">{formatFCFA(selectedStudentForReceipt.monthlyRate)} / mois</span>
              </div>

              <div className="flex justify-between items-center pt-1 text-sm font-extrabold text-slate-950">
                <span>TOTAL COTISATIONS TRANSPORT</span>
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

      {/* ================= MODALE 3 : ITINÉRAIRES & HORAIRES DE PASSAGE DES CARS ================= */}
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
                    Plan des Itinéraires & Horaires de Passage des Cars
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
              {ITINERAIRES_DATA.map((item, idx) => (
                <div key={item.line} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-extrabold text-slate-950 text-sm font-heading">
                      {item.line}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      {item.bus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-white border border-slate-200">
                    <div>
                      <span className="text-slate-400 block font-medium">Chauffeur titulaire :</span>
                      <strong className="text-slate-800">{item.driver}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Accompagnatrice :</span>
                      <strong className="text-slate-800">{item.monitor}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Ramassage Matin :</span>
                      <strong className="text-emerald-800 font-mono">{item.morningTime}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Retour Soir :</span>
                      <strong className="text-blue-800 font-mono">{item.eveningTime}</strong>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-600 block mb-1">Arrêts desservis :</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.stops.map((stop) => (
                        <span key={stop} className="px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 text-[10.5px] font-medium">
                          📍 {stop}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer la Fiche Itinéraires</span>
              </button>

              <button
                type="button"
                onClick={() => setIsItinerairesModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 4 : NOUVEL ABONNEMENT CAR (DÉMARRE ENTIÈREMENT VIDE) ================= */}
      {isNewSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Bus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 font-heading">
                    Nouvel Abonnement Car Scolaire
                  </h3>
                  <p className="text-xs text-slate-500">
                    Souscription aux navettes de ramassage 2026-2027
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

              {/* Remplissage automatique dès la sélection de l'élève */}
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
                <label className="font-bold text-slate-700 block">Arrêt de Ramassage Souhaité *</label>
                <input
                  type="text"
                  required
                  value={newSubStop}
                  onChange={(e) => setNewSubStop(e.target.value)}
                  placeholder="Ex : Riviera Bonoumin, Angré Djibi, Deux Plateaux..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Tarif Mensuel Car en FCFA *</label>
                <input
                  type="number"
                  required
                  value={newSubRate}
                  onChange={(e) => setNewSubRate(e.target.value)}
                  placeholder="35000"
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
