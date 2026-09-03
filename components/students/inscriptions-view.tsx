'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import Link from 'next/link';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import {
  getLiveStudents,
  getLiveSchool,
  saveRegisteredStudent,
  DATA_UPDATED_EVENT,
} from '@/lib/data/live-store';

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
  const [schoolState, setSchoolState] = useState<School>(school);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<Student | null>(null);

  // État de sélection d'un élève existant (null = mode nouvelle inscription)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isIdPickerOpen, setIsIdPickerOpen] = useState(false);
  const [idSearchQuery, setIdSearchQuery] = useState('');
  const [idTypeFilter, setIdTypeFilter] = useState<'all' | 'nouveau' | 'ancien'>('all');

  // Synchronisation dynamique avec le live-store (Élèves & Paramètres École)
  useEffect(() => {
    setStudents(getLiveStudents(initialStudents));
    setSchoolState(getLiveSchool(schoolSlug, school));

    const handleUpdate = () => {
      setStudents(getLiveStudents(initialStudents));
      setSchoolState(getLiveSchool(schoolSlug, school));
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
  const [secondaryPhones, setSecondaryPhones] = useState<string[]>([]);
  const [showSecondaryPhonesOnReceipt, setShowSecondaryPhonesOnReceipt] = useState<boolean>(false);

  // Modal de prévisualisation et partage de la photo HD du reçu WhatsApp
  const [whatsAppPreviewData, setWhatsAppPreviewData] = useState<{
    imageUrl: string;
    blob: Blob;
    fileName: string;
    phone: string;
    cleanPhone: string;
    name: string;
  } | null>(null);

  // Prestations Complémentaires : Frais Annexes & Tenue Tout Cousue (Payé ✓ / Non payé ✕)
  const [fraisAnnexesPaid, setFraisAnnexesPaid] = useState<boolean>(false);
  const [tenueCousuePaid, setTenueCousuePaid] = useState<boolean>(false);

  // Saisie Libre Financière (Toutes les cases vides à 0 F par défaut — Aucune somme prédéterminée)
  const [tuitionAmount, setTuitionAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [remainingAmount, setRemainingAmount] = useState<number>(0);

  // 5 Versements fractionnés (Cases vides à 0 F par défaut)
  const [versement1Amount, setVersement1Amount] = useState<number>(0);
  const [versement1Method, setVersement1Method] = useState<string>('Espèces');
  const [versement1Date, setVersement1Date] = useState<string>('2026-08-29');

  const [versement2Amount, setVersement2Amount] = useState<number>(0);
  const [versement2Method, setVersement2Method] = useState<string>('Paiement en ligne (Wave)');
  const [versement2Date, setVersement2Date] = useState<string>('2026-08-29');

  const [versement3Amount, setVersement3Amount] = useState<number>(0);
  const [versement3Method, setVersement3Method] = useState<string>('Virement bancaire');
  const [versement3Date, setVersement3Date] = useState<string>('2026-08-29');

  const [versement4Amount, setVersement4Amount] = useState<number>(0);
  const [versement4Method, setVersement4Method] = useState<string>('Espèces');
  const [versement4Date, setVersement4Date] = useState<string>('2026-08-29');

  const [versement5Amount, setVersement5Amount] = useState<number>(0);
  const [versement5Method, setVersement5Method] = useState<string>('Orange Money');
  const [versement5Date, setVersement5Date] = useState<string>('2026-08-29');

  const [paymentDate, setPaymentDate] = useState('2026-08-29');
  const [paymentMethod, setPaymentMethod] = useState<'especes' | 'virement' | 'en_ligne'>('especes');
  const [onlineOperator, setOnlineOperator] = useState<'mtn' | 'moov' | 'orange' | 'wave'>('orange');

  // Mise à jour 100% manuelle et libre de chaque versement (sans calcul imposé)
  const handleUpdateVersement = (
    index: 1 | 2 | 3 | 4 | 5,
    field: 'amount' | 'method' | 'date',
    value: string | number
  ) => {
    if (index === 1) {
      if (field === 'amount') setVersement1Amount(parseInt(value as string, 10) || 0);
      if (field === 'method') setVersement1Method(value as string);
      if (field === 'date') setVersement1Date(value as string);
    } else if (index === 2) {
      if (field === 'amount') setVersement2Amount(parseInt(value as string, 10) || 0);
      if (field === 'method') setVersement2Method(value as string);
      if (field === 'date') setVersement2Date(value as string);
    } else if (index === 3) {
      if (field === 'amount') setVersement3Amount(parseInt(value as string, 10) || 0);
      if (field === 'method') setVersement3Method(value as string);
      if (field === 'date') setVersement3Date(value as string);
    } else if (index === 4) {
      if (field === 'amount') setVersement4Amount(parseInt(value as string, 10) || 0);
      if (field === 'method') setVersement4Method(value as string);
      if (field === 'date') setVersement4Date(value as string);
    } else if (index === 5) {
      if (field === 'amount') setVersement5Amount(parseInt(value as string, 10) || 0);
      if (field === 'method') setVersement5Method(value as string);
      if (field === 'date') setVersement5Date(value as string);
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

  // Liste triée des élèves par numéro ID croissant (pour affichage de ID-001 à ID-actuel)
  const sortedStudentsById = useMemo(() => {
    return [...students].sort((a, b) => {
      const numA = parseInt(a.studentNumber.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.studentNumber.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }, [students]);

  // Compute next available Student ID sequence number
  const nextSeq = useMemo(() => {
    if (students.length === 0) return 51;
    const nums = students
      .map((s) => {
        const match = s.studentNumber?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const maxNum = Math.max(50, ...nums);
    return maxNum + 1;
  }, [students]);

  // Trouver l'élève actuellement sélectionné s'il existe
  const currentSelectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return students.find((s) => s.id === selectedStudentId || s.studentNumber === selectedStudentId) || null;
  }, [selectedStudentId, students]);

  // ID & Matricule affichés
  const currentIdStr = useMemo(() => {
    if (currentSelectedStudent) {
      return currentSelectedStudent.studentNumber;
    }
    return `ID-${nextSeq.toString().padStart(3, '0')}`;
  }, [currentSelectedStudent, nextSeq]);

  const currentMatricule = useMemo(() => {
    if (currentSelectedStudent) {
      return currentSelectedStudent.matricule;
    }
    const alphabet = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    const letterCode = alphabet[(nextSeq - 1) % alphabet.length];
    return `${26014800 + nextSeq}${letterCode}`;
  }, [currentSelectedStudent, nextSeq]);

  const receiptNumber = useMemo(() => {
    const seqNum = currentSelectedStudent
      ? parseInt(currentSelectedStudent.studentNumber.replace(/\D/g, ''), 10) || nextSeq
      : nextSeq;
    return `REC-2026-${seqNum.toString().padStart(3, '0')}`;
  }, [currentSelectedStudent, nextSeq]);

  const netAmount = Math.max(0, tuitionAmount - discountAmount);

  // Charger les coordonnées et les frais d'un élève sélectionné
  const handleSelectStudent = (stu: Student) => {
    setSelectedStudentId(stu.id);
    setLastName(stu.lastName);
    setFirstName(stu.firstName);
    setGender(stu.gender);
    setGrade(stu.grade);
    setEnrollmentType(stu.enrollmentType || 'nouveau');
    setAddress(stu.address || `${schoolState.city}`);
    setGuardianName(stu.guardianName || '');
    setWhatsappPhone(stu.whatsappPhone || stu.guardianPhone || '');
    setTuitionAmount(stu.tuitionAmount || 250000);
    setDiscountAmount(stu.discountAmount || 0);
    setPaidAmount(stu.paidAmount || 0);
    const rem = typeof stu.balanceRemaining === 'number'
      ? stu.balanceRemaining
      : Math.max(0, (stu.netAmount || stu.tuitionAmount) - (stu.paidAmount || 0));
    setRemainingAmount(rem);
    setPaymentDate(stu.paymentDate || '2026-08-27');

    // Charger les 5 versements de l'élève
    const inst = stu.installments;
    const p = stu.paidAmount || 0;
    const v1 = inst?.versement1 || (p > 0 ? { amount: Math.min(p, 100000), paymentMethod: stu.paymentMethod || 'Espèces', date: stu.paymentDate || '2026-08-27' } : { amount: 0, paymentMethod: 'Espèces', date: '2026-08-27' });
    const v2 = inst?.versement2 || (p > 100000 ? { amount: Math.min(p - 100000, 50000), paymentMethod: 'Paiement en ligne (Wave)', date: stu.paymentDate || '2026-08-27' } : { amount: 0, paymentMethod: 'Paiement en ligne (Wave)', date: '2026-08-27' });
    const v3 = inst?.versement3 || (p > 150000 ? { amount: Math.min(p - 150000, 50000), paymentMethod: 'Virement bancaire', date: stu.paymentDate || '2026-08-27' } : { amount: 0, paymentMethod: 'Virement bancaire', date: '2026-08-27' });
    const v4 = inst?.versement4 || (p > 200000 ? { amount: Math.min(p - 200000, 50000), paymentMethod: 'Espèces', date: stu.paymentDate || '2026-08-27' } : { amount: 0, paymentMethod: 'Espèces', date: '2026-08-27' });
    const v5 = inst?.versement5 || (p > 250000 ? { amount: p - 250000, paymentMethod: 'Orange Money', date: stu.paymentDate || '2026-08-27' } : { amount: 0, paymentMethod: 'Orange Money', date: '2026-08-27' });

    setVersement1Amount(v1.amount);
    setVersement1Method(v1.paymentMethod || 'Espèces');
    setVersement1Date(v1.date || '2026-08-27');

    setVersement2Amount(v2.amount);
    setVersement2Method(v2.paymentMethod || 'Paiement en ligne (Wave)');
    setVersement2Date(v2.date || '2026-08-27');

    setVersement3Amount(v3.amount);
    setVersement3Method(v3.paymentMethod || 'Virement bancaire');
    setVersement3Date(v3.date || '2026-08-27');

    setVersement4Amount(v4.amount);
    setVersement4Method(v4.paymentMethod || 'Espèces');
    setVersement4Date(v4.date || '2026-08-27');

    setVersement5Amount(v5.amount);
    setVersement5Method(v5.paymentMethod || 'Orange Money');
    setVersement5Date(v5.date || '2026-08-27');

    if (stu.notes) {
      setFraisAnnexesPaid(stu.notes.includes('Frais Annexes (Payé'));
      setTenueCousuePaid(stu.notes.includes('Tenue tout cousue (Payé'));
    }
    setIsIdPickerOpen(false);
  };

  // Réinitialiser le formulaire pour créer un Nouveau Reçu (mode nouvelle inscription)
  const handleStartNewReceipt = () => {
    setSelectedStudentId(null);
    setLastName('');
    setFirstName('');
    setGender('female');
    setGrade('6ème');
    setEnrollmentType('nouveau');
    setAddress('');
    setGuardianName('');
    setWhatsappPhone('');
    setTuitionAmount(0);
    setDiscountAmount(0);
    setPaidAmount(0);
    setRemainingAmount(0);
    setVersement1Amount(0);
    setVersement1Method('Espèces');
    setVersement1Date('2026-08-29');
    setVersement2Amount(0);
    setVersement2Method('Paiement en ligne (Wave)');
    setVersement2Date('2026-08-29');
    setVersement3Amount(0);
    setVersement3Method('Virement bancaire');
    setVersement3Date('2026-08-29');
    setVersement4Amount(0);
    setVersement4Method('Espèces');
    setVersement4Date('2026-08-29');
    setVersement5Amount(0);
    setVersement5Method('Orange Money');
    setVersement5Date('2026-08-29');
    setPaymentDate('2026-08-29');
    setPaymentMethod('especes');
    setFraisAnnexesPaid(false);
    setTenueCousuePaid(false);
    setIsIdPickerOpen(false);
  };

  // Navigation vers l'ID précédent ou suivant
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

    if (currentIndex === -1) return;

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
  };

  // Form submit handler -> Open Confirmation Modal
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastName.trim() || !firstName.trim()) {
      alert('Veuillez renseigner le nom et le prénom de l’élève.');
      return;
    }
    setShowConfirmModal(true);
  };

  // Confirm and save student + invoice in persistent live store
  const handleConfirmAndSave = () => {
    const studentIdToSave = currentSelectedStudent
      ? currentSelectedStudent.id
      : `stu-${nextSeq.toString().padStart(3, '0')}`;

    const studentNumberToSave = currentSelectedStudent
      ? currentSelectedStudent.studentNumber
      : currentIdStr;

    const matriculeToSave = currentSelectedStudent
      ? currentSelectedStudent.matricule
      : currentMatricule;

    const installments: StudentInstallments = {
      versement1: versement1Amount > 0 ? { amount: versement1Amount, paymentMethod: versement1Method, date: versement1Date } : undefined,
      versement2: versement2Amount > 0 ? { amount: versement2Amount, paymentMethod: versement2Method, date: versement2Date } : undefined,
      versement3: versement3Amount > 0 ? { amount: versement3Amount, paymentMethod: versement3Method, date: versement3Date } : undefined,
      versement4: versement4Amount > 0 ? { amount: versement4Amount, paymentMethod: versement4Method, date: versement4Date } : undefined,
      versement5: versement5Amount > 0 ? { amount: versement5Amount, paymentMethod: versement5Method, date: versement5Date } : undefined,
    };

    const newStudent: Student = {
      id: studentIdToSave,
      studentNumber: studentNumberToSave,
      matricule: matriculeToSave,
      firstName: firstName.trim(),
      lastName: lastName.trim().toUpperCase(),
      fullName: `${firstName.trim()} ${lastName.trim().toUpperCase()}`,
      grade,
      gender,
      avatar: currentSelectedStudent?.avatar || '',
      dateOfBirth: currentSelectedStudent?.dateOfBirth || '2015-05-12',
      guardianName: guardianName.trim() || 'Parent',
      guardianPhone: whatsappPhone.trim(),
      whatsappPhone: whatsappPhone.trim(),
      address: address.trim() || `${schoolState.city}`,
      enrollmentDate: paymentDate,
      attendanceRate: currentSelectedStudent?.attendanceRate || 95,
      status: 'active',
      enrollmentType: enrollmentType,
      tuitionAmount: tuitionAmount,
      discountAmount: discountAmount,
      netAmount: netAmount,
      paidAmount: paidAmount,
      balanceRemaining: remainingAmount,
      tuitionStatus: remainingAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
      paymentDate: paymentDate,
      paymentMethod: getPaymentMethodLabel(),
      installments: installments,
      isBoarding: currentSelectedStudent?.isBoarding || false,
      notes: `Prestations : Frais Annexes (${fraisAnnexesPaid ? 'Payé' : 'Non payé'}), Tenue tout cousue (${tenueCousuePaid ? 'Payé' : 'Non payé'})`,
    };

    const newInvoice: Invoice = {
      id: `inv-${studentNumberToSave.replace(/\D/g, '').padStart(3, '0')}`,
      invoiceNumber: studentNumberToSave,
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
      feeType: "Frais d'inscription & Scolarité",
      amount: tuitionAmount,
      discountAmount: discountAmount,
      netAmount: netAmount,
      paidAmount: paidAmount,
      balanceRemaining: remainingAmount,
      enrollmentType: enrollmentType,
      paymentMethod: getPaymentMethodLabel(),
      installments: installments,
      issueDate: paymentDate,
      dueDate: paymentDate,
      status: remainingAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'sent',
    };

    // Save to persistent storage and broadcast event
    saveRegisteredStudent(newStudent, newInvoice);

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
        setSuccessToast("✓ Image du reçu copiée dans le presse-papier ! Vous pouvez faire Coller (Ctrl + V) dans WhatsApp.");
      } else {
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
    installmentsList: Array<{ label: string; amount: number; method: string; date: string }>
  ): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1680;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

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

    // Textes École au centre : Nom complet, Sigle en dessous, Devise, Contacts
    ctx.textAlign = 'center';

    // Ligne 1 : Nom complet de l'école
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px Outfit, sans-serif';
    ctx.fillText((schoolState.name || 'EPC MARKAZ AHLI SOUNNAH').toUpperCase(), 600, 80);

    // Ligne 2 : Sigle de l'école en dessous
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillText(`(${schoolState.shortName || 'EPC MANOI'})`, 600, 108);

    // Ligne 3 : Devise
    ctx.fillStyle = '#065f46';
    ctx.font = 'italic bold 15px Outfit, sans-serif';
    ctx.fillText(schoolState.receiptHeaderMotto || schoolState.motto || '« Excellence Académique • Rigueur • Éducation de Référence »', 600, 134);

    // Ligne 4 : Slogan
    if (schoolState.receiptHeaderSlogan || schoolState.slogan) {
      ctx.fillStyle = '#b45309';
      ctx.font = 'italic bold 14px Outfit, sans-serif';
      ctx.fillText(schoolState.receiptHeaderSlogan || schoolState.slogan || '✦ Former les élites et leaders de demain pour un avenir radieux', 600, 158);
    }

    // Ligne 5 : Contacts & Situation
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText(`Situation : ${schoolState.receiptHeaderAddress || schoolState.district || 'Cocody Angré 8ème Tranche'} • Tél : ${schoolState.receiptHeaderPhone || schoolState.phone || '+225 27 22 44 11 00'}`, 600, 185);

    // Ligne 6 : Badge Code MENA arrondi au centre
    drawRoundRect(400, 204, 400, 32, 8);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`Code Établissement : ${schoolState.menaCode || schoolState.ministryCode || 'MENA-04829-CI'}`, 600, 226);

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
    ctx.fillText(`Quittance N° : ${receiptNumber}`, 1130, 341);

    // --- COORDONNÉES ÉLÈVE & PARENT ARRONDI (radius 16) ---
    drawRoundRect(45, 375, 1110, 215, 16);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';

    // Ligne 1 : ID & Date
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText('Identifiant :', 70, 415);
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`${currentIdStr} (Matr. ${currentMatricule})`, 180, 415);

    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText("Date d'encaissement :", 730, 415);
    ctx.font = 'bold 18px monospace';
    ctx.fillText(formatDate(paymentDate), 920, 415);

    // Ligne 2 : Nom de l'élève & Classe
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText('Nom & Prénom :', 70, 460);
    ctx.font = 'bold 22px Outfit, sans-serif';
    ctx.fillText(`${(name || 'NOM ET PRÉNOM').toUpperCase()} (${gender === 'female' ? '♀ Fille' : '♂ Garçon'})`, 210, 460);

    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText('Classe & Statut :', 730, 460);
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(`${grade} (${enrollmentType === 'nouveau' ? 'Nouvel élève' : 'Ancien élève'})`, 880, 460);

    // Ligne 3 : Parent & Téléphone
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText('Parent / Tuteur :', 70, 505);
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(guardianName || 'Non renseigné', 210, 505);

    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText('WhatsApp :', 730, 505);
    ctx.font = 'bold 18px monospace';
    ctx.fillText(phone || 'Non renseigné', 840, 505);

    // Ligne 4 : Prestations de rentrée
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText('Prestations Rentrée :', 70, 550);
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(
      `Frais Annexes : ${fraisAnnexesPaid ? 'Payé ✓' : 'Non payé ✕'}   •   Tenue Tout Cousue : ${tenueCousuePaid ? 'Payé ✓' : 'Non payé ✕'}`,
      250,
      550
    );

    // --- TABLEAU FINANCIER OFFICIEL ARRONDI ---
    drawRoundRect(45, 605, 1110, 42, 10);
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

    drawRow("Frais d'inscription / Scolarité annuelle", formatFCFA(tuitionAmount));
    if (discountAmount > 0) {
      drawRow('Réduction / Bourse accordée', `-${formatFCFA(discountAmount)}`);
    }
    drawRow(
      'Reste à Payer Scolarité',
      remainingAmount > 0 ? `${formatFCFA(remainingAmount)} (À régler)` : '0 FCFA (Soldé)',
      true,
      remainingAmount === 0,
      remainingAmount > 0
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
    installmentsList.forEach((inst) => {
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
    ctx.fillText(`Quittance officielle N° ${receiptNumber}`, 70, y + 74);

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
    ctx.font = 'italic bold 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      schoolState.receiptFooterNote ||
        'Tout versement donne droit à un reçu numéroté immédiat. Conservez ce reçu officiel de paiement.',
      600,
      y
    );

    return canvas;
  };

  // Send receipt photo/image via WhatsApp (100% Natif, Instantané, avec Vrais Logos et Sans Échec)
  const handleCaptureAndShareWhatsApp = async (customPhone?: string, stuName?: string) => {
    const rawPhone = customPhone || whatsappPhone || '+225 07 48 92 11 00';
    const digitsOnly = rawPhone.replace(/\D/g, '');
    let cleanPhone = digitsOnly;
    if (digitsOnly.startsWith('225') && digitsOnly.length >= 12) {
      cleanPhone = digitsOnly;
    } else if (digitsOnly.length === 10) {
      cleanPhone = `225${digitsOnly}`;
    } else if (digitsOnly.length === 8) {
      cleanPhone = `22507${digitsOnly}`;
    } else {
      cleanPhone = digitsOnly.startsWith('225') ? digitsOnly : `225${digitsOnly}`;
    }

    const name = stuName || `${lastName} ${firstName}`.trim() || 'Élève';
    setSuccessToast("📸 Génération instantanée de la photo officielle du reçu...");

    try {
      const installmentsList = [
        { label: '1er Versement', amount: versement1Amount, method: versement1Method, date: versement1Date },
        { label: '2ème Versement', amount: versement2Amount, method: versement2Method, date: versement2Date },
        { label: '3ème Versement', amount: versement3Amount, method: versement3Method, date: versement3Date },
        { label: '4ème Versement', amount: versement4Amount, method: versement4Method, date: versement4Date },
        { label: '5ème Versement', amount: versement5Amount, method: versement5Method, date: versement5Date },
      ];

      const canvas = await generateOfficialReceiptCanvas(name, rawPhone, installmentsList);

      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          alert("Erreur lors de la création de la photo du reçu.");
          return;
        }

        const fileName = `Recu-Paiement-${receiptNumber}-${name.replace(/\s+/g, '_')}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        const imageUrl = URL.createObjectURL(blob);

        // Copier l'image dans le presse-papier pour collage direct (Ctrl+V)
        await handleCopyReceiptImageToClipboard(blob);

        // Sur mobile/tablette supportant le partage de fichiers
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Reçu de Paiement - ${name}`,
              text: `Reçu officiel de paiement (${receiptNumber}) pour ${name} — ${schoolState.name}`,
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

        setSuccessToast(`📷 Photo HD du reçu générée (${fileName}) et copiée !`);
      }, 'image/png');
    } catch (err) {
      console.error('Erreur génération reçu image:', err);
      const whatsappUrl = `https://wa.me/${cleanPhone}`;
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
            {/* Logo de l'École (À gauche) */}
            <div className="shrink-0 text-center flex items-center justify-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    schoolState.logoUrl ||
                    'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&auto=format&fit=crop&q=80'
                  }
                  alt={schoolState.name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            </div>

            {/* Informations de l'école au centre : Nom complet, Sigle en dessous, Devise, Contacts */}
            <div className="flex-1 min-w-0 px-1 text-center space-y-0.5">
              <h2
                className="font-black uppercase tracking-tight text-slate-950 font-heading text-xs sm:text-sm md:text-base block w-full leading-tight break-words"
                title={schoolState.name}
              >
                {schoolState.name || 'EPC MARKAZ AHLI SOUNNAH'}
              </h2>
              <p className="font-extrabold text-emerald-800 text-[11px] sm:text-xs tracking-wide">
                ({schoolState.shortName || 'EPC MANOI'})
              </p>
              <p className="font-semibold text-emerald-900 italic text-[9.5px] sm:text-[11px] truncate">
                « {schoolState.motto || 'Excellence Académique • Rigueur • Éducation de Référence'} »
              </p>
              {schoolState.slogan && (
                <p className="font-medium text-amber-700 italic text-[9px] sm:text-[10px] truncate">
                  ✦ {schoolState.slogan}
                </p>
              )}
              <p className="text-slate-700 font-medium leading-tight text-[9.5px] sm:text-[10.5px] truncate">
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

        {/* Détails Élève */}
        <div className="relative z-10 grid grid-cols-2 rounded-xl bg-slate-50/90 border border-slate-200 gap-2.5 sm:gap-3 p-3.5 text-xs sm:text-sm">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">
              Identifiant & Matricule :
            </span>
            <span className="font-mono font-black text-slate-950 text-xs sm:text-sm">
              {currentIdStr} • {currentMatricule}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">
              Année Scolaire & Date :
            </span>
            <span className="font-extrabold text-slate-950 text-xs sm:text-sm">
              {schoolState.academicYear} • {formatDate(paymentDate)}
            </span>
          </div>

          <div className="col-span-2 pt-1 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-1">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">
                Nom & Prénom de l&apos;Élève :
              </span>
              <span className="font-black text-slate-950 uppercase font-heading text-sm sm:text-base">
                {lastName || 'NOM'} {firstName || 'PRÉNOM'}
              </span>{' '}
              <span className="ml-1 text-[11px] font-bold text-slate-700">
                ({gender === 'female' ? '♀ Fille' : '♂ Garçon'})
              </span>
            </div>

            {/* Badge Statut de l'élève (Nouveau / Ancien) */}
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">
                Statut :
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black border ${
                enrollmentType === 'nouveau'
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-300 shadow-2xs'
                  : 'bg-blue-100 text-blue-950 border-blue-300 shadow-2xs'
              }`}>
                {enrollmentType === 'nouveau' ? '🌟 Nouvel Élève' : '🔄 Ancien Élève'}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">
              Classe d&apos;inscription :
            </span>
            <span className="inline-flex px-2.5 py-0.5 rounded bg-white border border-slate-300 font-black text-slate-950 text-xs">
              {grade}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">
              Nom du Parent / Tuteur :
            </span>
            <span className="font-extrabold text-slate-900 truncate block">
              {guardianName || 'Non spécifié'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">
              Contact WhatsApp Parent :
            </span>
            <span className="font-mono font-black text-emerald-900 text-xs sm:text-sm">
              {whatsappPhone || '+225 ...'}
            </span>
          </div>

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
              {address || 'Non spécifiée'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">
              RESTE À PAYER SCOLARITÉ :
            </span>
            {remainingAmount > 0 ? (
              <span className="font-mono font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs inline-block">
                {formatFCFA(remainingAmount)} (À régler)
              </span>
            ) : (
              <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs inline-block">
                0 FCFA (Soldé)
              </span>
            )}
          </div>

          {/* Statuts des Prestations : Frais Annexes & Tenue Tout Cousue sur le Reçu */}
          <div className="col-span-2 grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
            <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-600">Frais Annexes :</span>
              {fraisAnnexesPaid ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <Check className="w-3 h-3 text-emerald-700" />
                  Payé
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-rose-100 text-rose-900 border border-rose-300">
                  <X className="w-3 h-3 text-rose-700" />
                  Non payé
                </span>
              )}
            </div>

            <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-600">Tenue Tout Cousue :</span>
              {tenueCousuePaid ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <Check className="w-3 h-3 text-emerald-700" />
                  Payé
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-rose-100 text-rose-900 border border-rose-300">
                  <X className="w-3 h-3 text-rose-700" />
                  Non payé
                </span>
              )}
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
              <tr>
                <td className="text-slate-800 font-bold py-2 px-3">
                  Frais d&apos;inscription ({grade})
                </td>
                <td className="text-right font-black text-slate-950 font-mono py-2 px-3">
                  {formatFCFA(tuitionAmount)}
                </td>
              </tr>

              {discountAmount > 0 && (
                <tr className="bg-amber-50/50 text-amber-950">
                  <td className="font-bold flex items-center gap-1 py-2 px-3">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Réduction accordée</span>
                  </td>
                  <td className="text-right font-black font-mono py-2 px-3">
                    -{formatFCFA(discountAmount)}
                  </td>
                </tr>
              )}

              {remainingAmount > 0 ? (
                <tr className="text-rose-800 bg-rose-50 font-black">
                  <td className="py-2 px-3">Reste à payer (Solde)</td>
                  <td className="text-right font-mono py-2 px-3">
                    {formatFCFA(remainingAmount)}
                  </td>
                </tr>
              ) : (
                <tr className="text-emerald-800 bg-emerald-50 font-black">
                  <td className="py-2 px-3">Solde de la Scolarité</td>
                  <td className="text-right font-mono py-2 px-3">
                    0 FCFA (Soldé)
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
                        {s.studentNumber} : {s.fullName} ({s.grade}) • {formatFCFA(s.tuitionAmount)} [{s.enrollmentType === 'ancien' ? '🔄 Ancien' : '🌟 Nouveau'}]
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
                  title="Réinitialiser le formulaire pour une nouvelle inscription"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Nouveau Reçu</span>
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
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                              {stu.studentNumber}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 block truncate max-w-[140px] sm:max-w-[180px]">
                                {stu.fullName}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {stu.grade} • {stu.enrollmentType === 'ancien' ? '🔄 Ancien' : '🌟 Nouveau'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-emerald-800 block text-[11px]">
                              {formatFCFA(stu.tuitionAmount)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {formatDate(stu.paymentDate || '2026-08-27')}
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
              <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 animate-in fade-in">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>
                    Vous consultez le reçu de <strong className="font-bold">{lastName} {firstName}</strong> ({currentIdStr})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleStartNewReceipt}
                  className="text-blue-700 hover:text-blue-900 font-bold underline text-[11px] shrink-0 ml-2 cursor-pointer"
                >
                  + Nouveau Reçu
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
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ex: KOUASSI"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase font-semibold transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Prénom(s) *
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex: Aya Marie"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold transition-all"
                />
              </div>
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
                    onClick={() => setGender('female')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      gender === 'female'
                        ? 'bg-pink-50 text-pink-700 border-pink-300 ring-2 ring-pink-400/20 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>♀ Fille</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      gender === 'male'
                        ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-400/20 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>♂ Garçon</span>
                  </button>
                </div>
              </div>

              {/* Classe */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Classe demandée *
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold cursor-pointer transition-all"
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

              {/* Statut de l'élève : Nouveau ou Ancien */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Statut élève *</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEnrollmentType('nouveau')}
                    className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      enrollmentType === 'nouveau'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Nouvelle inscription"
                  >
                    <span>🌟 Nouveau</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnrollmentType('ancien')}
                    className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      enrollmentType === 'ancien'
                        ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Réinscription ancien élève"
                  >
                    <span>🔄 Ancien</span>
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
                  placeholder="Ex: M. Kouassi Jean"
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

            {/* 5. Prestations Complémentaires : Frais Annexes & Tenue Tout Cousue */}
            <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">
                  Prestations Complémentaires de Rentrée :
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Reçu & Registre</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Frais Annexes */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                  <span className="text-xs font-semibold text-slate-800">
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

                {/* Tenue Tout Cousue */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                  <span className="text-xs font-semibold text-slate-800">
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

              {/* Ligne 1 : Frais d'inscription + Réduction */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Frais d&apos;inscription (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={tuitionAmount === 0 ? '' : tuitionAmount}
                    onChange={(e) => setTuitionAmount(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold text-slate-900 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Réduction / Bourse (FCFA)</span>
                    <span className="text-[10px] text-amber-600 font-normal">Optionnel</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={discountAmount === 0 ? '' : discountAmount}
                    onChange={(e) => setDiscountAmount(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-semibold text-slate-700 transition-all"
                  />
                </div>
              </div>

              {/* Raccourcis réductions rapides */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  Raccourcis :
                </span>
                {[0, 10000, 20000, 25000, 50000].map((amt) => (
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
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Date du versement *</span>
                  </label>
                  <FrenchDateInput
                    value={paymentDate}
                    onChange={setPaymentDate}
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

            {/* Bouton de Soumission Principal */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 px-6 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {selectedStudentId
                    ? 'Mettre à jour le Reçu'
                    : 'Enregistrer le Reçu'}
                </span>
              </button>
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
                <span className="text-slate-500">Identifiant & Matricule :</span>
                <span className="font-mono font-extrabold text-slate-900">
                  {currentIdStr} • {currentMatricule}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Nom & Prénom de l&apos;élève :</span>
                <span className="font-extrabold text-slate-950 font-heading">
                  {lastName} {firstName} ({gender === 'female' ? '♀ Fille' : '♂ Garçon'})
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Statut de l&apos;élève :</span>
                <span className={`font-extrabold px-2 py-0.5 rounded border text-[11px] ${
                  enrollmentType === 'nouveau'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-blue-100 text-blue-900 border-blue-300'
                }`}>
                  {enrollmentType === 'nouveau' ? '🌟 Nouvel Élève' : '🔄 Ancien Élève'}
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
                <span className="text-slate-500">Frais Annexes / Tenue :</span>
                <span className="font-semibold text-slate-800">
                  Frais Annexes ({fraisAnnexesPaid ? 'Payé ✓' : 'Non payé ✕'}) • Tenue Tout Cousue ({tenueCousuePaid ? 'Payé ✓' : 'Non payé ✕'})
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <span className="text-slate-500">Mode de règlement :</span>
                <span className="font-bold text-slate-800">
                  {getPaymentMethodLabel()}
                </span>
              </div>

              {remainingAmount > 0 ? (
                <div className="flex items-center justify-between text-xs text-rose-700 font-bold pt-1 border-t border-slate-200/70">
                  <span>Reste à payer (Solde) :</span>
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 text-center relative">
            {/* Bouton Croix pour fermer la modale */}
            <button
              type="button"
              onClick={() => setSuccessModalData(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 font-heading">
                Reçu d&apos;Inscription Enregistré !
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                L&apos;élève <strong className="text-slate-900">{successModalData.fullName}</strong> ({successModalData.studentNumber}) est enregistré(e) en <strong className="text-slate-900">{successModalData.grade}</strong> ({successModalData.enrollmentType === 'ancien' ? 'Ancien élève' : 'Nouvel élève'}).
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1.5 bg-emerald-50 py-1 px-3 rounded-full inline-block border border-emerald-200">
                ✓ Synchronisé dans la Vue d&apos;ensemble et le Tableau de bord
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {/* Bouton WhatsApp avec texte bien disposé sur 2 lignes distinctes */}
              <button
                type="button"
                onClick={() => handleCaptureAndShareWhatsApp(successModalData.whatsappPhone || successModalData.guardianPhone, successModalData.fullName)}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  <span>Envoyer la photo du reçu par WhatsApp aux parents</span>
                </div>
                <span className="text-[11px] text-emerald-100 font-mono font-normal">
                  Numéro : {successModalData.whatsappPhone || successModalData.guardianPhone || 'Contact non renseigné'}
                </span>
              </button>

              {/* Bouton Imprimer le Reçu */}
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer border border-slate-200"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Imprimer le reçu</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseSuccessAndNext}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
              >
                + Inscrire l&apos;élève suivant (Nouveau Reçu)
              </button>
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
