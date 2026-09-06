'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student, School, Invoice } from '@/lib/data/types';
import { GenderBadge } from '@/components/ui/badge';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { availableClasses, mockStudents } from '@/lib/data/mock-data';
import { getLiveStudents, getLiveSchool, DATA_UPDATED_EVENT, getDeletedStudentIds, broadcastLiveUpdate } from '@/lib/data/live-store';
import { saveStudentToSupabase, saveInvoiceToSupabase } from '@/lib/supabase/services';
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
} from 'lucide-react';

interface BoardingViewProps {
  initialBoarders?: any;
  school: School;
  schoolSlug: string;
}

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

  // Modale de Confirmation de Souscription d'Internat
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

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

  // Construction de la liste des pensionnaires inscrits (STRICTEMENT reliée aux souscriptions confirmées)
  const boarders = useMemo(() => {
    // Les pensionnaires issus des customSubscriptions
    const customList = customSubscriptions
      .map((cs) => {
        let foundStudent = students.find(
          (s) => s.id === cs.studentId || s.studentNumber === cs.matricule || s.matricule === cs.matricule
        );

        // Sécurité anti-disparition : si l'élève n'est pas encore dans l'état local students, reconstruction directe depuis cs
        if (!foundStudent && cs.studentName) {
          const nameParts = cs.studentName.trim().split(' ');
          foundStudent = {
            id: cs.studentId,
            studentNumber: cs.matricule || `MAT-${cs.studentId.slice(-4)}`,
            matricule: cs.matricule || `MAT-${cs.studentId.slice(-4)}`,
            firstName: nameParts[0] || 'Élève',
            lastName: nameParts.slice(1).join(' ') || 'Pensionnaire',
            fullName: cs.studentName.trim(),
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

        const studentMonths = monthlyPayments[cs.studentId] || {};
        const paidMonthsCount = MONTHS_LIST.filter((m) => studentMonths[m]).length;
        const totalPaid = paidMonthsCount * cs.monthlyRate;
        const totalDue = cs.monthlyRate * 9; // 9 mois stricts
        const remainingBalance = Math.max(0, totalDue - totalPaid);

        return {
          student: foundStudent,
          isBoarder: true,
          pavilion: cs.pavilion,
          roomNumber: cs.roomNumber,
          monthlyRate: cs.monthlyRate,
          paidMonthsCount,
          totalPaid,
          totalDue,
          remainingBalance,
          isUpToDate: remainingBalance === 0,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    return customList;
  }, [students, customSubscriptions, monthlyPayments]);

  // Filtrage pour la recherche et la navigation
  const filteredBoarders = useMemo(() => {
    return boarders.filter((b) => {
      const matchSearch =
        searchQuery === '' ||
        `${b.student.firstName} ${b.student.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.student.studentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
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

  // États du formulaire interactif
  const [formStudentName, setFormStudentName] = useState('');
  const [formMatricule, setFormMatricule] = useState('');
  const [formClassName, setFormClassName] = useState('6ème');
  const [formGender, setFormGender] = useState<'M' | 'F'>('M');
  const [formPavilion, setFormPavilion] = useState('Pavillon A (Garçons)');
  const [formRoom, setFormRoom] = useState('');
  const [formParentContact, setFormParentContact] = useState('');
  const [formMonthlyRate, setFormMonthlyRate] = useState<number>(0);
  const [formPaymentDate, setFormPaymentDate] = useState(getTodayFrenchDateStr());
  const [formPaymentMethod, setFormPaymentMethod] = useState('Espèces');
  const [activeMonthsChecked, setActiveMonthsChecked] = useState<Record<string, boolean>>({});

  // Synchronisation du formulaire avec le pensionnaire actif quand on n'est pas en création
  useEffect(() => {
    if (!isCreatingNew && activeBoarder) {
      setFormStudentName(`${activeBoarder.student.firstName} ${activeBoarder.student.lastName}`.trim());
      setFormMatricule(activeBoarder.student.studentNumber || activeBoarder.student.matricule);
      setFormClassName(activeBoarder.student.grade || (activeBoarder.student as any).className || '6ème');
      setFormGender(activeBoarder.student.gender === 'female' || (activeBoarder.student.gender as any) === 'F' ? 'F' : 'M');
      setFormPavilion(activeBoarder.pavilion);
      setFormRoom(activeBoarder.roomNumber);
      setFormParentContact(activeBoarder.student.guardianPhone || (activeBoarder.student as any).guardianContact || '+225 07 00 00 00 00');
      setFormMonthlyRate(activeBoarder.monthlyRate || 0);

      const months = monthlyPayments[activeBoarder.student.id] || {};
      setActiveMonthsChecked(months);
    }
  }, [activeBoarder, isCreatingNew, monthlyPayments]);

  // Réinitialisation complète à zéro pour « Nouvelle Souscription »
  const handleStartNewSubscription = () => {
    setIsCreatingNew(true);
    setFormStudentName('');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setFormMatricule(`MAT-2026-${randomSuffix}`);
    setFormClassName('6ème');
    setFormGender('M');
    setFormPavilion('Pavillon A (Garçons)');
    setFormRoom('');
    setFormParentContact('');
    setFormMonthlyRate(0); // Coordonnées et montants à 0
    setFormPaymentDate(getTodayFrenchDateStr());
    setFormPaymentMethod('Espèces');
    setActiveMonthsChecked({}); // Aucun mois coché

    setToastMessage('📝 Formulaire réinitialisé à zéro. Saisissez les coordonnées de la nouvelle souscription.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Annuler la création et revenir aux pensionnaires existants
  const handleCancelNewSubscription = () => {
    setIsCreatingNew(false);
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
      return formStudentName.trim().length > 0 && Number(formMonthlyRate) > 0;
    }
    if (!activeBoarder) return false;

    const initialName = `${activeBoarder.student.firstName} ${activeBoarder.student.lastName}`.trim();
    const initialMatricule = activeBoarder.student.studentNumber || activeBoarder.student.matricule || '';
    const initialClass = activeBoarder.student.grade || (activeBoarder.student as any).className || '6ème';
    const initialGender = activeBoarder.student.gender === 'female' || (activeBoarder.student.gender as any) === 'F' ? 'F' : 'M';
    const initialPavilion = activeBoarder.pavilion || 'Pavillon A (Garçons)';
    const initialRoom = activeBoarder.roomNumber || '';
    const initialContact = activeBoarder.student.guardianPhone || (activeBoarder.student as any).guardianContact || '+225 07 00 00 00 00';
    const initialRate = activeBoarder.monthlyRate || 0;
    const initialMethod = activeBoarder.student.paymentMethod || 'Espèces';

    const initialMonths = monthlyPayments[activeBoarder.student.id] || {};

    const nameChanged = formStudentName.trim() !== initialName;
    const matChanged = formMatricule.trim() !== initialMatricule;
    const classChanged = formClassName !== initialClass;
    const genderChanged = formGender !== initialGender;
    const pavChanged = formPavilion !== initialPavilion;
    const roomChanged = formRoom.trim() !== initialRoom;
    const contactChanged = formParentContact.trim() !== initialContact;
    const rateChanged = Number(formMonthlyRate) !== initialRate;
    const methodChanged = formPaymentMethod !== initialMethod;

    const monthsChanged = MONTHS_LIST.some((m) => !!activeMonthsChecked[m] !== !!initialMonths[m]);

    return nameChanged || matChanged || classChanged || genderChanged || pavChanged || roomChanged || contactChanged || rateChanged || methodChanged || monthsChanged;
  }, [
    isCreatingNew,
    activeBoarder,
    formStudentName,
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

    if (!formStudentName.trim()) {
      alert('Veuillez saisir le nom et prénom de l’élève.');
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
    const targetStudentId = isCreatingNew
      ? `stud-int-${Date.now()}`
      : activeBoarder?.student.id || `stud-int-${Date.now()}`;

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
      studentName: formStudentName.trim(),
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

    // 3. Enregistrer l'élève dans le registre persistant multi-clés et Supabase (SANS fausse scolarité)
    const nameParts = formStudentName.trim().split(' ');
    const studentObj: Student = {
      id: targetStudentId,
      studentNumber: formMatricule.trim(),
      matricule: formMatricule.trim(),
      firstName: nameParts[0] || 'Élève',
      lastName: nameParts.slice(1).join(' ') || 'Pensionnaire',
      fullName: formStudentName.trim(),
      avatar: '',
      gender: formGender === 'F' ? 'female' : 'male',
      grade: formClassName,
      address: 'Abidjan, Côte d\'Ivoire',
      guardianName: 'Parent / Tuteur',
      guardianPhone: formParentContact.trim(),
      whatsappPhone: formParentContact.trim(),
      tuitionAmount: 0,
      paidAmount: 0,
      registrationFee: 0,
      paymentDate: formPaymentDate || getTodayFrenchDateStr(),
      paymentMethod: formPaymentMethod,
      attendanceRate: 100,
      status: 'active',
      tuitionStatus: 'unpaid',
      isBoarding: true,
      enrollmentType: isCreatingNew ? 'nouveau' : (activeBoarder?.student.enrollmentType || 'nouveau'),
    };

    try {
      // Clé globale
      const raw = localStorage.getItem(STUDENTS_STORAGE_KEY);
      const currentList: Student[] = raw ? JSON.parse(raw) : [];
      const updatedStudentList = [studentObj, ...currentList.filter((s) => s.id !== targetStudentId && s.studentNumber !== formMatricule.trim())];
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updatedStudentList));

      // Clé école spécifique
      const schoolKey = `${STUDENTS_STORAGE_KEY}_${schoolSlug}`;
      const rawSchool = localStorage.getItem(schoolKey);
      const currentSchoolList: Student[] = rawSchool ? JSON.parse(rawSchool) : [];
      const updatedSchoolList = [studentObj, ...currentSchoolList.filter((s) => s.id !== targetStudentId && s.studentNumber !== formMatricule.trim())];
      localStorage.setItem(schoolKey, JSON.stringify(updatedSchoolList));

      if (schoolSlug === 'epc-manoi' || schoolSlug === 'college-excellence') {
        localStorage.setItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`, JSON.stringify(updatedSchoolList));
        localStorage.setItem(`${STUDENTS_STORAGE_KEY}_college-excellence`, JSON.stringify(updatedSchoolList));
      }

      // Synchronisation Supabase de l'élève
      saveStudentToSupabase(studentObj, schoolSlug).catch(() => {});
    } catch (err) {}

    // Mise à jour immédiate de l'état local students pour que les 3 blocs KPI se recalculent sur-le-champ
    setStudents((prev) => [studentObj, ...prev.filter((s) => s.id !== targetStudentId && s.studentNumber !== formMatricule.trim())]);

    // 4. Gérer la Facture / Quittance officielle d'Internat pour le Journal de Caisse & Dashboard
    const invoiceNumber = `INT-${formMatricule.replace(/\D/g, '').slice(-4) || Date.now().toString().slice(-4)}`;
    const invoiceId = `inv-boarding-${targetStudentId}`;

    if (activeTotalCollected > 0) {
      const boardingInvoice: Invoice = {
        id: invoiceId,
        invoiceNumber,
        studentId: targetStudentId,
        studentName: formStudentName.trim(),
        studentGrade: formClassName,
        studentGender: formGender === 'F' ? 'female' : 'male',
        guardianName: 'Parent / Tuteur',
        guardianPhone: formParentContact.trim(),
        feeType: 'Internat & Pensionnat',
        amount: activeTotalAnnualExigible,
        discountAmount: 0,
        netAmount: activeTotalAnnualExigible,
        paidAmount: activeTotalCollected,
        balanceRemaining: activeRemainingBalance,
        paymentMethod: formPaymentMethod,
        enrollmentType: isCreatingNew ? 'nouveau' : (activeBoarder?.student.enrollmentType || 'nouveau'),
        issueDate: formPaymentDate || getTodayFrenchDateStr(),
        dueDate: formPaymentDate || getTodayFrenchDateStr(),
        status: activeRemainingBalance === 0 ? 'paid' : 'partial',
      };

      try {
        const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
        const prevInvoices: Invoice[] = rawInvoices ? JSON.parse(rawInvoices) : [];
        const updatedInvoices = [
          boardingInvoice,
          ...prevInvoices.filter((i) => i.id !== invoiceId && i.studentId !== targetStudentId && i.invoiceNumber !== invoiceNumber),
        ];
        localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(updatedInvoices));

        const invSchoolKey = `${INVOICES_STORAGE_KEY}_${schoolSlug}`;
        const rawInvSchool = localStorage.getItem(invSchoolKey);
        const prevInvSchool: Invoice[] = rawInvSchool ? JSON.parse(rawInvSchool) : [];
        const updatedInvSchool = [
          boardingInvoice,
          ...prevInvSchool.filter((i) => i.id !== invoiceId && i.studentId !== targetStudentId && i.invoiceNumber !== invoiceNumber),
        ];
        localStorage.setItem(invSchoolKey, JSON.stringify(updatedInvSchool));

        if (schoolSlug === 'epc-manoi' || schoolSlug === 'college-excellence') {
          localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, JSON.stringify(updatedInvSchool));
          localStorage.setItem(`${INVOICES_STORAGE_KEY}_college-excellence`, JSON.stringify(updatedInvSchool));
        }

        saveInvoiceToSupabase(boardingInvoice, schoolSlug).catch(() => {});
      } catch (err) {}
    } else {
      // Aucun versement d'internat -> nettoyer toute facture résiduelle à zéro franc
      try {
        const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
        if (rawInvoices) {
          const prevInvoices: Invoice[] = JSON.parse(rawInvoices);
          const cleaned = prevInvoices.filter((i) => !(i.id === invoiceId || (i.studentId === targetStudentId && i.feeType === 'Internat & Pensionnat')));
          localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(cleaned));
        }
        const invSchoolKey = `${INVOICES_STORAGE_KEY}_${schoolSlug}`;
        const rawInvSchool = localStorage.getItem(invSchoolKey);
        if (rawInvSchool) {
          const prevInvSchool: Invoice[] = JSON.parse(rawInvSchool);
          const cleaned = prevInvSchool.filter((i) => !(i.id === invoiceId || (i.studentId === targetStudentId && i.feeType === 'Internat & Pensionnat')));
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
    setIsCreatingNew(false);
    setActiveBoarderIndex(0);
    if (activeTotalCollected > 0) {
      setToastMessage(`✓ Quittance d'internat enregistrée avec succès (${activePaidMonthsCount}/9 mois réglés pour ${formStudentName}).`);
    } else {
      setToastMessage(`✓ Modifications des coordonnées du pensionnaire enregistrées avec succès (${formStudentName}).`);
    }
    setTimeout(() => setToastMessage(null), 5000);
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

  // 1. Impression A4 Isolé (Uniquement le reçu cadré)
  const handlePrintReceipt = () => {
    document.body.classList.add('print-receipt-only');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-receipt-only');
    }, 1200);
  };

  // Fonction génératrice de Canvas HD pour le reçu
  const generateReceiptCanvas = async () => {
    if (!receiptRef.current) return null;
    const html2canvasModule = await import('html2canvas');
    const html2canvas = html2canvasModule.default;
    return await html2canvas(receiptRef.current, {
      scale: 2.5, // Ultra Haute Définition
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
    });
  };

  // 2. Téléchargement direct en Image PNG HD
  const handleDownloadReceiptImage = async () => {
    try {
      setIsGeneratingImage(true);
      const canvas = await generateReceiptCanvas();
      if (!canvas) return;
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const cleanName = (formStudentName || 'Eleve').replace(/\s+/g, '_');
      link.download = `Quittance_Internat_${cleanName}_${formMatricule}.png`;
      link.href = url;
      link.click();
      setToastMessage('📥 Image HD de la quittance téléchargée avec succès !');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la génération de l’image du reçu.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // 3. Copier l'Image dans le Presse-Papier (pour coller direct dans WhatsApp avec Ctrl+V)
  const handleCopyReceiptImage = async () => {
    try {
      setIsGeneratingImage(true);
      const canvas = await generateReceiptCanvas();
      if (!canvas) return;

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob }),
            ]);
            setToastMessage('📋 Image de la quittance copiée ! Collez-la directement dans WhatsApp (Ctrl+V).');
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
      const canvas = await generateReceiptCanvas();
      if (canvas) {
        const url = canvas.toDataURL('image/png');
        setGeneratedImagePreviewUrl(url);

        // Copie automatique dans le presse-papier
        canvas.toBlob(async (blob) => {
          if (blob && navigator.clipboard && navigator.clipboard.write) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
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

  // 5. Action directe : Partage WhatsApp Direct avec Copie Image dans le Presse-Papier (Sans redirection automatique)
  const handleDirectWhatsAppShare = async () => {
    try {
      setIsGeneratingImage(true);
      setToastMessage('📸 Capture HD du reçu d\'internat en cours...');
      const canvas = await generateReceiptCanvas();
      if (!canvas) {
        setIsGeneratingImage(false);
        setToastMessage('⚠️ Erreur lors de la capture du reçu.');
        setTimeout(() => setToastMessage(null), 3500);
        return;
      }

      const cleanName = (formStudentName || 'Eleve').replace(/\s+/g, '_');
      const cleanPhone = (formParentContact || '').replace(/[^0-9]/g, '');
      const fileName = `Quittance_Internat_${cleanName}_${formMatricule}.png`;

      let blob: Blob | null = null;
      try {
        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      } catch (blobErr) {
        console.warn('toBlob error:', blobErr);
      }

      if (!blob) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const res = await fetch(dataUrl);
          blob = await res.blob();
        } catch (fetchErr) {
          console.warn('dataUrl fallback failed:', fetchErr);
        }
      }

      if (!blob) {
        setIsGeneratingImage(false);
        setToastMessage('⚠️ Erreur lors de la génération de l\'image.');
        setTimeout(() => setToastMessage(null), 3500);
        return;
      }

      // Copier l'image dans le presse-papier pour WhatsApp (Ctrl+V)
      try {
        if (navigator.clipboard && (window as any).ClipboardItem) {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ 'image/png': blob }),
          ]);
        }
      } catch (e) {
        console.warn('Clipboard write fallback', e);
      }

      const imageUrl = URL.createObjectURL(blob);
      setWhatsAppPreviewData({
        imageUrl,
        blob,
        fileName,
        phone: formParentContact || '+225 --',
        cleanPhone,
        name: formStudentName || 'Élève Interne',
      });

      setToastMessage('✅ Le reçu automatique a été déjà copié dans votre presse-papiers ! Vous pouvez maintenant aller sur WhatsApp et faire Coller (Ctrl + V).');
      setTimeout(() => setToastMessage(null), 7000);
      setIsGeneratingImage(false);
    } catch (e) {
      console.error(e);
      setIsGeneratingImage(false);
      setToastMessage('⚠️ Erreur lors de la capture du reçu.');
      setTimeout(() => setToastMessage(null), 3500);
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
                    const messageText = `📄 Quittance d'internat officielle — ${formStudentName} (${formMatricule})`;
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
          MODALE DE CONFIRMATION DE SOUSCRIPTION / QUITTANCE INTERNAT
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
                    Confirmer la Quittance d&apos;Internat
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
                  La confirmation enregistrera la quittance officielle, actualisera immédiatement les 3 compteurs KPI (effectif, dortoirs, recouvrement) et alimentera le journal des encaissements sur le tableau de bord.
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
            Gestion des dortoirs, chambres et génération des quittances officielles d&apos;internat — {currentSchool.name}
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
                  {idx + 1}. {b.student.firstName} {b.student.lastName} ({b.student.grade || (b.student as any).className || '6ème'} • {b.roomNumber})
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
            {/* 1. Coordonnées de l'élève */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Nom & Prénom de l&apos;Élève *</span>
                  {isCreatingNew && (
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                      Champs vierges
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: KOUASSI Aya Marie"
                  value={formStudentName}
                  onChange={(e) => setFormStudentName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Matricule</label>
                <input
                  type="text"
                  placeholder="Ex: MAT-2026-001"
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

              <div className="space-y-1 sm:col-span-2">
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

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Contact WhatsApp du Tuteur / Parent</label>
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
                    ? 'Enregistrer le Paiement & Actualiser la Quittance'
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
                Quittance Officielle
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
                onClick={handleDirectWhatsAppShare}
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

              {/* Centre : Hiérarchie stricte avec textes agrandis et lisibles */}
              <div className="text-center flex-1 space-y-0.5 min-w-0">
                <h1 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-tight font-heading leading-tight truncate">
                  {currentSchool.name || 'EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL'}
                </h1>
                <p className="text-xs font-extrabold text-emerald-800 tracking-wide font-heading">
                  {currentSchool.shortName || 'EPC MANOI'}
                </p>
                <p className="text-[10px] sm:text-[11px] italic text-slate-700 font-semibold">
                  « {currentSchool.motto || 'Discipline • Rigueur • Réussite'} »
                </p>
                <p className="text-[9.5px] sm:text-[10px] font-medium text-slate-600">
                  {currentSchool.slogan || 'L’Excellence au service de l’Éducation'}
                </p>
                <p className="text-[9px] sm:text-[9.5px] text-slate-500 font-mono font-bold">
                  Code Établissement : {currentSchool.ministryCode || '321119'} • Tél : {currentSchool.phone || '+225 01 02 03 04 05'}
                </p>
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
                  QUITTANCE DE PAIEMENT D&apos;INTERNAT & PENSIONNAT
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

            {/* 3. Détails du Pensionnaire (Textes agrandis) */}
            <div className="grid grid-cols-2 gap-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl p-3 bg-slate-50/70">
              <div>
                <span className="text-[11px] text-slate-500 font-bold block">Nom & Prénom de l&apos;Élève :</span>
                <span className="font-extrabold text-slate-950">{formStudentName || 'Non renseigné'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold block">Matricule & Classe :</span>
                <span className="font-extrabold text-slate-950">{formMatricule} • {formClassName}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold block">Pavillon & Chambre :</span>
                <span className="font-extrabold text-emerald-900">{formPavilion} — {formRoom || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold block">Tuteur / Contact WhatsApp :</span>
                <span className="font-mono font-bold text-slate-900">{formParentContact || 'Non renseigné'}</span>
              </div>
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
              <span className="font-extrabold block mb-1.5">Mois d&apos;internat validés par cette quittance :</span>
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
                    Photo HD de la Quittance d&apos;Internat
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
                  Vous pouvez maintenant aller directement sur WhatsApp et faire <strong>Coller (Ctrl + V)</strong> dans la discussion pour envoyer la quittance officielle.
                </p>
              </div>
            </div>

            {/* Actions principales */}
            <div className="space-y-2 pt-1">
              <a
                href={
                  whatsAppPreviewData.cleanPhone
                    ? `https://wa.me/${whatsAppPreviewData.cleanPhone}?text=${encodeURIComponent(
                        `📄 *QUITTANCE D'INTERNAT & PENSIONNAT — ${(currentSchool.shortName || currentSchool.name || 'ÉTABLISSEMENT SCOLAIRE').toUpperCase()}*\n👤 Élève : *${formStudentName}* (${formMatricule})\n🏫 Classe : *${formClassName}*\n🏠 Pavillon / Chambre : *${formPavilion} — ${formRoom}*\n💰 Tarif Mensuel : *${formatFCFA(formMonthlyRate)} / mois*\n✅ *Total Encaissé : ${formatFCFA(activeTotalCollected)}*\n📅 Date : ${formPaymentDate}\n\n_(L'image HD de la quittance est copiée : faites Coller / Ctrl+V directement dans WhatsApp)._\n\n_Quittance certifiée par l'Intendance & Gestion de l'Internat._`
                      )}`
                    : `https://wa.me/?text=${encodeURIComponent(
                        `📄 *QUITTANCE D'INTERNAT & PENSIONNAT — ${(currentSchool.shortName || currentSchool.name || 'ÉTABLISSEMENT SCOLAIRE').toUpperCase()}*\n👤 Élève : *${formStudentName}* (${formMatricule})\n🏫 Classe : *${formClassName}*\n🏠 Pavillon / Chambre : *${formPavilion} — ${formRoom}*\n💰 Tarif Mensuel : *${formatFCFA(formMonthlyRate)} / mois*\n✅ *Total Encaissé : ${formatFCFA(activeTotalCollected)}*\n📅 Date : ${formPaymentDate}\n\n_(L'image HD de la quittance est copiée : faites Coller / Ctrl+V directement dans WhatsApp)._\n\n_Quittance certifiée par l'Intendance & Gestion de l'Internat._`
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
                        setToastMessage('✓ Image de la quittance recopiée dans le presse-papier !');
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
