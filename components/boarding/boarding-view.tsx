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
} from 'lucide-react';

interface BoardingViewProps {
  school: School;
  schoolSlug: string;
}

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

  // Modale d'Aperçu & Partage Image HD (WhatsApp)
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
      studentName?: string;
      matricule?: string;
      className?: string;
      gender?: 'M' | 'F';
      parentContact?: string;
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

  // Construction de la liste des pensionnaires inscrits
  const boarders = useMemo(() => {
    const customMap = new Map(customSubscriptions.map((cs) => [cs.studentId, cs]));

    // 1. Les pensionnaires issus des customSubscriptions
    const customList = customSubscriptions.map((cs) => {
      const foundStudent = students.find((s) => s.id === cs.studentId || s.studentNumber === cs.matricule);
      const studentObj: Student = foundStudent || {
        id: cs.studentId,
        studentNumber: cs.matricule || `MAT-INT-${cs.studentId.slice(-4)}`,
        firstName: cs.studentName?.split(' ')[0] || 'Élève',
        lastName: cs.studentName?.split(' ').slice(1).join(' ') || 'Pensionnaire',
        gender: cs.gender || 'M',
        className: cs.className || '6ème',
        birthDate: '2012-05-10',
        enrollmentDate: '2026-09-01',
        guardianName: 'Parent / Tuteur',
        guardianContact: cs.parentContact || '+225 07 00 00 00 00',
        status: 'active',
        schoolSlug: schoolSlug,
        tuitionFee: 0,
        paidAmount: 0,
      };

      const studentMonths = monthlyPayments[cs.studentId] || {};
      const paidMonthsCount = MONTHS_LIST.filter((m) => studentMonths[m]).length;
      const totalPaid = paidMonthsCount * cs.monthlyRate;
      const totalDue = cs.monthlyRate * 9; // 9 mois stricts
      const remainingBalance = Math.max(0, totalDue - totalPaid);

      return {
        student: studentObj,
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
    });

    // 2. Pensionnaires démo initiaux
    const demoList = students
      .filter((s) => !customMap.has(s.id))
      .filter((_, idx) => idx % 4 === 0)
      .map((student, idx) => {
        const pavilion = student.gender === 'F' ? 'Pavillon B (Filles)' : 'Pavillon A (Garçons)';
        const roomNumber = `Chambre ${101 + (idx % 20)}`;
        const monthlyRate = 50000;

        const studentMonths = monthlyPayments[student.id] || {};
        const paidMonthsCount = MONTHS_LIST.filter((m) => studentMonths[m]).length;
        const totalPaid = paidMonthsCount * monthlyRate;
        const totalDue = monthlyRate * 9;
        const remainingBalance = Math.max(0, totalDue - totalPaid);

        return {
          student,
          isBoarder: true,
          pavilion,
          roomNumber,
          monthlyRate,
          paidMonthsCount,
          totalPaid,
          totalDue,
          remainingBalance,
          isUpToDate: remainingBalance === 0,
        };
      });

    return [...customList, ...demoList];
  }, [students, customSubscriptions, monthlyPayments, schoolSlug]);

  // Filtrage pour la recherche et la navigation
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
  const [formPaymentDate, setFormPaymentDate] = useState('03/09/2026');
  const [formPaymentMethod, setFormPaymentMethod] = useState('Espèces');
  const [activeMonthsChecked, setActiveMonthsChecked] = useState<Record<string, boolean>>({});

  // Synchronisation du formulaire avec le pensionnaire actif quand on n'est pas en création
  useEffect(() => {
    if (!isCreatingNew && activeBoarder) {
      setFormStudentName(`${activeBoarder.student.firstName} ${activeBoarder.student.lastName}`.trim());
      setFormMatricule(activeBoarder.student.studentNumber);
      setFormClassName(activeBoarder.student.className || '6ème');
      setFormGender(activeBoarder.student.gender || 'M');
      setFormPavilion(activeBoarder.pavilion);
      setFormRoom(activeBoarder.roomNumber);
      setFormParentContact(activeBoarder.student.guardianContact || '+225 07 00 00 00 00');
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
    setFormPaymentDate('03/09/2026');
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

  // Enregistrement & validation (Création ou Mise à jour)
  const handleSaveReceipt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formStudentName.trim()) {
      alert('Veuillez saisir le nom et prénom de l’élève.');
      return;
    }

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
    };

    if (existingIndex >= 0) {
      updatedSubs[existingIndex] = subRecord;
    } else {
      updatedSubs.unshift(subRecord);
    }
    saveSubscriptionsToStorage(updatedSubs);

    // 3. Si création d'un nouvel élève, l'ajouter aussi au registre global des élèves
    if (isCreatingNew) {
      try {
        const raw = localStorage.getItem(STUDENTS_STORAGE_KEY);
        const currentList: Student[] = raw ? JSON.parse(raw) : [];
        const nameParts = formStudentName.trim().split(' ');
        const newStudentObj: Student = {
          id: targetStudentId,
          studentNumber: formMatricule.trim(),
          firstName: nameParts[0] || 'Élève',
          lastName: nameParts.slice(1).join(' ') || 'Pensionnaire',
          gender: formGender,
          className: formClassName,
          birthDate: '2012-05-10',
          enrollmentDate: '2026-09-01',
          guardianName: 'Parent / Tuteur',
          guardianContact: formParentContact.trim(),
          status: 'active',
          schoolSlug: schoolSlug,
          tuitionFee: rate * 9,
          paidAmount: activeTotalCollected,
        };
        const updatedStudentList = [newStudentObj, ...currentList.filter((s) => s.id !== targetStudentId)];
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updatedStudentList));
      } catch (err) {}
    }

    setIsCreatingNew(false);
    setActiveBoarderIndex(0);
    setToastMessage(`✓ Quittance d'internat enregistrée avec succès (${activePaidMonthsCount}/9 mois réglés pour ${formStudentName}).`);
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

  // 5. Action directe : Ouvrir la discussion WhatsApp
  const handleDirectWhatsAppChat = () => {
    const cleanPhone = (formParentContact || '').replace(/[^0-9]/g, '');
    const captionText = `Quittance officielle de pensionnat — ${formStudentName} (${currentSchool.shortName || currentSchool.name})`;
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(captionText)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(captionText)}`;
    window.open(waUrl, '_blank');
  };

  // Statistiques Globales KPI (Sur 9 Mois : Septembre à Mai - 100 Places Max)
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
                  L&apos;image est déjà <strong>copiée dans votre presse-papier</strong> ! Vous pouvez la coller directement (Ctrl+V) dans votre discussion.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleDirectWhatsAppChat}
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

        {/* KPI 3: Capacité & Occupation (Fixée à 100 Places) */}
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
              {totalBoarders} / 100
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
              Places
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Disponibles :</span>
            <span className="font-bold text-slate-900">{Math.max(0, 100 - totalBoarders)} lits</span>
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
                  {idx + 1}. {b.student.firstName} {b.student.lastName} ({b.student.className} • {b.roomNumber})
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

          <form onSubmit={handleSaveReceipt} className="space-y-4">
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
                  <option value="Pavillon Junior">Pavillon Junior (Maternelle/Primaire)</option>
                  <option value="Pavillon Honneur">Pavillon Honneur (Collège 3ème)</option>
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
            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isCreatingNew ? 'Valider la Nouvelle Souscription' : 'Enregistrer & Actualiser la Quittance'}
                </span>
              </button>
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

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Bouton Impression A4 Isolé */}
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer shadow-2xs"
                title="Imprimer uniquement ce reçu sur feuille A4"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Imprimer A4</span>
              </button>

              {/* Bouton Télécharger Image PNG */}
              <button
                type="button"
                onClick={handleDownloadReceiptImage}
                disabled={isGeneratingImage}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                title="Télécharger la quittance au format Image PNG"
              >
                {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-slate-600" />}
                <span>Image PNG</span>
              </button>

              {/* Bouton Partager WhatsApp avec Modale d'Aperçu */}
              <button
                type="button"
                onClick={handleOpenShareModal}
                disabled={isGeneratingImage}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                title="Afficher l'image HD du reçu et partager sur WhatsApp"
              >
                {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Share2 className="w-3.5 h-3.5 text-white" />}
                <span>WhatsApp</span>
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
                    <th className="py-2 px-3.5">Désignation</th>
                    <th className="py-2 px-3.5 text-center">Mois Réglés (sur 9)</th>
                    <th className="py-2 px-3.5 text-right">Montant Encaissé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  <tr>
                    <td className="py-2.5 px-3.5">
                      <div className="font-extrabold text-slate-950">Pension d&apos;Internat Annuelle</div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        Tarif : {formatFCFA(formMonthlyRate)} / mois • Mode : {formPaymentMethod}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-extrabold border border-emerald-300 text-xs">
                        {activePaidMonthsCount} / 9 mois
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-black text-slate-950 font-heading text-sm sm:text-base">
                      {formatFCFA(activeTotalCollected)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-300 text-xs sm:text-sm">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3.5 text-slate-700 font-extrabold">
                      Reste Annuel à Solder (sur les 9 mois) :
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-rose-600 font-black font-heading text-sm sm:text-base">
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
    </div>
  );
}
