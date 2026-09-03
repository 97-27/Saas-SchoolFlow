'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  History,
  Sparkles,
  Coins,
  Edit3,
  ShieldCheck,
  FolderOpen,
  User,
  Share2,
  Lock,
} from 'lucide-react';

interface BoardingViewProps {
  initialBoarders?: any[];
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

const BOARDING_PAYMENTS_KEY = 'schoolflow_boarding_monthly_payments_v2';
const BOARDING_SUBSCRIPTIONS_KEY = 'schoolflow_boarding_subscriptions_v2';

export function BoardingView({
  school,
  schoolSlug,
}: BoardingViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('Toutes les classes');
  const [selectedPavilion, setSelectedPavilion] = useState('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modales secondaires
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isNewAdmissionModalOpen, setIsNewAdmissionModalOpen] = useState(false);

  // Synchronized horizontal scroll references
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1000);

  // Formulaire nouvelle admission modal
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

  // Souscriptions personnalisées et chambres par élève
  const [customBoardingMap, setCustomBoardingMap] = useState<Record<string, { room: string; pavilion: string; rate: number }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(BOARDING_SUBSCRIPTIONS_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // Synchronisation des élèves et école
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

  // Synchronisation de la barre de défilement horizontal
  useEffect(() => {
    const updateWidth = () => {
      if (tableContainerRef.current) {
        setTableScrollWidth(Math.max(900, tableContainerRef.current.scrollWidth));
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

  // Pensionnaires réels de l'internat
  const boarders = useMemo(() => {
    return students
      .filter((stu, idx) => {
        return customBoardingMap[stu.id] || idx % 3 === 0;
      })
      .map((stu, idx) => {
        const custom = customBoardingMap[stu.id];
        const isBoy = stu.gender === 'male';
        const defaultPavilion = isBoy ? 'Pavillon A (Garçons)' : 'Pavillon B (Filles)';
        const defaultRoom = isBoy ? `Chambre G-${101 + (idx % 8)}` : `Chambre F-${201 + (idx % 8)}`;

        const pavilion = custom?.pavilion || defaultPavilion;
        const room = custom?.room || defaultRoom;
        const monthlyRate = custom?.rate || 50000;

        // Mois payés par défaut si non enregistrés
        const monthsState = monthlyPayments[stu.id] || {
          Septembre: true,
          Octobre: true,
          Novembre: idx % 2 === 0,
          Décembre: idx % 3 === 0,
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
          pavilion,
          roomNumber: room,
          monthlyRate,
          monthsState,
          paidMonths,
          paidMonthsCount,
          totalPaidAmount,
        };
      });
  }, [students, customBoardingMap, monthlyPayments]);

  // ═══════════════════════════════════════════════════════════════
  // ÉTAT DU FORMULAIRE ET REÇU INTERACTIF EN DIRECT
  // ═══════════════════════════════════════════════════════════════
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);

  // Formulaire d'encaissement et de coordonnées de l'élève actif
  const [formFullName, setFormFullName] = useState('');
  const [formMatricule, setFormMatricule] = useState('');
  const [formStudentNumber, setFormStudentNumber] = useState('ID-001');
  const [formGrade, setFormGrade] = useState('6ème');
  const [formGender, setFormGender] = useState<'male' | 'female'>('male');
  const [formPavilion, setFormPavilion] = useState('Pavillon A (Garçons)');
  const [formRoom, setFormRoom] = useState('Chambre G-101');
  const [formPhone, setFormPhone] = useState('+225 07 48 92 11 00');
  const [formMonthlyRate, setFormMonthlyRate] = useState<number>(50000);
  const [formPaymentDate, setFormPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [formPaymentMethod, setFormPaymentMethod] = useState<
    'Espèces' | 'Wave' | 'Orange Money' | 'MTN Money' | 'Moov Money' | 'Virement' | 'Chèque'
  >('Espèces');
  const [formMonthsState, setFormMonthsState] = useState<Record<string, boolean>>({
    Septembre: true,
    Octobre: true,
    Novembre: false,
    Décembre: false,
    Janvier: false,
    Février: false,
    Mars: false,
    Avril: false,
    Mai: false,
    Juin: false,
  });

  // Initialiser le premier élève au chargement
  useEffect(() => {
    if (boarders.length > 0 && !selectedStudentId) {
      loadStudentIntoForm(boarders[0]);
    }
  }, [boarders, selectedStudentId]);

  // Fonction pour charger un élève dans le formulaire et le reçu
  const loadStudentIntoForm = (boarder: any) => {
    if (!boarder) return;
    setSelectedStudentId(boarder.id);
    setFormFullName(boarder.fullName || '');
    setFormMatricule(boarder.matricule || 'MAT-2026-001');
    setFormStudentNumber(boarder.studentNumber || 'ID-001');
    setFormGrade(boarder.grade || '6ème');
    setFormGender(boarder.gender === 'female' ? 'female' : 'male');
    setFormPavilion(boarder.pavilion || 'Pavillon A (Garçons)');
    setFormRoom(boarder.roomNumber || 'Chambre G-101');
    setFormPhone(boarder.whatsappPhone || boarder.guardianPhone || '+225 07 48 92 11 00');
    setFormMonthlyRate(boarder.monthlyRate || 50000);
    setFormMonthsState(
      boarder.monthsState || {
        Septembre: true,
        Octobre: true,
        Novembre: false,
        Décembre: false,
        Janvier: false,
        Février: false,
        Mars: false,
        Avril: false,
        Mai: false,
        Juin: false,
      }
    );
  };

  // Navigation Suivant / Précédent
  const handleNavigateId = (direction: 'prev' | 'next') => {
    if (boarders.length === 0) return;
    const currentIndex = boarders.findIndex((b) => b.id === selectedStudentId);
    if (currentIndex === -1) {
      loadStudentIntoForm(boarders[0]);
      return;
    }

    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0) nextIndex = boarders.length - 1;
    if (nextIndex >= boarders.length) nextIndex = 0;

    loadStudentIntoForm(boarders[nextIndex]);
  };

  // Basculer un mois dans le formulaire interactif
  const handleToggleFormMonth = (month: string) => {
    setFormMonthsState((prev) => ({
      ...prev,
      [month]: !prev[month],
    }));
  };

  // Calculs en temps réel pour l'élève actif
  const activePaidMonths = useMemo(() => {
    return Object.keys(formMonthsState).filter((m) => formMonthsState[m]);
  }, [formMonthsState]);

  const activeUnpaidMonths = useMemo(() => {
    return MONTHS_LIST.filter((m) => !formMonthsState[m]);
  }, [formMonthsState]);

  const activeTotalPaidAmount = useMemo(() => {
    return activePaidMonths.length * formMonthlyRate;
  }, [activePaidMonths, formMonthlyRate]);

  const activeTotalAnnualExigible = useMemo(() => {
    return formMonthlyRate * 10;
  }, [formMonthlyRate]);

  const activeAnnualRemaining = useMemo(() => {
    return Math.max(0, activeTotalAnnualExigible - activeTotalPaidAmount);
  }, [activeTotalAnnualExigible, activeTotalPaidAmount]);

  // Enregistrement des coordonnées & quittance
  const handleSaveActiveReceipt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedStudentId) {
      alert('Veuillez sélectionner un élève ou créer une nouvelle admission.');
      return;
    }

    const newPayments = {
      ...monthlyPayments,
      [selectedStudentId]: formMonthsState,
    };

    const newBoardingMap = {
      ...customBoardingMap,
      [selectedStudentId]: {
        room: formRoom,
        pavilion: formPavilion,
        rate: formMonthlyRate,
      },
    };

    setMonthlyPayments(newPayments);
    setCustomBoardingMap(newBoardingMap);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(BOARDING_PAYMENTS_KEY, JSON.stringify(newPayments));
        localStorage.setItem(BOARDING_SUBSCRIPTIONS_KEY, JSON.stringify(newBoardingMap));
      } catch (err) {}
    }

    setToastMessage(
      `✓ Reçu officiel et cotisations d’internat actualisés avec succès pour ${formFullName} (${formStudentNumber}) !`
    );
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Impression ciblée du Reçu Officiel A4
  const handlePrintReceipt = () => {
    window.print();
  };

  // Partage WhatsApp du Reçu d'Internat
  const handleShareWhatsApp = () => {
    const cleanPhone = formPhone.replace(/[^0-9]/g, '');
    const receiptRef = `REC-INTERN-2026-${formMatricule || '001'}`;
    const paidMonthsStr = activePaidMonths.length > 0 ? activePaidMonths.join(', ') : 'Aucun mois validé';
    const unpaidMonthsStr = activeUnpaidMonths.length > 0 ? activeUnpaidMonths.join(', ') : 'Année entièrement soldée ✓';

    const message =
      `*REÇU OFFICIEL DE PAIEMENT D'INTERNAT & PENSIONNAT — ${currentSchool.name.toUpperCase()}*\n\n` +
      `Bonjour Chers Parents de *${formFullName}* (${formGrade}),\n\n` +
      `Nous vous délivrons la confirmation officielle du règlement des cotisations d'internat et d'hébergement scolaire :\n\n` +
      `📄 *Réf Quittance :* ${receiptRef}\n` +
      `👤 *Élève :* ${formFullName} (Matricule : ${formMatricule} • ${formStudentNumber})\n` +
      `🏫 *Classe :* ${formGrade}\n` +
      `🛏️ *Hébergement :* ${formPavilion} — ${formRoom}\n` +
      `📅 *Mois d'Internat Réglés :* ${paidMonthsStr} (${activePaidMonths.length}/10 mois)\n` +
      `⏳ *Mois Restants :* ${unpaidMonthsStr}\n` +
      `💰 *Tarif Mensuel :* ${formatFCFA(formMonthlyRate)} / mois\n` +
      `💵 *TOTAL ENCAISSÉ :* ${formatFCFA(activeTotalPaidAmount)}\n` +
      `💳 *Mode de Règlement :* ${formPaymentMethod}\n` +
      `🗓️ *Date d'émission :* ${formatDate(formPaymentDate)}\n\n` +
      `_« ${currentSchool.motto || 'Discipline • Rigueur • Réussite'} »_\n` +
      `Merci pour votre confiance. — *Intendance & Direction ${currentSchool.shortName || 'EPC MANOI'}*`;

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Filtrage du tableau des pensionnaires
  const filteredBoarders = useMemo(() => {
    return boarders.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        b.fullName.toLowerCase().includes(q) ||
        b.matricule.toLowerCase().includes(q) ||
        b.studentNumber.toLowerCase().includes(q) ||
        b.roomNumber.toLowerCase().includes(q);

      const matchesClass =
        selectedClass === 'Toutes les classes' ||
        b.grade.toLowerCase() === selectedClass.toLowerCase();

      const matchesPavilion =
        selectedPavilion === 'all' ||
        b.pavilion.toLowerCase().includes(selectedPavilion.toLowerCase());

      return matchesSearch && matchesClass && matchesPavilion;
    });
  }, [boarders, searchQuery, selectedClass, selectedPavilion]);

  // Statistiques Internat (3 Cartes KPI du haut)
  const stats = useMemo(() => {
    const totalBoarders = boarders.length;
    const girls = boarders.filter((b) => b.gender === 'female').length;
    const boys = boarders.filter((b) => b.gender === 'male').length;

    const totalCollected = boarders.reduce((acc, b) => acc + b.totalPaidAmount, 0);
    const totalExigible = boarders.reduce((acc, b) => acc + b.monthlyRate * 10, 0);
    const recoveryRate = totalExigible > 0 ? ((totalCollected / totalExigible) * 100).toFixed(1) : '0';

    return {
      totalBoarders,
      girls,
      boys,
      totalCollected,
      totalExigible,
      recoveryRate,
    };
  }, [boarders]);

  // Enregistrer une nouvelle admission internat depuis la modale
  const handleCreateAdmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubStudentId) {
      alert('Veuillez sélectionner un élève.');
      return;
    }

    const rate = parseInt(newSubRate, 10) || 50000;
    const nextBoardingMap = {
      ...customBoardingMap,
      [newSubStudentId]: {
        room: newSubRoom || 'Chambre G-105',
        pavilion: newSubPavilion,
        rate,
      },
    };

    setCustomBoardingMap(nextBoardingMap);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(BOARDING_SUBSCRIPTIONS_KEY, JSON.stringify(nextBoardingMap));
      } catch (e) {}
    }

    const stu = students.find((s) => s.id === newSubStudentId);
    if (stu) {
      loadStudentIntoForm({
        ...stu,
        pavilion: newSubPavilion,
        roomNumber: newSubRoom || 'Chambre G-105',
        monthlyRate: rate,
      });
    }

    setToastMessage(`✓ Nouvelle admission à l’internat validée pour ${stu ? stu.fullName : 'l’élève'} !`);
    setTimeout(() => setToastMessage(null), 5000);
    setIsNewAdmissionModalOpen(false);
    setNewSubStudentId('');
    setNewSubRoom('');
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDU DU REÇU OFFICIEL STRICT (EN-TÊTE HIÉRARCHIQUE SOIGNÉ)
  // ═══════════════════════════════════════════════════════════════
  const renderReceiptSlip = (copyLabel?: string) => {
    return (
      <div className="bg-white rounded-2xl border-2 border-slate-900 shadow-sm relative overflow-hidden p-4 sm:p-5 space-y-3.5">
        {/* CADRE EN-TÊTE OFFICIEL : Respect strict de l'ordre d'affichage demandé par Mouhamed */}
        <div className="relative z-10 border-2 border-slate-900 rounded-xl bg-white shadow-2xs p-3">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* 1. Logo de l'École (À gauche) */}
            <div className="shrink-0 text-center flex items-center justify-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    currentSchool.logoUrl ||
                    'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&auto=format&fit=crop&q=80'
                  }
                  alt={currentSchool.name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            </div>

            {/* 2. Centre : Nom école -> Sigle -> Devise -> Slogan -> Code & Numéro */}
            <div className="flex-1 min-w-0 px-1 text-center space-y-0.5">
              {/* Ligne 1 : Nom de l'école */}
              <h2
                className="font-black uppercase tracking-tight text-slate-950 font-heading text-xs sm:text-sm md:text-base block w-full leading-tight break-words"
                title={currentSchool.name}
              >
                {currentSchool.name || 'EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL'}
              </h2>

              {/* Ligne 2 : Sigle de l'école */}
              <p className="font-extrabold text-emerald-800 text-[11px] sm:text-xs tracking-wide">
                ({currentSchool.shortName || 'EPC MANOI'})
              </p>

              {/* Ligne 3 : Devise de la discipline */}
              <p className="font-semibold text-emerald-900 italic text-[9.5px] sm:text-[11px] truncate">
                « {currentSchool.motto || 'Discipline • Rigueur • Réussite'} »
              </p>

              {/* Ligne 4 : Slogan de l'école */}
              {currentSchool.slogan && (
                <p className="font-medium text-amber-700 italic text-[9px] sm:text-[10px] truncate">
                  ✦ {currentSchool.slogan}
                </p>
              )}

              {/* Ligne 5 : Code Établissement & Numéro de Téléphone */}
              <p className="text-slate-700 font-medium leading-tight text-[9.5px] sm:text-[10.5px] truncate">
                Code Établissement : {currentSchool.ministryCode || '321119'} • Tél :{' '}
                {currentSchool.phone || currentSchool.whatsappPhone || '+225 01 02 03 04 05'}
              </p>
              <p className="text-slate-500 font-medium leading-tight text-[9px] truncate">
                {currentSchool.city || 'Abidjan'} — {currentSchool.country || 'Côte d’Ivoire'}
              </p>
            </div>

            {/* 3. Emblème National / Sceau Officiel (À droite) */}
            <div className="shrink-0 text-center flex items-center justify-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    currentSchool.countryEmblemUrl ||
                    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png'
                  }
                  alt="Emblème National"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* BANDEAU OFFICIEL : QUITTANCE DE PAIEMENT D'INTERNAT */}
        <div className="relative z-10 bg-slate-950 text-white rounded-xl flex items-center justify-between shadow-xs px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ReceiptText className="text-emerald-400 shrink-0 w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-extrabold tracking-wider uppercase font-heading text-xs sm:text-sm md:text-base">
              QUITTANCE OFFICIELLE D&apos;INTERNAT
            </span>
            {copyLabel && (
              <span className="px-2 py-0.5 rounded font-mono font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[9.5px] sm:text-xs">
                {copyLabel}
              </span>
            )}
          </div>
          <span className="font-mono font-extrabold text-emerald-300 text-xs sm:text-sm">
            REC-INTERN-2026-{formMatricule || '001'}
          </span>
        </div>

        {/* Détails Pensionnaire */}
        <div className="relative z-10 grid grid-cols-2 rounded-xl bg-slate-50/90 border border-slate-200 gap-2.5 sm:gap-3 p-3.5 text-xs sm:text-sm">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">
              Identifiant & Matricule :
            </span>
            <span className="font-mono font-black text-slate-950 text-xs sm:text-sm">
              {formStudentNumber} • {formMatricule}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">
              Année Scolaire & Date :
            </span>
            <span className="font-extrabold text-slate-950 text-xs sm:text-sm">
              {currentSchool.academicYear} • {formatDate(formPaymentDate)}
            </span>
          </div>

          <div className="col-span-2 pt-1 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-1">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">
                Pensionnaire Résident :
              </span>
              <span className="font-black text-slate-950 uppercase font-heading text-sm sm:text-base">
                {formFullName || 'NOM PRÉNOM'}
              </span>{' '}
              <span className="ml-1 text-[11px] font-bold text-slate-700">
                ({formGender === 'female' ? '♀ Fille' : '♂ Garçon'})
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">
                Classe & Hébergement :
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-black bg-purple-50 text-purple-950 border border-purple-300 shadow-2xs">
                {formGrade} • {formRoom}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">
              Pavillon Résidentiel :
            </span>
            <span className="font-bold text-slate-900 text-xs">
              {formPavilion}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">
              Parent / WhatsApp :
            </span>
            <span className="font-mono font-bold text-emerald-800 text-xs">
              {formPhone}
            </span>
          </div>
        </div>

        {/* Grille du Décompte & Mois Réglés */}
        <div className="relative z-10 border border-slate-300 rounded-xl overflow-hidden shadow-2xs bg-white text-xs">
          <div className="bg-slate-100/90 p-2.5 border-b border-slate-300 flex items-center justify-between font-bold text-[11px] uppercase tracking-wider text-slate-700">
            <span>Désignation des Prestations</span>
            <span>Montant en FCFA</span>
          </div>

          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-800">
              <span>Frais d&apos;Hébergement, Dortoir & Restauration ({activePaidMonths.length} mois réglés) :</span>
              <span className="font-mono font-bold text-slate-950">{formatFCFA(activeTotalPaidAmount)}</span>
            </div>

            {/* Badges des mois réglés */}
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                Détail des Mois Couverts (Septembre → Juin) :
              </span>
              <div className="flex flex-wrap gap-1">
                {MONTHS_LIST.map((m) => {
                  const isPaid = !!formMonthsState[m];
                  return (
                    <span
                      key={m}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                      }`}
                    >
                      {m} {isPaid ? '✓' : ''}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-600">
              <span>Tarif Mensuel d&apos;Internat :</span>
              <span className="font-mono font-bold text-slate-800">{formatFCFA(formMonthlyRate)} / mois</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span>Mode de Règlement Retenu :</span>
              <span className="font-bold text-slate-900">{formPaymentMethod}</span>
            </div>
          </div>

          {/* Grand Total Encaissé & Reste Annuel */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-slate-50 border-t border-slate-300 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-900 block">
                Montant Total Encaissé
              </span>
              <span className="text-xl sm:text-2xl font-extrabold font-heading text-emerald-950 tracking-tight">
                {formatFCFA(activeTotalPaidAmount)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Reste Annuel pour Solder
              </span>
              <span className={`font-mono font-bold text-xs sm:text-sm ${activeAnnualRemaining > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                {activeAnnualRemaining > 0 ? formatFCFA(activeAnnualRemaining) : '0 FCFA (Soldé ✓)'}
              </span>
            </div>
          </div>
        </div>

        {/* Pied de Quittance : Mention légale & Double signature */}
        <div className="relative z-10 pt-2 border-t border-slate-200 text-[10px] space-y-3">
          <p className="text-center italic text-slate-500 font-medium">
            « Tout versement en caisse donne droit à un reçu numéroté immédiat. Aucun remboursement après encaissement. »
          </p>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="text-center p-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="font-bold text-slate-700 block text-[10px] uppercase">
                Signature du Parent / Déposant
              </span>
              <div className="h-10 sm:h-12 flex items-center justify-center text-slate-400 italic text-[9px]">
                (Lu et approuvé)
              </div>
            </div>

            <div className="text-center p-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="font-bold text-emerald-900 block text-[10px] uppercase">
                L&apos;Économe / Intendant Internat
              </span>
              <div className="h-10 sm:h-12 flex items-center justify-center font-bold text-emerald-800 font-mono text-[9.5px]">
                [ Cachet Officiel {currentSchool.shortName || 'EPC'} ]
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Internat & Pensionnat Scolaire
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Gestion des dortoirs, coordonnées pensionnaires, quittance automatique et cotisations mensuelles — {currentSchool.name}
          </p>
        </div>

        {/* Actions rapides */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handlePrintReceipt}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
            title="Imprimer le reçu officiel sur une page A4"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>Imprimer Reçu</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer"
            title="Envoyer la quittance au parent sur WhatsApp"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRegisterModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-purple-600" />
            <span>Registre Dortoirs</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewSubStudentId('');
              setNewSubRoom('');
              setNewSubPavilion('Pavillon A (Garçons)');
              setNewSubRate('50000');
              setIsNewAdmissionModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouvelle admission</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="text-emerald-700 font-bold ml-4 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 2. LES 3 CARTES KPI INTERNAT DU HAUT */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 print:hidden">
        {/* Card 1 : Total Pensionnaires */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 shadow-xs">
                <BedDouble className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Total Pensionnaires
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap">
                {stats.totalBoarders} élèves
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
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
            <span>Régime</span>
            <span className="font-semibold text-slate-800">Pension complète 7j/7</span>
          </div>
        </div>

        {/* Card 2 : Recouvrement Internat */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 shadow-xs">
                <Home className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Recouvrement Pensionnat
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

        {/* Card 3 : Occupation des Pavillons */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Occupation des Dortoirs
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap text-emerald-950">
                {stats.totalBoarders} / 30 lits
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Pavillon A & B
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {Math.max(0, 30 - stats.totalBoarders)} lits disponibles pour nouvelles admissions
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Encadrement</span>
            <span className="font-semibold text-emerald-700">Surveillance 24h/24</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 3. SECTION PRINCIPALE 2 COLONNES (FORMULAIRE & REÇU EN DIRECT) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= COLONNE GAUCHE : FORMULAIRE DE SAISIE (6 COLS) ================= */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-7 space-y-5 print:hidden">
          {/* EN-TÊTE DU FORMULAIRE AVEC SÉLECTEUR RAPIDE D'ID */}
          <div className="border-b border-slate-100 pb-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-heading">
                    Coordonnées & Quittance Internat
                  </h2>
                  <p className="text-xs text-slate-500">
                    Saisissez les coordonnées ci-dessous, le reçu se met à jour en direct
                  </p>
                </div>
              </div>

              {/* BOUTONS NAVIGATION RAPIDE */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => handleNavigateId('prev')}
                  className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
                  title="Voir le pensionnaire précédent"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Précédent</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigateId('next')}
                  className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
                  title="Voir le pensionnaire suivant"
                >
                  <span className="hidden sm:inline">Suivant</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsStudentPickerOpen(!isStudentPickerOpen)}
                  className="px-3 py-1.5 rounded-xl font-mono font-extrabold text-xs transition-all border shadow-2xs inline-flex items-center gap-1.5 cursor-pointer bg-purple-50 text-purple-900 border-purple-300 ring-2 ring-purple-500/20"
                  title="Rechercher parmi les pensionnaires"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>{formStudentNumber}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isStudentPickerOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* SÉLECTEUR DÉROULANT RAPIDE DIRECTEMENT CLIQUABLE */}
            <div className="p-3 bg-gradient-to-r from-purple-50/90 via-slate-50 to-emerald-50/80 rounded-2xl border-2 border-purple-300 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="direct-boarding-select" className="text-xs font-extrabold text-slate-900 font-heading flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Sélectionner le Pensionnaire Actif :</span>
                </label>
                <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md">
                  {boarders.length} pensionnaires
                </span>
              </div>

              <select
                id="direct-boarding-select"
                value={selectedStudentId}
                onChange={(e) => {
                  const found = boarders.find((b) => b.id === e.target.value);
                  if (found) loadStudentIntoForm(found);
                }}
                className="w-full px-3 py-2 rounded-xl bg-white border border-purple-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-2xs"
              >
                {boarders.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.studentNumber} • {b.matricule} — {b.fullName} ({b.grade} • {b.roomNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* FORMULAIRE DE SAISIE DES COORDONNÉES */}
          <form onSubmit={handleSaveActiveReceipt} className="space-y-4 text-xs">
            {/* 1. Nom, Prénom & Matricule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Nom & Prénom de l&apos;Élève *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="Ex : KOUADIO Emmanuel"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white text-xs font-bold text-slate-900 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Matricule National / Dossier *
                </label>
                <input
                  type="text"
                  required
                  value={formMatricule}
                  onChange={(e) => setFormMatricule(e.target.value)}
                  placeholder="Ex : MAT-2026-0042"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white text-xs font-mono font-bold text-slate-900 transition-all"
                />
              </div>
            </div>

            {/* 2. Classe, Genre, Pavillon & Chambre */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Classe *</label>
                <select
                  value={formGrade}
                  onChange={(e) => setFormGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 cursor-pointer"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Genre *</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFormGender('male');
                      setFormPavilion('Pavillon A (Garçons)');
                    }}
                    className={`py-2 text-center rounded-xl font-bold border transition-all cursor-pointer ${
                      formGender === 'male'
                        ? 'bg-blue-50 text-blue-900 border-blue-300 ring-1 ring-blue-500 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    ♂ Garçon
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormGender('female');
                      setFormPavilion('Pavillon B (Filles)');
                    }}
                    className={`py-2 text-center rounded-xl font-bold border transition-all cursor-pointer ${
                      formGender === 'female'
                        ? 'bg-pink-50 text-pink-900 border-pink-300 ring-1 ring-pink-500 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    ♀ Fille
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Chambre / Dortoir *</label>
                <input
                  type="text"
                  required
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                  placeholder="Ex : Chambre G-102"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* 3. Pavillon & Coordonnées Parent */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Pavillon Résidentiel *</label>
                <select
                  value={formPavilion}
                  onChange={(e) => setFormPavilion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800 cursor-pointer"
                >
                  <option value="Pavillon A (Garçons)">Pavillon A (Garçons)</option>
                  <option value="Pavillon B (Filles)">Pavillon B (Filles)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Téléphone WhatsApp Parent *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+225 07 48 92 11 00"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 4. PARAMÈTRES FINANCIERS DE LA COTISATION */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>Paramètres Financiers & Encaissement</span>
                </span>
                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                  Tarif Modifiable
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block text-[10px]">
                    Frais Mensuels en FCFA *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formMonthlyRate}
                    onChange={(e) => setFormMonthlyRate(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block text-[10px]">
                    Date du Versement *
                  </label>
                  <FrenchDateInput
                    value={formPaymentDate}
                    onChange={setFormPaymentDate}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block text-[10px]">
                    Mode de Règlement *
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Wave">Wave</option>
                    <option value="Orange Money">Orange Money</option>
                    <option value="MTN Money">MTN Money</option>
                    <option value="Moov Money">Moov Money</option>
                    <option value="Virement">Virement bancaire</option>
                    <option value="Chèque">Chèque</option>
                  </select>
                </div>
              </div>

              {/* GRILLE DES 10 MOIS SCOLAIRES (Septembre à Juin) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] block">
                    Cocher les Mois d&apos;Hébergement Réglés :
                  </span>
                  <span className="text-[10px] font-extrabold text-emerald-800">
                    {activePaidMonths.length} / 10 mois validés
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {MONTHS_LIST.map((month) => {
                    const isPaid = !!formMonthsState[month];
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => handleToggleFormMonth(month)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                          isPaid
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        <span className="text-[11px] truncate w-full">{month}</span>
                        <span className={`text-[9px] mt-0.5 ${isPaid ? 'text-emerald-100 font-bold' : 'text-slate-400'}`}>
                          {isPaid ? 'Payé ✓' : 'En attente'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Récapitulatif Total & Reste de l'année */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Total Encaissé ({activePaidMonths.length} mois)
                  </span>
                  <strong className="text-emerald-800 font-heading text-base font-extrabold">
                    {formatFCFA(activeTotalPaidAmount)}
                  </strong>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Reste Annuel à Payer
                  </span>
                  <strong className={`font-mono text-xs sm:text-sm font-bold ${activeAnnualRemaining > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                    {activeAnnualRemaining > 0 ? formatFCFA(activeAnnualRemaining) : '0 FCFA (Soldé ✓)'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Bouton Principal de Validation */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 px-6 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Enregistrer & Actualiser la Quittance</span>
              </button>
            </div>
          </form>
        </div>

        {/* ================= COLONNE DROITE : LE REÇU OFFICIEL EN DIRECT (6 COLS) ================= */}
        <div className="lg:col-span-6 print:hidden">
          {renderReceiptSlip()}
        </div>
      </div>

      {/* ================= ZONE D'IMPRESSION OFFICIELLE A4 ================= */}
      <div id="official-boarding-receipt-print" className="hidden print:block print:w-full">
        {renderReceiptSlip('EXEMPLAIRE OFFICIEL DE CAISSE')}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 4. TABLEAU DES PENSIONNAIRES (COLONNES ÉPURÉES & FRAIS FIXES) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden print:hidden">
        {/* Toolbar */}
        <div className="p-3.5 sm:p-4 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher pensionnaire, chambre, matricule..."
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

          <div className="relative flex-1 sm:flex-none min-w-[170px]">
            <select
              value={selectedPavilion}
              onChange={(e) => setSelectedPavilion(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 cursor-pointer"
            >
              <option value="all">Tous les pavillons</option>
              <option value="Garçons">Pavillon A (Garçons)</option>
              <option value="Filles">Pavillon B (Filles)</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {(searchQuery || selectedClass !== 'Toutes les classes' || selectedPavilion !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedClass('Toutes les classes');
                setSelectedPavilion('all');
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

        {/* Tableau épuré sans les colonnes superflues, frais bloqués en lecture seule */}
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="overflow-x-auto"
        >
          <table className="w-full text-left border-collapse min-w-[800px]">
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
                <th className="py-3.5 px-3 whitespace-nowrap">Pavillon & Chambre</th>
                <th className="py-3.5 px-3 whitespace-nowrap text-right min-w-[140px]">Frais Mensuels (FCFA)</th>
                <th className="py-3.5 pr-5 pl-3 whitespace-nowrap">Contact WhatsApp Parent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredBoarders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Aucun pensionnaire d&apos;internat trouvé.
                  </td>
                </tr>
              ) : (
                filteredBoarders.map((sub) => {
                  const isSelected = sub.id === selectedStudentId;

                  return (
                    <tr
                      key={sub.id}
                      onClick={() => {
                        loadStudentIntoForm(sub);
                        window.scrollTo({ top: 380, behavior: 'smooth' });
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-purple-50/60 hover:bg-purple-50/80 ring-1 ring-purple-300'
                          : 'hover:bg-emerald-50/20'
                      }`}
                      title="Cliquez pour charger ce pensionnaire dans le formulaire et le reçu"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => loadStudentIntoForm(sub)}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 text-[11px] whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded border ${
                          isSelected ? 'bg-purple-100 text-purple-900 border-purple-300 font-black' : 'bg-slate-100 border-slate-200'
                        }`}>
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
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 block">{sub.roomNumber}</span>
                          <span className="text-[10px] text-purple-700 font-semibold">{sub.pavilion}</span>
                        </div>
                      </td>

                      {/* FRAIS MENSUELS BLOQUÉS EN LECTURE SEULE */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 text-xs">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>{formatFCFA(sub.monthlyRate)}</span>
                        </span>
                      </td>

                      <td className="py-3.5 pr-5 pl-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
            Total affiché : <strong className="text-slate-900 font-bold">{filteredBoarders.length}</strong> pensionnaires inscrits à l&apos;internat
          </span>
          <span className="text-[11px] text-slate-400">
            Cliquez sur une ligne pour charger immédiatement le reçu officiel en haut
          </span>
        </div>
      </div>

      {/* ================= MODALE : REGISTRE OFFICIEL DE L'INTERNAT ================= */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold shrink-0">
                  <BedDouble className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-950 font-heading">
                    Registre Officiel des Pensionnaires & Dortoirs
                  </h3>
                  <p className="text-xs text-slate-500">
                    Année Scolaire {currentSchool.academicYear} • {currentSchool.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Total Résidents</span>
                  <span className="text-xl font-black text-purple-950 font-heading">{stats.totalBoarders} élèves</span>
                </div>
                <div className="p-3 rounded-xl bg-pink-50 border border-pink-200">
                  <span className="text-[10px] uppercase font-bold text-pink-700 block">Filles (Pavillon B)</span>
                  <span className="text-xl font-black text-pink-950 font-heading">♀ {stats.girls}</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">Garçons (Pavillon A)</span>
                  <span className="text-xl font-black text-blue-950 font-heading">♂ {stats.boys}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Lits Libres</span>
                  <span className="text-xl font-black text-emerald-950 font-heading">{Math.max(0, 30 - stats.totalBoarders)} lits</span>
                </div>
              </div>

              <table className="w-full text-left border-collapse border border-slate-200 text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-600">
                    <th className="p-2">N°</th>
                    <th className="p-2">Matricule</th>
                    <th className="p-2">Pensionnaire</th>
                    <th className="p-2 text-center">Classe</th>
                    <th className="p-2">Chambre</th>
                    <th className="p-2">Contact Parent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {boarders.map((b, idx) => (
                    <tr key={b.id}>
                      <td className="p-2 font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-2 font-mono font-bold text-slate-800">{b.matricule}</td>
                      <td className="p-2 font-extrabold uppercase text-slate-950">{b.fullName}</td>
                      <td className="p-2 text-center font-bold">{b.grade}</td>
                      <td className="p-2 font-semibold text-purple-900">{b.roomNumber} ({b.pavilion.includes('Garçons') ? 'Pavillon A' : 'Pavillon B'})</td>
                      <td className="p-2 font-mono text-emerald-800">{b.whatsappPhone || b.guardianPhone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer le Registre Officiel</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE : NOUVELLE ADMISSION INTERNAT ================= */}
      {isNewAdmissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <BedDouble className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 font-heading">
                    Nouvelle Admission Internat
                  </h3>
                  <p className="text-xs text-slate-500">
                    Affectation en pensionnat scolaire 2026-2027
                  </p>
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

            <form onSubmit={handleCreateAdmission} className="space-y-4 text-xs">
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                    Sélectionner l&apos;élève ({students.length} disponibles) :
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={newSubSearchQuery}
                      onChange={(e) => setNewSubSearchQuery(e.target.value)}
                      placeholder="Nom, matricule..."
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs focus:ring-1 focus:ring-purple-500"
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
                  <option value="">-- Choisir un élève --</option>
                  {students
                    .filter((s) => {
                      const matchSearch =
                        !newSubSearchQuery ||
                        s.fullName?.toLowerCase().includes(newSubSearchQuery.toLowerCase()) ||
                        s.matricule?.toLowerCase().includes(newSubSearchQuery.toLowerCase());
                      const matchGrade =
                        newSubGradeFilter === 'Toutes les classes' || s.grade === newSubGradeFilter;
                      return matchSearch && matchGrade;
                    })
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.studentNumber} • {s.fullName} ({s.grade})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Pavillon Résidentiel *</label>
                <select
                  value={newSubPavilion}
                  onChange={(e) => setNewSubPavilion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold text-slate-800 cursor-pointer"
                >
                  <option value="Pavillon A (Garçons)">Pavillon A (Garçons)</option>
                  <option value="Pavillon B (Filles)">Pavillon B (Filles)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Numéro de Chambre *</label>
                <input
                  type="text"
                  required
                  value={newSubRoom}
                  onChange={(e) => setNewSubRoom(e.target.value)}
                  placeholder="Ex : Chambre G-104, Chambre F-203..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Frais Mensuels en FCFA *</label>
                <input
                  type="number"
                  required
                  value={newSubRate}
                  onChange={(e) => setNewSubRate(e.target.value)}
                  placeholder="50000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewAdmissionModalOpen(false)}
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
                  Valider l&apos;Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
