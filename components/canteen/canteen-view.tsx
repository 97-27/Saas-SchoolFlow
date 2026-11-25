'use client';
import { currentAcademicYear } from '@/lib/data/school-calendar';
import { compareStudentsAlpha } from '@/lib/utils/alpha';

import { schoolPhonesText } from '@/lib/data/school-phones';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student, School, Invoice } from '@/lib/data/types';
import { GenderBadge } from '@/components/ui/badge';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { availableClasses, mockStudents } from '@/lib/data/mock-data';
import { getLiveStudents, getLiveInvoices, getLiveSchool, saveLivePaymentInvoice, DATA_UPDATED_EVENT, updateRegisteredStudent, deleteLiveStudents, broadcastLiveUpdate, saveLiveCanteenData, deleteServiceReceipts } from '@/lib/data/live-store';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import { ServicePrintListButton } from '@/components/services/service-print-list';
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
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Coins,
  BadgePercent,
  Copy,
  Loader2,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { Figure } from '@/components/ui/masked-figure';
import { ServiceBilan } from '@/components/services/service-bilan';
import { SCHOOL_MONTHS, buildServiceMonthInvoice, isPlaceholderInvoice, serviceMonthDetails, toIsoPayDate, type ServiceMonthDetail } from '@/lib/data/service-payments';
import type { ServicePaymentMeta } from '@/lib/data/live-store';
import { captureReceiptPng, copyPngToClipboard, downloadPng } from '@/lib/client/receipt-share';
import { ReceiptShareModal, type ReceiptShareData } from '@/components/services/receipt-share-modal';

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
];

const CANTEEN_PAYMENTS_KEY = 'schoolflow_canteen_monthly_payments_v3';
import { currentServiceMonth, markServiceStart } from '@/lib/data/service-start';

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
  // L'école pilote (epc-manoi) garde les clés historiques non suffixées (données réelles déjà
  // stockées ainsi) ; toute autre école reçoit une clé dédiée pour ne jamais partager ses
  // abonnés/paiements cantine avec une autre école sur le même navigateur.
  const isPilotSchool = !schoolSlug || schoolSlug === 'epc-manoi';
  const scopedCanteenSubKey = isPilotSchool ? CANTEEN_SUBSCRIPTIONS_KEY : `${CANTEEN_SUBSCRIPTIONS_KEY}_${schoolSlug}`;
  const scopedCanteenPayKey = isPilotSchool ? CANTEEN_PAYMENTS_KEY : `${CANTEEN_PAYMENTS_KEY}_${schoolSlug}`;
  const scopedCanteenMenuKey = isPilotSchool ? CANTEEN_MENU_KEY : `${CANTEEN_MENU_KEY}_${schoolSlug}`;

  // Relit toujours la version la plus fraîche depuis localStorage juste avant de fusionner un
  // changement, plutôt que de se fier à la copie en mémoire chargée au montage ou au dernier
  // DATA_UPDATED_EVENT : sans cela, un membre du personnel qui enregistre une nouvelle
  // souscription/un paiement pendant qu'un collègue (autre onglet/appareil) vient d'en
  // enregistrer un autre écrase silencieusement la modification de l'autre avec sa propre copie
  // périmée de la carte complète (même bug que celui déjà corrigé sur la page Présences).
  const readFreshCanteenSubMap = (): Record<string, { diet: string; rate: number; discount?: number }> => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(scopedCanteenSubKey);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  };
  const readFreshCanteenPayMap = (): Record<string, Record<string, boolean>> => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(scopedCanteenPayKey);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  };

  const [students, setStudents] = useState<Student[]>([]);
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('Toutes les classes');
  const [selectedDiet, setSelectedDiet] = useState('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [receiptShare, setReceiptShare] = useState<ReceiptShareData | null>(null);

  // Références de défilement horizontal synchronisé
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const receiptCardRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1200);

  // Modales
  const [selectedStudentForMonths, setSelectedStudentForMonths] = useState<any | null>(null);
  const [selectedStudentForReceipt, setSelectedStudentForReceipt] = useState<any | null>(null);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isNewSubModalOpen, setIsNewSubModalOpen] = useState(false);
  const [showDeleteCanteenModal, setShowDeleteCanteenModal] = useState(false);
  const [isDeletingCanteen, setIsDeletingCanteen] = useState(false);
  const [monthsPaymentDate, setMonthsPaymentDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [monthsPaymentMethod, setMonthsPaymentMethod] = useState<string>('Espèces');
  // Date propre à chaque mois coché : sans date saisie, le mois prend la date par défaut.
  const [monthDates, setMonthDates] = useState<Record<string, string>>({});
  const modalStudentId = selectedStudentForMonths?.id as string | undefined;
  // Mois déjà réglés avant d'ouvrir la fiche : leur date ne se modifie pas ici.
  const modalPreviouslyPaid = useMemo<Record<string, boolean>>(
    () => (modalStudentId ? readFreshCanteenPayMap()[modalStudentId] || {} : {}),
    [modalStudentId]
  );
  // Détail de chaque mois déjà facturé (date, montant, mode) : permet de corriger la date d'un mois réglé.
  const modalDetails = useMemo<Record<string, ServiceMonthDetail>>(
    () =>
      selectedStudentForMonths
        ? serviceMonthDetails(
            'cantine',
            [selectedStudentForMonths.id, selectedStudentForMonths.studentNumber],
            getLiveInvoices([], schoolSlug)
          )
        : {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modalStudentId, schoolSlug]
  );
  useEffect(() => {
    setMonthDates({});
  }, [modalStudentId]);

  // État du menu de la semaine modifiable
  const [weeklyMenu, setWeeklyMenu] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(scopedCanteenMenuKey);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_WEEKLY_MENU;
  });

  // Formulaire nouvelle souscription
  const [newSubStudentId, setNewSubStudentId] = useState('');
  const [newSubDiet, setNewSubDiet] = useState('Standard (Sans allergie)');
  const [newSubRate, setNewSubRate] = useState('25000');
  const [newSubDiscount, setNewSubDiscount] = useState('0');
  const [newSubSearchQuery, setNewSubSearchQuery] = useState('');
  const [newSubGradeFilter, setNewSubGradeFilter] = useState('Toutes les classes');

  // Suivi des mois payés : studentId -> { [monthName]: boolean }
  const [monthlyPayments, setMonthlyPayments] = useState<Record<string, Record<string, boolean>>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(scopedCanteenPayKey);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // Souscriptions personnalisées : studentId -> { diet, rate, discount }
  const [customDietMap, setCustomDietMap] = useState<Record<string, { diet: string; rate: number; discount?: number }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(scopedCanteenSubKey);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Synchronisation des élèves et des factures/quittances
  useEffect(() => {
    setStudents(getLiveStudents(mockStudents, schoolSlug));
    setInvoices(getLiveInvoices([], schoolSlug));
    setCurrentSchool(getLiveSchool(schoolSlug, school));

    const handleUpdate = () => {
      setStudents(getLiveStudents(mockStudents, schoolSlug));
      setInvoices(getLiveInvoices([], schoolSlug));
      setCurrentSchool(getLiveSchool(schoolSlug, school));
      if (typeof window !== 'undefined') {
        try {
          const savedPayments = localStorage.getItem(scopedCanteenPayKey);
          if (savedPayments) setMonthlyPayments(JSON.parse(savedPayments));
          const savedCustom = localStorage.getItem(scopedCanteenSubKey);
          if (savedCustom) setCustomDietMap(JSON.parse(savedCustom));
          const savedMenu = localStorage.getItem(scopedCanteenMenuKey);
          if (savedMenu) setWeeklyMenu(JSON.parse(savedMenu));
        } catch (e) {}
      }
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

  // Filtrage des élèves pour la modale de souscription
  const filteredStudentsForNewSub = useMemo(() => {
    // Recherche sans accents ni majuscules, mots dans n'importe quel ordre (« kone lassina »).
    const norm = (v: string) => (v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const words = norm(newSubSearchQuery).split(/\s+/).filter(Boolean);
    return students.filter((s) => {
      const hay = norm(`${s.fullName || ''} ${s.lastName || ''} ${s.firstName || ''} ${s.studentNumber || ''} ${s.matricule || ''}`);
      const matchSearch = words.every((w) => hay.includes(w));
      const matchGrade =
        newSubGradeFilter === 'Toutes les classes' || s.grade === newSubGradeFilter;
      return matchSearch && matchGrade;
    });
  }, [students, newSubSearchQuery, newSubGradeFilter]);

  // Déterminer l'élève sélectionné dans le formulaire nouvelle souscription
  const selectedStudentInNewSub = useMemo(() => {
    return students.find((s) => s.id === newSubStudentId) || null;
  }, [students, newSubStudentId]);

  // Liste des abonnés cantine adaptée aux données réelles enregistrées dans le module
  const subscribers = useMemo(() => {
    const canteenInvoiceStudentIds = new Set(
      invoices
        .filter((inv) => inv.feeType === 'Cantine' || inv.invoiceNumber?.startsWith('CAN-') || inv.notes?.toLowerCase().includes('cantine'))
        .map((inv) => inv.studentId)
    );

    return students
      .filter((stu) => {
        const hasCustom = Boolean(customDietMap[stu.id]);
        const monthsState = monthlyPayments[stu.id] || {};
        const hasPaidMonths = Object.values(monthsState).some(Boolean);
        const hasInvoice = canteenInvoiceStudentIds.has(stu.id);
        return hasCustom || hasPaidMonths || hasInvoice;
      })
      .map((stu) => {
        const custom = customDietMap[stu.id];
        const defaultDiet = 'Standard (Sans restriction)';

        const monthlyRate = custom?.rate || 25000;
        const discountAmount = custom?.discount || 0;
        const diet = custom?.diet || defaultDiet;

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
        };

        const paidMonths = Object.keys(monthsState).filter((m) => monthsState[m]);
        const paidMonthsCount = paidMonths.length;
        let grossAmount = paidMonthsCount * monthlyRate;
        let totalPaidAmount = Math.max(0, grossAmount - discountAmount);

        // Si aucun mois n'est encore coché manuellement mais qu'un paiement Cantine existe dans invoices
        const matchingInvoices = invoices.filter(
          (inv) =>
            // Par identifiant ; le nom ne sert que pour une ancienne facture sans identifiant.
            (inv.studentId ? inv.studentId === stu.id || inv.studentId === stu.studentNumber : inv.studentName === stu.fullName) &&
            (inv.feeType === 'Cantine' || inv.invoiceNumber?.startsWith('CAN-') || inv.notes?.toLowerCase().includes('cantine'))
        );
        const invoicePaidTotal = matchingInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

        if (totalPaidAmount === 0 && invoicePaidTotal > 0) {
          totalPaidAmount = invoicePaidTotal;
          grossAmount = invoicePaidTotal + discountAmount;
        }

        return {
          ...stu,
          dietaryRestrictions: diet,
          monthlyRate,
          discountAmount,
          grossAmount,
          monthsState,
          paidMonths,
          paidMonthsCount,
          totalPaidAmount,
        };
      });
  }, [students, customDietMap, monthlyPayments, invoices]);

  // Filtrage
  const filteredSubscribers = useMemo(() => {
    return [...subscribers].sort(compareStudentsAlpha).filter((sub) => {
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

  // Statistiques globales Cantine
  const stats = useMemo(() => {
    const totalSubscribers = subscribers.length;
    const girls = subscribers.filter((s) => s.gender === 'female').length;
    const boys = subscribers.filter((s) => s.gender === 'male').length;
    const specificDietCount = subscribers.filter(
      (s) => !s.dietaryRestrictions.toLowerCase().includes('standard')
    ).length;

    const totalCollected = subscribers.reduce((acc, s) => acc + s.totalPaidAmount, 0);
    const totalExigible = subscribers.reduce((acc, s) => acc + (s.monthlyRate * 9 - s.discountAmount), 0);
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

  // Modification rapide du tarif
  const handleQuickUpdateRate = (stuId: string, newRateStr: string) => {
    const newRate = parseInt(newRateStr, 10) || 0;
    const current = subscribers.find((s) => s.id === stuId);
    if (!current) return;

    const freshSub = readFreshCanteenSubMap();
    const nextMap = {
      ...freshSub,
      [stuId]: {
        diet: current.dietaryRestrictions,
        rate: newRate,
        discount: current.discountAmount || 0,
      },
    };

    setCustomDietMap(nextMap);
    saveLiveCanteenData(nextMap, readFreshCanteenPayMap(), undefined, schoolSlug);
  };

  // Basculer un mois pour l'élève en édition
  const toggleMonthStatus = (month: string) => {
    if (!selectedStudentForMonths) return;

    setSelectedStudentForMonths((prev: any) => {
      const nextMonths = {
        ...prev.monthsState,
        [month]: !prev.monthsState[month],
      };
      const paid = Object.keys(nextMonths).filter((m) => nextMonths[m]);
      const paidCount = paid.length;
      const gross = paidCount * prev.monthlyRate;
      const net = Math.max(0, gross - (prev.discountAmount || 0));

      return {
        ...prev,
        monthsState: nextMonths,
        paidMonths: paid,
        paidMonthsCount: paidCount,
        grossAmount: gross,
        totalPaidAmount: net,
      };
    });
  };

  // Sauvegarder les cotisations et la réduction spéciale
  const handleSaveMonthlyPayments = () => {
    if (!selectedStudentForMonths) return;

    const stuId = selectedStudentForMonths.id;
    // Mois déjà réglés AVANT cette modification : seuls les mois nouvellement cochés donnent un encaissement.
    const previousMonths: Record<string, boolean> = readFreshCanteenPayMap()[stuId] || {};
    const nextPayments = {
      ...readFreshCanteenPayMap(),
      [stuId]: selectedStudentForMonths.monthsState,
    };
    setMonthlyPayments(nextPayments);

    const nextCustom = {
      ...readFreshCanteenSubMap(),
      [stuId]: {
        diet: selectedStudentForMonths.dietaryRestrictions,
        rate: selectedStudentForMonths.monthlyRate,
        discount: selectedStudentForMonths.discountAmount || 0,
      },
    };
    setCustomDietMap(nextCustom);
    // Détail de chaque mois nouvellement coché : date saisie, montant du mois, moyen de paiement.
    const defaultPayDate = monthsPaymentDate || new Date().toISOString().split('T')[0];
    const payDateOf = (m: string) => toIsoPayDate(monthDates[m] || defaultPayDate);
    const newlyPaidMonths = SCHOOL_MONTHS.filter(
      (m) => selectedStudentForMonths.monthsState?.[m] && !previousMonths[m]
    );
    // Mois DÉJÀ réglés dont la date a été corrigée : on met à jour leur ligne et leur facture.
    const editedMonths = SCHOOL_MONTHS.filter(
      (m) =>
        selectedStudentForMonths.monthsState?.[m] &&
        previousMonths[m] &&
        monthDates[m] &&
        toIsoPayDate(monthDates[m]) !== (modalDetails[m]?.date || '')
    );
    const paymentMeta: ServicePaymentMeta = { [stuId]: {} };
    newlyPaidMonths.forEach((m) => {
      paymentMeta[stuId][m] = {
        date: payDateOf(m),
        amount: selectedStudentForMonths.monthlyRate,
        method: monthsPaymentMethod || 'Espèces',
      };
    });
    editedMonths.forEach((m) => {
      paymentMeta[stuId][m] = {
        date: payDateOf(m),
        amount: modalDetails[m]?.amount || selectedStudentForMonths.monthlyRate,
        method: modalDetails[m]?.method || 'Espèces',
      };
    });
    saveLiveCanteenData(nextCustom, nextPayments, undefined, schoolSlug, paymentMeta);

    // Journal des encaissements : un règlement = un mois nouvellement coché, avec son montant du
    // mois, sa date, son moyen de paiement et les coordonnées du parent (jamais le cumul).
    // Mois déjà réglé et date corrigée : on réécrit SA facture (même numéro), sans en créer une autre.
    editedMonths.forEach((month) => {
      const detail = modalDetails[month];
      if (detail && !isPlaceholderInvoice(detail.invoice)) {
        saveLivePaymentInvoice({ ...detail.invoice, issueDate: payDateOf(month), dueDate: payDateOf(month) }, schoolSlug);
      }
    });
    newlyPaidMonths.forEach((month) => {
      saveLivePaymentInvoice(
        buildServiceMonthInvoice({
          service: 'cantine',
          studentId: stuId,
          studentNumber: selectedStudentForMonths.studentNumber,
          fullName: selectedStudentForMonths.fullName,
          avatar: selectedStudentForMonths.avatar,
          grade: selectedStudentForMonths.grade,
          gender: selectedStudentForMonths.gender,
          guardianName: selectedStudentForMonths.guardianName,
          guardianPhone: selectedStudentForMonths.whatsappPhone || selectedStudentForMonths.guardianPhone,
          enrollmentType: selectedStudentForMonths.enrollmentType,
          month,
          amount: selectedStudentForMonths.monthlyRate,
          paymentMethod: monthsPaymentMethod || 'Espèces',
          paymentDate: payDateOf(month),
        }),
        schoolSlug
      );
    });

    setToastMessage(`✓ Cotisations & Réduction enregistrées pour ${selectedStudentForMonths.fullName}`);
    setTimeout(() => setToastMessage(null), 4000);
    setSelectedStudentForMonths(null);
  };

  // Sauvegarder une nouvelle souscription
  const handleCreateNewSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubStudentId) {
      alert('Veuillez sélectionner un élève.');
      return;
    }

    const rate = parseInt(newSubRate, 10) || 25000;
    const discount = parseInt(newSubDiscount, 10) || 0;

    const nextCustom = {
      ...readFreshCanteenSubMap(),
      [newSubStudentId]: {
        diet: newSubDiet,
        rate,
        discount,
      },
    };
    setCustomDietMap(nextCustom);

    // Le service commence CE mois-ci : le premier règlement est celui du mois en cours, et les mois
    // déjà écoulés ne sont pas dus (ils n'apparaîtront pas dans le Suivi des versements).
    const startMonth = currentServiceMonth();
    markServiceStart(schoolSlug, 'cantine', newSubStudentId, startMonth);
    const nextPayments = {
      ...readFreshCanteenPayMap(),
      [newSubStudentId]: {
        Septembre: false,
        Octobre: false,
        Novembre: false,
        Décembre: false,
        Janvier: false,
        Février: false,
        Mars: false,
        Avril: false,
        Mai: false,
        [startMonth]: true,
      },
    };
    setMonthlyPayments(nextPayments);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(scopedCanteenSubKey, JSON.stringify(nextCustom));
        localStorage.setItem(scopedCanteenPayKey, JSON.stringify(nextPayments));
      } catch (e) {}
    }

    // Créer la transaction de cantine pour Septembre et mettre à jour le statut élève
    const targetStu = students.find((s) => s.id === newSubStudentId);
    if (targetStu) {
      const updatedStu = {
        ...targetStu,
        // Le statut cantine est porté uniquement par le champ isCanteen (voir lib/data/types.ts),
        // déjà lu partout (parent-scolarite-tab.tsx, live-store.ts). Le marqueur texte
        // "| Cantine (Oui)" était en plus injecté directement dans l'adresse de résidence de
        // l'élève, où il restait affiché en permanence dans les formulaires de modification.
        isCanteen: true,
        updatedAt: new Date().toISOString(),
      };
      updateRegisteredStudent(updatedStu, schoolSlug);
      // Le premier mois (Septembre) est un règlement comme les autres : une facture au montant du mois.
      const todayStr = new Date().toISOString().split('T')[0];
      saveLivePaymentInvoice(
        buildServiceMonthInvoice({
          service: 'cantine',
          studentId: newSubStudentId,
          studentNumber: targetStu.studentNumber,
          fullName: targetStu.fullName,
          avatar: targetStu.avatar,
          grade: targetStu.grade,
          gender: targetStu.gender,
          guardianName: targetStu.guardianName,
          guardianPhone: targetStu.whatsappPhone || targetStu.guardianPhone,
          enrollmentType: targetStu.enrollmentType,
          month: startMonth,
          amount: rate,
          paymentMethod: 'Espèces',
          paymentDate: todayStr,
        }),
        schoolSlug
      );
    }

    saveLiveCanteenData(nextCustom, nextPayments, undefined, schoolSlug, {
      [newSubStudentId]: {
        [startMonth]: { date: new Date().toISOString().split('T')[0], amount: rate, method: 'Espèces' },
      },
    });
    setIsNewSubModalOpen(false);
    setToastMessage('✓ Nouvelle souscription à la cantine enregistrée avec succès.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Retirer uniquement de l'abonnement cantine
  const handleRemoveFromCanteenOnly = async () => {
    if (!selectedStudentForReceipt) return;
    setIsDeletingCanteen(true);
    try {
      const studentId = selectedStudentForReceipt.id;
      const studentNumber = selectedStudentForReceipt.studentNumber;
      const matricule = selectedStudentForReceipt.matricule;

      // a. Mettre à jour l'élève (isCanteen: false)
      const foundStudent = students.find((s) => s.id === studentId);
      if (foundStudent) {
        const updatedStudent: Student = {
          ...foundStudent,
          isCanteen: false,
          notes: (foundStudent.notes || '').replace(/cantine\s*\(oui\)/gi, '').trim(),
        };
        updateRegisteredStudent(updatedStudent, schoolSlug);
      }

      // b. Nettoyer customDietMap
      const nextMap = { ...readFreshCanteenSubMap() };
      delete nextMap[studentId];
      if (studentNumber) delete nextMap[studentNumber];
      if (matricule) delete nextMap[matricule];
      setCustomDietMap(nextMap);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(scopedCanteenSubKey, JSON.stringify(nextMap));
        } catch (e) {}
      }

      // c. Nettoyer monthlyPayments
      const nextPayments = { ...readFreshCanteenPayMap() };
      delete nextPayments[studentId];
      if (studentNumber) delete nextPayments[studentNumber];
      if (matricule) delete nextPayments[matricule];
      setMonthlyPayments(nextPayments);
      saveLiveCanteenData(nextMap, nextPayments, undefined, schoolSlug);

      // d. Supprimer les reçus de CANTINE de l'élève (ici et en base, confirmé) — jamais son
      //    reçu de scolarité (avant, tous ses reçus étaient effacés localement et le vrai reçu de
      //    cantine restait en base).
      const receiptsDeleted = await deleteServiceReceipts({ id: studentId, studentNumber }, 'cantine', schoolSlug);

      // e. Diffuser l'événement
      broadcastLiveUpdate({
        action: 'canteen_removed',
        studentId,
        schoolSlug,
      });
      window.dispatchEvent(new CustomEvent(DATA_UPDATED_EVENT, { detail: { action: 'canteen_removed' } }));

      setShowDeleteCanteenModal(false);
      setSelectedStudentForReceipt(null);
      if (!receiptsDeleted) return;
      setToastMessage(`✓ L'élève ${selectedStudentForReceipt.fullName} a été retiré de la cantine scolaire.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Erreur lors du retrait de la cantine:', err);
    } finally {
      setIsDeletingCanteen(false);
    }
  };

  // 2. Supprimer définitivement l'élève et tous ses reçus (si doublon)
  const handleDeleteEntireCanteenStudent = async () => {
    if (!selectedStudentForReceipt) return;
    setIsDeletingCanteen(true);
    try {
      const studentId = selectedStudentForReceipt.id;
      const studentNumber = selectedStudentForReceipt.studentNumber;
      const matricule = selectedStudentForReceipt.matricule;

      // Nettoyer map et payments
      const nextMap = { ...readFreshCanteenSubMap() };
      delete nextMap[studentId];
      if (studentNumber) delete nextMap[studentNumber];
      if (matricule) delete nextMap[matricule];
      setCustomDietMap(nextMap);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(scopedCanteenSubKey, JSON.stringify(nextMap));
        } catch (e) {}
      }

      const nextPayments = { ...readFreshCanteenPayMap() };
      delete nextPayments[studentId];
      if (studentNumber) delete nextPayments[studentNumber];
      if (matricule) delete nextPayments[matricule];
      setMonthlyPayments(nextPayments);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(scopedCanteenPayKey, JSON.stringify(nextPayments));
        } catch (e) {}
      }

      // Supprimer définitivement l'élève et tous ses reçus (confirmé par la base)
      saveLiveCanteenData(nextMap, nextPayments, undefined, schoolSlug);
      const idsToDelete = [studentId, studentNumber, matricule].filter(Boolean) as string[];
      const confirmed = await deleteLiveStudents(idsToDelete, schoolSlug);

      setShowDeleteCanteenModal(false);
      setSelectedStudentForReceipt(null);
      if (!confirmed) return;
      setToastMessage(`✓ Reçu et dossier de ${selectedStudentForReceipt.fullName} définitivement supprimés.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Erreur suppression totale cantine:', err);
    } finally {
      setIsDeletingCanteen(false);
    }
  };

  // Partage WhatsApp du reçu avec copie d'image dans le presse-papier
  // Le reçu part sur WhatsApp : la discussion s'ouvre pendant le clic, l'image est photographiée,
  // téléchargée automatiquement sur l'appareil et copiée ; l'aperçu permet de la recopier ou de la
  // retélécharger à tout moment (voir lib/client/receipt-share.ts).
  const handleSendReceiptWhatsApp = async (sub: any) => {
    if (!sub) return;
    const rawPhone = sub.whatsappPhone || sub.guardianPhone || '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const monthsLabel = sub.paidMonths.length > 1 ? 'Mois réglés' : 'Mois réglé';
    const message = `Bonjour,\nVoici le reçu officiel de restauration (Cantine Scolaire) pour votre enfant *${sub.fullName}* (${sub.grade}) pour l'année ${currentSchool.academicYear || currentAcademicYear()}.\n• Régime : ${sub.dietaryRestrictions}\n• Total encaissé : ${formatFCFA(sub.totalPaidAmount)}\n• ${monthsLabel} : ${sub.paidMonths.length > 0 ? sub.paidMonths.join(', ') : 'Aucun'}\n• Établissement : ${currentSchool.name}.`;
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    // Ouvert pendant le clic, sinon le navigateur bloque la fenêtre.
    window.open(waUrl, '_blank');

    setIsGeneratingImage(true);
    try {
      const blob = await captureReceiptPng(receiptCardRef.current);
      if (!blob) {
        setToastMessage('⚠️ Image du reçu non générée. Utilisez « Imprimer le Reçu » puis envoyez-le sur WhatsApp.');
        setTimeout(() => setToastMessage(null), 6000);
        return;
      }
      const fileName = `Recu-Cantine-${sub.studentNumber || 'ELEVE'}-${String(sub.fullName).replace(/\s+/g, '_')}.png`;
      downloadPng(blob, fileName);
      const copied = await copyPngToClipboard(blob);
      setReceiptShare({
        imageUrl: URL.createObjectURL(blob),
        blob,
        fileName,
        waUrl,
        recipient: rawPhone || 'non renseigné',
        name: sub.fullName,
        copied,
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Enregistrer le menu hebdomadaire
  const handleSaveWeeklyMenu = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(scopedCanteenMenuKey, JSON.stringify(weeklyMenu));
      } catch (e) {}
    }
    setIsMenuModalOpen(false);
    setToastMessage('✓ Menu de la semaine mis à jour avec succès.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6 sm:space-y-7 animate-fadeIn">
      {/* 1. EN-TÊTE DE PAGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 font-heading">
              Restauration & Demi-Pension
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-2xl font-extrabold text-slate-900 tracking-tight font-heading">
            Cantine Scolaire
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-sans mt-0.5">
            Gestion des inscriptions, régimes, fiches médicales et suivi des cotisations mensuelles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <ServicePrintListButton
            serviceName="Cantine"
            detailLabel="Régime"
            signatureLabel="Émargement"
            schoolName={currentSchool.name}
            grades={availableClasses.filter((c) => c !== 'Toutes les classes')}
            subscribers={subscribers.map((s) => ({
              id: s.id,
              fullName: s.fullName,
              studentNumber: s.studentNumber,
              grade: s.grade,
              detail: s.dietaryRestrictions,
              monthsState: s.monthsState,
            }))}
          />
          <button
            type="button"
            onClick={() => setIsMenuModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
            <span>Menu de la Semaine</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewSubStudentId('');
              setNewSubDiet('Standard (Sans allergie)');
              setNewSubRate('25000');
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

      {/* Toast Centré au Milieu de l'Écran */}
      {toastMessage && (
        <div className="fixed inset-x-0 bottom-5 z-[9999] flex justify-center px-4 pointer-events-none animate-in fade-in duration-200">
          <div className="pointer-events-auto bg-slate-900/95 text-white border border-emerald-500/50 px-6 py-4 rounded-3xl shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs sm:text-sm font-bold animate-in zoom-in-95 duration-200 max-w-md text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="leading-snug text-left flex-1">{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
              <span className="text-xl sm:text-2xl xl:text-2xl font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap">
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
              <span className="text-xl sm:text-2xl xl:text-2xl font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap text-teal-900">
                <Figure>{formatFCFA(stats.totalCollected)}</Figure>
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Cotisations mensuelles perçues à ce jour
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-teal-700 font-medium flex items-center justify-between">
            <span>Taux de recouvrement</span>
            <span className="font-bold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              <Figure>{stats.recoveryRate}</Figure>% perçu
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
              <span className="text-xl sm:text-2xl xl:text-2xl font-extrabold text-rose-900 tracking-tight font-heading whitespace-nowrap">
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

      <ServiceBilan
        title="Bilan financier de la Cantine"
        accent="amber"
        rows={subscribers.map((s) => ({
          id: s.id,
          name: s.fullName,
          grade: s.grade,
          paidMonthsCount: s.paidMonthsCount,
          totalPaid: s.totalPaidAmount,
          totalDue: Math.max(0, s.monthlyRate * 9 - s.discountAmount),
          monthlyRate: s.monthlyRate,
          monthsState: s.monthsState,
        }))}
      />

      {/* 3. Table des Inscrits Cantine avec Défilement en Haut */}
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

        {/* Barre de défilement horizontal EN HAUT DU TABLEAU */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="custom-top-scrollbar overflow-x-auto bg-slate-100/90 border-b border-slate-200"
          style={{ height: '16px' }}
        >
          <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
        </div>

        {/* Tableau */}
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
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
                <th className="py-3.5 px-3 whitespace-nowrap">Régime & Allergies</th>
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
                          <span>Mois ({sub.paidMonthsCount}/9)</span>
                        </button>
                      </td>

                      {/* COLONNE D'ACTION : GÉRER & REÇU TEMPS RÉEL */}
                      <td className="py-3.5 pr-5 pl-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForReceipt(sub)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer shadow-2xs"
                        >
                          <ReceiptText className="w-3.5 h-3.5 text-white" />
                          <span>Voir le reçu</span>
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
            Utilisez les boutons de défilement en haut ou cliquez sur « Modifier & Reçu »
          </span>
        </div>
      </div>

      {/* ================= MODALE 1 : SUIVI DES COTISATIONS, RÉDUCTION & TARIF PAR ÉLÈVE ================= */}
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
                <label className="font-bold text-slate-700 block">Réduction / Remise</label>
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

            {/* Date et Mode de Règlement du versement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Date par défaut *</label>
                <FrenchDateInput
                  value={monthsPaymentDate}
                  onChange={setMonthsPaymentDate}
                  className="w-full text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Mode de Règlement *</label>
                <select
                  value={monthsPaymentMethod}
                  onChange={(e) => setMonthsPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold text-slate-900 bg-white cursor-pointer"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Paiement en ligne (Wave)">Paiement en ligne (Wave)</option>
                  <option value="Orange Money">Orange Money</option>
                  <option value="MTN Money">MTN Money</option>
                  <option value="Moov Money">Moov Money</option>
                  <option value="Virement bancaire">Virement bancaire</option>
                  <option value="Chèque">Chèque</option>
                </select>
              </div>
            </div>

            {/* Total réglé calculé */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Mois Validés</span>
                <strong className="text-slate-900 font-heading text-sm">{selectedStudentForMonths.paidMonthsCount} sur 9 mois</strong>
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
                <span>Pointage des 9 mois scolaires :</span>
                <span className="text-[11px] text-slate-400">Cliquez pour valider/invalider</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {MONTHS_LIST.map((month) => {
                  const isPaid = !!selectedStudentForMonths.monthsState?.[month];
                  const isNewlyChecked = isPaid && !modalPreviouslyPaid[month];
                  return (
                    <div key={month} className="flex flex-col gap-1">
                      <button
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
                      {isPaid && (
                        <div className="text-[10px]">
                          <FrenchDateInput
                            value={monthDates[month] ?? (isNewlyChecked ? monthsPaymentDate : modalDetails[month]?.date || '')}
                            onChange={(v) => setMonthDates((prev) => ({ ...prev, [month]: v }))}
                            className="w-full text-[11px]"
                          />
                        </div>
                      )}
                    </div>
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
                <span>Enregistrer le tarif</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 2 : REÇU OFFICIEL DE CANTINE & ENVOI WHATSAPP (AVEC RÉDUCTION) ================= */}
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
                    Reçu de Restauration Scolaire
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
                  <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-tight font-heading leading-tight">
                    {currentSchool.name}
                  </h2>
                  {currentSchool.shortName && (
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono font-black text-[9.5px] tracking-wider shadow-2xs">
                        {currentSchool.shortName.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <p className="text-[9.5px] italic text-emerald-900 font-semibold leading-tight">
                    « {currentSchool.motto || 'Discipline • Rigueur • Réussite'} »
                  </p>
                  {currentSchool.slogan && (
                    <p className="text-[9px] font-medium text-amber-700 italic leading-tight">
                      ✦ {currentSchool.slogan}
                    </p>
                  )}
                  <p className="text-[8.5px] text-slate-500 font-mono leading-tight">
                    Code : {currentSchool.ministryCode || 'Non renseigné'} • Tél : {schoolPhonesText(currentSchool)}
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
                    Service Demi-Pension
                  </span>
                  <span className="font-extrabold font-heading text-xs sm:text-sm">
                    REÇU OFFICIEL DE CANTINE SCOLAIRE
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-amber-400 font-bold text-xs">{currentSchool.academicYear || currentAcademicYear()}</span>
                </div>
              </div>

              {/* Détails Bénéficiaire */}
              <div className="grid grid-cols-2 gap-2 text-xs border border-slate-200 rounded-xl p-3 bg-slate-50/70">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Élève Bénéficiaire :</span>
                  <strong className="text-slate-950 font-heading text-xs sm:text-sm">{selectedStudentForReceipt.fullName}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">{selectedStudentForReceipt.matricule ? 'ID / Matr. & Classe :' : 'ID & Classe :'}</span>
                  <span className="font-mono font-bold text-slate-900">{selectedStudentForReceipt.studentNumber}{selectedStudentForReceipt.matricule ? ` (${selectedStudentForReceipt.matricule})` : ''} • {selectedStudentForReceipt.grade}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Régime Alimentaire :</span>
                  <span className="font-semibold text-emerald-800">{selectedStudentForReceipt.dietaryRestrictions}</span>
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
                        <div className="font-bold text-slate-900">Cantine Scolaire Mensuelle</div>
                        <div className="text-[10px] text-slate-400">
                          Tarif : {formatFCFA(selectedStudentForReceipt.monthlyRate)} / mois
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-xs">
                          {selectedStudentForReceipt.paidMonthsCount} / 9 mois
                        </span>
                        {selectedStudentForReceipt.paidMonths.length > 0 && (
                          <span className="block text-[9.5px] text-emerald-950 font-extrabold mt-0.5 max-w-[200px] truncate">
                            {selectedStudentForReceipt.paidMonths.join(', ')}
                          </span>
                        )}
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

              {/* Détail mois par mois : date de versement, mode et montant de chaque mois réglé */}
              {(() => {
                const det = serviceMonthDetails(
                  'cantine',
                  [selectedStudentForReceipt.id, selectedStudentForReceipt.studentNumber],
                  getLiveInvoices([], schoolSlug)
                );
                const paidList = MONTHS_LIST.filter((m) => selectedStudentForReceipt.monthsState?.[m]);
                return (
                  <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                    <div className="bg-emerald-50 px-3 py-1.5 font-extrabold text-emerald-950 border-b border-emerald-200">
                      Détail des versements par mois
                    </div>
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase">
                        <tr>
                          <th className="py-1.5 px-3">Mois</th>
                          <th className="py-1.5 px-3">Date du versement</th>
                          <th className="py-1.5 px-3">Mode</th>
                          <th className="py-1.5 px-3 text-right">Montant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-900">
                        {paidList.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-2 px-3 text-center text-slate-500">Aucun mois réglé</td>
                          </tr>
                        )}
                        {paidList.map((m) => {
                          const d = det[m];
                          return (
                            <tr key={m}>
                              <td className="py-1.5 px-3 font-bold">{m}</td>
                              <td className="py-1.5 px-3 font-mono font-semibold">
                                {d?.date ? toIsoPayDate(d.date).split('-').reverse().join('/') : '—'}
                              </td>
                              <td className="py-1.5 px-3">{d?.method || '—'}</td>
                              <td className="py-1.5 px-3 text-right font-mono font-black">
                                {formatFCFA(d?.amount || selectedStudentForReceipt.monthlyRate)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Suivi Visuel des 9 Mois de l'Année Scolaire */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  État des Règlements par Mois (9 Mois Scolaires) :
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 text-center">
                  {MONTHS_LIST.map((m) => {
                    const isPaid = selectedStudentForReceipt.monthsState?.[m];
                    return (
                      <div
                        key={m}
                        className={`py-1 px-1 rounded-lg border text-[9.5px] font-extrabold transition-all ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}
                      >
                        <span className="block truncate">{m.slice(0, 4)}.</span>
                        <span className="text-[8.5px]">{isPaid ? '✓ Réglé' : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cachet Officiel */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <div className="text-[9px] text-slate-400 italic">
                  Reçu officiel numéroté émis par l&apos;Économe.
                </div>
                {currentSchool.stampUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentSchool.stampUrl} alt="Cachet officiel" className="max-h-28 print:max-h-36 max-w-[190px] print:max-w-[240px] object-contain opacity-90 rotate-[-4deg]" />
                ) : (
                <div className="p-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50 flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Cachet Électronique Certifié</span>
                </div>
                )}
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

              <button
                type="button"
                onClick={() => setShowDeleteCanteenModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-all shadow-2xs cursor-pointer"
                title="Supprimer ce reçu ou cette souscription de cantine"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Supprimer ce Reçu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aperçu du reçu envoyé à WhatsApp (téléchargé + copié automatiquement) */}
      {receiptShare && <ReceiptShareModal data={receiptShare} onClose={() => setReceiptShare(null)} />}

      {/* Modale de Confirmation de Suppression de Reçu / Abonnement Cantine */}
      {showDeleteCanteenModal && selectedStudentForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-950 font-heading">
                  Supprimer ce Reçu / Inscription à la Cantine ?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choisissez le mode de suppression pour ce reçu de restauration scolaire.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteCanteenModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Récapitulatif de l'élève */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Élève :</span>
                <span className="font-extrabold text-slate-950 truncate max-w-[220px]">
                  {selectedStudentForReceipt.fullName}
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Matricule / ID :</span>
                <span className="font-mono font-bold text-slate-800">
                  {selectedStudentForReceipt.studentNumber} {selectedStudentForReceipt.matricule ? `(${selectedStudentForReceipt.matricule})` : ''} • {selectedStudentForReceipt.grade}
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Régime alimentaire :</span>
                <span className="font-bold text-emerald-800">
                  {selectedStudentForReceipt.dietaryRestrictions}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Total Réglé :</span>
                <span className="font-mono font-black text-emerald-700">
                  {formatFCFA(selectedStudentForReceipt.totalPaidAmount || 0)} ({selectedStudentForReceipt.paidMonthsCount}/9 mois)
                </span>
              </div>
            </div>

            {/* Options de suppression */}
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isDeletingCanteen}
                onClick={handleRemoveFromCanteenOnly}
                className="w-full p-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-left transition-all cursor-pointer flex items-start gap-3 group"
              >
                <RotateCcw className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 group-hover:rotate-[-45deg] transition-transform" />
                <div className="flex-1">
                  <span className="text-xs font-bold text-amber-950 block">
                    1. Retirer uniquement de la cantine (Recommandé)
                  </span>
                  <span className="text-[11px] text-amber-800 mt-0.5 block">
                    L&apos;élève reste scolarisé dans l&apos;école. Seuls son inscription à la cantine, son reçu et ses mensualités de restauration sont supprimés.
                  </span>
                </div>
              </button>

              <button
                type="button"
                disabled={isDeletingCanteen}
                onClick={handleDeleteEntireCanteenStudent}
                className="w-full p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-left transition-all cursor-pointer flex items-start gap-3 group"
              >
                <Trash2 className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div className="flex-1">
                  <span className="text-xs font-bold text-rose-950 block">
                    2. Supprimer définitivement le reçu et le dossier complet
                  </span>
                  <span className="text-[11px] text-rose-800 mt-0.5 block">
                    Idéal si ce reçu est un doublon accidentel. L&apos;élève et tous ses reçus disparaîtront immédiatement de toute la base de données.
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={isDeletingCanteen}
                onClick={() => setShowDeleteCanteenModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Annuler
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

      {/* ================= MODALE 4 : NOUVELLE SOUSCRIPTION CANTINE ================= */}
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
                    Nouvelle Souscription Cantine
                  </h3>
                  <p className="text-xs text-slate-500">
                    Inscrire un élève au service de restauration
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
                <input
                  type="search"
                  autoComplete="off"
                  value={newSubSearchQuery}
                  onChange={(e) => setNewSubSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom, numéro ou matricule…"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-300 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="text-[11px] text-slate-500">
                  {filteredStudentsForNewSub.length} élève(s) trouvé(s) parmi les élèves déjà inscrits.
                </p>
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
                  <label className="font-bold text-slate-700 block">Tarif Mensuel (FCFA)</label>
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
                <label className="font-bold text-slate-700 block">Régime / Fiche Médicale</label>
                <input
                  type="text"
                  value={newSubDiet}
                  onChange={(e) => setNewSubDiet(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900"
                  placeholder="Ex: Standard ou Allergie arachides"
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
