'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student, School, Invoice } from '@/lib/data/types';
import { GenderBadge } from '@/components/ui/badge';
import { formatFCFA, formatDate, splitFullNameNomFirst } from '@/lib/utils/formatters';
import { availableClasses, mockStudents } from '@/lib/data/mock-data';
import { getLiveStudents, getLiveSchool, DATA_UPDATED_EVENT, getDeletedStudentIds, broadcastLiveUpdate, saveLivePaymentInvoice, updateRegisteredStudent, deleteLiveStudents } from '@/lib/data/live-store';
import { saveStudentToSupabase, saveInvoiceToSupabase, deleteInvoiceFromSupabase } from '@/lib/supabase/services';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import {
  BedDouble,
  Building2,
  Phone,
  PlusCircle,
  Search,
  ChevronDown,
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
  Coins,
  Edit3,
  ShieldCheck,
  User,
  Share2,
  Check,
  RotateCcw,
  Sparkles,
  FileCheck,
  Download,
  Copy,
  Loader2,
  ImageIcon,
  Eye,
  ExternalLink,
  Smartphone,
  Lock,
  Trash2,
} from 'lucide-react';

interface BoardingViewProps {
  initialBoarders?: any;
  school: School;
  schoolSlug: string;
}

// Formateur robuste pour WhatsApp (formats Côte d'Ivoire & International)
const formatCleanWhatsApp = (phone: string): string => {
  let d = (phone || '').replace(/\D/g, '');
  if (d.startsWith('225')) {
    if (d.length === 11) d = '22507' + d.slice(3);
    return d;
  }
  if (d.length === 10) return '225' + d;
  if (d.length === 8) return '22507' + d;
  return d ? (d.startsWith('225') ? d : `225${d}`) : '';
};

// Helper date du jour au format strict JJ/MM/AAAA
const getTodayFrenchDateStr = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// 9 Mois scolaires officiels (Septembre à Mai)
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

const BOARDING_PAYMENTS_KEY = 'schoolflow_boarding_monthly_payments_v3';
const BOARDING_SUBSCRIPTIONS_KEY = 'schoolflow_boarding_subscriptions_v3';
const STUDENTS_STORAGE_KEY = 'schoolflow_registered_students_v1';
const INVOICES_STORAGE_KEY = 'schoolflow_registered_invoices_v1';

export function BoardingView({
  school,
  schoolSlug,
}: BoardingViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPavilionFilter, setSelectedPavilionFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Modale finale de confirmation avec bouton OK suite à l'enregistrement d'une quittance
  const [successReceiptModalData, setSuccessReceiptModalData] = useState<{
    studentName: string;
    matricule: string;
    className: string;
    pavilion: string;
    room: string;
    totalPaid: number;
    remaining: number;
    paidMonthsCount: number;
    paymentDate: string;
    paymentMethod: string;
  } | null>(null);

  // Modale de Confirmation de Souscription d'Internat
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Modale de suppression de reçu / pensionnaire
  const [showDeleteBoardingModal, setShowDeleteBoardingModal] = useState(false);
  const [isDeletingBoarding, setIsDeletingBoarding] = useState(false);

  // Modale d'Aperçu & Partage Image HD (WhatsApp)
  const [whatsAppPreviewData, setWhatsAppPreviewData] = useState<{
    imageUrl: string;
    blob: Blob;
    fileName: string;
    phone: string;
    cleanPhone: string;
    name: string;
  } | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [generatedImagePreviewUrl, setGeneratedImagePreviewUrl] = useState<string | null>(null);

  // Référence DOM du reçu pour la capture d'image et impression isolée
  const receiptRef = useRef<HTMLDivElement>(null);

  // Mode création d'une nouvelle souscription vierge
  const [isCreatingNew, setIsCreatingNew] = useState(false);

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
      studentName?: string;
      matricule?: string;
      className?: string;
      gender?: 'M' | 'F';
      parentContact?: string;
      pavilion: string;
      roomNumber: string;
      monthlyRate: number;
      paymentDate?: string;
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

  // Capacité personnalisée de l'internat (modifiable par l'établissement)
  const [boardingCapacity, setBoardingCapacity] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`schoolflow_boarding_capacity_${schoolSlug}`);
        if (saved !== null) return parseInt(saved, 10) || 0;
      } catch (e) {}
    }
    return 0;
  });
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState(boardingCapacity.toString());

  const handleSaveCapacity = (newVal: number) => {
    setBoardingCapacity(newVal);
    setIsEditingCapacity(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`schoolflow_boarding_capacity_${schoolSlug}`, newVal.toString());
      } catch (e) {}
    }
    setToastMessage(`✓ Capacité de l’internat fixée à ${newVal} places.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Synchronisation globale avec le live-store
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
          if (savedSubs) {
            const parsed: any[] = JSON.parse(savedSubs);
            const deletedIds = getDeletedStudentIds();
            const validSubs = parsed.filter(
              (cs) => !deletedIds.has(cs.studentId) && !(cs.matricule && deletedIds.has(cs.matricule))
            );
            setCustomSubscriptions(validSubs);
          }
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
      studentName?: string;
      matricule?: string;
      className?: string;
      gender?: 'M' | 'F';
      parentContact?: string;
      pavilion: string;
      roomNumber: string;
      monthlyRate: number;
      paymentDate?: string;
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

  // Pensionnaires unifiés : Inscriptions avec option Internat + Souscriptions directes
  const boarders = useMemo(() => {
    const seenIds = new Set<string>();
    const seenNumbers = new Set<string>();

    // 1. Les pensionnaires issus des customSubscriptions
    const customList = customSubscriptions
      .map((cs) => {
        let foundStudent = students.find(
          (s) => s.id === cs.studentId || s.studentNumber === cs.matricule || s.matricule === cs.matricule
        );

        // Sécurité anti-disparition : si l'élève n'est pas encore dans l'état local students, reconstruction directe depuis cs
        if (!foundStudent && cs.studentName) {
          const parsedName = splitFullNameNomFirst(cs.studentName);
          foundStudent = {
            id: cs.studentId,
            studentNumber: cs.matricule || `MAT-${cs.studentId.slice(-4)}`,
            matricule: cs.matricule || '',
            firstName: parsedName.firstName || 'Élève',
            lastName: parsedName.lastName || 'PENSIONNAIRE',
            fullName: `${parsedName.lastName || 'PENSIONNAIRE'} ${parsedName.firstName || 'Élève'}`.trim(),
            avatar: '',
            gender: cs.gender === 'F' ? 'female' : 'male',
            grade: cs.className || '6ème',
            address: 'Abidjan, Côte d\'Ivoire',
            guardianName: 'Parent / Tuteur',
            guardianPhone: cs.parentContact || '+225 07 00 00 00 00',
            whatsappPhone: cs.parentContact || '+225 07 00 00 00 00',
            tuitionAmount: (cs.monthlyRate || 0) * 9,
            paidAmount: 0,
            paymentDate: cs.paymentDate || getTodayFrenchDateStr(),
            attendanceRate: 100,
            status: 'active',
            tuitionStatus: 'partial',
            isBoarding: true,
          };
        }

        if (!foundStudent) return null;

        seenIds.add(foundStudent.id);
        if (foundStudent.studentNumber) seenNumbers.add(foundStudent.studentNumber);
        if (foundStudent.matricule) seenNumbers.add(foundStudent.matricule);

        const studentMonths = monthlyPayments[cs.studentId] || (foundStudent.id ? monthlyPayments[foundStudent.id] : {}) || {};
        const paidMonthsCount = MONTHS_LIST.filter((m) => studentMonths[m]).length;
        const rate = cs.monthlyRate || 50000;
        const totalPaid = paidMonthsCount * rate;
        const totalDue = rate * 9; // 9 mois stricts
        const remainingBalance = Math.max(0, totalDue - totalPaid);

        return {
          student: foundStudent,
          isBoarder: true,
          pavilion: cs.pavilion || (foundStudent.gender === 'female' ? 'Pavillon B (Filles)' : 'Pavillon A (Garçons)'),
          roomNumber: cs.roomNumber || 'Chambre 101',
          monthlyRate: rate,
          paidMonthsCount,
          totalPaid,
          totalDue,
          remainingBalance,
          isUpToDate: remainingBalance === 0,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    // 2. Les élèves inscrits ayant souscrit à l'internat (isBoarding ou mention dans les prestations)
    const registeredBoarders = students
      .filter((s) => {
        if (!s) return false;
        if (seenIds.has(s.id) || (s.studentNumber && seenNumbers.has(s.studentNumber)) || (s.matricule && seenNumbers.has(s.matricule))) {
          return false;
        }
        return Boolean(
          s.isBoarding ||
          s.notes?.toLowerCase().includes('internat (oui)') ||
          s.address?.toLowerCase().includes('internat (oui)')
        );
      })
      .map((s) => {
        seenIds.add(s.id);
        if (s.studentNumber) seenNumbers.add(s.studentNumber);
        if (s.matricule) seenNumbers.add(s.matricule);

        const studentMonths = monthlyPayments[s.id] || (s.studentNumber ? monthlyPayments[s.studentNumber] : {}) || {};
        const paidMonthsCount = MONTHS_LIST.filter((m) => studentMonths[m]).length;
        const rate = 50000;
        const totalPaid = paidMonthsCount * rate;
        const totalDue = rate * 9;
        const remainingBalance = Math.max(0, totalDue - totalPaid);

        return {
          student: s,
          isBoarder: true,
          pavilion: s.gender === 'female' ? 'Pavillon B (Filles)' : 'Pavillon A (Garçons)',
          roomNumber: 'Chambre 101',
          monthlyRate: rate,
          paidMonthsCount,
          totalPaid,
          totalDue,
          remainingBalance,
          isUpToDate: remainingBalance === 0,
        };
      });

    return [...customList, ...registeredBoarders];
  }, [students, customSubscriptions, monthlyPayments]);

  // Filtrage pour la recherche et la navigation
  const filteredBoarders = useMemo(() => {
    return boarders.filter((b) => {
      const stuFullName = `${(b.student.lastName || '').toUpperCase()} ${b.student.firstName || ''}`.trim();
      const matchSearch =
        searchQuery === '' ||
        stuFullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.student.studentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.student.matricule && b.student.matricule.toLowerCase().includes(searchQuery.toLowerCase())) ||
        b.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.student.grade || (b.student as any).className || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchPavilion =
        selectedPavilionFilter === 'all' ||
        (selectedPavilionFilter === 'garcons' && b.pavilion.includes('Garçons')) ||
        (selectedPavilionFilter === 'filles' && b.pavilion.includes('Filles'));

      return matchSearch && matchPavilion;
    });
  }, [boarders, searchQuery, selectedPavilionFilter]);

  // Index du pensionnaire actif
  const [activeBoarderIndex, setActiveBoarderIndex] = useState(0);

  // Pensionnaire actif
  const activeBoarder = useMemo(() => {
    if (isCreatingNew) return null;
    if (filteredBoarders.length === 0) return boarders[0] || null;
    const safeIndex = Math.min(Math.max(0, activeBoarderIndex), filteredBoarders.length - 1);
    return filteredBoarders[safeIndex] || filteredBoarders[0];
  }, [filteredBoarders, activeBoarderIndex, boarders, isCreatingNew]);

  // États du formulaire interactif avec NOM DE FAMILLE (Majuscule) et Prénoms séparés
  const [formLastName, setFormLastName] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formMatricule, setFormMatricule] = useState('');
  const [formStudentId, setFormStudentId] = useState('');
  const [selectedEnrolledStudentId, setSelectedEnrolledStudentId] = useState('');
  const [formSecondaryPhones, setFormSecondaryPhones] = useState<string[]>([]);
  const [formClassName, setFormClassName] = useState('6ème');
  const [formGender, setFormGender] = useState<'M' | 'F'>('M');
  const [formPavilion, setFormPavilion] = useState('Pavillon A (Garçons)');
  const [formRoom, setFormRoom] = useState('');
  const [formParentContact, setFormParentContact] = useState('');
  const [formMonthlyRate, setFormMonthlyRate] = useState<number>(0);
  const [formPaymentDate, setFormPaymentDate] = useState(getTodayFrenchDateStr());
  const [formPaymentMethod, setFormPaymentMethod] = useState('Espèces');
  const [activeMonthsChecked, setActiveMonthsChecked] = useState<Record<string, boolean>>({});

  // Nom complet officiel strictement ordonné : NOM DE FAMILLE d'abord, puis Prénom(s)
  const formStudentName = useMemo(() => {
    const l = (formLastName || '').trim().toUpperCase();
    const f = (formFirstName || '').trim();
    return l ? `${l} ${f}`.trim() : f;
  }, [formLastName, formFirstName]);

  // ID Comptable d'affichage (distinct du Matricule Officiel)
  const displayStudentId = useMemo(() => {
    if (formStudentId) {
      const digits = formStudentId.replace(/\D/g, '');
      return digits ? `ID-${digits.padStart(3, '0')}` : formStudentId;
    }
    if (selectedEnrolledStudentId) {
      const s = students.find((st) => st.id === selectedEnrolledStudentId || st.studentNumber === selectedEnrolledStudentId);
      if (s) return s.studentNumber || `ID-${s.id.slice(-4)}`;
    }
    if (!isCreatingNew && activeBoarder) {
      return activeBoarder.student.studentNumber || `ID-${activeBoarder.student.id.slice(-4)}`;
    }
    return 'ID-COMPTA';
  }, [formStudentId, selectedEnrolledStudentId, students, isCreatingNew, activeBoarder]);

  // Synchronisation du formulaire avec le pensionnaire actif quand on n'est pas en création
  useEffect(() => {
    if (!isCreatingNew && activeBoarder) {
      setFormLastName((activeBoarder.student.lastName || '').toUpperCase());
      setFormFirstName(activeBoarder.student.firstName || '');
      setFormMatricule(activeBoarder.student.matricule || '');
      setFormStudentId(activeBoarder.student.studentNumber || activeBoarder.student.id || '');
      setFormClassName(activeBoarder.student.grade || (activeBoarder.student as any).className || '6ème');
      setFormGender(activeBoarder.student.gender === 'female' || (activeBoarder.student.gender as any) === 'F' ? 'F' : 'M');
      setFormPavilion(activeBoarder.pavilion);
      setFormRoom(activeBoarder.roomNumber);
      setFormParentContact(activeBoarder.student.whatsappPhone || activeBoarder.student.guardianPhone || (activeBoarder.student as any).guardianContact || '+225 07 00 00 00 00');
      setFormSecondaryPhones(activeBoarder.student.secondaryPhones || []);
      setFormMonthlyRate(activeBoarder.monthlyRate || 0);

      const months = monthlyPayments[activeBoarder.student.id] || {};
      setActiveMonthsChecked(months);
    }
  }, [activeBoarder, isCreatingNew, monthlyPayments]);

  // Sélection d'un élève déjà inscrit dans l'établissement pour la souscription
  const handleSelectEnrolledStudent = (studentId: string) => {
    setSelectedEnrolledStudentId(studentId);
    if (!studentId) return;
    const stu = students.find((s) => s.id === studentId || s.studentNumber === studentId);
    if (stu) {
      setFormLastName((stu.lastName || '').toUpperCase());
      setFormFirstName(stu.firstName || '');
      setFormMatricule(stu.matricule || '');
      setFormStudentId(stu.studentNumber || stu.id || '');
      setFormClassName(stu.grade || '6ème');
      const isFem = stu.gender === 'female' || (stu.gender as any) === 'F';
      setFormGender(isFem ? 'F' : 'M');
      if (isFem && formPavilion.includes('Garçons')) {
        setFormPavilion('Pavillon B (Filles)');
      } else if (!isFem && formPavilion.includes('Filles')) {
        setFormPavilion('Pavillon A (Garçons)');
      }
      setFormParentContact(stu.whatsappPhone || stu.guardianPhone || '');
      setFormSecondaryPhones(stu.secondaryPhones || []);
      setToastMessage(`✓ Élève ${stu.studentNumber || 'ID'} — ${(stu.lastName || '').toUpperCase()} ${stu.firstName} sélectionné(e).`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Réinitialisation complète à zéro pour « Nouvelle Souscription »
  const handleStartNewSubscription = () => {
    setIsCreatingNew(true);
    setSelectedEnrolledStudentId('');
    setFormLastName('');
    setFormFirstName('');
    setFormMatricule('');
    setFormStudentId('');
    setFormSecondaryPhones([]);
    setFormClassName('6ème');
    setFormGender('M');
    setFormPavilion('Pavillon A (Garçons)');
    setFormRoom('');
    setFormParentContact('');
    setFormMonthlyRate(0); // Coordonnées et montants à 0
    setFormPaymentDate(getTodayFrenchDateStr());
    setFormPaymentMethod('Espèces');
    setActiveMonthsChecked({}); // Aucun mois coché

    setToastMessage('📝 Formulaire réinitialisé à zéro. Saisissez ou sélectionnez l’élève pour la souscription.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Annuler la création et revenir aux pensionnaires existants
  const handleCancelNewSubscription = () => {
    setIsCreatingNew(false);
    setSelectedEnrolledStudentId('');
    if (boarders.length > 0) {
      setActiveBoarderIndex(0);
    }
  };

  // Calculs financiers réactifs (SUR 9 MOIS : Septembre à Mai)
  const activePaidMonthsCount = useMemo(() => {
    return MONTHS_LIST.filter((m) => activeMonthsChecked[m]).length;
  }, [activeMonthsChecked]);

  const activeTotalCollected = useMemo(() => {
    return activePaidMonthsCount * (Number(formMonthlyRate) || 0);
  }, [activePaidMonthsCount, formMonthlyRate]);

  const activeTotalAnnualExigible = useMemo(() => {
    return (Number(formMonthlyRate) || 0) * 9; // 9 mois
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

  // Détection des modifications du formulaire et des versements
  const isFormDirty = useMemo(() => {
    if (isCreatingNew) {
      return (formLastName.trim().length > 0 || formFirstName.trim().length > 0) && Number(formMonthlyRate) > 0;
    }
    if (!activeBoarder) return false;

    const initialLastName = (activeBoarder.student.lastName || '').trim().toUpperCase();
    const initialFirstName = (activeBoarder.student.firstName || '').trim();
    const initialMatricule = activeBoarder.student.matricule || '';
    const initialClass = activeBoarder.student.grade || (activeBoarder.student as any).className || '6ème';
    const initialGender = activeBoarder.student.gender === 'female' || (activeBoarder.student.gender as any) === 'F' ? 'F' : 'M';
    const initialPavilion = activeBoarder.pavilion || 'Pavillon A (Garçons)';
    const initialRoom = activeBoarder.roomNumber || '';
    const initialContact = activeBoarder.student.guardianPhone || (activeBoarder.student as any).guardianContact || '+225 07 00 00 00 00';
    const initialRate = activeBoarder.monthlyRate || 0;
    const initialMethod = activeBoarder.student.paymentMethod || 'Espèces';

    const initialMonths = monthlyPayments[activeBoarder.student.id] || {};

    const lastNameChanged = formLastName.trim().toUpperCase() !== initialLastName;
    const firstNameChanged = formFirstName.trim() !== initialFirstName;
    const matChanged = formMatricule.trim() !== initialMatricule;
    const classChanged = formClassName !== initialClass;
    const genderChanged = formGender !== initialGender;
    const pavChanged = formPavilion !== initialPavilion;
    const roomChanged = formRoom.trim() !== initialRoom;
    const contactChanged = formParentContact.trim() !== initialContact;
    const rateChanged = Number(formMonthlyRate) !== initialRate;
    const methodChanged = formPaymentMethod !== initialMethod;

    const monthsChanged = MONTHS_LIST.some((m) => !!activeMonthsChecked[m] !== !!initialMonths[m]);

    return lastNameChanged || firstNameChanged || matChanged || classChanged || genderChanged || pavChanged || roomChanged || contactChanged || rateChanged || methodChanged || monthsChanged;
  }, [
    isCreatingNew,
    activeBoarder,
    formLastName,
    formFirstName,
    formMatricule,
    formClassName,
    formGender,
    formPavilion,
    formRoom,
    formParentContact,
    formMonthlyRate,
    formPaymentMethod,
    activeMonthsChecked,
    monthlyPayments,
  ]);

  const hasPaymentChange = useMemo(() => {
    if (isCreatingNew) return activePaidMonthsCount > 0 && activeTotalCollected > 0;
    if (!activeBoarder) return false;
    const initialMonths = monthlyPayments[activeBoarder.student.id] || {};
    return MONTHS_LIST.some((m) => !!activeMonthsChecked[m] !== !!initialMonths[m]);
  }, [isCreatingNew, activeBoarder, activeMonthsChecked, monthlyPayments, activePaidMonthsCount, activeTotalCollected]);

  // 1. Déclenchement de la modale de confirmation
  const handleOpenConfirmModal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!isFormDirty) {
      return;
    }

    if (!formLastName.trim() && !formFirstName.trim()) {
      alert('Veuillez saisir le nom de famille et prénom de l’élève.');
      return;
    }

    if (!Number(formMonthlyRate) || Number(formMonthlyRate) <= 0) {
      alert('Veuillez renseigner le tarif mensuel de l’internat.');
      return;
    }

    // Si seulement modification des coordonnées sans nouveau versement et sans paiement, sauvegarder directement
    if (!isCreatingNew && !hasPaymentChange && activeTotalCollected === 0) {
      executeFinalSaveReceipt();
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // 2. Exécution finale de l'enregistrement et persistance totale
  const executeFinalSaveReceipt = () => {
    const rate = Number(formMonthlyRate) || 0;
    const finalLastName = (formLastName || '').trim().toUpperCase();
    const finalFirstName = (formFirstName || '').trim();
    const finalFullName = `${finalLastName} ${finalFirstName}`.trim();

    // Trouver l'élève existant correspondant pour réutiliser son identifiant unique réel
    const matchedExistingStudent = selectedEnrolledStudentId
      ? students.find((s) => s.id === selectedEnrolledStudentId || s.studentNumber === selectedEnrolledStudentId)
      : students.find(
          (s) =>
            (formMatricule && (s.matricule === formMatricule || s.studentNumber === formMatricule)) ||
            (formStudentId && (s.studentNumber === formStudentId || s.id === formStudentId)) ||
            (s.fullName && s.fullName.toLowerCase() === finalFullName.toLowerCase())
        );

    const targetStudentId = matchedExistingStudent
      ? matchedExistingStudent.id
      : !isCreatingNew && activeBoarder
      ? activeBoarder.student.id
      : `stud-int-${Date.now()}`;

    // 1. Sauvegarder les mois cochés
    const updatedPayments = {
      ...monthlyPayments,
      [targetStudentId]: activeMonthsChecked,
    };
    savePaymentsToStorage(updatedPayments);

    // 2. Mettre à jour / ajouter dans customSubscriptions
    const existingIndex = customSubscriptions.findIndex((s) => s.studentId === targetStudentId);
    let updatedSubs = [...customSubscriptions];
    const subRecord = {
      studentId: targetStudentId,
      studentName: finalFullName,
      matricule: formMatricule.trim(),
      className: formClassName,
      gender: formGender,
      parentContact: formParentContact.trim(),
      pavilion: formPavilion,
      roomNumber: formRoom.trim() || 'Chambre 101',
      monthlyRate: rate,
      paymentDate: formPaymentDate || getTodayFrenchDateStr(),
    };

    if (existingIndex >= 0) {
      updatedSubs[existingIndex] = subRecord;
    } else {
      updatedSubs.unshift(subRecord);
    }
    saveSubscriptionsToStorage(updatedSubs);

    // 3. Mettre à jour isBoarding: true sur l'élève existant s'il existe (SANS JAMAIS CRÉER DE FAUX ÉLÈVE DANS STUDENTS)
    if (matchedExistingStudent) {
      try {
        const updatedStu: Student = {
          ...matchedExistingStudent,
          isBoarding: true,
        };
        updateRegisteredStudent(updatedStu, schoolSlug);
      } catch (e) {}
    }

    // 4. Enregistrer la Quittance officielle d'Internat pour le Journal de Caisse & Dashboard
    const paidMonthsList = MONTHS_LIST.filter((m) => activeMonthsChecked[m]);
    const cleanId = (matchedExistingStudent?.studentNumber || formStudentId || targetStudentId || '').replace(/\D/g, '').slice(-4);
    const invoiceNumber = `QUI-INT-${cleanId || Date.now().toString().slice(-4)}`;
    const invoiceId = `inv-boarding-${targetStudentId}`;

    const parsedPaymentDate = formPaymentDate && formPaymentDate.includes('/')
      ? formPaymentDate.split('/').reverse().join('-')
      : (formPaymentDate || new Date().toISOString().split('T')[0]);

    if (activeTotalCollected > 0) {
      const boardingInvoice: Invoice = {
        id: invoiceId,
        invoiceNumber,
        studentId: targetStudentId,
        studentName: finalFullName,
        studentAvatar: matchedExistingStudent?.avatar || '/avatars/default.png',
        studentGrade: formClassName,
        studentGender: formGender === 'F' ? 'female' : 'male',
        guardianName: matchedExistingStudent?.guardianName || 'Parent / Tuteur',
        guardianPhone: formParentContact.trim(),
        feeType: `Internat & Pensionnat (${activePaidMonthsCount} mois: ${paidMonthsList.join(', ')})`,
        amount: activeTotalAnnualExigible,
        discountAmount: 0,
        netAmount: activeTotalAnnualExigible,
        paidAmount: activeTotalCollected,
        balanceRemaining: activeRemainingBalance,
        paymentMethod: formPaymentMethod,
        enrollmentType: matchedExistingStudent?.enrollmentType || (isCreatingNew ? 'nouveau' : (activeBoarder?.student.enrollmentType || 'nouveau')),
        issueDate: parsedPaymentDate,
        dueDate: parsedPaymentDate,
        status: activeRemainingBalance === 0 ? 'paid' : 'partial',
        notes: `${activePaidMonthsCount} mois (${paidMonthsList.join(', ')})`,
        schoolSlug,
        schoolId: schoolSlug,
      };

      saveLivePaymentInvoice(boardingInvoice, schoolSlug);
    } else {
      // Aucun versement d'internat -> nettoyer toute facture résiduelle à zéro franc
      try {
        const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
        if (rawInvoices) {
          const prevInvoices: Invoice[] = JSON.parse(rawInvoices);
          const cleaned = prevInvoices.filter((i) => !(i.id === invoiceId || (i.studentId === targetStudentId && i.feeType?.toLowerCase().includes('internat'))));
          localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(cleaned));
        }
        const invSchoolKey = `${INVOICES_STORAGE_KEY}_${schoolSlug}`;
        const rawInvSchool = localStorage.getItem(invSchoolKey);
        if (rawInvSchool) {
          const prevInvSchool: Invoice[] = JSON.parse(rawInvSchool);
          const cleaned = prevInvSchool.filter((i) => !(i.id === invoiceId || (i.studentId === targetStudentId && i.feeType?.toLowerCase().includes('internat'))));
          localStorage.setItem(invSchoolKey, JSON.stringify(cleaned));
        }
      } catch (e) {}
    }

    // 5. Diffusion globale de l'événement en temps réel
    broadcastLiveUpdate({
      action: 'boarding_subscription_updated',
      studentId: targetStudentId,
      schoolSlug,
    });

    setIsConfirmModalOpen(false);

    // Déclencher la modale finale de confirmation avec bouton OK demandée par la direction
    setSuccessReceiptModalData({
      studentName: finalFullName || 'Pensionnaire',
      matricule: formMatricule.trim() || '—',
      className: formClassName,
      pavilion: formPavilion,
      room: formRoom.trim() || 'Chambre 101',
      totalPaid: activeTotalCollected,
      remaining: activeRemainingBalance,
      paidMonthsCount: activePaidMonthsCount,
      paymentDate: formPaymentDate || getTodayFrenchDateStr(),
      paymentMethod: formPaymentMethod,
    });
  };

  // Navigation Reçu Précédent / Suivant
  const handlePrevReceipt = () => {
    setIsCreatingNew(false);
    if (filteredBoarders.length === 0) return;
    setActiveBoarderIndex((prev) => (prev > 0 ? prev - 1 : filteredBoarders.length - 1));
  };

  const handleNextReceipt = () => {
    setIsCreatingNew(false);
    if (filteredBoarders.length === 0) return;
    setActiveBoarderIndex((prev) => (prev < filteredBoarders.length - 1 ? prev + 1 : 0));
  };

  // Suppression du Reçu / Retrait de l'Internat
  const handleRemoveFromBoardingOnly = async () => {
    if (!activeBoarder) return;
    setIsDeletingBoarding(true);
    try {
      const studentId = activeBoarder.student.id;
      const studentNumber = activeBoarder.student.studentNumber;
      const matricule = activeBoarder.student.matricule;

      // 1. Mettre à jour l'élève pour retirer l'option internat
      const updatedStudent: Student = {
        ...activeBoarder.student,
        isBoarding: false,
        notes: (activeBoarder.student.notes || '').replace(/internat\s*\(oui\)/gi, '').trim(),
      };
      updateRegisteredStudent(updatedStudent, schoolSlug);

      // 2. Nettoyer les customSubscriptions
      const updatedSubs = customSubscriptions.filter(
        (cs) => cs.studentId !== studentId && cs.matricule !== studentNumber && cs.matricule !== matricule
      );
      saveSubscriptionsToStorage(updatedSubs);

      // 3. Nettoyer les monthlyPayments
      const updatedPayments = { ...monthlyPayments };
      delete updatedPayments[studentId];
      if (studentNumber) delete updatedPayments[studentNumber];
      if (matricule) delete updatedPayments[matricule];
      savePaymentsToStorage(updatedPayments);

      // 4. Supprimer la quittance d'internat du journal
      const invoiceId = `inv-boarding-${studentId}`;
      if (typeof window !== 'undefined') {
        try {
          const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
          if (rawInvoices) {
            const prevInvoices: Invoice[] = JSON.parse(rawInvoices);
            const filteredInvoices = prevInvoices.filter(
              (inv) => inv.id !== invoiceId && inv.studentId !== studentId && !inv.invoiceNumber?.startsWith(`QUI-INT-${studentNumber}`)
            );
            localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(filteredInvoices));
          }
        } catch (e) {}
      }

      deleteInvoiceFromSupabase(invoiceId, schoolSlug).catch(() => {});

      // 5. Diffuser l'événement en temps réel
      broadcastLiveUpdate({
        action: 'boarding_removed',
        studentId,
        schoolSlug,
      });
      window.dispatchEvent(new CustomEvent(DATA_UPDATED_EVENT, { detail: { action: 'boarding_removed' } }));

      setShowDeleteBoardingModal(false);
      setActiveBoarderIndex((prev) => Math.max(0, prev - 1));
      setToastMessage(`✓ L'élève ${activeBoarder.student.fullName} a été retiré de l'internat.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Erreur lors du retrait de l\'internat:', err);
    } finally {
      setIsDeletingBoarding(false);
    }
  };

  // Suppression totale et définitive du doublon ou élève de toute la base
  const handleDeleteEntireBoarderStudent = async () => {
    if (!activeBoarder) return;
    setIsDeletingBoarding(true);
    try {
      const studentId = activeBoarder.student.id;
      const studentNumber = activeBoarder.student.studentNumber;
      const matricule = activeBoarder.student.matricule;

      // Nettoyer les subscriptions et monthly payments
      const updatedSubs = customSubscriptions.filter(
        (cs) => cs.studentId !== studentId && cs.matricule !== studentNumber && cs.matricule !== matricule
      );
      saveSubscriptionsToStorage(updatedSubs);

      const updatedPayments = { ...monthlyPayments };
      delete updatedPayments[studentId];
      if (studentNumber) delete updatedPayments[studentNumber];
      if (matricule) delete updatedPayments[matricule];
      savePaymentsToStorage(updatedPayments);

      // Supprimer définitivement l'élève et tous ses reçus
      const idsToDelete = [studentId, studentNumber, matricule].filter(Boolean) as string[];
      deleteLiveStudents(idsToDelete, schoolSlug);

      setShowDeleteBoardingModal(false);
      setActiveBoarderIndex((prev) => Math.max(0, prev - 1));
      setToastMessage(`✓ Reçu et dossier de ${activeBoarder.student.fullName} définitivement supprimés.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Erreur suppression totale pensionnaire:', err);
    } finally {
      setIsDeletingBoarding(false);
    }
  };

  // 1. Impression A4 Isolé (Uniquement le reçu cadré)
  const handlePrintReceipt = () => {
    document.body.classList.add('print-receipt-only');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-receipt-only');
    }, 1200);
  };

  // Helper pour charger une image sans risque d'erreur CORS
  const loadCanvasImageSafe = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      if (!src) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  // Moteur de rendu 100% Natif Canvas HD pour la Quittance d'Internat
  const generateBoardingReceiptCanvas = async (): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1680;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // Chargement ultra-sécurisé sans risque de corrompre/tainter le canvas avec Wikimedia CORS
    const logoImgPromise = currentSchool.logoUrl ? loadCanvasImageSafe(currentSchool.logoUrl) : Promise.resolve(null);
    const emblemImgPromise = currentSchool.countryEmblemUrl && currentSchool.countryEmblemUrl.startsWith('data:')
      ? loadCanvasImageSafe(currentSchool.countryEmblemUrl)
      : Promise.resolve(null);
    const stampImgPromise = currentSchool.stampUrl ? loadCanvasImageSafe(currentSchool.stampUrl) : Promise.resolve(null);

    const [logoImg, emblemImg, stampImg] = await Promise.all([logoImgPromise, emblemImgPromise, stampImgPromise]);

    // Fond blanc
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 1680);

    // Bordures
    drawRoundRect(30, 30, 1140, 1620, 24);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    drawRoundRect(38, 38, 1124, 1604, 20);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // En-tête école
    drawRoundRect(45, 45, 1110, 245, 20);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Logo École à gauche
    drawRoundRect(65, 65, 130, 130, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (logoImg) {
      try {
        ctx.save();
        drawRoundRect(70, 70, 120, 120, 14);
        ctx.clip();
        ctx.drawImage(logoImg, 70, 70, 120, 120);
        ctx.restore();
      } catch (e) {
        ctx.fillStyle = '#064e3b';
        ctx.font = 'bold 22px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((currentSchool.shortName || 'EPC').slice(0, 4), 130, 135);
      }
    } else {
      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 22px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((currentSchool.shortName || 'EPC').slice(0, 4), 130, 135);
    }

    // Emblème National à droite (Rendu vectoriel 100% natif insensible aux erreurs réseau/CORS)
    drawRoundRect(1005, 65, 130, 130, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (emblemImg) {
      try {
        ctx.save();
        drawRoundRect(1010, 70, 120, 120, 14);
        ctx.clip();
        ctx.drawImage(emblemImg, 1010, 70, 120, 120);
        ctx.restore();
      } catch (e) {
        drawVectorEmblem(ctx);
      }
    } else {
      // Dessin vectoriel direct de l'emblème national
      ctx.save();
      // Drapeau tricolore stylisé (Orange, Blanc, Vert)
      ctx.fillStyle = '#f97316';
      ctx.fillRect(1030, 85, 26, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(1056, 85, 28, 12);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(1056, 85, 28, 12);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(1084, 85, 26, 12);

      // Écusson central
      drawRoundRect(1040, 105, 60, 45, 8);
      ctx.fillStyle = '#fffbeb';
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RÉPUBLIQUE', 1070, 122);
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillText("DE CÔTE D'IVOIRE", 1070, 136);

      ctx.fillStyle = '#059669';
      ctx.font = 'italic 8px Inter, sans-serif';
      ctx.fillText('Union • Discipline • Travail', 1070, 165);
      ctx.restore();
    }

    // Textes École au centre
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 24px Outfit, sans-serif';
    ctx.fillText((currentSchool.name || 'EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL').toUpperCase(), 600, 95);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillText((currentSchool.shortName || 'EPC MANOI').toUpperCase(), 600, 124);

    if (currentSchool.motto) {
      ctx.fillStyle = '#b45309';
      ctx.font = 'italic bold 13px Outfit, sans-serif';
      ctx.fillText(`« ${currentSchool.motto} »`, 600, 148);
    }

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText(`${currentSchool.district || currentSchool.city || 'Abidjan'} • Tél : ${currentSchool.phone || '+225 27 22 44 11 00'}`, 600, 170);

    drawRoundRect(380, 186, 440, 30, 8);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`Code Établissement : ${currentSchool.ministryCode || 'MENA-04829-CI'}`, 600, 206);

    // Titre Reçu
    drawRoundRect(45, 305, 1110, 56, 12);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Outfit, sans-serif';
    ctx.fillText("REÇU DE PAIEMENT INTERNAT & PENSIONNAT", 70, 341);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 20px monospace';
    const refNum = `REC-INT-2026-${(activeBoarderIndex + 1).toString().padStart(4, '0')}`;
    ctx.fillText(`Réf : ${refNum}`, 1130, 341);

    // Coordonnées élève agrandies et aérées (hauteur 240px)
    drawRoundRect(45, 375, 1110, 240, 16);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';

    // Ligne 1 : Distinction stricte ID Élève (Compta) vs Matricule Officiel
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('ID Élève (Compta) :', 70, 412);
    ctx.font = 'bold 17px monospace';
    ctx.fillText(displayStudentId || '—', 225, 412);

    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('Matricule Officiel :', 420, 412);
    ctx.font = 'bold 17px monospace';
    ctx.fillText(formMatricule.trim() ? formMatricule.trim() : '—', 570, 412);

    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText("Date de paiement :", 810, 412);
    ctx.font = 'bold 17px monospace';
    ctx.fillText(formPaymentDate, 965, 412);

    // Ligne 2 : NOM EN MAJUSCULES D'ABORD, puis Prénom(s) & Classe
    const finalDisplayNom = (formLastName ? `${formLastName.toUpperCase()} ${formFirstName}` : formStudentName).trim();
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('Élève Pensionnaire :', 70, 450);
    ctx.font = '900 20px Outfit, sans-serif';
    ctx.fillText(`${finalDisplayNom.toUpperCase()} (${formGender === 'F' ? '♀ Fille' : '♂ Garçon'})`, 230, 450);

    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('Classe :', 810, 450);
    ctx.font = 'bold 17px Inter, sans-serif';
    ctx.fillText(formClassName, 880, 450);

    // Ligne 3 : Pavillon, Chambre & WhatsApp Parent
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('Hébergement :', 70, 488);
    ctx.font = 'bold 17px Inter, sans-serif';
    ctx.fillText(`${formPavilion} — ${formRoom || 'Chambre 101'}`, 205, 488);

    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('WhatsApp Parent :', 730, 488);
    ctx.font = 'bold 17px monospace';
    ctx.fillText(formParentContact || 'Non renseigné', 885, 488);

    // Ligne 4 : Contacts Secondaires spacieux
    if (formSecondaryPhones && formSecondaryPhones.filter(Boolean).length > 0) {
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Autres contacts :', 70, 526);
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(formSecondaryPhones.filter(Boolean).join('  •  '), 205, 526);
    }

    // Décompte financier
    let y = 635;
    drawRoundRect(45, y, 1110, 48, 10);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.fillText('DÉSIGNATION DU SERVICE', 70, y + 30);
    ctx.textAlign = 'center';
    ctx.fillText('MOIS RÉGLÉS (SUR 9)', 700, y + 30);
    ctx.textAlign = 'right';
    ctx.fillText('MONTANT ENCAISSÉ', 1130, y + 30);

    y += 56;
    drawRoundRect(45, y, 1110, 65, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px Inter, sans-serif';
    ctx.fillText("Pension d'Internat & Hébergement Annuelle", 70, y + 28);
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Tarif : ${formatFCFA(formMonthlyRate)} / mois • Mode : ${formPaymentMethod}`, 70, y + 50);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${activePaidMonthsCount} / 9 mois`, 700, y + 38);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(formatFCFA(activeTotalCollected), 1130, y + 38);

    // Ligne Total Net Encaissé
    y += 75;
    drawRoundRect(45, y, 1110, 52, 10);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillText('TOTAL NET ENCAISSÉ :', 70, y + 33);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(formatFCFA(activeTotalCollected), 1130, y + 33);

    // Suivi des 9 mois
    y += 70;
    drawRoundRect(45, y, 1110, 110, 12);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText('ÉTAT DES RÈGLEMENTS PAR MOIS (9 MOIS SCOLAIRES) :', 70, y + 30);

    const boxW = 106;
    const boxH = 48;
    const startX = 70;
    const boxY = y + 44;

    MONTHS_LIST.forEach((m, idx) => {
      const bx = startX + idx * (boxW + 6);
      const isPaid = activeMonthsChecked[m];
      drawRoundRect(bx, boxY, boxW, boxH, 8);
      ctx.fillStyle = isPaid ? '#d1fae5' : '#f1f5f9';
      ctx.fill();
      ctx.strokeStyle = isPaid ? '#34d399' : '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = isPaid ? '#065f46' : '#64748b';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText(m.slice(0, 4), bx + boxW / 2, boxY + 20);
      ctx.font = 'bold 11px monospace';
      ctx.fillText(isPaid ? '✓ Réglé' : '—', bx + boxW / 2, boxY + 38);
    });

    // Signature & Cachet
    y += 135;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 12px Inter, sans-serif';
    ctx.fillText('Reçu officiel numéroté émis par l’Intendance & Gestion de l’Internat.', 70, y + 30);

    // Cachet à droite
    if (stampImg) {
      try {
        ctx.drawImage(stampImg, 960, y - 20, 160, 80);
      } catch (e) {}
    } else {
      drawRoundRect(920, y - 10, 230, 50, 10);
      ctx.fillStyle = '#ecfdf5';
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText('✓ Cachet Électronique Certifié', 1035, y + 20);
    }

    return canvas;
  };

  // Helper pour dessiner l'emblème vectoriel si besoin
  const drawVectorEmblem = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.fillStyle = '#f97316';
    ctx.fillRect(1030, 85, 26, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1056, 85, 28, 12);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(1084, 85, 26, 12);
    ctx.restore();
  };

  // 2. Téléchargement direct en Image PNG HD
  const handleDownloadReceiptImage = async () => {
    try {
      setIsGeneratingImage(true);
      const canvas = await generateBoardingReceiptCanvas();
      if (!canvas) return;
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const cleanName = (formLastName ? `${formLastName.toUpperCase()}_${formFirstName}` : formStudentName || 'Eleve').replace(/\s+/g, '_');
      link.download = `Recu_Internat_${cleanName}_${formMatricule || 'REC'}.png`;
      link.href = url;
      link.click();
      setToastMessage('📥 Image HD du reçu téléchargée avec succès !');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (e) {
      console.error(e);
      setToastMessage('⚠️ Téléchargement lancé.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // 3. Copier l'Image dans le Presse-Papier (pour coller direct dans WhatsApp avec Ctrl+V)
  const handleCopyReceiptImage = async () => {
    try {
      setIsGeneratingImage(true);
      const canvas = await generateBoardingReceiptCanvas();
      if (!canvas) return;

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          if (navigator.clipboard && (window as any).ClipboardItem) {
            await navigator.clipboard.write([
              new (window as any).ClipboardItem({ 'image/png': blob }),
            ]);
            setToastMessage('📋 Image du reçu copiée ! Collez-la directement dans WhatsApp (Ctrl+V).');
            setTimeout(() => setToastMessage(null), 5000);
          } else {
            handleDownloadReceiptImage();
          }
        } catch (err) {
          handleDownloadReceiptImage();
        }
      }, 'image/png');
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // 4. Ouvrir la modale d'aperçu d'image pour WhatsApp
  const handleOpenShareModal = async () => {
    try {
      setIsGeneratingImage(true);
      const canvas = await generateBoardingReceiptCanvas();
      if (canvas) {
        const url = canvas.toDataURL('image/png');
        setGeneratedImagePreviewUrl(url);

        canvas.toBlob(async (blob) => {
          if (blob && navigator.clipboard && (window as any).ClipboardItem) {
            try {
              await navigator.clipboard.write([
                new (window as any).ClipboardItem({ 'image/png': blob }),
              ]);
            } catch (e) {}
          }
        }, 'image/png');

        setIsShareModalOpen(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // 5. Action directe : Partage WhatsApp Direct avec Salutations Scolaires et Prévisualisation
  const handleDirectWhatsAppShare = async (customPhone?: string, stuName?: string) => {
    const activeName = (formLastName ? `${formLastName.toUpperCase()} ${formFirstName}` : (stuName || formStudentName)).trim() || 'Élève Pensionnaire';
    const rawPhone = customPhone || formParentContact || '+225 07 48 92 11 00';
    const cleanPhone = formatCleanWhatsApp(rawPhone) || '2250748921100';
    const activeReceiptNum = `QUI-INT-2026-${(activeBoarderIndex + 1).toString().padStart(4, '0')}`;

    setToastMessage("📸 Génération du reçu et ouverture de WhatsApp...");

    const schoolGreeting = (currentSchool.schoolType === 'laique')
      ? 'Salut'
      : (currentSchool.schoolType === 'non_confessionnelle')
      ? 'Bonjour'
      : 'Salam anlaekoum';

    const paidMonthsList = MONTHS_LIST.filter((m) => activeMonthsChecked[m]);
    const monthsText = paidMonthsList.length > 0 ? ` (${paidMonthsList.join(', ')})` : '';

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
      `${schoolGreeting}, voici le reçu officiel de paiement internat et pensionnat (${activeReceiptNum}) pour ${activeName} — ${currentSchool.name}. ${activePaidMonthsCount} mois réglés${monthsText}, total encaissé : ${formatFCFA(activeTotalCollected)}.`
    )}`;

    // Ouvrir immédiatement l'onglet WhatsApp de discussion avec le parent
    try {
      window.open(whatsappUrl, '_blank');
    } catch (e) {}

    try {
      setIsGeneratingImage(true);
      const canvas = await generateBoardingReceiptCanvas();
      if (!canvas) {
        setIsGeneratingImage(false);
        return;
      }

      canvas.toBlob(async (blob: Blob | null) => {
        setIsGeneratingImage(false);
        if (!blob) return;

        const cleanFileName = `Recu-Internat-${activeReceiptNum}-${activeName.replace(/\s+/g, '_')}.png`;
        const file = new File([blob], cleanFileName, { type: 'image/png' });
        const imageUrl = URL.createObjectURL(blob);

        // Copier l'image dans le presse-papier pour WhatsApp (Ctrl + V)
        try {
          if (navigator.clipboard && (window as any).ClipboardItem) {
            await navigator.clipboard.write([
              new (window as any).ClipboardItem({ 'image/png': blob }),
            ]);
          }
        } catch (clipErr) {
          console.warn('Clipboard write fallback', clipErr);
        }

        // Partage mobile natif si supporté
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Reçu Internat & Pensionnat - ${activeName}`,
              text: `Reçu officiel de paiement internat et pensionnat (${activeReceiptNum}) pour ${activeName} — ${currentSchool.name}`,
              files: [file],
            });
            setToastMessage(`✓ Photo du reçu partagée avec succès sur WhatsApp !`);
            return;
          } catch (shareErr: any) {
            if (shareErr.name === 'AbortError') return;
          }
        }

        // Téléchargement automatique de l'image PNG HD
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = cleanFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Ouvrir la modale interactive avec prévisualisation et options directes
        setWhatsAppPreviewData({
          imageUrl,
          blob,
          fileName: cleanFileName,
          phone: rawPhone,
          cleanPhone,
          name: activeName,
        });

        setToastMessage(`📷 Photo HD du reçu officiel (${activeReceiptNum}) générée et copiée ! Faites Ctrl + V dans WhatsApp.`);
        setTimeout(() => setToastMessage(null), 5000);
      }, 'image/png');
    } catch (err) {
      console.error('Erreur génération reçu internat:', err);
      setIsGeneratingImage(false);
      setToastMessage("ℹ️ Lien WhatsApp ouvert avec succès.");
    }
  };

  // Statistiques Globales KPI (Sur 9 Mois : Septembre à Mai - 100 Places Max)
  const totalBoarders = boarders.length;
  const totalCollected = boarders.reduce((acc, b) => acc + b.totalPaid, 0);
  const totalExigible = boarders.reduce((acc, b) => acc + b.monthlyRate * 9, 0);
  const recoveryRate = totalExigible > 0 ? ((totalCollected / totalExigible) * 100).toFixed(1) : '0';
  const girlsCount = boarders.filter((b) => b.student.gender === 'female' || (b.student.gender as any) === 'F').length;
  const boysCount = boarders.filter((b) => b.student.gender === 'male' || (b.student.gender as any) === 'M').length;

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
          MODALE D'APERÇU & PARTAGE IMAGE WHATSAPP
          ═══════════════════════════════════════════════════════════════ */}
      {isShareModalOpen && generatedImagePreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-heading">
                    Image Haute Définition du Reçu
                  </h3>
                  <p className="text-xs text-slate-500">
                    Prête à envoyer aux parents sur WhatsApp
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aperçu Visuel de l'Image Générée */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl p-3 bg-slate-50 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedImagePreviewUrl}
                alt="Aperçu Reçu Officiel"
                className="max-h-[50vh] w-auto object-contain rounded-xl shadow-md border border-slate-300"
              />
            </div>

            {/* Guide & Boutons d'Action WhatsApp */}
            <div className="space-y-3 pt-2 shrink-0">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  L&apos;image est <strong>copiée dans votre presse-papier</strong> ! Appuyez simplement sur <strong>Ctrl+V (Coller)</strong> dans WhatsApp.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = (formParentContact || '').replace(/[^0-9]/g, '');
                    const messageText = `📄 Reçu officiel de paiement internat et pensionnat — ${formStudentName} (${formMatricule})`;
                    const waUrl = cleanPhone
                      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
                      : `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
                    window.open(waUrl, '_blank');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Ouvrir WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyReceiptImage}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copier Image</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadReceiptImage}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger PNG</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODALE DE CONFIRMATION DE SOUSCRIPTION / REÇU INTERNAT
          ═══════════════════════════════════════════════════════════════ */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shadow-xs">
                  <BedDouble className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 font-heading">
                    Confirmer le Reçu de Paiement Internat & Pensionnat
                  </h3>
                  <p className="text-xs text-slate-500">
                    Vérification des coordonnées avant validation officielle
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Récapitulatif Éléve & Hébergement */}
            <div className="space-y-3 flex-1 overflow-y-auto">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Élève Pensionnaire :</span>
                  <span className="text-xs font-extrabold text-slate-900">{formStudentName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Matricule :</span>
                  <span className="text-xs font-mono font-bold text-slate-700">{formMatricule}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Classe & Genre :</span>
                  <span className="text-xs font-semibold text-slate-800">
                    {formClassName} • {formGender === 'F' ? '♀ Fille' : '♂ Garçon'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-xs text-slate-500 font-medium">Pavillon & Chambre :</span>
                  <span className="text-xs font-bold text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                    {formPavilion} — {formRoom.trim() || 'Chambre 101'}
                  </span>
                </div>
              </div>

              {/* Récapitulatif Financier */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-900 font-medium">Tarif Mensuel :</span>
                  <span className="text-xs font-extrabold text-emerald-950 font-mono">{formatFCFA(formMonthlyRate)} / mois</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-900 font-medium">Mois Réglés :</span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                    {activePaidMonthsCount} / 9 mois pris en compte
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-900 font-medium">Total Encaissé Ce Jour :</span>
                  <span className="text-sm font-black text-emerald-900 font-mono font-heading">{formatFCFA(activeTotalCollected)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-900 font-medium">Reste Exigible Annuel :</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">{formatFCFA(activeRemainingBalance)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60">
                  <span className="text-xs text-emerald-900 font-medium">Mode & Date de Paiement :</span>
                  <span className="text-xs font-bold text-emerald-950">
                    {formPaymentMethod} • {formPaymentDate}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  La confirmation enregistrera le reçu officiel, actualisera immédiatement les 3 compteurs KPI (effectif, dortoirs, recouvrement) et alimentera le journal des encaissements sur le tableau de bord.
                </span>
              </div>
            </div>

            {/* Boutons d'Action */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer text-center"
              >
                Annuler / Modifier
              </button>
              <button
                type="button"
                onClick={executeFinalSaveReceipt}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmer & Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODALE FINALE DE CONFIRMATION AVEC BOUTON OK (REÇU ENREGISTRÉ)
          ═══════════════════════════════════════════════════════════════ */}
      {successReceiptModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-14 h-14 rounded-3xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900 font-heading">
                Reçu Enregistré avec Succès !
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Le dossier du pensionnaire et le journal de caisse ont été mis à jour immédiatement.
              </p>
            </div>

            {/* Récapitulatif clair */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500">Pensionnaire :</span>
                <span className="font-extrabold text-slate-900 truncate max-w-[200px]">
                  {successReceiptModalData.studentName}
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500">Matricule & Classe :</span>
                <span className="font-mono font-bold text-slate-800">
                  {successReceiptModalData.matricule} • {successReceiptModalData.className}
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500">Hébergement :</span>
                <span className="font-semibold text-purple-900 truncate max-w-[200px]">
                  {successReceiptModalData.pavilion} — {successReceiptModalData.room}
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500">Mensualités prises en compte :</span>
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {successReceiptModalData.paidMonthsCount} / 9 mois réglés
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500">Total Encaissé :</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {formatFCFA(successReceiptModalData.totalPaid)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Reste Exigible Annuel :</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatFCFA(successReceiptModalData.remaining)}
                </span>
              </div>
            </div>

            {/* Boutons d'Action : WhatsApp Direct & Réinitialisation à zéro avec OK */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleDirectWhatsAppShare();
                }}
                className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <Smartphone className="w-5 h-5 text-white shrink-0" />
                <span>
                  📱 Envoyer le reçu par WhatsApp ({formParentContact || 'Numéro parent'})
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSuccessReceiptModalData(null);
                  handleStartNewSubscription();
                }}
                className="w-full py-3 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200"
              >
                <Check className="w-4 h-4 text-emerald-600" />
                <span>OK (Élève suivant / Réinitialiser à zéro)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de Confirmation de Suppression de Reçu / Pensionnaire */}
      {showDeleteBoardingModal && activeBoarder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-950 font-heading">
                  Supprimer ce Reçu / Pensionnaire ?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choisissez le mode de suppression pour ce dossier.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteBoardingModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Récapitulatif de l'élève */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Pensionnaire :</span>
                <span className="font-extrabold text-slate-950 truncate max-w-[220px]">
                  {activeBoarder.student.fullName}
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Matricule / ID :</span>
                <span className="font-mono font-bold text-slate-800">
                  {activeBoarder.student.studentNumber} {activeBoarder.student.matricule ? `(${activeBoarder.student.matricule})` : ''} • {activeBoarder.student.grade}
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Dortoir & Chambre :</span>
                <span className="font-bold text-purple-900">
                  {activeBoarder.pavilion} — {activeBoarder.roomNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Total Réglé :</span>
                <span className="font-mono font-black text-emerald-700">
                  {formatFCFA(activeBoarder.totalPaid)} ({activeBoarder.paidMonthsCount}/9 mois)
                </span>
              </div>
            </div>

            {/* Options de suppression */}
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isDeletingBoarding}
                onClick={handleRemoveFromBoardingOnly}
                className="w-full p-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-left transition-all cursor-pointer flex items-start gap-3 group"
              >
                <RotateCcw className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 group-hover:rotate-[-45deg] transition-transform" />
                <div className="flex-1">
                  <span className="text-xs font-bold text-amber-950 block">
                    1. Retirer uniquement de l'internat (Recommandé)
                  </span>
                  <span className="text-[11px] text-amber-800 mt-0.5 block">
                    L'élève reste scolarisé dans l'école. Seuls son inscription à l'internat, son reçu et ses mensualités de pensionnat sont annulés.
                  </span>
                </div>
              </button>

              <button
                type="button"
                disabled={isDeletingBoarding}
                onClick={handleDeleteEntireBoarderStudent}
                className="w-full p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-left transition-all cursor-pointer flex items-start gap-3 group"
              >
                <Trash2 className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div className="flex-1">
                  <span className="text-xs font-bold text-rose-950 block">
                    2. Supprimer définitivement le reçu et le dossier complet
                  </span>
                  <span className="text-[11px] text-rose-800 mt-0.5 block">
                    Idéal si ce reçu est un doublon accidentel. L'élève et tous ses reçus disparaîtront immédiatement de toute la base de données.
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={isDeletingBoarding}
                onClick={() => setShowDeleteBoardingModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          EN-TÊTE DE PAGE AVEC ANNÉE SCOLAIRE SUR LA MÊME LIGNE
          ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Internat & Hébergement
            </h1>
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs">
              {currentSchool.academicYear || '2026-2027'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Gestion des dortoirs, chambres et génération des reçus officiels de paiement internat et pensionnat — {currentSchool.name}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1 : LES 3 CARTES STATISTIQUES KPI PANDHOWAN
          ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 print:hidden">
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
            <span suppressHydrationWarning className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
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
            <span suppressHydrationWarning className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
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

        {/* KPI 3: Capacité & Occupation (Modifiable par l'établissement) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition-all sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
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
            {!isEditingCapacity && (
              <button
                type="button"
                onClick={() => {
                  setCapacityInput(boardingCapacity.toString());
                  setIsEditingCapacity(true);
                }}
                className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                title="Modifier la capacité totale de l'internat"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isEditingCapacity ? (
            <div className="space-y-2 py-1">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(e.target.value)}
                  placeholder="Capacité max"
                  className="w-24 px-2.5 py-1 text-sm font-bold rounded-lg border border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => handleSaveCapacity(parseInt(capacityInput, 10) || 0)}
                  className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 cursor-pointer"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingCapacity(false)}
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <p className="text-[10px] text-slate-400">Saisissez le nombre total de lits/places</p>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
                {totalBoarders} / {boardingCapacity}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Places
              </span>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Disponibles :</span>
            <span className="font-bold text-slate-900">
              {boardingCapacity > 0 ? Math.max(0, boardingCapacity - totalBoarders) : 0} lits
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          BANDEAU DE NAVIGATION RAPIDE & BOUTON NOUVELLE SOUSCRIPTION
          ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 print:hidden">
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
                setIsCreatingNew(false);
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
                setIsCreatingNew(false);
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
              value={isCreatingNew ? 'new' : activeBoarder?.student.id || ''}
              onChange={(e) => {
                const targetId = e.target.value;
                if (targetId === 'new') {
                  handleStartNewSubscription();
                  return;
                }
                setIsCreatingNew(false);
                const idx = filteredBoarders.findIndex((b) => b.student.id === targetId);
                if (idx >= 0) setActiveBoarderIndex(idx);
              }}
              className={`w-full appearance-none pl-3 pr-8 py-2 text-xs rounded-xl border font-bold focus:outline-none focus:ring-2 cursor-pointer truncate ${
                isCreatingNew
                  ? 'bg-amber-50 border-amber-300 text-amber-900 focus:ring-amber-500/20'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-950 focus:ring-emerald-500/20'
              }`}
            >
              {isCreatingNew && <option value="new">✨ + Nouvelle Souscription (En cours de saisie)</option>}
              {filteredBoarders.map((b, idx) => (
                <option key={b.student.id} value={b.student.id}>
                  {idx + 1}. {(b.student.lastName || '').toUpperCase()} {b.student.firstName} ({b.student.grade || (b.student as any).className || '6ème'} • {b.roomNumber})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Boutons de Navigation Reçu Précédent / Suivant & Bouton Nouvelle Souscription */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          {!isCreatingNew && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={handlePrevReceipt}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                title="Reçu Précédent"
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
                title="Reçu Suivant"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {isCreatingNew ? (
            <button
              type="button"
              onClick={handleCancelNewSubscription}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Annuler la création</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartNewSubscription}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-xs shadow-emerald-600/30 transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nouvelle Souscription</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2 : LE FORMULAIRE INTERACTIF & LE REÇU OFFICIEL (2 COLS)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLONNE GAUCHE : FORMULAIRE DE SAISIE ET ENREGISTREMENT */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 shadow-xs space-y-4 print:hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isCreatingNew ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
              }`}>
                {isCreatingNew ? <Sparkles className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-heading">
                  {isCreatingNew ? '✨ Nouvelle Souscription' : 'Coordonnées d’Internat'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isCreatingNew
                    ? 'Remplissez les informations pour inscrire un élève'
                    : 'Modifiez les données et cliquez sur enregistrer'}
                </p>
              </div>
            </div>

            {/* Badge état paiement */}
            <span
              className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                isCreatingNew
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : activeRemainingBalance === 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isCreatingNew
                ? 'Nouveau Dossier'
                : activeRemainingBalance === 0
                ? '✓ Soldé (9/9 mois)'
                : `${activePaidMonthsCount}/9 Mois`}
            </span>
          </div>

          <form onSubmit={handleOpenConfirmModal} className="space-y-4">
            {/* 1. Sélection d'un élève déjà inscrit dans l'établissement (si création) */}
            {isCreatingNew && (
              <div className="p-3 bg-amber-50/90 rounded-2xl border border-amber-300 space-y-1.5 shadow-2xs">
                <label className="text-xs font-extrabold text-amber-950 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Sélectionner un élève déjà inscrit (Recommandé)</span>
                  </span>
                  <span className="text-[10px] text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded font-bold">Liaison sans doublon</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedEnrolledStudentId}
                    onChange={(e) => handleSelectEnrolledStudent(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-xs rounded-xl bg-white border border-amber-300 text-slate-900 font-extrabold focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer shadow-xs"
                  >
                    <option value="">— Saisie libre OU Choisir un élève déjà inscrit —</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.studentNumber || 'ID'} — {(st.lastName || '').toUpperCase()} {st.firstName} ({st.grade})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-amber-700 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Coordonnées détaillées de l'élève */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Nom de famille en majuscules */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Nom de famille * (MAJUSCULES)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: KONATE"
                  value={formLastName}
                  onChange={(e) => setFormLastName(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-black tracking-wide focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Prénom(s) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Prénom(s) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Lassina Mouhamed"
                  value={formFirstName}
                  onChange={(e) => setFormFirstName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* ID Comptable (système) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  ID Élève (Comptabilité)
                </label>
                <input
                  type="text"
                  readOnly
                  value={displayStudentId}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold cursor-not-allowed"
                />
              </div>

              {/* Matricule Officiel Ministère */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Matricule Officiel (Ministère MENA)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 21458932A (ou laisser vide)"
                  value={formMatricule}
                  onChange={(e) => setFormMatricule(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Classe *</label>
                <select
                  value={formClassName}
                  onChange={(e) => setFormClassName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Genre</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormGender('M');
                      if (formPavilion.includes('Filles')) setFormPavilion('Pavillon A (Garçons)');
                    }}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formGender === 'M'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    ♂ Garçon
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormGender('F');
                      if (formPavilion.includes('Garçons')) setFormPavilion('Pavillon B (Filles)');
                    }}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formGender === 'F'
                        ? 'bg-pink-50 border-pink-300 text-pink-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    ♀ Fille
                  </button>
                </div>
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

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Pavillon d&apos;Hébergement</label>
                <select
                  value={formPavilion}
                  onChange={(e) => setFormPavilion(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none"
                >
                  <option value="Pavillon A (Garçons)">Pavillon A (Garçons)</option>
                  <option value="Pavillon B (Filles)">Pavillon B (Filles)</option>
                </select>
              </div>

              {/* Contact WhatsApp Principal */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Contact WhatsApp Parent Principal *</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Ex: +225 07 48 92 11 00"
                    value={formParentContact}
                    onChange={(e) => setFormParentContact(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* Contacts Secondaires Spacieux */}
              <div className="space-y-2 sm:col-span-2">
                {formSecondaryPhones.map((phone, pIdx) => (
                  <div key={pIdx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => {
                        const copy = [...formSecondaryPhones];
                        copy[pIdx] = e.target.value;
                        setFormSecondaryPhones(copy);
                      }}
                      placeholder={`Deuxième / Troisième numéro (Ex : +225 05 01 22 33 44)`}
                      className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setFormSecondaryPhones(formSecondaryPhones.filter((_, i) => i !== pIdx))}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title="Supprimer ce numéro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {formSecondaryPhones.length < 2 && (
                  <button
                    type="button"
                    onClick={() => setFormSecondaryPhones([...formSecondaryPhones, ''])}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Ajouter un autre contact (Deuxième / Troisième numéro)</span>
                  </button>
                )}
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
                    value={formMonthlyRate === 0 ? '' : formMonthlyRate}
                    onChange={(e) => setFormMonthlyRate(Number(e.target.value) || 0)}
                    placeholder="0"
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

            {/* 3. Grille des 9 Mois Scolaires (Septembre à Mai) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mois Scolaires Pris en Compte (Septembre à Mai — 9 mois) :</span>
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

              <div className="grid grid-cols-3 gap-2">
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
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="submit"
                disabled={!isFormDirty}
                className={`w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isFormDirty
                    ? 'text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 cursor-pointer transform hover:-translate-y-0.5'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                {isFormDirty ? <Save className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span>
                  {isCreatingNew
                    ? 'Valider la Nouvelle Souscription'
                    : hasPaymentChange
                    ? 'Enregistrer le Paiement & Actualiser le Reçu'
                    : isFormDirty
                    ? 'Enregistrer les Modifications du Dossier'
                    : '🔒 Aucune modification ni nouveau versement'}
                </span>
              </button>
              {!isFormDirty && !isCreatingNew && (
                <p className="text-[10.5px] text-slate-400 text-center font-medium">
                  Modifiez une coordonnée ou cochez un mois pour enregistrer.
                </p>
              )}
              {!isCreatingNew && activeBoarder && (
                <button
                  type="button"
                  onClick={() => setShowDeleteBoardingModal(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer shadow-2xs mt-1"
                  title="Supprimer ce reçu ou ce pensionnaire en doublon"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Supprimer ce Reçu / Pensionnaire</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* COLONNE DROITE : REÇU OFFICIEL D'INTERNAT EN DIRECT (Cadré et Rétréci pour éviter les espaces vides) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-start space-y-4">
          {/* Barre d'Actions Rapides du Reçu */}
          <div className="w-full max-w-[620px] bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs flex items-center justify-between flex-wrap gap-2 print:hidden">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-heading">
                Reçu Officiel
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Bouton Impression Reçu */}
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
                title="Imprimer uniquement ce reçu sur feuille A4"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                <span>Imprimer le Reçu</span>
              </button>

              {/* Bouton Partager sur WhatsApp */}
              <button
                type="button"
                onClick={() => handleDirectWhatsAppShare()}
                disabled={isGeneratingImage}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-400 hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                title="Copier l'image HD du reçu dans le presse-papier et ouvrir WhatsApp"
              >
                {isGeneratingImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>Partager sur WhatsApp</span>
              </button>

              {/* Bouton Supprimer ce Reçu / Pensionnaire */}
              {activeBoarder && (
                <button
                  type="button"
                  onClick={() => setShowDeleteBoardingModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-all shadow-2xs cursor-pointer"
                  title="Supprimer ce reçu ou ce pensionnaire en doublon"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Supprimer ce Reçu</span>
                </button>
              )}
            </div>
          </div>

          {/* DOCUMENT OFFICIEL DU REÇU IMPRIMABLE & CAPTURABLE EN IMAGE (Largeur compacte et textes agrandis) */}
          <div
            id="official-receipt-printable"
            ref={receiptRef}
            className="w-full max-w-[620px] mx-auto bg-white border-2 border-slate-900 rounded-3xl p-5 sm:p-6 space-y-4 shadow-md print:border-none print:shadow-none print:p-0 print:max-w-none"
          >
            {/* 1. En-tête de l'Établissement DANS UN CADRE ÉLÉGANT */}
            <div className="border-2 border-slate-900 rounded-2xl p-3.5 sm:p-4 bg-slate-50/70 shadow-2xs flex items-center justify-between gap-3">
              {/* Logo Gauche */}
              <div className="w-18 h-18 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                {currentSchool.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentSchool.logoUrl}
                    alt={currentSchool.name}
                    crossOrigin="anonymous"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl border border-emerald-300 bg-emerald-50 flex flex-col items-center justify-center text-center p-1">
                    <Building2 className="w-6 h-6 text-emerald-600 mb-0.5" />
                    <span className="text-[8px] font-black text-emerald-800 uppercase leading-none">
                      {currentSchool.shortName || 'LOGO'}
                    </span>
                  </div>
                )}
              </div>

              {/* Centre : Hiérarchie stricte avec nom et sigle sur la même ligne */}
              <div className="text-center flex-1 space-y-0.5 min-w-0">
                <h1 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-tight font-heading leading-tight">
                  {currentSchool.name || 'EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL'}
                </h1>
                {currentSchool.shortName && (
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono font-black text-[9.5px] tracking-wider shadow-2xs">
                      {currentSchool.shortName.toUpperCase()}
                    </span>
                  </div>
                )}
                <p className="text-[10px] sm:text-[11px] italic text-emerald-900 font-semibold leading-tight">
                  « {currentSchool.motto || 'Discipline • Rigueur • Réussite'} »
                </p>
                {currentSchool.slogan && (
                  <p className="text-[9.5px] sm:text-[10px] font-medium text-amber-700 italic leading-tight">
                    ✦ {currentSchool.slogan}
                  </p>
                )}
                <p className="text-[9.5px] sm:text-[10px] font-medium text-slate-600 leading-tight">
                  {currentSchool.district || `${currentSchool.city} — ${currentSchool.country}`} • Tél : {currentSchool.phone || '+225 01 02 03 04 05'}
                </p>
                <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[9px] font-mono font-bold text-slate-700">
                  <span>Code Établissement : {currentSchool.ministryCode || '321119'}</span>
                </div>
              </div>

              {/* Emblème Droit */}
              <div className="w-18 h-18 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                {currentSchool.countryEmblemUrl && currentSchool.countryEmblemUrl.startsWith('data:image') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentSchool.countryEmblemUrl}
                    alt="Armoiries Nationales"
                    crossOrigin="anonymous"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl border border-amber-300 bg-amber-50 flex flex-col items-center justify-center text-center p-1">
                    <Building2 className="w-6 h-6 text-amber-600 mb-0.5" />
                    <span className="text-[8px] font-black text-amber-900 uppercase leading-none">
                      ARMOIRIES
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Titre & Référence de Quittance */}
            <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between text-xs sm:text-sm">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-extrabold block">
                  Document Officiel d&apos;Encaissement
                </span>
                <span className="font-extrabold font-heading text-xs sm:text-sm">
                  REÇU DE PAIEMENT INTERNAT & PENSIONNAT
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-300 block font-mono font-bold">
                  RÉF : QUI-INT-2026-{(activeBoarderIndex + 1).toString().padStart(4, '0')}
                </span>
                <span className="font-extrabold text-amber-400 text-xs sm:text-sm">
                  {formPaymentDate}
                </span>
              </div>
            </div>

            {/* 3. Détails du Pensionnaire (Textes agrandis & Distinction ID / Matricule) */}
            <div className="grid grid-cols-2 gap-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl p-3.5 bg-slate-50/80">
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-500 font-bold block">Élève Pensionnaire (Nom en Majuscules) :</span>
                <span className="font-black text-slate-950 text-sm">
                  {formLastName ? `${formLastName.toUpperCase()} ${formFirstName}`.trim() : formStudentName || 'Non renseigné'}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-500 font-bold block">Classe & Genre :</span>
                <span className="font-extrabold text-slate-900">
                  {formClassName} • {formGender === 'F' ? '♀ Fille' : '♂ Garçon'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-bold block">ID Élève (Comptabilité) :</span>
                <span className="font-mono font-black text-emerald-800">{displayStudentId || '—'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold block">Matricule Officiel (MENA) :</span>
                <span className="font-mono font-bold text-slate-800">{formMatricule.trim() ? formMatricule.trim() : '—'}</span>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-bold block">Pavillon & Chambre :</span>
                <span className="font-extrabold text-purple-900">{formPavilion} — {formRoom || 'Chambre 101'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold block">Contact WhatsApp Parent :</span>
                <span className="font-mono font-bold text-slate-900">{formParentContact || 'Non renseigné'}</span>
              </div>

              {/* Contacts Secondaires Dédiés */}
              {formSecondaryPhones && formSecondaryPhones.filter(Boolean).length > 0 && (
                <div className="col-span-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-500 font-bold block">Autres contacts (Deuxième / Troisième numéro) :</span>
                  <span className="font-mono font-bold text-slate-800 text-xs">
                    {formSecondaryPhones.filter(Boolean).join('  •  ')}
                  </span>
                </div>
              )}
            </div>

            {/* 4. Tableau du Décompte Financier (9 Mois : Septembre à Mai) */}
            <div className="border border-slate-300 rounded-xl overflow-hidden text-xs sm:text-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-300 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3.5">Désignation</th>
                    <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Mois Réglés (sur 9)</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Montant Encaissé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  <tr>
                    <td className="py-3 px-3.5">
                      <div className="font-extrabold text-slate-950">Pension d&apos;Internat Annuelle</div>
                      <div className="text-[11px] sm:text-xs text-slate-500 font-medium whitespace-nowrap flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span>Tarif : <strong className="text-slate-900 font-bold">{formatFCFA(formMonthlyRate)} / mois</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Mode de Règlement : <strong className="text-slate-900 font-bold">{formPaymentMethod}</strong></span>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-center whitespace-nowrap align-middle">
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-black border border-emerald-300 text-xs whitespace-nowrap inline-block shadow-2xs">
                        {activePaidMonthsCount} / 9 mois
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right font-black text-slate-950 font-heading text-sm sm:text-base whitespace-nowrap align-middle">
                      {formatFCFA(activeTotalCollected)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-300 text-xs sm:text-sm">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3.5 text-slate-700 font-extrabold whitespace-nowrap">
                      Reste Annuel à Solder (sur les 9 mois) :
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-rose-600 font-black font-heading text-sm sm:text-base whitespace-nowrap">
                      {formatFCFA(activeRemainingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 5. Liste des mois réglés */}
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-950">
              <span className="font-extrabold block mb-1.5">Mois d&apos;internat validés par ce reçu :</span>
              <div className="flex flex-wrap gap-1.5">
                {MONTHS_LIST.map((m) => (
                  <span
                    key={m}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      activeMonthsChecked[m]
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-400 border-slate-200 line-through'
                    }`}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* 6. Signature Unique : Intendance & Cachet Officiel de l'École (Sans signature parent) */}
            <div className="pt-3 border-t border-slate-300 flex flex-col items-end">
              <div className="text-right space-y-2 max-w-xs">
                <div>
                  <span className="text-xs font-black text-slate-950 uppercase block tracking-wider font-heading">
                    L&apos;Intendance & Économe de l&apos;Établissement
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">Direction Générale & Pédagogique</span>
                </div>

                {/* Emplacement Cachet / Tampon */}
                <div className="h-16 flex items-center justify-end">
                  {currentSchool.stampUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentSchool.stampUrl}
                      alt="Cachet officiel"
                      crossOrigin="anonymous"
                      className="max-h-full object-contain opacity-95"
                    />
                  ) : (
                    <div className="p-2.5 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/80 flex items-center gap-1.5 text-xs font-extrabold text-emerald-900 shadow-2xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Cachet Électronique Certifié</span>
                    </div>
                  )}
                </div>

                <p className="text-[9px] text-slate-400 italic">
                  {currentSchool.receiptFooterNote || 'Reçu certifié et numéroté immédiat. Aucun remboursement après encaissement.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODAL PRÉVISUALISATION & PARTAGE PHOTO REÇU WHATSAPP ================= */}
      {whatsAppPreviewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200 print:hidden">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-heading">
                    Photo HD du Reçu d&apos;Internat & Pensionnat
                  </h3>
                  <p className="text-xs text-slate-500">
                    Parent / Élève : <strong className="text-slate-900 font-mono whitespace-nowrap">{whatsAppPreviewData.phone}</strong> ({whatsAppPreviewData.name})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsAppPreviewData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Aperçu fidèle de l'image capturée */}
            <div className="rounded-2xl border-2 border-slate-200 overflow-hidden bg-slate-50 max-h-72 overflow-y-auto p-1.5 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={whatsAppPreviewData.imageUrl}
                alt="Photo officielle du reçu d'internat"
                className="w-full object-contain rounded-xl shadow-xs"
              />
            </div>

            {/* Instruction claire */}
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-900">
                  Le reçu automatique a été déjà copié dans votre presse-papiers !
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-tight">
                  Vous pouvez maintenant aller directement sur WhatsApp et faire <strong>Coller (Ctrl + V)</strong> dans la discussion pour envoyer le reçu officiel.
                </p>
              </div>
            </div>

            {/* Actions principales */}
            <div className="space-y-2 pt-1">
              <a
                href={
                  whatsAppPreviewData.cleanPhone
                    ? `https://wa.me/${whatsAppPreviewData.cleanPhone}?text=${encodeURIComponent(
                        `📄 *REÇU DE PAIEMENT INTERNAT & PENSIONNAT — ${(currentSchool.shortName || currentSchool.name || 'ÉTABLISSEMENT SCOLAIRE').toUpperCase()}*\n👤 Élève : *${formStudentName}* (${formMatricule})\n🏫 Classe : *${formClassName}*\n🏠 Pavillon / Chambre : *${formPavilion} — ${formRoom}*\n💰 Tarif Mensuel : *${formatFCFA(formMonthlyRate)} / mois*\n✅ *Total Encaissé : ${formatFCFA(activeTotalCollected)}*\n📅 Date : ${formPaymentDate}\n\n_(L'image HD du reçu est copiée : faites Coller / Ctrl+V directement dans WhatsApp)._\n\n_Reçu certifié par l'Intendance & Gestion de l'Internat._`
                      )}`
                    : `https://wa.me/?text=${encodeURIComponent(
                        `📄 *REÇU DE PAIEMENT INTERNAT & PENSIONNAT — ${(currentSchool.shortName || currentSchool.name || 'ÉTABLISSEMENT SCOLAIRE').toUpperCase()}*\n👤 Élève : *${formStudentName}* (${formMatricule})\n🏫 Classe : *${formClassName}*\n🏠 Pavillon / Chambre : *${formPavilion} — ${formRoom}*\n💰 Tarif Mensuel : *${formatFCFA(formMonthlyRate)} / mois*\n✅ *Total Encaissé : ${formatFCFA(activeTotalCollected)}*\n📅 Date : ${formPaymentDate}\n\n_(L'image HD du reçu est copiée : faites Coller / Ctrl+V directement dans WhatsApp)._\n\n_Reçu certifié par l'Intendance & Gestion de l'Internat._`
                      )}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Ouvrir WhatsApp ({whatsAppPreviewData.phone})</span>
              </a>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (navigator.clipboard && (window as any).ClipboardItem) {
                        await navigator.clipboard.write([
                          new (window as any).ClipboardItem({ 'image/png': whatsAppPreviewData.blob }),
                        ]);
                        setToastMessage('✓ Image du reçu recopiée dans le presse-papier !');
                        setTimeout(() => setToastMessage(null), 3000);
                      }
                    } catch (e) {}
                  }}
                  className="inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Recopier l&apos;image</span>
                </button>

                <a
                  href={whatsAppPreviewData.imageUrl}
                  download={whatsAppPreviewData.fileName}
                  className="inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Télécharger PNG</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
