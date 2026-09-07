'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student, School, Invoice, StudentInstallments } from '@/lib/data/types';
import { GenderBadge } from '@/components/ui/badge';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { availableClasses } from '@/lib/data/mock-data';
import {
  UserPlus,
  Printer,
  CheckCircle,
  Tag,
  Coins,
  FileText,
  Calendar,
  Check,
  Landmark,
  Smartphone,
  X,
  CheckCircle2,
  ShieldCheck,
  Users,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Sparkles,
  History,
  RotateCcw,
  Edit3,
  Copy,
  Download,
  Trash2,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import {
  getLiveStudents,
  getLiveSchool,
  saveRegisteredStudent,
  DATA_UPDATED_EVENT,
} from '@/lib/data/live-store';
import { playRegistrationSuccessSound, playCopySound } from '@/lib/utils/audio';

interface InscriptionsViewProps {
  initialStudents: Student[];
  school: School;
  schoolSlug?: string;
}

export function InscriptionsView({
  initialStudents,
  school,
  schoolSlug = 'college-excellence',
}: InscriptionsViewProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [schoolState, setSchoolState] = useState<School>(() => getLiveSchool(schoolSlug, school));
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<Student | null>(null);

  // État de sélection d'un élève existant (null = mode nouvelle inscription)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isIdPickerOpen, setIsIdPickerOpen] = useState(false);
  const [idSearchQuery, setIdSearchQuery] = useState('');
  const [idTypeFilter, setIdTypeFilter] = useState<'all' | 'nouveau' | 'ancien'>('all');

  const [collaboratorAlert, setCollaboratorAlert] = useState<{
    message: string;
    studentNumber: string;
    fullName: string;
    newSeq: number;
  } | null>(null);

  const prevMaxSeqRef = useRef<number>(0);

  // Synchronisation dynamique avec le live-store (Élèves & Paramètres École) + Détection Collaborateur en temps réel
  useEffect(() => {
    const initialLive = getLiveStudents(initialStudents, schoolSlug);
    setStudents(initialLive);
    setSchoolState(getLiveSchool(schoolSlug, school));

    const initialNums = initialLive
      .map((s) => {
        const match = (s?.studentNumber || s?.id || '')?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);
    prevMaxSeqRef.current = initialNums.length > 0 ? Math.max(...initialNums) : 0;

    const handleUpdate = (e?: any) => {
      const live = getLiveStudents(initialStudents, schoolSlug);
      // Fusionner immédiatement l'élève reçu par diffusion d'événement pour réactivité instantanée
      const eventStudent = e?.detail?.student;
      let combinedLive = [...live];
      if (eventStudent && !combinedLive.some((s) => s.id === eventStudent.id || s.studentNumber === eventStudent.studentNumber)) {
        combinedLive.push(eventStudent);
      }

      setStudents(combinedLive);
      setSchoolState(getLiveSchool(schoolSlug, school));

      const nums = combinedLive
        .map((s) => {
          const match = (s?.studentNumber || s?.id || '')?.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        })
        .filter((n) => !isNaN(n) && n > 0);
      const currentMax = nums.length > 0 ? Math.max(...nums) : 0;

      // Détecter si un collaborateur vient de valider une inscription
      if (prevMaxSeqRef.current > 0 && currentMax > prevMaxSeqRef.current) {
        const latestStu = combinedLive.find((s) => {
          const num = parseInt((s?.studentNumber || s?.id || '')?.replace(/\D/g, ''), 10);
          return num === currentMax;
        });
        const stuName = latestStu?.fullName || latestStu?.lastName || 'Nouvel élève';
        const stuNum = latestStu?.studentNumber || `ID-${String(currentMax).padStart(3, '0')}`;
        const nextNumber = currentMax + 1;

        setCollaboratorAlert({
          message: `Un collaborateur vient de valider l'inscription ${stuNum} (${stuName}) ! Votre fiche d'inscription a été automatiquement ajustée sur le prochain identifiant ID-${String(nextNumber).padStart(3, '0')} pour éviter toute collision.`,
          studentNumber: stuNum,
          fullName: stuName,
          newSeq: nextNumber,
        });

        // Si l'utilisateur avait sélectionné l'ID qui vient d'être pris par le collaborateur, basculer immédiatement en mode nouveau
        setSelectedStudentId((prev) => {
          if (prev === stuNum || prev === latestStu?.id) {
            return null; // Bascule automatiquement sur le nouveau formulaire
          }
          return prev;
        });

        setTimeout(() => setCollaboratorAlert(null), 10000);
      }

      prevMaxSeqRef.current = currentMax;
    };

    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [initialStudents, schoolSlug, school]);

  // Form State for Live Inscription & Real-Time Receipt (Cases vides par défaut pour une nouvelle inscription)
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [grade, setGrade] = useState('6ème');
  const [enrollmentType, setEnrollmentType] = useState<'nouveau' | 'ancien'>('nouveau');
  const [address, setAddress] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [customMatricule, setCustomMatricule] = useState('');
  const [secondaryPhones, setSecondaryPhones] = useState<string[]>([]);
  const [showSecondaryPhonesOnReceipt, setShowSecondaryPhonesOnReceipt] = useState<boolean>(false);

  // Helper pour l'accord grammatical strict du statut selon le genre (Fille: Nouvelle/Ancienne, Garçon: Nouveau/Ancien)
  const getEnrollmentStatusLabel = (type: 'nouveau' | 'ancien' = 'nouveau', gen: 'female' | 'male' = 'female') => {
    if (type === 'nouveau') {
      return gen === 'female' ? 'Nouvelle' : 'Nouveau';
    } else {
      return gen === 'female' ? 'Ancienne' : 'Ancien';
    }
  };

  // Modal de prévisualisation et partage de la photo HD du reçu WhatsApp
  const [whatsAppPreviewData, setWhatsAppPreviewData] = useState<{
    imageUrl: string;
    blob: Blob;
    fileName: string;
    phone: string;
    cleanPhone: string;
    name: string;
  } | null>(null);

  // Prestations Complémentaires : Internat, Cantine, Transport, Frais Annexes & Tenue Tout Cousue
  const [isBoarding, setIsBoarding] = useState<boolean>(false);
  const [isCanteen, setIsCanteen] = useState<boolean>(false);
  const [isTransport, setIsTransport] = useState<boolean>(false);
  const [fraisAnnexesPaid, setFraisAnnexesPaid] = useState<boolean>(false);
  const [tenueCousuePaid, setTenueCousuePaid] = useState<boolean>(false);

  // Helper pour obtenir la date du jour (format YYYY-MM-DD)
  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Saisie Libre Financière : Chaque école applique ses propres tarifs configurés
  const [registrationFee, setRegistrationFee] = useState<number>(() => schoolState.defaultRegistrationFee || 0);
  const [tuitionAmount, setTuitionAmount] = useState<number>(() => schoolState.defaultTuitionAmount || 0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [remainingAmount, setRemainingAmount] = useState<number>(0);

  // 5 Versements fractionnés (Cases vides à 0 F par défaut - Date par défaut = Date du Jour)
  const [versement1Amount, setVersement1Amount] = useState<number>(0);
  const [versement1Method, setVersement1Method] = useState<string>('Espèces');
  const [versement1Date, setVersement1Date] = useState<string>(getTodayDateStr());

  const [versement2Amount, setVersement2Amount] = useState<number>(0);
  const [versement2Method, setVersement2Method] = useState<string>('Paiement en ligne (Wave)');
  const [versement2Date, setVersement2Date] = useState<string>(getTodayDateStr());

  const [versement3Amount, setVersement3Amount] = useState<number>(0);
  const [versement3Method, setVersement3Method] = useState<string>('Virement bancaire');
  const [versement3Date, setVersement3Date] = useState<string>(getTodayDateStr());

  const [versement4Amount, setVersement4Amount] = useState<number>(0);
  const [versement4Method, setVersement4Method] = useState<string>('Espèces');
  const [versement4Date, setVersement4Date] = useState<string>(getTodayDateStr());

  const [versement5Amount, setVersement5Amount] = useState<number>(0);
  const [versement5Method, setVersement5Method] = useState<string>('Orange Money');
  const [versement5Date, setVersement5Date] = useState<string>(getTodayDateStr());

  // Snapshot des versements initiaux lors de la consultation d'un élève existant
  const [initialVersementsSnapshot, setInitialVersementsSnapshot] = useState<{
    v1: number;
    v2: number;
    v3: number;
    v4: number;
    v5: number;
    total: number;
  } | null>(null);

  // Détection si un nouveau versement a été saisi pour un reçu existant
  const currentVersementsTotal =
    (versement1Amount || 0) +
    (versement2Amount || 0) +
    (versement3Amount || 0) +
    (versement4Amount || 0) +
    (versement5Amount || 0);

  const hasNewVersement = useMemo(() => {
    if (!selectedStudentId) return true; // En mode nouveau reçu, toujours débloqué
    if (!initialVersementsSnapshot) return true;
    return (
      currentVersementsTotal > initialVersementsSnapshot.total ||
      versement1Amount !== initialVersementsSnapshot.v1 ||
      versement2Amount !== initialVersementsSnapshot.v2 ||
      versement3Amount !== initialVersementsSnapshot.v3 ||
      versement4Amount !== initialVersementsSnapshot.v4 ||
      versement5Amount !== initialVersementsSnapshot.v5
    );
  }, [
    selectedStudentId,
    initialVersementsSnapshot,
    currentVersementsTotal,
    versement1Amount,
    versement2Amount,
    versement3Amount,
    versement4Amount,
    versement5Amount,
  ]);

  const [paymentDate, setPaymentDate] = useState<string>(getTodayDateStr());

  // Synchronisation stricte de la date : quand la date d'inscription est modifiée, le 1er versement s'aligne immédiatement
  const handlePaymentDateChange = (newDate: string) => {
    setPaymentDate(newDate);
    setVersement1Date(newDate);
  };
  const [paymentMethod, setPaymentMethod] = useState<'especes' | 'virement' | 'en_ligne'>('especes');
  const [onlineOperator, setOnlineOperator] = useState<'mtn' | 'moov' | 'orange' | 'wave'>('orange');

  // Mise à jour de chaque versement avec synchronisation automatique du total versé et du reste
  const handleUpdateVersement = (
    index: 1 | 2 | 3 | 4 | 5,
    field: 'amount' | 'method' | 'date',
    value: string | number
  ) => {
    let newV1 = versement1Amount;
    let newV2 = versement2Amount;
    let newV3 = versement3Amount;
    let newV4 = versement4Amount;
    let newV5 = versement5Amount;

    if (index === 1) {
      if (field === 'amount') {
        newV1 = parseInt(value as string, 10) || 0;
        setVersement1Amount(newV1);
      }
      if (field === 'method') setVersement1Method(value as string);
      if (field === 'date') setVersement1Date(value as string);
    } else if (index === 2) {
      if (field === 'amount') {
        newV2 = parseInt(value as string, 10) || 0;
        setVersement2Amount(newV2);
      }
      if (field === 'method') setVersement2Method(value as string);
      if (field === 'date') setVersement2Date(value as string);
    } else if (index === 3) {
      if (field === 'amount') {
        newV3 = parseInt(value as string, 10) || 0;
        setVersement3Amount(newV3);
      }
      if (field === 'method') setVersement3Method(value as string);
      if (field === 'date') setVersement3Date(value as string);
    } else if (index === 4) {
      if (field === 'amount') {
        newV4 = parseInt(value as string, 10) || 0;
        setVersement4Amount(newV4);
      }
      if (field === 'method') setVersement4Method(value as string);
      if (field === 'date') setVersement4Date(value as string);
    } else if (index === 5) {
      if (field === 'amount') {
        newV5 = parseInt(value as string, 10) || 0;
        setVersement5Amount(newV5);
      }
      if (field === 'method') setVersement5Method(value as string);
      if (field === 'date') setVersement5Date(value as string);
    }

    if (field === 'amount') {
      const totalPaid = newV1 + newV2 + newV3 + newV4 + newV5;
      setPaidAmount(totalPaid);
      const net = Math.max(0, tuitionAmount - discountAmount);
      setRemainingAmount(Math.max(0, net - totalPaid));
    }
  };

  const getPaymentMethodLabel = () => {
    if (paymentMethod === 'especes') return 'Espèces';
    if (paymentMethod === 'virement') return 'Virement bancaire';
    if (paymentMethod === 'en_ligne') {
      const opMap: Record<string, string> = {
        mtn: 'MTN Money',
        moov: 'Moov Money',
        orange: 'Orange Money',
        wave: 'Wave',
      };
      return `Paiement en ligne (${opMap[onlineOperator] || 'Mobile Money'})`;
    }
    return 'Espèces';
  };

  // Liste triée des élèves par numéro ID croissant (avec protection totale contre les objets incomplets)
  const sortedStudentsById = useMemo(() => {
    return [...(students || [])]
      .filter((s): s is Student => Boolean(s && (s.id || s.studentNumber)))
      .sort((a, b) => {
        const numA = parseInt((a?.studentNumber || a?.id || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt((b?.studentNumber || b?.id || '').replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
  }, [students]);

  // Compute next available Student ID sequence number
  const nextSeq = useMemo(() => {
    if (!students || students.length === 0) return 1;
    const nums = students
      .map((s) => {
        const match = (s?.studentNumber || s?.id || '')?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
    return maxNum + 1;
  }, [students]);

  // Trouver l'élève actuellement sélectionné s'il existe
  const currentSelectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return (students || []).find((s) => s.id === selectedStudentId || s.studentNumber === selectedStudentId) || null;
  }, [selectedStudentId, students]);

  // ID & Matricule affichés
  const currentIdStr = useMemo(() => {
    if (currentSelectedStudent) {
      return currentSelectedStudent.studentNumber || `ID-${nextSeq.toString().padStart(3, '0')}`;
    }
    return `ID-${nextSeq.toString().padStart(3, '0')}`;
  }, [currentSelectedStudent, nextSeq]);

  const autoGeneratedMatricule = useMemo(() => {
    if (currentSelectedStudent) {
      return currentSelectedStudent.matricule || '';
    }
    return '';
  }, [currentSelectedStudent]);

  const currentMatricule = useMemo(() => {
    if (customMatricule.trim()) {
      return customMatricule.trim().toUpperCase();
    }
    if (currentSelectedStudent) {
      return currentSelectedStudent.matricule || '';
    }
    return '';
  }, [customMatricule, currentSelectedStudent]);

  const receiptNumber = useMemo(() => {
    const seqNum = currentSelectedStudent
      ? parseInt((currentSelectedStudent.studentNumber || currentSelectedStudent.id || '').replace(/\D/g, ''), 10) || nextSeq
      : nextSeq;
    return `ID-${seqNum.toString().padStart(3, '0')}`;
  }, [currentSelectedStudent, nextSeq]);

  const netAmount = Math.max(0, tuitionAmount - discountAmount);

  // Validation stricte des coordonnées obligatoires avant de déverrouiller l'enregistrement
  const formValidation = useMemo(() => {
    const isNomValid = Boolean(lastName.trim());
    const isPrenomValid = Boolean(firstName.trim());
    const isMatriculeValid = true;
    const isGenreValid = Boolean(gender);
    const isClasseValid = Boolean(grade && grade.trim());
    const isStatutValid = Boolean(enrollmentType);
    const isParentValid = Boolean(guardianName.trim());
    const isWhatsappValid = Boolean(whatsappPhone.trim());
    const isAdresseValid = Boolean(address.trim());

    const isAllComplete =
      isNomValid &&
      isPrenomValid &&
      isGenreValid &&
      isClasseValid &&
      isStatutValid &&
      isParentValid &&
      isWhatsappValid &&
      isAdresseValid;

    const missingFields: string[] = [];
    if (!isNomValid) missingFields.push('Nom de l’élève');
    if (!isPrenomValid) missingFields.push('Prénom de l’élève');
    if (!isParentValid) missingFields.push('Nom du Parent / Tuteur');
    if (!isWhatsappValid) missingFields.push('Contact WhatsApp Parent');
    if (!isAdresseValid) missingFields.push('Adresse de résidence');

    return {
      isAllComplete,
      isNomValid,
      isPrenomValid,
      isMatriculeValid,
      isGenreValid,
      isClasseValid,
      isStatutValid,
      isParentValid,
      isWhatsappValid,
      isAdresseValid,
      missingFields,
    };
  }, [
    lastName,
    firstName,
    customMatricule,
    autoGeneratedMatricule,
    gender,
    grade,
    enrollmentType,
    guardianName,
    whatsappPhone,
    address,
  ]);

  const isSubmitAllowed = selectedStudentId ? hasNewVersement : formValidation.isAllComplete;

  // Clé de persistance du brouillon du formulaire d'inscription (sessionStorage + localStorage)
  const draftStorageKey = `schoolflow_inscription_draft_${schoolSlug || 'college-excellence'}`;
  const isDraftHydrated = useRef(false);

  // 1. Restaurer le brouillon lors du chargement ou de la navigation vers la page
  useEffect(() => {
    if (typeof window === 'undefined' || isDraftHydrated.current) return;
    try {
      const saved = sessionStorage.getItem(draftStorageKey) || localStorage.getItem(draftStorageKey);
      if (saved && !selectedStudentId) {
        const draft = JSON.parse(saved);
        if (draft.lastName) setLastName(draft.lastName);
        if (draft.firstName) setFirstName(draft.firstName);
        if (draft.gender) setGender(draft.gender);
        if (draft.grade) setGrade(draft.grade);
        if (draft.enrollmentType) setEnrollmentType(draft.enrollmentType);
        if (draft.customMatricule) setCustomMatricule(draft.customMatricule);
        if (draft.address) setAddress(draft.address);
        if (draft.guardianName) setGuardianName(draft.guardianName);
        if (draft.whatsappPhone) setWhatsappPhone(draft.whatsappPhone);
        if (draft.secondaryPhones) setSecondaryPhones(draft.secondaryPhones);
        if (draft.isBoarding !== undefined) setIsBoarding(draft.isBoarding);
        if (draft.isCanteen !== undefined) setIsCanteen(draft.isCanteen);
        if (draft.isTransport !== undefined) setIsTransport(draft.isTransport);
        if (draft.fraisAnnexesPaid !== undefined) setFraisAnnexesPaid(draft.fraisAnnexesPaid);
        if (draft.tenueCousuePaid !== undefined) setTenueCousuePaid(draft.tenueCousuePaid);
        if (draft.registrationFee !== undefined) setRegistrationFee(draft.registrationFee);
        if (draft.tuitionAmount !== undefined) setTuitionAmount(draft.tuitionAmount);
        if (draft.discountAmount !== undefined) setDiscountAmount(draft.discountAmount);
        if (draft.paidAmount !== undefined) setPaidAmount(draft.paidAmount);
        if (draft.remainingAmount !== undefined) setRemainingAmount(draft.remainingAmount);
        if (draft.paymentDate) setPaymentDate(draft.paymentDate);
        if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
        if (draft.onlineOperator) setOnlineOperator(draft.onlineOperator);
        if (draft.versement1Amount !== undefined) setVersement1Amount(draft.versement1Amount);
        if (draft.versement1Method) setVersement1Method(draft.versement1Method);
        if (draft.versement1Date) setVersement1Date(draft.versement1Date);
        if (draft.versement2Amount !== undefined) setVersement2Amount(draft.versement2Amount);
        if (draft.versement2Method) setVersement2Method(draft.versement2Method);
        if (draft.versement2Date) setVersement2Date(draft.versement2Date);
        if (draft.versement3Amount !== undefined) setVersement3Amount(draft.versement3Amount);
        if (draft.versement3Method) setVersement3Method(draft.versement3Method);
        if (draft.versement3Date) setVersement3Date(draft.versement3Date);
        if (draft.versement4Amount !== undefined) setVersement4Amount(draft.versement4Amount);
        if (draft.versement4Method) setVersement4Method(draft.versement4Method);
        if (draft.versement4Date) setVersement4Date(draft.versement4Date);
        if (draft.versement5Amount !== undefined) setVersement5Amount(draft.versement5Amount);
        if (draft.versement5Method) setVersement5Method(draft.versement5Method);
        if (draft.versement5Date) setVersement5Date(draft.versement5Date);
      }
    } catch (e) {
      console.warn('Erreur restauration brouillon inscription:', e);
    } finally {
      isDraftHydrated.current = true;
    }
  }, [draftStorageKey, selectedStudentId]);

  // 2. Mettre en cache instantanément les modifications dans sessionStorage et localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || selectedStudentId || !isDraftHydrated.current) return;

    const hasAnyContent = Boolean(
      lastName ||
      firstName ||
      guardianName ||
      whatsappPhone ||
      address ||
      customMatricule ||
      tuitionAmount > 0 ||
      paidAmount > 0
    );

    if (!hasAnyContent) return;

    const draft = {
      lastName,
      firstName,
      gender,
      grade,
      enrollmentType,
      customMatricule,
      address,
      guardianName,
      whatsappPhone,
      secondaryPhones,
      isBoarding,
      isCanteen,
      isTransport,
      fraisAnnexesPaid,
      tenueCousuePaid,
      registrationFee,
      tuitionAmount,
      discountAmount,
      paidAmount,
      remainingAmount,
      paymentDate,
      paymentMethod,
      onlineOperator,
      versement1Amount,
      versement1Method,
      versement1Date,
      versement2Amount,
      versement2Method,
      versement2Date,
      versement3Amount,
      versement3Method,
      versement3Date,
      versement4Amount,
      versement4Method,
      versement4Date,
      versement5Amount,
      versement5Method,
      versement5Date,
    };

    try {
      sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch (e) {}
  }, [
    selectedStudentId,
    draftStorageKey,
    lastName,
    firstName,
    gender,
    grade,
    enrollmentType,
    customMatricule,
    address,
    guardianName,
    whatsappPhone,
    secondaryPhones,
    isBoarding,
    isCanteen,
    isTransport,
    fraisAnnexesPaid,
    tenueCousuePaid,
    registrationFee,
    tuitionAmount,
    discountAmount,
    paidAmount,
    remainingAmount,
    paymentDate,
    paymentMethod,
    onlineOperator,
    versement1Amount,
    versement1Method,
    versement1Date,
    versement2Amount,
    versement2Method,
    versement2Date,
    versement3Amount,
    versement3Method,
    versement3Date,
    versement4Amount,
    versement4Method,
    versement4Date,
    versement5Amount,
    versement5Method,
    versement5Date,
  ]);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(draftStorageKey);
      localStorage.removeItem(draftStorageKey);
    } catch (e) {}
  };

  // Charger les coordonnées et les frais d'un élève sélectionné
  const handleSelectStudent = (stu: Student) => {
    if (!stu) return;
    try {
      setSelectedStudentId(stu.id);
      setLastName(stu.lastName || '');
      setFirstName(stu.firstName || '');
      setGender(stu.gender || 'female');
      setGrade(stu.grade || '6ème');
      setEnrollmentType(stu.enrollmentType || 'nouveau');
      setCustomMatricule(stu.matricule || '');
      setAddress(stu.address || `${schoolState.city || 'Abidjan'}`);
      setGuardianName(stu.guardianName || '');
      setWhatsappPhone(stu.whatsappPhone || stu.guardianPhone || '');
      setSecondaryPhones(stu.secondaryPhones || []);
      setRegistrationFee(stu.registrationFee !== undefined ? stu.registrationFee : (schoolState.defaultRegistrationFee || 0));
      setTuitionAmount(stu.tuitionAmount || 0);
      setDiscountAmount(stu.discountAmount || 0);
      setPaidAmount(stu.paidAmount || 0);
      const rem = typeof stu.balanceRemaining === 'number'
        ? stu.balanceRemaining
        : Math.max(0, (stu.netAmount || stu.tuitionAmount || 0) - (stu.paidAmount || 0));
      setRemainingAmount(rem);
      const defaultDate = stu.enrollmentDate || stu.paymentDate || getTodayDateStr();
      setPaymentDate(defaultDate);

      // Charger les 5 versements réels de l'élève (sans inventer de versements fictifs)
      const inst = stu.installments;
      const v1 = inst?.versement1 || { amount: 0, paymentMethod: 'Espèces', date: defaultDate };
      const v2 = inst?.versement2 || { amount: 0, paymentMethod: 'Paiement en ligne (Wave)', date: defaultDate };
      const v3 = inst?.versement3 || { amount: 0, paymentMethod: 'Virement bancaire', date: defaultDate };
      const v4 = inst?.versement4 || { amount: 0, paymentMethod: 'Espèces', date: defaultDate };
      const v5 = inst?.versement5 || { amount: 0, paymentMethod: 'Orange Money', date: defaultDate };

      setVersement1Amount(Number(v1?.amount) || 0);
      setVersement1Method(v1?.paymentMethod || 'Espèces');
      setVersement1Date(v1?.date || defaultDate);

      setVersement2Amount(Number(v2?.amount) || 0);
      setVersement2Method(v2?.paymentMethod || 'Paiement en ligne (Wave)');
      setVersement2Date(v2?.date || defaultDate);

      setVersement3Amount(Number(v3?.amount) || 0);
      setVersement3Method(v3?.paymentMethod || 'Virement bancaire');
      setVersement3Date(v3?.date || defaultDate);

      setVersement4Amount(Number(v4?.amount) || 0);
      setVersement4Method(v4?.paymentMethod || 'Espèces');
      setVersement4Date(v4?.date || defaultDate);

      setVersement5Amount(Number(v5?.amount) || 0);
      setVersement5Method(v5?.paymentMethod || 'Orange Money');
      setVersement5Date(v5?.date || defaultDate);

      setPaymentMethod(stu.paymentMethod === 'Virement bancaire' ? 'virement' : (stu.paymentMethod?.includes('Paiement en ligne') ? 'en_ligne' : 'especes'));
      setIsBoarding(!!stu.isBoarding);
      setIsCanteen(!!stu.isCanteen);
      setIsTransport(!!stu.isTransport);
      setFraisAnnexesPaid(stu.notes?.includes('Frais Annexes (Payé)') || false);
      setTenueCousuePaid(stu.notes?.includes('Tenue tout cousue (Payé)') || false);

      // Mémoriser l'état initial des versements pour verrouiller l'enregistrement tant qu'aucun nouveau versement n'est saisi
      const initTotal = (Number(v1?.amount) || 0) + (Number(v2?.amount) || 0) + (Number(v3?.amount) || 0) + (Number(v4?.amount) || 0) + (Number(v5?.amount) || 0);
      setInitialVersementsSnapshot({
        v1: Number(v1?.amount) || 0,
        v2: Number(v2?.amount) || 0,
        v3: Number(v3?.amount) || 0,
        v4: Number(v4?.amount) || 0,
        v5: Number(v5?.amount) || 0,
        total: initTotal,
      });

      setIsIdPickerOpen(false);
    } catch (err) {
      console.error('Erreur sélection élève:', err);
    }
  };

  // Réinitialiser le formulaire pour créer un Nouveau Reçu (mode nouvelle inscription : remise intégrale à zéro)
  const handleStartNewReceipt = () => {
    clearDraft();
    const today = getTodayDateStr();
    setSelectedStudentId(null);
    setInitialVersementsSnapshot(null);
    setLastName('');
    setFirstName('');
    setGender('female');
    setGrade('6ème');
    setEnrollmentType('nouveau');
    setAddress('');
    setGuardianName('');
    setWhatsappPhone('');
    setCustomMatricule('');
    setSecondaryPhones([]);
    setIsBoarding(false);
    setIsCanteen(false);
    setIsTransport(false);
    setRegistrationFee(0);
    setTuitionAmount(0);
    setDiscountAmount(0);
    setPaidAmount(0);
    setRemainingAmount(0);
    setVersement1Amount(0);
    setVersement1Method('Espèces');
    setVersement1Date(today);
    setVersement2Amount(0);
    setVersement2Method('Paiement en ligne (Wave)');
    setVersement2Date(today);
    setVersement3Amount(0);
    setVersement3Method('Virement bancaire');
    setVersement3Date(today);
    setVersement4Amount(0);
    setVersement4Method('Espèces');
    setVersement4Date(today);
    setVersement5Amount(0);
    setVersement5Method('Orange Money');
    setVersement5Date(today);
    setPaymentDate(today);
    setPaymentMethod('especes');
    setFraisAnnexesPaid(false);
    setTenueCousuePaid(false);
    setIsIdPickerOpen(false);
  };

  // Navigation vers l'ID précédent ou suivant (sécurisée)
  const handleNavigateId = (direction: 'prev' | 'next') => {
    if (sortedStudentsById.length === 0) return;

    if (!selectedStudentId) {
      if (direction === 'prev') {
        handleSelectStudent(sortedStudentsById[sortedStudentsById.length - 1]);
      }
      return;
    }

    const currentIndex = sortedStudentsById.findIndex(
      (s) => s.id === selectedStudentId || s.studentNumber === selectedStudentId
    );

    if (currentIndex === -1) {
      if (direction === 'prev' && sortedStudentsById.length > 0) {
        handleSelectStudent(sortedStudentsById[sortedStudentsById.length - 1]);
      } else if (sortedStudentsById.length > 0) {
        handleSelectStudent(sortedStudentsById[0]);
      }
      return;
    }

    if (direction === 'prev') {
      if (currentIndex > 0) {
        handleSelectStudent(sortedStudentsById[currentIndex - 1]);
      }
    } else {
      if (currentIndex < sortedStudentsById.length - 1) {
        handleSelectStudent(sortedStudentsById[currentIndex + 1]);
      } else {
        handleStartNewReceipt();
      }
    }
  };

  // Quick discount handler
  const handleApplyQuickDiscount = (amount: number) => {
    setDiscountAmount(amount);
    const net = Math.max(0, tuitionAmount - amount);
    const totalPaid = versement1Amount + versement2Amount + versement3Amount + versement4Amount + versement5Amount;
    setPaidAmount(totalPaid);
    setRemainingAmount(Math.max(0, net - totalPaid));
  };

  // Form submit handler -> Open Confirmation Modal (Validation stricte)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId && !formValidation.isAllComplete) {
      alert(`Veuillez renseigner toutes les coordonnées obligatoires avant d'enregistrer le reçu :\n- ${formValidation.missingFields.join('\n- ')}`);
      return;
    }
    if (selectedStudentId && !hasNewVersement) {
      alert("L'enregistrement est verrouillé en mode consultation. Seule la saisie d'un nouveau versement débloque l'enregistrement.");
      return;
    }
    setShowConfirmModal(true);
  };

  // Confirm and save student + invoice in persistent live store
  const handleConfirmAndSave = () => {
    // Récupération en temps réel des élèves les plus récents pour éviter toute collision d'ID entre collaborateurs
    const freshStudents = getLiveStudents(initialStudents, schoolSlug);
    const existingNums = freshStudents
      .map((s) => {
        const match = (s?.studentNumber || s?.id || '')?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);
    const freshMax = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    const computedNextSeq = Math.max(nextSeq, freshMax + 1);

    const studentIdToSave = currentSelectedStudent
      ? currentSelectedStudent.id
      : `stu-${computedNextSeq.toString().padStart(3, '0')}`;

    const studentNumberToSave = currentSelectedStudent
      ? currentSelectedStudent.studentNumber
      : `ID-${computedNextSeq.toString().padStart(3, '0')}`;

    const matriculeToSave = currentMatricule;

    const finalPaymentDate = paymentDate || getTodayDateStr();

    const installments: StudentInstallments = {
      versement1: versement1Amount > 0 ? { amount: versement1Amount, paymentMethod: versement1Method, date: versement1Date || finalPaymentDate } : undefined,
      versement2: versement2Amount > 0 ? { amount: versement2Amount, paymentMethod: versement2Method, date: versement2Date || finalPaymentDate } : undefined,
      versement3: versement3Amount > 0 ? { amount: versement3Amount, paymentMethod: versement3Method, date: versement3Date || finalPaymentDate } : undefined,
      versement4: versement4Amount > 0 ? { amount: versement4Amount, paymentMethod: versement4Method, date: versement4Date || finalPaymentDate } : undefined,
      versement5: versement5Amount > 0 ? { amount: versement5Amount, paymentMethod: versement5Method, date: versement5Date || finalPaymentDate } : undefined,
    };

    // En mode consultation, préserver scrupuleusement l'identité de l'élève (modifications d'identité réservées à la page "Vue d'ensemble")
    const finalLastName = currentSelectedStudent ? currentSelectedStudent.lastName : lastName.trim().toUpperCase();
    const finalFirstName = currentSelectedStudent ? currentSelectedStudent.firstName : firstName.trim();
    const finalGender = currentSelectedStudent ? currentSelectedStudent.gender : gender;
    const finalGrade = currentSelectedStudent ? currentSelectedStudent.grade : grade;
    const finalEnrollmentType = currentSelectedStudent ? (currentSelectedStudent.enrollmentType || enrollmentType) : enrollmentType;
    const finalMatricule = currentSelectedStudent ? (currentSelectedStudent.matricule || '') : (customMatricule.trim().toUpperCase() || '');

    const newStudent: Student = {
      id: studentIdToSave,
      studentNumber: studentNumberToSave,
      matricule: finalMatricule,
      firstName: finalFirstName,
      lastName: finalLastName,
      fullName: `${finalLastName} ${finalFirstName}`,
      grade: finalGrade,
      gender: finalGender,
      avatar: currentSelectedStudent?.avatar || '',
      dateOfBirth: currentSelectedStudent?.dateOfBirth || '2015-05-12',
      guardianName: guardianName.trim() || 'Parent',
      guardianPhone: whatsappPhone.trim(),
      whatsappPhone: whatsappPhone.trim(),
      secondaryPhones: secondaryPhones.map((p) => p.trim()).filter(Boolean),
      address: address.trim() || `${schoolState.city}`,
      enrollmentDate: finalPaymentDate,
      attendanceRate: currentSelectedStudent?.attendanceRate || 95,
      status: 'active',
      enrollmentType: finalEnrollmentType,
      registrationFee: registrationFee,
      tuitionAmount: tuitionAmount,
      discountAmount: discountAmount,
      netAmount: netAmount,
      paidAmount: paidAmount,
      balanceRemaining: remainingAmount,
      tuitionStatus: remainingAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
      paymentDate: finalPaymentDate,
      paymentMethod: getPaymentMethodLabel(),
      installments: installments,
      isBoarding: isBoarding,
      isCanteen: isCanteen,
      isTransport: isTransport,
      notes: `Prestations : Internat (${isBoarding ? 'Oui' : 'Non'}), Cantine (${isCanteen ? 'Oui' : 'Non'}), Transport (${isTransport ? 'Oui' : 'Non'}), Frais Annexes (${fraisAnnexesPaid ? 'Payé' : 'Non payé'}), Tenue tout cousue (${tenueCousuePaid ? 'Payé' : 'Non payé'})`,
      updatedAt: new Date().toISOString(),
    };

    const savedReceiptNumber = receiptNumber;

    const newInvoice: Invoice = {
      id: `inv-${studentNumberToSave.replace(/\D/g, '').padStart(3, '0')}`,
      invoiceNumber: savedReceiptNumber,
      studentId: newStudent.id,
      studentName: newStudent.fullName,
      studentAvatar:
        gender === 'female'
          ? 'https://images.unsplash.com/photo-1534751516642-a1714f5a596a?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      studentGrade: grade,
      studentGender: gender,
      guardianName: newStudent.guardianName,
      guardianPhone: newStudent.guardianPhone,
      secondaryPhones: newStudent.secondaryPhones,
      feeType: "Frais d'inscription & Scolarité",
      registrationFee: registrationFee,
      amount: tuitionAmount,
      discountAmount: discountAmount,
      netAmount: netAmount,
      paidAmount: paidAmount,
      balanceRemaining: remainingAmount,
      enrollmentType: enrollmentType,
      paymentMethod: getPaymentMethodLabel(),
      installments: installments,
      issueDate: finalPaymentDate,
      dueDate: finalPaymentDate,
      status: remainingAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'sent',
    };

    // Save to persistent storage and broadcast event
    saveRegisteredStudent(newStudent, newInvoice, schoolSlug);
    clearDraft();

    // Mettre à jour immédiatement la liste locale des élèves pour recalculer le prochain ID/Reçu
    const refreshedStudents = getLiveStudents(initialStudents, schoolSlug);
    setStudents(refreshedStudents);

    // Déclencher le signal sonore de succès
    playRegistrationSuccessSound();

    setSuccessModalData(newStudent);
    setShowConfirmModal(false);
    setSuccessToast(`Élève ${newStudent.fullName} (${newStudent.studentNumber}) enregistré(e) avec succès !`);
  };

  // Close success modal & reset form for next student
  const handleCloseSuccessAndNext = () => {
    setSuccessModalData(null);
    handleStartNewReceipt();
  };

  // Print official receipt
  const handlePrintReceipt = () => {
    window.print();
  };

  // Helper pour copier l'image du reçu dans le presse-papier
  const handleCopyReceiptImageToClipboard = async (blob: Blob) => {
    try {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({
            'image/png': blob,
          }),
        ]);
        playCopySound();
        setSuccessToast("✓ Image du reçu copiée dans le presse-papier ! Vous pouvez faire Coller (Ctrl + V) dans WhatsApp.");
      } else {
        playCopySound();
        setSuccessToast("ℹ️ Image HD du reçu prête pour WhatsApp.");
      }
    } catch (err) {
      console.warn("Copie presse-papier:", err);
    }
  };

  // Helper pour charger une image en tant que HTMLImageElement pour le Canvas
  const loadCanvasImage = (src: string): Promise<HTMLImageElement | null> => {
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

  // Moteur Natif Instantané de Génération du Reçu Officiel en Image HD (Canvas 2D avec Coins Arrondis, Filigrane et Vrais Logos)
  const generateOfficialReceiptCanvas = async (
    name: string,
    phone: string,
    installmentsList: Array<{ label: string; amount: number; method: string; date: string }>,
    targetStudent?: Student | null,
    targetReceiptNum?: string
  ): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1680;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Résolution précise des données cibles (Élève réel pour lequel le reçu est généré)
    const finalStuName = targetStudent ? targetStudent.fullName : (name || 'NOM ET PRÉNOM');
    const finalStuGender = targetStudent ? targetStudent.gender : gender;
    const finalStuGrade = targetStudent ? targetStudent.grade : grade;
    const finalStuStatus = targetStudent ? (targetStudent.enrollmentType || 'nouveau') : enrollmentType;
    const finalStuParent = targetStudent ? (targetStudent.guardianName || 'Non renseigné') : (guardianName || 'Non renseigné');
    const finalStuPhone = targetStudent ? (targetStudent.whatsappPhone || targetStudent.guardianPhone || phone || 'Non renseigné') : (phone || 'Non renseigné');
    const finalStuDate = targetStudent ? (targetStudent.paymentDate || targetStudent.enrollmentDate || paymentDate) : paymentDate;
    const finalStuId = targetStudent ? (targetStudent.studentNumber || targetStudent.id) : currentIdStr;
    const finalStuMat = targetStudent ? (targetStudent.matricule || '') : (currentMatricule || customMatricule.trim());

    const finalReceiptNum = targetReceiptNum || (targetStudent
      ? (targetStudent.studentNumber || currentIdStr)
      : currentIdStr);

    const finalRegistrationFee = targetStudent ? targetStudent.registrationFee : registrationFee;
    const finalTuitionAmount = targetStudent ? targetStudent.tuitionAmount : tuitionAmount;
    const finalDiscountAmount = targetStudent ? (targetStudent.discountAmount || 0) : discountAmount;
    const finalPaidAmount = targetStudent ? targetStudent.paidAmount : paidAmount;
    const finalRemainingAmount = targetStudent ? (targetStudent.balanceRemaining ?? Math.max(0, finalTuitionAmount - finalPaidAmount)) : remainingAmount;

    const finalBoarding = targetStudent ? targetStudent.isBoarding : isBoarding;
    const finalCanteen = targetStudent ? targetStudent.isCanteen : isCanteen;
    const finalTransport = targetStudent ? targetStudent.isTransport : isTransport;

    let finalInstallmentsList = installmentsList;
    if (targetStudent && targetStudent.installments) {
      finalInstallmentsList = [
        { label: '1er Versement', amount: targetStudent.installments.versement1?.amount || 0, method: targetStudent.installments.versement1?.paymentMethod || 'Espèces en caisse', date: targetStudent.installments.versement1?.date || finalStuDate },
        { label: '2ème Versement', amount: targetStudent.installments.versement2?.amount || 0, method: targetStudent.installments.versement2?.paymentMethod || 'Espèces en caisse', date: targetStudent.installments.versement2?.date || finalStuDate },
        { label: '3ème Versement', amount: targetStudent.installments.versement3?.amount || 0, method: targetStudent.installments.versement3?.paymentMethod || 'Espèces en caisse', date: targetStudent.installments.versement3?.date || finalStuDate },
        { label: '4ème Versement', amount: targetStudent.installments.versement4?.amount || 0, method: targetStudent.installments.versement4?.paymentMethod || 'Espèces en caisse', date: targetStudent.installments.versement4?.date || finalStuDate },
        { label: '5ème Versement', amount: targetStudent.installments.versement5?.amount || 0, method: targetStudent.installments.versement5?.paymentMethod || 'Espèces en caisse', date: targetStudent.installments.versement5?.date || finalStuDate },
      ];
    }

    // Helper pour dessiner des rectangles aux coins élégamment arrondis
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

    // Preload real school logo and country emblem
    const logoImgPromise = loadCanvasImage(
      schoolState.logoUrl ||
        'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&auto=format&fit=crop&q=80'
    );
    const emblemImgPromise = loadCanvasImage(
      schoolState.countryEmblemUrl ||
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png'
    );
    const [logoImg, emblemImg] = await Promise.all([logoImgPromise, emblemImgPromise]);

    // Fond blanc pur
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 1680);

    // Bordure extérieure avec coins arrondis (radius 24)
    drawRoundRect(30, 30, 1140, 1620, 24);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Cadre intérieur subtil arrondi (radius 20)
    drawRoundRect(38, 38, 1124, 1604, 20);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // --- EN-TÊTE ÉTABLISSEMENT ARRONDI (radius 20) ---
    drawRoundRect(45, 45, 1110, 245, 20);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Logo École à gauche (cadre arrondi 16)
    drawRoundRect(65, 65, 130, 130, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (logoImg) {
      ctx.save();
      drawRoundRect(70, 70, 120, 120, 14);
      ctx.clip();
      ctx.drawImage(logoImg, 70, 70, 120, 120);
      ctx.restore();
    } else {
      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 20px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EPC', 130, 125);
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('MANOI', 130, 150);
    }

    // Emblème National à droite (cadre arrondi 16)
    drawRoundRect(1005, 65, 130, 130, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (emblemImg) {
      ctx.save();
      drawRoundRect(1010, 70, 120, 120, 14);
      ctx.clip();
      ctx.drawImage(emblemImg, 1010, 70, 120, 120);
      ctx.restore();
    } else {
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 18px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RÉPUBLIQUE', 1070, 125);
      ctx.font = '13px Inter, sans-serif';
      ctx.fillText("CÔTE D'IVOIRE", 1070, 150);
    }

    // Textes École au centre
    ctx.textAlign = 'center';

    // Ligne 1 : Nom officiel complet
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 24px Outfit, sans-serif';
    ctx.fillText((schoolState.receiptHeaderFullName || schoolState.name || 'EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL').toUpperCase(), 600, 95);

    // Ligne 2 : Sigle / Nom court
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillText((schoolState.shortName || 'EPC MANOI').toUpperCase(), 600, 124);

    // Ligne 3 : Slogan / Devise
    if (schoolState.receiptHeaderSlogan || schoolState.slogan) {
      ctx.fillStyle = '#b45309';
      ctx.font = 'italic bold 13px Outfit, sans-serif';
      ctx.fillText(schoolState.receiptHeaderSlogan || schoolState.slogan || '✦ Former les élites et leaders de demain pour un avenir radieux', 600, 148);
    }

    // Ligne 4 : Contacts & Situation
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText(`Situation : ${schoolState.receiptHeaderAddress || schoolState.district || 'Cocody Angré 8ème Tranche'} • Tél : ${schoolState.receiptHeaderPhone || schoolState.phone || '+225 27 22 44 11 00'}`, 600, 170);

    // Ligne 5 : Badge Code Établissement
    drawRoundRect(380, 186, 440, 30, 8);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`Code Établissement : ${schoolState.menaCode || schoolState.ministryCode || 'MENA-04829-CI'}`, 600, 206);

    // --- BANDEAU TITRE DU REÇU ARRONDI (radius 12) ---
    drawRoundRect(45, 305, 1110, 56, 12);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 23px Outfit, sans-serif';
    ctx.fillText('REÇU DE PAIEMENT', 70, 341);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 21px monospace';
    ctx.fillText(`Quittance N° : ${finalReceiptNum}`, 1130, 341);

    // --- COORDONNÉES ÉLÈVE & PARENT ARRONDI (radius 16) ---
    drawRoundRect(45, 375, 1110, 228, 16);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';

    // Ligne 1 : ID Comptable, Matricule Officiel & Date d'encaissement
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('ID Élève :', 70, 408);
    ctx.font = 'bold 17px monospace';
    ctx.fillText(finalStuId, 155, 408);

    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('Matricule :', 390, 408);
    ctx.font = 'bold 17px monospace';
    ctx.fillText(finalStuMat ? finalStuMat : '—', 485, 408);

    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText("Date d'encaissement :", 750, 408);
    ctx.font = 'bold 17px monospace';
    ctx.fillText(formatDate(finalStuDate), 930, 408);

    // Ligne 2 : Nom de l'élève & Classe
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('Nom & Prénom :', 70, 442);
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.fillText(`${finalStuName.toUpperCase()} (${finalStuGender === 'female' ? '♀ Fille' : '♂ Garçon'})`, 205, 442);

    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('Classe & Statut :', 750, 442);
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(`${finalStuGrade} (${getEnrollmentStatusLabel(finalStuStatus, finalStuGender)})`, 885, 442);

    // Ligne 3 : Parent & Contacts Téléphoniques (Principal, 2ème, 3ème numéro)
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('Parent / Tuteur :', 70, 474);
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(finalStuParent, 205, 474);

    const finalSecPhones = (targetStudent?.secondaryPhones && targetStudent.secondaryPhones.length > 0)
      ? targetStudent.secondaryPhones
      : secondaryPhones.map((p) => p.trim()).filter(Boolean);

    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('Contact WhatsApp :', 750, 474);
    ctx.font = 'bold 16px monospace';
    ctx.fillText(finalStuPhone || '—', 915, 474);

    if (finalSecPhones.length > 0) {
      let secPhoneText = '';
      if (finalSecPhones[0]) secPhoneText += `Deuxième numéro : ${finalSecPhones[0]}`;
      if (finalSecPhones[1]) secPhoneText += `   |   Troisième numéro : ${finalSecPhones[1]}`;
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(secPhoneText, 750, 498);
      ctx.fillStyle = '#0f172a';
    }

    // Ligne 4 : 5 Blocs de Prestations & Services avec Icônes/Emojis et Badges de Statut
    const servicesList = [
      {
        title: '🏢 Internat',
        active: finalBoarding,
        activeLabel: 'Pensionnaire',
        inactiveLabel: 'Externe',
        activeBg: '#d1fae5',
        activeText: '#065f46',
        inactiveBg: '#f1f5f9',
        inactiveText: '#475569',
      },
      {
        title: '🍲 Cantine',
        active: finalCanteen,
        activeLabel: 'Souscrit',
        inactiveLabel: 'Sans cantine',
        activeBg: '#d1fae5',
        activeText: '#065f46',
        inactiveBg: '#f1f5f9',
        inactiveText: '#475569',
      },
      {
        title: '🚌 Transport',
        active: finalTransport,
        activeLabel: 'Souscrit',
        inactiveLabel: 'Sans transport',
        activeBg: '#d1fae5',
        activeText: '#065f46',
        inactiveBg: '#f1f5f9',
        inactiveText: '#475569',
      },
      {
        title: '🎒 Frais Annexes',
        active: fraisAnnexesPaid,
        activeLabel: 'Payé',
        inactiveLabel: 'Non payé',
        activeBg: '#d1fae5',
        activeText: '#065f46',
        inactiveBg: '#ffe4e6',
        inactiveText: '#9f1239',
      },
      {
        title: '👔 Tenue Cousue',
        active: tenueCousuePaid,
        activeLabel: 'Payé',
        inactiveLabel: 'Non payé',
        activeBg: '#d1fae5',
        activeText: '#065f46',
        inactiveBg: '#ffe4e6',
        inactiveText: '#9f1239',
      },
    ];

    const cardY = 526;
    const cardW = 205;
    const cardH = 58;
    const gap = 15;
    const startX = 65;

    servicesList.forEach((srv, idx) => {
      const bx = startX + idx * (cardW + gap);
      // Fond de la boîte avec bordure
      drawRoundRect(bx, cardY, cardW, cardH, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Titre Service avec Icône
      ctx.textAlign = 'center';
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText(srv.title, bx + cardW / 2, cardY + 20);

      // Badge Statut
      const badgeW = 155;
      const badgeH = 22;
      const badgeX = bx + (cardW - badgeW) / 2;
      const badgeY = cardY + 28;
      drawRoundRect(badgeX, badgeY, badgeW, badgeH, 6);
      ctx.fillStyle = srv.active ? srv.activeBg : srv.inactiveBg;
      ctx.fill();
      ctx.strokeStyle = srv.active ? '#6ee7b7' : '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = srv.active ? srv.activeText : srv.inactiveText;
      ctx.font = 'bold 11px Inter, sans-serif';
      const label = srv.active ? `✓ ${srv.activeLabel}` : srv.inactiveLabel;
      ctx.fillText(label, bx + cardW / 2, badgeY + 15);
    });

    // --- TABLEAU FINANCIER OFFICIEL ARRONDI ---
    drawRoundRect(45, 615, 1110, 42, 10);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillText('DÉSIGNATION DU RÈGLEMENT', 70, 632);
    ctx.textAlign = 'right';
    ctx.fillText('MONTANT (FCFA) / ÉTAT', 1130, 632);

    let y = 680;
    const drawRow = (label: string, value: string, isBold = false, isEmerald = false, isRose = false) => {
      drawRoundRect(45, y - 26, 1110, 44, 8);
      ctx.fillStyle = isEmerald ? '#ecfdf5' : isRose ? '#fff1f2' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = isEmerald ? '#065f46' : isRose ? '#9f1239' : '#0f172a';
      ctx.font = isBold ? 'bold 17px Inter, sans-serif' : '16px Inter, sans-serif';
      ctx.fillText(label, 70, y + 3);

      ctx.textAlign = 'right';
      ctx.fillStyle = isEmerald ? '#047857' : isRose ? '#be123c' : '#0f172a';
      ctx.font = isBold ? 'bold 20px monospace' : '18px monospace';
      ctx.fillText(value, 1130, y + 3);

      y += 48;
    };

    drawRow("Frais d'inscription", formatFCFA(finalRegistrationFee || 0));
    drawRow(`Scolarité annuelle (${finalStuGrade})`, formatFCFA(finalTuitionAmount || 0));
    if ((finalDiscountAmount || 0) > 0) {
      drawRow('Réduction / Bourse accordée', `-${formatFCFA(finalDiscountAmount || 0)}`);
    }
    if ((finalPaidAmount || 0) > 0) {
      drawRow('Versements Scolarité Encaissés', formatFCFA(finalPaidAmount || 0), false, true, false);
    }
    drawRow(
      'Reste à Payer Scolarité (Solde)',
      finalRemainingAmount > 0 ? `${formatFCFA(finalRemainingAmount)} (À régler)` : '0 FCFA (Soldé)',
      true,
      finalRemainingAmount === 0,
      finalRemainingAmount > 0
    );

    // --- DÉTAIL DES 5 VERSEMENTS ARRONDI ---
    y += 14;
    drawRoundRect(45, y - 24, 1110, 38, 8);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 17px Outfit, sans-serif';
    ctx.fillText('DÉTAIL DES 5 VERSEMENTS & MODES DE RÈGLEMENT', 70, y + 2);
    ctx.textAlign = 'right';
    ctx.fillText('5 TRANCHES', 1130, y + 2);

    y += 36;
    finalInstallmentsList.forEach((inst) => {
      drawRoundRect(45, y - 20, 1110, 36, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = inst.amount > 0 ? '#0f172a' : '#94a3b8';
      ctx.font = inst.amount > 0 ? 'bold 16px Inter, sans-serif' : '15px Inter, sans-serif';
      ctx.fillText(`${inst.label} :`, 70, y + 5);

      ctx.textAlign = 'right';
      if (inst.amount > 0) {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(formatFCFA(inst.amount), 830, y + 5);

        ctx.fillStyle = '#047857';
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.fillText(`[ ${inst.method} • ${formatDate(inst.date)} ]`, 1130, y + 5);
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 17px monospace';
        ctx.fillText('-', 1130, y + 5);
      }
      y += 40;
    });

    // --- CACHET CAISSE & VALIDATION COMPTABLE ARRONDI (radius 16) ---
    y += 14;
    drawRoundRect(45, y, 1110, 120, 16);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('✓ ENCAISSEMENT VALIDÉ & CERTIFIÉ', 70, y + 44);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`Quittance officielle N° ${finalReceiptNum}`, 70, y + 74);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px Inter, sans-serif';
    ctx.fillText('LA CAISSE & LE COMPTABLE :', 1130, y + 44);

    // Sceau Caisse Validé arrondi
    drawRoundRect(850, y + 54, 270, 50, 10);
    ctx.fillStyle = '#ecfdf5';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 17px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('[ CACHET CAISSE OFFICIEL ]', 985, y + 85);

    // Bas de page officiel
    y += 145;
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Document émis électroniquement par SchoolFlow Africa le ${formatDate(finalStuDate)} • Quittance N° ${finalReceiptNum} • Valeur juridique intégrale`,
      600,
      y
    );

    return canvas;
  };

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

  // Send receipt photo/image via WhatsApp (100% Natif, Instantané, avec Vrais Logos et Sans Échec)
  const handleCaptureAndShareWhatsApp = async (
    customPhone?: string,
    stuName?: string,
    shouldOpenWindow: boolean = true,
    targetStudent?: Student | null,
    targetReceiptNum?: string
  ) => {
    const activeStudent = targetStudent || successModalData;
    const rawPhone = customPhone || (activeStudent?.whatsappPhone || activeStudent?.guardianPhone) || whatsappPhone || '+225 07 48 92 11 00';
    const cleanPhone = formatCleanWhatsApp(rawPhone) || '2250748921100';

    const name = stuName || activeStudent?.fullName || (lastName ? `${lastName.toUpperCase()} ${firstName}` : `${firstName}`).trim() || 'Élève';
    
    const activeReceiptNumber = targetReceiptNum || (activeStudent
      ? (activeStudent.studentNumber || currentIdStr)
      : currentIdStr);

    setSuccessToast("📸 Génération du reçu et ouverture de WhatsApp...");

    const schoolGreeting = (schoolState.schoolType === 'laique')
      ? 'Salut'
      : (schoolState.schoolType === 'non_confessionnelle')
      ? 'Bonjour'
      : 'Salam anlaekoum';

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
      `${schoolGreeting}, voici le reçu officiel de paiement (${activeReceiptNumber}) pour ${name} — ${schoolState.name}.`
    )}`;

    // Ouvrir immédiatement l'onglet WhatsApp du parent en direct si demandé (pour clic bouton direct)
    if (shouldOpenWindow) {
      try {
        window.open(whatsappUrl, '_blank');
      } catch (e) {}
    }

    try {
      const installmentsList = [
        { label: '1er Versement', amount: versement1Amount, method: versement1Method, date: versement1Date },
        { label: '2ème Versement', amount: versement2Amount, method: versement2Method, date: versement2Date },
        { label: '3ème Versement', amount: versement3Amount, method: versement3Method, date: versement3Date },
        { label: '4ème Versement', amount: versement4Amount, method: versement4Method, date: versement4Date },
        { label: '5ème Versement', amount: versement5Amount, method: versement5Method, date: versement5Date },
      ];

      const canvas = await generateOfficialReceiptCanvas(name, rawPhone, installmentsList, activeStudent, activeReceiptNumber);

      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          alert("Erreur lors de la création de la photo du reçu.");
          return;
        }

        const fileName = `Recu-Paiement-${activeReceiptNumber}-${name.replace(/\s+/g, '_')}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        const imageUrl = URL.createObjectURL(blob);

        // Copier l'image dans le presse-papier pour collage direct (Ctrl+V)
        await handleCopyReceiptImageToClipboard(blob);

        // Sur mobile/tablette supportant le partage de fichiers
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Reçu de Paiement - ${name}`,
              text: `Reçu officiel de paiement (${activeReceiptNumber}) pour ${name} — ${schoolState.name}`,
              files: [file],
            });
            setSuccessToast(`✓ Photo du reçu partagée avec succès sur WhatsApp !`);
            return;
          } catch (shareErr: any) {
            if (shareErr.name === 'AbortError') return;
          }
        }

        // Téléchargement automatique de l'image PNG HD
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Ouvrir la modale interactive avec prévisualisation et bouton WhatsApp direct
        setWhatsAppPreviewData({
          imageUrl,
          blob,
          fileName,
          phone: rawPhone,
          cleanPhone,
          name,
        });

        setSuccessToast(`📷 Photo HD du reçu (${activeReceiptNumber}) générée et copiée ! Faites Ctrl + V dans WhatsApp.`);
      }, 'image/png');
    } catch (err) {
      console.error('Erreur génération reçu image:', err);
      window.open(whatsappUrl, '_blank');
    }
  };

  // Liste filtrée pour le sélecteur / popup d'ID
  const filteredStudentsForPicker = useMemo(() => {
    return sortedStudentsById.filter((stu) => {
      const q = idSearchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        stu.studentNumber.toLowerCase().includes(q) ||
        stu.fullName.toLowerCase().includes(q) ||
        stu.grade.toLowerCase().includes(q) ||
        (stu.guardianName && stu.guardianName.toLowerCase().includes(q));

      const matchesType =
        idTypeFilter === 'all' || stu.enrollmentType === idTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [sortedStudentsById, idSearchQuery, idTypeFilter]);

  // Composant officiel de Quittance de Reçu (Utilisé en direct à l'écran et pour l'impression officielle 1 page A4)
  const renderReceiptSlip = (copyLabel?: string) => {
    return (
      <div className="bg-white rounded-2xl border-2 border-slate-900 shadow-sm relative overflow-hidden p-4 sm:p-5 space-y-3.5">
        {/* CADRE EN-TÊTE OFFICIEL : Logos harmonieux, Nom école, Sigle en dessous, coordonnées nettes */}
        <div className="relative z-10 border-2 border-slate-900 rounded-xl bg-white shadow-2xs p-3">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Logo de l'École (À gauche) - Sans flash ni image bizarre */}
            <div className="shrink-0 text-center flex items-center justify-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center overflow-hidden">
                {schoolState.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={schoolState.logoUrl}
                    alt={schoolState.name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg bg-emerald-700 text-white flex flex-col items-center justify-center font-heading font-black shadow-inner">
                    <span className="text-xs sm:text-sm tracking-wider leading-none uppercase">
                      {schoolState.shortName ? schoolState.shortName.slice(0, 4) : 'SF'}
                    </span>
                    <span className="text-[8px] font-bold text-emerald-200 tracking-tight mt-0.5">ÉCOLE</span>
                  </div>
                )}
              </div>
            </div>

            {/* Informations de l'école au centre : Nom complet en Ligne 1, Sigle EN DESSOUS en Ligne 2 */}
            <div className="flex-1 min-w-0 px-1 text-center space-y-1">
              <h2
                className="font-black uppercase tracking-tight text-slate-950 font-heading text-[11px] sm:text-xs md:text-sm lg:text-[14px] leading-tight text-center"
              >
                {schoolState.name || 'EPC MARKAZ NOUROUL-OULOUM INTERNATIONAL'}
              </h2>
              {schoolState.shortName && (
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono font-black text-[10px] sm:text-xs tracking-wider shadow-2xs">
                    {schoolState.shortName.toUpperCase()}
                  </span>
                </div>
              )}
              <p className="font-semibold text-emerald-900 italic text-[9.5px] sm:text-[11px] leading-tight">
                « {schoolState.motto || 'Excellence Académique • Rigueur • Éducation de Référence'} »
              </p>
              {schoolState.slogan && (
                <p className="font-medium text-amber-700 italic text-[9px] sm:text-[10px] leading-tight">
                  ✦ {schoolState.slogan}
                </p>
              )}
              <p className="text-slate-700 font-medium leading-tight text-[9.5px] sm:text-[10.5px]">
                {schoolState.district || `${schoolState.city} — ${schoolState.country}`} • Tél : {schoolState.phone || '+225 27 22 44 11 00'}
              </p>
              <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-slate-900 text-[9px] sm:text-[10px]">
                <span>Code Établissement : {schoolState.ministryCode || 'MENA-04829-CI'}</span>
              </div>
            </div>

            {/* Emblème National à droite */}
            <div className="shrink-0 text-center flex items-center justify-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    schoolState.countryEmblemUrl ||
                    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png'
                  }
                  alt="Emblème National"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* BANDEAU OFFICIEL : REÇU DE PAIEMENT */}
        <div className="relative z-10 bg-slate-950 text-white rounded-xl flex items-center justify-between shadow-xs px-4 py-2.5">
          <div className="flex items-center gap-2">
            <FileText className="text-emerald-400 shrink-0 w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-extrabold tracking-wider uppercase font-heading text-xs sm:text-sm md:text-base">
              REÇU DE PAIEMENT
            </span>
            {copyLabel && (
              <span className="px-2 py-0.5 rounded font-mono font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[9.5px] sm:text-xs">
                {copyLabel}
              </span>
            )}
          </div>
          <span className="font-mono font-extrabold text-emerald-300 text-xs sm:text-sm">
            {receiptNumber}
          </span>
        </div>

        {/* Détails Élève & Coordonnées Quittance */}
        <div className="relative z-10 rounded-xl bg-slate-50/95 border border-slate-200 p-3.5 space-y-2.5 text-xs sm:text-sm">
          {/* 1. En-tête de Quittance : Identifiant Comptable, Matricule Officiel, Date & Statut Administratif */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pb-2.5 border-b border-slate-200/80 items-center">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                ID Élève (Compta) :
              </span>
              <span className="font-mono font-black text-emerald-800 text-xs sm:text-sm">
                {currentIdStr}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                Matricule Officiel :
              </span>
              <span className="font-mono font-black text-slate-950 text-xs sm:text-sm">
                {currentMatricule ? currentMatricule : '—'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                Date d&apos;encaissement :
              </span>
              <span className="font-extrabold text-slate-950 text-xs sm:text-sm font-mono">
                {formatDate(paymentDate)}
              </span>
            </div>

            <div className="flex flex-col sm:items-end justify-center">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">
                Statut Inscription :
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border shadow-2xs whitespace-nowrap ${
                enrollmentType === 'nouveau'
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                  : 'bg-blue-100 text-blue-950 border-blue-300'
              }`}>
                <span className="text-sm leading-none">{enrollmentType === 'nouveau' ? '🌟' : '🔄'}</span>
                <span>
                  {enrollmentType === 'nouveau'
                    ? (gender === 'female' ? 'Nouvelle Inscription' : 'Nouveau Inscrit')
                    : (gender === 'female' ? 'Ancienne Élève' : 'Ancien Élève')}
                </span>
              </span>
            </div>
          </div>

          {/* 2. Nom de Famille (en Majuscule), Prénom(s), Genre & Classe */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                Nom de Famille & Prénom(s) de l&apos;Élève :
              </span>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {lastName || firstName ? (
                  <span className="font-black text-slate-950 font-heading text-sm sm:text-base truncate">
                    <span className="uppercase tracking-wide font-black">{lastName || 'NOM'}</span>{' '}
                    <span className="font-bold text-slate-800">{firstName || ''}</span>
                  </span>
                ) : (
                  <span className="text-slate-400 italic font-normal text-xs sm:text-sm">— En attente de saisie —</span>
                )}
                <span className="text-[11px] font-bold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded-md">
                  {gender === 'female' ? '♀ Fille' : '♂ Garçon'}
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Classe :</span>
              <span className="inline-flex px-3 py-1 rounded-lg bg-white border-2 border-emerald-500 text-emerald-900 font-black text-xs shadow-2xs font-heading">
                {grade}
              </span>
            </div>
          </div>

          {/* 3. Coordonnées Parents, Règlement & Soldes */}
          <div className="grid grid-cols-2 gap-2.5 pt-0.5">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">
                Nom du Parent / Tuteur :
              </span>
              <span className="font-extrabold text-slate-900 truncate block">
                {guardianName || '—'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">
                Contact Principal (WhatsApp) :
              </span>
              <span className="font-mono font-black text-emerald-900 text-xs sm:text-sm block">
                {whatsappPhone || '—'}
              </span>
            </div>

            {/* Ligne dédiée spacieuse pour le 2ème et 3ème numéro pour éviter tout débordement */}
            {secondaryPhones && secondaryPhones.filter(Boolean).length > 0 && (
              <div className="col-span-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3">
                {secondaryPhones[0] && secondaryPhones[0].trim() && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Deuxième numéro :
                    </span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 shadow-2xs">
                      {secondaryPhones[0].trim()}
                    </span>
                  </div>
                )}
                {secondaryPhones[1] && secondaryPhones[1].trim() && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Troisième numéro :
                    </span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 shadow-2xs">
                      {secondaryPhones[1].trim()}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">
                Mode de Règlement :
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-slate-900">
                {getPaymentMethodLabel()}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">
                Adresse de Résidence :
              </span>
              <span className="text-slate-800 font-semibold truncate block" title={address}>
                {address || '—'}
              </span>
            </div>


            <div className="col-span-2 pt-2 border-t border-slate-200/70 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">
                  RESTE À PAYER SCOLARITÉ :
                </span>
                {remainingAmount > 0 ? (
                  <span className="font-mono font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200 text-xs inline-block">
                    {formatFCFA(remainingAmount)} (À régler)
                  </span>
                ) : (
                  <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 text-xs inline-block">
                    0 FCFA (Soldé ✓)
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">
                  Montant Réglé à ce jour :
                </span>
                <span className="font-mono font-black text-emerald-900 text-xs sm:text-sm">
                  {formatFCFA(paidAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Statuts des Prestations : Internat, Cantine, Transport, Frais Annexes & Tenue Tout Cousue (Bien centrés et équilibrés) */}
          <div className="col-span-2 pt-2 border-t border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 text-center">
              Prestations & Services Complémentaires
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {/* 1. Internat */}
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-600 mb-1">🏢 Internat</span>
                {isBoarding ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <Check className="w-3 h-3 text-emerald-700" />
                    Pensionnaire
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    Externe
                  </span>
                )}
              </div>

              {/* 2. Cantine */}
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-600 mb-1">🍲 Cantine</span>
                {isCanteen ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <Check className="w-3 h-3 text-emerald-700" />
                    Souscrit
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                    <X className="w-3 h-3 text-slate-400" />
                    Sans cantine
                  </span>
                )}
              </div>

              {/* 3. Transport */}
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-600 mb-1">🚌 Transport</span>
                {isTransport ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <Check className="w-3 h-3 text-emerald-700" />
                    Souscrit
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                    <X className="w-3 h-3 text-slate-400" />
                    Sans transport
                  </span>
                )}
              </div>

              {/* 4. Frais Annexes */}
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-600 mb-1">🎒 Frais Annexes</span>
                {fraisAnnexesPaid ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <Check className="w-3 h-3 text-emerald-700" />
                    Payé
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                    <X className="w-3 h-3 text-rose-600" />
                    Non payé
                  </span>
                )}
              </div>

              {/* 5. Tenue Tout Cousue */}
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-600 mb-1">👔 Tenue Cousue</span>
                {tenueCousuePaid ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <Check className="w-3 h-3 text-emerald-700" />
                    Payé
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                    <X className="w-3 h-3 text-rose-600" />
                    Non payé
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tableau Financier du Reçu */}
        <div className="relative z-10 border-2 border-slate-300 rounded-xl overflow-hidden text-xs sm:text-sm">
          <table className="w-full">
            <thead className="bg-slate-100 text-[10.5px] font-black uppercase tracking-wider text-slate-700 border-b border-slate-200">
              <tr>
                <th className="text-left py-2 px-3">Désignation</th>
                <th className="text-right py-2 px-3">Montant / État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {/* Ligne 1 : Frais d'inscription */}
              <tr>
                <td className="text-slate-800 font-bold py-2.5 px-3">
                  <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                    <span className="whitespace-nowrap">Frais d&apos;inscription</span>
                    <span className="text-[9.5px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 whitespace-nowrap shrink-0">
                      Payé à l&apos;inscription
                    </span>
                  </div>
                </td>
                <td className="text-right font-black text-slate-950 font-mono py-2.5 px-3 whitespace-nowrap">
                  {formatFCFA(registrationFee)}
                </td>
              </tr>

              {/* Ligne 2 : Scolarité Annuelle */}
              <tr className="bg-slate-50/50">
                <td className="text-slate-800 font-bold py-2.5 px-3 whitespace-nowrap">
                  Scolarité Annuelle ({grade})
                </td>
                <td className="text-right font-black text-slate-950 font-mono py-2.5 px-3 whitespace-nowrap">
                  {formatFCFA(tuitionAmount)}
                </td>
              </tr>

              {/* Ligne 3 : Réduction éventuelle */}
              {discountAmount > 0 && (
                <tr className="bg-amber-50/50 text-amber-950">
                  <td className="font-bold flex items-center gap-1.5 py-2.5 px-3 whitespace-nowrap">
                    <Tag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="whitespace-nowrap">Réduction / Bourse accordée</span>
                  </td>
                  <td className="text-right font-black font-mono py-2.5 px-3 text-amber-800 whitespace-nowrap">
                    -{formatFCFA(discountAmount)}
                  </td>
                </tr>
              )}

              {/* Ligne 4 : Versements scolarité encaissés */}
              {paidAmount > 0 && (
                <tr className="bg-emerald-50/30 text-emerald-950">
                  <td className="font-bold py-2.5 px-3 flex items-center gap-1.5 whitespace-nowrap">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="whitespace-nowrap">Versements Scolarité Encaissés</span>
                  </td>
                  <td className="text-right font-black font-mono py-2.5 px-3 text-emerald-800 whitespace-nowrap">
                    {formatFCFA(paidAmount)}
                  </td>
                </tr>
              )}

              {/* Ligne 5 : Reste à payer sur la scolarité */}
              {remainingAmount > 0 ? (
                <tr className="text-rose-800 bg-rose-50 font-black">
                  <td className="py-2.5 px-3 whitespace-nowrap">Reste à Payer Scolarité (Solde dû)</td>
                  <td className="text-right font-mono py-2.5 px-3 whitespace-nowrap text-rose-700">
                    {formatFCFA(remainingAmount)}
                  </td>
                </tr>
              ) : (
                <tr className="text-emerald-800 bg-emerald-50 font-black">
                  <td className="py-2.5 px-3 whitespace-nowrap">Reste à Payer Scolarité</td>
                  <td className="text-right font-mono py-2.5 px-3 whitespace-nowrap text-emerald-700">
                    0 FCFA (Scolarité Soldée)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Échéancier compact des 5 versements */}
        <div className="relative z-10 border-2 border-slate-300 rounded-xl overflow-hidden bg-slate-50/40 text-xs">
          <div className="bg-slate-100 border-b border-slate-200 flex items-center justify-between px-3 py-1.5">
            <span className="font-black uppercase tracking-wider text-slate-800 font-heading flex items-center gap-1 text-[10px]">
              <Coins className="w-3 h-3 text-emerald-600" />
              <span>Détail des 5 Versements & Modes de Règlement</span>
            </span>
            <span className="text-[9px] font-mono font-bold text-slate-600">5 Tranches</span>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: '1er Versement', amount: versement1Amount, method: versement1Method, date: versement1Date },
              { label: '2ème Versement', amount: versement2Amount, method: versement2Method, date: versement2Date },
              { label: '3ème Versement', amount: versement3Amount, method: versement3Method, date: versement3Date },
              { label: '4ème Versement', amount: versement4Amount, method: versement4Method, date: versement4Date },
              { label: '5ème Versement', amount: versement5Amount, method: versement5Method, date: versement5Date },
            ].map((tr, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5">
                <span className={`font-bold ${tr.amount > 0 ? 'text-slate-950' : 'text-slate-400'}`}>
                  {tr.label} :
                </span>

                {tr.amount > 0 ? (
                  <div className="flex items-center gap-2 text-right">
                    <span className="font-mono font-black text-slate-950 whitespace-nowrap">
                      {formatFCFA(tr.amount)}
                    </span>
                    <span className="text-[9.5px] font-bold text-emerald-900 bg-emerald-100 px-2 py-0.2 rounded border border-emerald-300 whitespace-nowrap">
                      {tr.method} • {formatDate(tr.date || paymentDate)}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 font-mono font-semibold">-</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Cachet & Validation Caisse */}
        <div className="relative z-10 flex items-center justify-between gap-3 pt-2">
          <div className="space-y-0.5 text-left">
            <div className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-300">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Encaissement Validé & Certifié</span>
            </div>
            <p className="text-[9px] text-slate-500 font-mono font-bold">
              Quittance N° {receiptNumber}
            </p>
          </div>

          {/* Cachet Officiel Numérique */}
          <div className="space-y-0.5 text-center">
            <span className="text-[9.5px] text-slate-600 font-black uppercase block">
              La Caisse & Le Comptable :
            </span>
            <div className="flex items-center justify-center h-10">
              {schoolState.stampUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={schoolState.stampUrl}
                  alt="Cachet Officiel"
                  className="object-contain opacity-85 rotate-[-5deg] max-h-10"
                />
              ) : (
                <div className="border-2 border-dashed border-emerald-500 rounded-lg px-3 py-1 bg-emerald-50 text-[10px] font-black text-emerald-900 uppercase tracking-wider">
                  [ CACHET CAISSE VALIDÉ ]
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mention de bas de page officielle */}
        <div className="relative z-10 pt-1 border-t border-slate-200 text-center">
          <p className="text-[9px] text-slate-500 font-bold italic">
            {schoolState.receiptFooterNote ||
              'Tout versement en caisse donne droit à un reçu numéroté immédiat. Aucun remboursement après encaissement.'}
          </p>
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
              Inscriptions & Reçu Automatique
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {schoolState.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Enregistrement en direct au registre de l&apos;établissement et génération du reçu officiel — {schoolState.name}
          </p>
        </div>

        {/* Actions rapides : Boutons compacts et harmonieux */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePrintReceipt}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-2xs cursor-pointer"
            title="Imprimer le reçu officiel sur une page A4"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Imprimer le Reçu</span>
          </button>

          <button
            type="button"
            onClick={() => handleCaptureAndShareWhatsApp()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-400 hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer"
            title={`Envoyer la photo HD du reçu officiel au parent sur WhatsApp (${whatsappPhone || 'numéro renseigné'})`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Envoyer par WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {successToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Alerte Détection Collaborateur en direct */}
      {collaboratorAlert && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-emerald-500/10 border-2 border-amber-500 rounded-2xl p-4 flex items-start justify-between gap-3 text-amber-950 animate-in slide-in-from-top-2 duration-200 shadow-md">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl font-bold shrink-0 mt-0.5 animate-pulse shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black font-heading text-sm sm:text-base text-amber-950">
                  ⚡ Nouveau reçu validé par un collaborateur en direct !
                </span>
                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md font-mono text-[10px] font-black border border-amber-300">
                  SYNCHRO TEMPS RÉEL
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                {collaboratorAlert.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollaboratorAlert(null)}
            className="text-amber-800 hover:text-amber-950 p-1.5 rounded-xl hover:bg-amber-500/20 transition-colors cursor-pointer shrink-0 font-bold"
            title="Fermer l'alerte"
          >
            ✕
          </button>
        </div>
      )}

      {/* ================= SECTION PRINCIPALE 2 COLONNES (FORMULAIRE & REÇU OFFICIEL) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= GAUCHE : FORMULAIRE DE SAISIE (6 COLS) ================= */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-7 space-y-5 print:hidden">
          {/* EN-TÊTE DE LA CARTE AVEC SÉLECTEUR ID INTERACTIF DIRECT & HISTORIQUE */}
          <div className="border-b border-slate-100 pb-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  {selectedStudentId ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-heading">
                    {selectedStudentId ? `Reçu Élève : ${currentIdStr}` : 'Coordonnées de l’Élève'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedStudentId
                      ? 'Consultation et mise à jour du reçu officiel'
                      : 'Remplissez les informations d’admission ci-dessous'}
                  </p>
                </div>
              </div>

              {/* BOUTONS NAVIGATION RAPIDE & POPUP DÉTAILLÉ */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => handleNavigateId('prev')}
                  className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
                  title="Voir le reçu précédent"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Précédent</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigateId('next')}
                  className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
                  title="Voir le reçu suivant"
                >
                  <span className="hidden sm:inline">Suivant</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Bouton pour ouvrir la recherche plein écran / liste complète */}
                <button
                  type="button"
                  onClick={() => setIsIdPickerOpen(!isIdPickerOpen)}
                  className={`px-3 py-1.5 rounded-xl font-mono font-extrabold text-xs transition-all border shadow-2xs inline-flex items-center gap-1.5 cursor-pointer ${
                    selectedStudentId
                      ? 'bg-blue-50 text-blue-900 border-blue-300 ring-2 ring-blue-500/20'
                      : 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-2 ring-emerald-500/20'
                  }`}
                  title="Rechercher parmi tous les reçus de ID-001 à ID actuel"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>{currentIdStr}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isIdPickerOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* SÉLECTEUR RAPIDE D'ID : MENU DÉROULANT DIRECTEMENT VISIBLE ET CLIQUABLE */}
            <div className="p-3 bg-gradient-to-r from-emerald-50/90 via-slate-50 to-blue-50/80 rounded-2xl border-2 border-emerald-300 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="direct-student-id-select" className="text-xs font-extrabold text-slate-900 font-heading flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Sélectionner un Reçu ou Créer une Nouvelle Inscription :</span>
                </label>
                <span className="text-[11px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                  {sortedStudentsById.length} Reçus enregistrés
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    id="direct-student-id-select"
                    value={selectedStudentId || 'new'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'new') {
                        handleStartNewReceipt();
                      } else {
                        const found = sortedStudentsById.find((s) => s.id === val || s.studentNumber === val);
                        if (found) handleSelectStudent(found);
                      }
                    }}
                    className="w-full appearance-none pl-3.5 pr-9 py-2.5 text-xs font-extrabold rounded-xl bg-white border-2 border-emerald-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs cursor-pointer"
                  >
                    <option value="new" className="font-extrabold text-emerald-700 bg-emerald-50 py-1">
                      ✨ + NOUVELLE INSCRIPTION (Créer le prochain Reçu ID-{nextSeq.toString().padStart(3, '0')})
                    </option>
                    <option disabled className="text-slate-300">
                      ────────── HISTORIQUE DE TOUS LES REÇUS (ID-001 À ID ACTUEL) ──────────
                    </option>
                    {sortedStudentsById.map((s) => (
                      <option key={s.id} value={s.id} className="py-1 text-slate-800 font-medium">
                        ID {(s.studentNumber || s.id || '').replace(/\D/g, '').padStart(3, '0')} : {(s.lastName || '').toUpperCase()} {s.firstName || ''} ({s.grade}) • {formatFCFA(s.tuitionAmount)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <button
                  type="button"
                  onClick={handleStartNewReceipt}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    !selectedStudentId
                      ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                      : 'bg-white border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50'
                  }`}
                  title="Créer un nouveau reçu avec le numéro d'ordre suivant"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Ajouter un nouveau</span>
                </button>
              </div>
            </div>

            {/* POPUP SÉLECTEUR D'ID DÉTAILLÉ (Recherche textuelle si l'utilisateur clique sur le badge) */}
            {isIdPickerOpen && (
              <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-xl p-3.5 space-y-3 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900 font-heading">
                      Historique de tous les reçus de ID-001 à ID-{nextSeq.toString().padStart(3, '0')} ({sortedStudentsById.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsIdPickerOpen(false)}
                    className="text-slate-400 hover:text-slate-700 text-xs font-bold p-1 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                {/* Bouton rapide : Créer un nouveau reçu */}
                <button
                  type="button"
                  onClick={handleStartNewReceipt}
                  className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+ Nouvelle Inscription (Nouveau Reçu)</span>
                  </div>
                  <span className="font-mono text-[11px] bg-emerald-200/80 px-1.5 py-0.5 rounded">
                    ID-{nextSeq.toString().padStart(3, '0')}
                  </span>
                </button>

                {/* Barre de recherche dans le sélecteur */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={idSearchQuery}
                    onChange={(e) => setIdSearchQuery(e.target.value)}
                    placeholder="Chercher par ID (ex: 001), nom d'élève, classe..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Filtre statut */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIdTypeFilter('all')}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                      idTypeFilter === 'all'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Tous ({sortedStudentsById.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdTypeFilter('nouveau')}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                      idTypeFilter === 'nouveau'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-emerald-700 border-emerald-200'
                    }`}
                  >
                    🌟 Nouveaux
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdTypeFilter('ancien')}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                      idTypeFilter === 'ancien'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-blue-700 border-blue-200'
                    }`}
                  >
                    🔄 Anciens
                  </button>
                </div>

                {/* Liste défilante des reçus */}
                <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-100 pr-1">
                  {filteredStudentsForPicker.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      Aucun reçu trouvé.
                    </div>
                  ) : (
                    filteredStudentsForPicker.map((stu) => {
                      const isCurrent = (selectedStudentId === stu.id) || (selectedStudentId === stu.studentNumber);
                      return (
                        <button
                          key={stu.id}
                          type="button"
                          onClick={() => handleSelectStudent(stu)}
                          className={`w-full p-2 rounded-xl text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                            isCurrent
                              ? 'bg-emerald-50 border border-emerald-300'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                              ID {(stu.studentNumber || stu.id || '').replace(/\D/g, '').padStart(3, '0')}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 block truncate max-w-[140px] sm:max-w-[190px]">
                                <span className="uppercase font-extrabold">{stu.lastName}</span> {stu.firstName}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {stu.grade} • {stu.enrollmentType === 'ancien' ? '🔄 Ancienne/Ancien' : '🌟 Nouvelle/Nouveau'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-emerald-800 block text-[11px]">
                              {formatFCFA(stu.tuitionAmount)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {formatDate(stu.enrollmentDate || stu.paymentDate || '—')}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Bandeau d'information si un élève existant est sélectionné */}
            {selectedStudentId && (
              <div className="mt-3 p-3 bg-amber-50/90 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-950 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Consultation du reçu de <strong className="font-extrabold uppercase">{(lastName || '').toUpperCase()} {firstName || ''}</strong> (ID {currentIdStr.replace(/\D/g, '').padStart(3, '0')}). Les coordonnées d&apos;identité sont verrouillées (modifiables uniquement dans <em>Vue d&apos;ensemble</em>). L&apos;enregistrement du reçu nécessite la saisie d&apos;un nouveau versement.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleStartNewReceipt}
                  className="text-amber-800 hover:text-amber-950 font-black underline text-xs shrink-0 cursor-pointer"
                >
                  + Nouveau Reçu Vierge
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Bloc Nom & Prénom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Nom de famille *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(selectedStudentId)}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ex: KONATE"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border font-semibold transition-all ${
                    selectedStudentId
                      ? 'bg-slate-100/90 border-slate-200 text-slate-500 cursor-not-allowed select-none uppercase'
                      : 'bg-slate-50 border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Prénom(s) *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(selectedStudentId)}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex: Lassina Mouhamed"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border font-semibold transition-all ${
                    selectedStudentId
                      ? 'bg-slate-100/90 border-slate-200 text-slate-500 cursor-not-allowed select-none'
                      : 'bg-slate-50 border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* Bloc Matricule Officiel de l'élève */}
            <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Matricule Officiel de l&apos;élève (Facultatif)</span>
                </label>
                <div className="flex items-center gap-2">
                  {currentMatricule ? (
                    <span className="text-[10px] text-slate-600 font-mono">
                      Matricule : <strong className="text-slate-900">{currentMatricule}</strong>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">
                      Délivré par le Ministère (laisser vide si non encore attribué)
                    </span>
                  )}
                </div>
              </div>
              <input
                type="text"
                disabled={Boolean(selectedStudentId)}
                value={customMatricule}
                onChange={(e) => setCustomMatricule(e.target.value.toUpperCase())}
                placeholder="Laisser vide si pas encore attribué (ex: 26014801A)..."
                className={`w-full px-3.5 py-2 text-xs rounded-xl border font-mono font-bold uppercase transition-all ${
                  selectedStudentId
                    ? 'bg-slate-100/90 border-slate-200 text-slate-500 cursor-not-allowed select-none'
                    : 'bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900'
                }`}
              />
            </div>

            {/* 2. Genre, Classe & Statut de l'élève (Nouveau ou Ancien) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Genre */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Genre *
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={Boolean(selectedStudentId)}
                    onClick={() => setGender('female')}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none ${
                      selectedStudentId ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                    } ${
                      gender === 'female'
                        ? 'bg-pink-50 text-pink-700 border-pink-300 ring-2 ring-pink-400/20 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="shrink-0 text-sm leading-none">♀</span>
                    <span className="whitespace-nowrap font-extrabold">Fille</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(selectedStudentId)}
                    onClick={() => setGender('male')}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none ${
                      selectedStudentId ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                    } ${
                      gender === 'male'
                        ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-400/20 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="shrink-0 text-sm leading-none">♂</span>
                    <span className="whitespace-nowrap font-extrabold">Garçon</span>
                  </button>
                </div>
              </div>

              {/* Classe */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Classe demandée *
                </label>
                <select
                  disabled={Boolean(selectedStudentId)}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border font-semibold transition-all ${
                    selectedStudentId
                      ? 'bg-slate-100/90 border-slate-200 text-slate-500 cursor-not-allowed select-none'
                      : 'bg-slate-50 border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer'
                  }`}
                >
                  {availableClasses
                    .filter((c) => c !== 'Toutes les classes')
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </div>

              {/* Statut de l'élève : Nouveau / Nouvelle ou Ancien / Ancienne */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Statut élève *</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={Boolean(selectedStudentId)}
                    onClick={() => setEnrollmentType('nouveau')}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none ${
                      selectedStudentId ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                    } ${
                      enrollmentType === 'nouveau'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={gender === 'female' ? 'Nouvelle inscription' : 'Nouvel élève'}
                  >
                    <span className="shrink-0 text-sm leading-none">🌟</span>
                    <span className="whitespace-nowrap font-extrabold">{gender === 'female' ? 'Nouvelle' : 'Nouveau'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(selectedStudentId)}
                    onClick={() => setEnrollmentType('ancien')}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none ${
                      selectedStudentId ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                    } ${
                      enrollmentType === 'ancien'
                        ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={gender === 'female' ? 'Réinscription ancienne élève' : 'Réinscription ancien élève'}
                  >
                    <span className="shrink-0 text-sm leading-none">🔄</span>
                    <span className="whitespace-nowrap font-extrabold">{gender === 'female' ? 'Ancienne' : 'Ancien'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Parent / Tuteur & Contact WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Nom du Parent / Tuteur *
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Ex: M. Konate Ibrahim"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Contact WhatsApp Parent *</span>
                  <span className="text-[10px] text-emerald-600 font-semibold">Pour envoi du reçu</span>
                </label>
                <input
                  type="tel"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="+225 07 00 00 00 00"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-semibold transition-all"
                />
              </div>
            </div>

            {/* Numéros de Contact Secondaires (Jusqu'à 3 numéros) */}
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Autres Numéros de Contact ({1 + secondaryPhones.length}/3) :
                </span>
                {secondaryPhones.length < 2 && (
                  <button
                    type="button"
                    onClick={() => setSecondaryPhones([...secondaryPhones, ''])}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer"
                  >
                    + Ajouter un numéro
                  </button>
                )}
              </div>

              {secondaryPhones.map((phone, pIdx) => (
                <div key={pIdx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => {
                      const copy = [...secondaryPhones];
                      copy[pIdx] = e.target.value;
                      setSecondaryPhones(copy);
                    }}
                    placeholder={`Numéro de contact ${pIdx + 2} (Ex : +225 05 01 22 33 44)`}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setSecondaryPhones(secondaryPhones.filter((_, i) => i !== pIdx))}
                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    title="Supprimer ce numéro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* 4. Adresse de résidence */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Adresse de Résidence / Quartier
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Cocody Angré 8ème Tranche, Rés. Bêttina"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
              />
            </div>

            {/* 5. Prestations Complémentaires : Internat, Cantine, Transport, Frais Annexes & Tenue */}
            <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Prestations Complémentaires & Services :</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Reçu & Modules Associés</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Internat / Pensionnat */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">Internat</span>
                    <span className="text-[10px] text-slate-400">(Hébergement)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsBoarding(true)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isBoarding
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🏢 Interne
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBoarding(false)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        !isBoarding
                          ? 'bg-slate-800 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🏠 Externe
                    </button>
                  </div>
                </div>

                {/* 2. Cantine Scolaire */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">Cantine</span>
                    <span className="text-[10px] text-slate-400">(Restauration)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCanteen(!isCanteen)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      isCanteen
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {isCanteen ? '🍲 Souscrit ✓' : '✕ Sans cantine'}
                  </button>
                </div>

                {/* 3. Transport Scolaire */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">Transport</span>
                    <span className="text-[10px] text-slate-400">(Ramassage)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTransport(!isTransport)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      isTransport
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {isTransport ? '🚌 Souscrit ✓' : '✕ Sans transport'}
                  </button>
                </div>

                {/* 4. Frais Annexes */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                  <span className="text-xs font-bold text-slate-800">
                    Frais Annexes
                  </span>
                  <button
                    type="button"
                    onClick={() => setFraisAnnexesPaid(!fraisAnnexesPaid)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      fraisAnnexesPaid
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {fraisAnnexesPaid ? '✓ Payé' : '✕ Non payé'}
                  </button>
                </div>

                {/* 5. Tenue Tout Cousue */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                  <span className="text-xs font-bold text-slate-800">
                    Tenue Tout Cousue
                  </span>
                  <button
                    type="button"
                    onClick={() => setTenueCousuePaid(!tenueCousuePaid)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      tenueCousuePaid
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {tenueCousuePaid ? '✓ Payé' : '✕ Non payé'}
                  </button>
                </div>
              </div>
            </div>

            {/* 6. Section Financière (Saisie Libre des montants) */}
            <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase font-heading tracking-wide">
                  Règlement de Scolarité & Encaissement
                </span>
              </div>

              {/* Ligne 1 : Frais d'inscription personnalisés par l'école + Scolarité Annuelle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Frais d&apos;inscription (FCFA)</span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {schoolState.defaultRegistrationFee ? `Tarif école : ${formatFCFA(schoolState.defaultRegistrationFee)}` : 'Tarif libre école'}
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={registrationFee === 0 ? '' : registrationFee}
                    onChange={(e) => setRegistrationFee(parseInt(e.target.value, 10) || 0)}
                    placeholder="Saisissez le montant"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold text-slate-900 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Scolarité Annuelle (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={tuitionAmount === 0 ? '' : tuitionAmount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setTuitionAmount(val);
                      const net = Math.max(0, val - discountAmount);
                      const totalPaid = versement1Amount + versement2Amount + versement3Amount + versement4Amount + versement5Amount;
                      setPaidAmount(totalPaid);
                      setRemainingAmount(Math.max(0, net - totalPaid));
                    }}
                    placeholder="Case à saisir (FCFA) - Saisir le montant..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold text-slate-900 transition-all"
                  />
                </div>
              </div>

              {/* Ligne 1.b : Réduction / Bourse */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Réduction / Bourse Scolaire (FCFA)</span>
                  <span className="text-[10px] text-amber-600 font-normal">Optionnel</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={discountAmount === 0 ? '' : discountAmount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setDiscountAmount(val);
                    const net = Math.max(0, tuitionAmount - val);
                    const totalPaid = versement1Amount + versement2Amount + versement3Amount + versement4Amount + versement5Amount;
                    setPaidAmount(totalPaid);
                    setRemainingAmount(Math.max(0, net - totalPaid));
                  }}
                  placeholder="0"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-semibold text-slate-700 transition-all"
                />
              </div>

              {/* Raccourcis réductions rapides */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  Raccourcis :
                </span>
                {[0, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleApplyQuickDiscount(amt)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      discountAmount === amt
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {amt === 0 ? 'Sans réduction' : `-${formatFCFA(amt)}`}
                  </button>
                ))}
              </div>

              {/* Ligne 2 : Reste à Payer Scolarité */}
              <div className="pt-1 border-t border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Reste à Payer Scolarité (FCFA) *
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setRemainingAmount(0)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        remainingAmount === 0
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      ✓ Soldé (0 F)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const net = Math.max(0, tuitionAmount - discountAmount);
                        const totalPaid = versement1Amount + versement2Amount + versement3Amount + versement4Amount + versement5Amount;
                        setRemainingAmount(Math.max(0, net - totalPaid));
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        remainingAmount > 0
                          ? 'bg-rose-600 text-white border-rose-700'
                          : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                      }`}
                    >
                      ⏳ Calculer reste
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={remainingAmount === 0 ? '' : remainingAmount}
                  onChange={(e) => setRemainingAmount(parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                  className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border focus:bg-white focus:outline-none focus:ring-2 transition-all font-mono font-extrabold ${
                    remainingAmount > 0
                      ? 'bg-rose-50/70 border-rose-300 text-rose-900 focus:ring-rose-400/20 focus:border-rose-500'
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-900 focus:ring-emerald-500/20 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Ligne 3 : Date du versement & Mode de règlement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/80 items-start">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Date d&apos;inscription & versement *</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {paymentDate ? formatDate(paymentDate) : 'JJ/MM/AAAA'}
                    </span>
                  </label>
                  <FrenchDateInput
                    value={paymentDate}
                    onChange={handlePaymentDateChange}
                    align="left"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Mode de Règlement *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('especes')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        paymentMethod === 'especes'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Coins className="w-3 h-3 text-emerald-600" />
                      <span className="truncate">Espèces</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('virement')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        paymentMethod === 'virement'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Landmark className="w-3 h-3 text-emerald-600" />
                      <span className="truncate">Virement</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('en_ligne')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        paymentMethod === 'en_ligne'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Smartphone className="w-3 h-3 text-emerald-600" />
                      <span className="truncate">En ligne</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sous-bloc : Opérateur en ligne (MTN, Moov, Orange, Wave) */}
              {paymentMethod === 'en_ligne' && (
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2 animate-in fade-in">
                  <span className="text-[11px] font-bold text-emerald-900 block">
                    Sélectionnez l&apos;opérateur de paiement en ligne :
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'orange', label: 'Orange Money', color: 'text-amber-600' },
                      { id: 'wave', label: 'Wave', color: 'text-blue-600' },
                      { id: 'mtn', label: 'MTN Money', color: 'text-yellow-600' },
                      { id: 'moov', label: 'Moov Money', color: 'text-blue-500' },
                    ].map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setOnlineOperator(op.id as 'mtn' | 'moov' | 'orange' | 'wave')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center ${
                          onlineOperator === op.id
                            ? 'bg-white text-slate-950 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <span className={op.color}>{op.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. ÉCHÉANCIER DES 5 VERSEMENTS & MODES DE RÈGLEMENT */}
              <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Échéancier des 5 Versements (Tranches & Modes de Règlement)</span>
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    { idx: 1 as const, label: '1er Versement', amount: versement1Amount, method: versement1Method, date: versement1Date },
                    { idx: 2 as const, label: '2ème Versement', amount: versement2Amount, method: versement2Method, date: versement2Date },
                    { idx: 3 as const, label: '3ème Versement', amount: versement3Amount, method: versement3Method, date: versement3Date },
                    { idx: 4 as const, label: '4ème Versement', amount: versement4Amount, method: versement4Method, date: versement4Date },
                    { idx: 5 as const, label: '5ème Versement', amount: versement5Amount, method: versement5Method, date: versement5Date },
                  ].map((v) => (
                    <div key={v.idx} className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-900 font-heading">
                          {v.label}
                        </span>
                        {v.amount > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {formatFCFA(v.amount)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Non renseigné (0 F)</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Montant */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                            Montant (FCFA)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={v.amount === 0 ? '' : v.amount}
                            onChange={(e) => handleUpdateVersement(v.idx, 'amount', e.target.value)}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Mode de règlement */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                            Mode de règlement
                          </label>
                          <select
                            value={v.method}
                            onChange={(e) => handleUpdateVersement(v.idx, 'method', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                          >
                            <option value="Espèces">Espèces</option>
                            <option value="Paiement en ligne (Wave)">Wave</option>
                            <option value="Orange Money">Orange Money</option>
                            <option value="MTN Money">MTN Money</option>
                            <option value="Moov Money">Moov Money</option>
                            <option value="Virement bancaire">Virement bancaire</option>
                          </select>
                        </div>

                        {/* Date */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                            Date
                          </label>
                          <FrenchDateInput
                            value={v.date}
                            onChange={(val) => handleUpdateVersement(v.idx, 'date', val)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bouton de Soumission Principal avec Contrôle Strict de Saisie */}
            <div className="pt-2 space-y-2.5">
              {/* Checklist dynamique des coordonnées obligatoires en mode Nouveau Reçu */}
              {!selectedStudentId && !formValidation.isAllComplete && (
                <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold text-amber-900 font-heading">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Coordonnées obligatoires à renseigner pour débloquer l&apos;enregistrement :</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                      { label: 'Nom', valid: formValidation.isNomValid },
                      { label: 'Prénom', valid: formValidation.isPrenomValid },
                      { label: 'Matricule', valid: formValidation.isMatriculeValid },
                      { label: 'Genre', valid: formValidation.isGenreValid },
                      { label: 'Classe', valid: formValidation.isClasseValid },
                      { label: 'Statut', valid: formValidation.isStatutValid },
                      { label: 'Parent / Tuteur', valid: formValidation.isParentValid },
                      { label: 'WhatsApp Parent', valid: formValidation.isWhatsappValid },
                      { label: 'Adresse', valid: formValidation.isAdresseValid },
                    ].map((item, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border transition-colors ${
                          item.valid
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {item.valid ? '✓' : '✗'} {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!isSubmitAllowed}
                className={`w-full py-3 px-6 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  !isSubmitAllowed
                    ? 'bg-slate-200 text-slate-500 border border-slate-300 shadow-none cursor-not-allowed select-none'
                    : 'text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 cursor-pointer transform hover:-translate-y-0.5'
                }`}
              >
                {!isSubmitAllowed ? (
                  selectedStudentId ? (
                    <>
                      <Lock className="w-4 h-4 text-slate-500" />
                      <span>Enregistrement bloqué (Saisissez un versement pour débloquer)</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-slate-500" />
                      <span>
                        Enregistrement bloqué ({formValidation.missingFields.length} coordonnée{formValidation.missingFields.length > 1 ? 's' : ''} obligatoire{formValidation.missingFields.length > 1 ? 's' : ''} manquante{formValidation.missingFields.length > 1 ? 's' : ''})
                      </span>
                    </>
                  )
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {selectedStudentId
                        ? 'Enregistrer le Nouveau Versement (Reçu mis à jour)'
                        : 'Enregistrer le Reçu'}
                    </span>
                  </>
                )}
              </button>

              {selectedStudentId && !hasNewVersement && (
                <p className="text-[11px] text-center text-slate-400 font-medium">
                  🔒 En mode consultation, l&apos;enregistrement est verrouillé. Ajoutez un versement pour valider le reçu.
                </p>
              )}
            </div>
          </form>
        </div>

        {/* ================= DROITE : LE REÇU OFFICIEL EN DIRECT (6 COLS SUR ÉCRAN) ================= */}
        <div className="lg:col-span-6 print:hidden">
          {renderReceiptSlip()}
        </div>
      </div>

      {/* ================= SECTION D'IMPRESSION OFFICIELLE (1 SEUL REÇU PAR PAGE A4) ================= */}
      <div id="official-receipt-print" className="hidden print:block print:w-full printable-receipt-area">
        {renderReceiptSlip('EXEMPLAIRE OFFICIEL')}
      </div>

      {/* ================= MODAL DE CONFIRMATION AVANT ENREGISTREMENT ================= */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 print:hidden">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-heading">
                    {selectedStudentId ? 'Mettre à jour le Reçu Élève' : 'Confirmer l’Inscription & Encaisser'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Vérifiez l&apos;exactitude des données avant validation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Récapitulatif clair */}
            <div className="space-y-2.5 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">ID Comptable :</span>
                <span className="font-mono font-extrabold text-emerald-800">
                  {currentIdStr}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Matricule Officiel :</span>
                <span className="font-mono font-extrabold text-slate-900">
                  {currentMatricule ? currentMatricule : '— Non renseigné —'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Nom & Prénom de l&apos;élève :</span>
                <span className="font-extrabold text-slate-950 font-heading">
                  <span className="uppercase">{lastName}</span> {firstName} ({gender === 'female' ? '♀ Fille' : '♂ Garçon'})
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Statut de l&apos;élève :</span>
                <span className={`font-extrabold px-2 py-0.5 rounded border text-[11px] ${
                  enrollmentType === 'nouveau'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-blue-100 text-blue-900 border-blue-300'
                }`}>
                  {enrollmentType === 'nouveau'
                    ? (gender === 'female' ? '🌟 Nouvelle' : '🌟 Nouveau')
                    : (gender === 'female' ? '🔄 Ancienne' : '🔄 Ancien')}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Classe d&apos;inscription :</span>
                <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {grade}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Parent / Tuteur :</span>
                <span className="font-semibold text-slate-800">
                  {guardianName || 'Non spécifié'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Contact WhatsApp :</span>
                <span className="font-mono font-bold text-emerald-800">
                  {whatsappPhone}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Prestations & Services :</span>
                <span className="font-semibold text-slate-800 text-right">
                  Internat : {isBoarding ? 'Oui (Interne)' : 'Non (Externe)'} • Cantine : {isCanteen ? 'Oui ✓' : 'Non ✕'} • Transport : {isTransport ? 'Oui ✓' : 'Non ✕'} • Frais Annexes ({fraisAnnexesPaid ? 'Payé ✓' : 'Non payé ✕'}) • Tenue ({tenueCousuePaid ? 'Payé ✓' : 'Non payé ✕'})
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Mode de règlement :</span>
                <span className="font-bold text-slate-800">
                  {getPaymentMethodLabel()}
                </span>
              </div>

              {/* Lignes Financières Détaillées */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Frais d&apos;inscription :</span>
                <span className="font-mono font-bold text-slate-900">{formatFCFA(registrationFee)}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Scolarité annuelle ({grade}) :</span>
                <span className="font-mono font-bold text-slate-900">{formatFCFA(tuitionAmount)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 text-amber-800">
                  <span>Réduction accordée :</span>
                  <span className="font-mono font-bold">-{formatFCFA(discountAmount)}</span>
                </div>
              )}

              {paidAmount > 0 && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 text-emerald-800">
                  <span>Total versements reçus :</span>
                  <span className="font-mono font-bold">{formatFCFA(paidAmount)}</span>
                </div>
              )}

              {remainingAmount > 0 ? (
                <div className="flex items-center justify-between text-xs text-rose-700 font-bold pt-1 border-t border-slate-200/70">
                  <span>Reste à payer (Solde scolarité) :</span>
                  <span className="font-mono">{formatFCFA(remainingAmount)}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-emerald-700 font-bold pt-1 border-t border-slate-200/70">
                  <span>Solde Scolarité :</span>
                  <span className="font-mono">0 FCFA (Soldé)</span>
                </div>
              )}
            </div>

            {/* Actions Modal */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-all text-center cursor-pointer"
              >
                Annuler / Modifier
              </button>

              <button
                type="button"
                onClick={handleConfirmAndSave}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all text-center cursor-pointer"
              >
                {selectedStudentId ? 'Enregistrer Modifications' : 'Confirmer & Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DE SUCCÈS APRÈS VALIDATION ================= */}
      {successModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 print:hidden">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-4 animate-in zoom-in-95 duration-200 text-center relative">
            {/* Bouton Croix pour fermer la modale et passer automatiquement au reçu suivant */}
            <button
              type="button"
              onClick={handleCloseSuccessAndNext}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Fermer et préparer l'élève suivant"
            >
              <X className="w-5 h-5" />
            </button>

            {/* En-tête avec Icône de Succès & Titre */}
            <div className="space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 font-heading">
                  Reçu d&apos;Inscription Enregistré !
                </h3>
                <span className="text-[11px] text-emerald-800 font-bold mt-1 bg-emerald-50 py-1 px-3 rounded-full inline-block border border-emerald-200">
                  ✓ Synchronisé dans la Scolarité et le Tableau de bord
                </span>
              </div>
            </div>

            {/* Récapitulatif structuré de l'élève sous forme de carte claire */}
            <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-3.5 text-left text-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Élève & Identifiant :</span>
                <span className="font-extrabold text-slate-900 font-heading">
                  {successModalData.fullName} <span className="font-mono font-bold text-emerald-700">({successModalData.studentNumber})</span>
                </span>
              </div>
              {successModalData.matricule ? (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                  <span className="text-slate-500 font-medium">Matricule Officiel :</span>
                  <span className="font-mono font-bold text-slate-800">{successModalData.matricule}</span>
                </div>
              ) : null}

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Classe & Statut :</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {successModalData.grade}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10.5px] border ${
                    successModalData.enrollmentType === 'ancien'
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    {successModalData.enrollmentType === 'ancien'
                      ? (successModalData.gender === 'female' ? '🔄 Ancienne' : '🔄 Ancien')
                      : (successModalData.gender === 'female' ? '🌟 Nouvelle' : '🌟 Nouveau')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-200/70">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Montant Versé :</span>
                  <span className="font-mono font-black text-emerald-800 text-xs sm:text-sm">
                    {formatFCFA(successModalData.paidAmount)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Reste à Payer :</span>
                  <span className={`font-mono font-black text-xs sm:text-sm ${
                    (successModalData.balanceRemaining || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
                  }`}>
                    {(successModalData.balanceRemaining || 0) > 0
                      ? formatFCFA(successModalData.balanceRemaining || 0)
                      : '0 FCFA (Soldé)'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 pt-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Contact Principal (WhatsApp) :</span>
                  <span className="font-mono font-extrabold text-slate-900">
                    {successModalData.whatsappPhone || successModalData.guardianPhone || 'Non spécifié'}
                  </span>
                </div>
                {successModalData.secondaryPhones && successModalData.secondaryPhones.length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Autres Numéros :</span>
                    <span className="font-mono font-bold text-slate-700">
                      {successModalData.secondaryPhones.join(' • ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Boutons d'actions principaux spacieux et ergonomiques */}
            <div className="space-y-2 pt-1">
              {/* Bouton WhatsApp Principal Direct */}
              <div className="space-y-1">
                <a
                  href={`https://wa.me/${formatCleanWhatsApp(successModalData.whatsappPhone || successModalData.guardianPhone)}?text=${encodeURIComponent(
                    `${(schoolState.schoolType === 'laique') ? 'Salut' : (schoolState.schoolType === 'non_confessionnelle') ? 'Bonjour' : 'Salam anlaekoum'}, voici le reçu officiel de paiement (${successModalData.studentNumber}) pour ${successModalData.fullName} — ${schoolState.name}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    handleCaptureAndShareWhatsApp(
                      successModalData.whatsappPhone || successModalData.guardianPhone,
                      successModalData.fullName,
                      false,
                      successModalData
                    );
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer transform hover:-translate-y-0.5"
                >
                  <Smartphone className="w-5 h-5 text-white shrink-0" />
                  <span>
                    📱 Ouvrir WhatsApp Parent ({successModalData.whatsappPhone || successModalData.guardianPhone || 'Numéro parent'})
                  </span>
                </a>
                <p className="text-[11px] text-emerald-800 font-bold text-center">
                  💡 Le reçu officiel HD est déjà copié : faites simplement <strong>Ctrl + V</strong> (ou Coller) dans WhatsApp pour envoyer la photo !
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Bouton Imprimer le Reçu */}
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer border border-slate-200"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Imprimer le reçu</span>
                </button>

                {/* Bouton Élève Suivant */}
                <button
                  type="button"
                  onClick={handleCloseSuccessAndNext}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                  <span>Élève suivant (+ Reçu)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    Photo HD du Reçu Officiel
                  </h3>
                  <p className="text-xs text-slate-500">
                    Destinataire : <strong className="text-slate-900 font-mono whitespace-nowrap">{whatsAppPreviewData.phone}</strong> ({whatsAppPreviewData.name})
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
                alt="Photo officielle du reçu"
                className="w-full object-contain rounded-xl shadow-xs"
              />
            </div>

            {/* Instruction claire */}
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-900">
                  Image du reçu déjà copiée dans votre presse-papier !
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-tight">
                  Cliquez sur <strong>« Ouvrir le WhatsApp du parent »</strong> puis faites <strong>Ctrl + V</strong> (ou Coller) dans la discussion pour envoyer la photo officielle.
                </p>
              </div>
            </div>

            {/* Actions principales */}
            <div className="space-y-2 pt-1">
              <a
                href={`https://wa.me/${whatsAppPreviewData.cleanPhone}`}
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
                  onClick={() => handleCopyReceiptImageToClipboard(whatsAppPreviewData.blob)}
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
