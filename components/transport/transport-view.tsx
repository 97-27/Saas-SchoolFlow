'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student, School, Invoice } from '@/lib/data/types';
import { GenderBadge } from '@/components/ui/badge';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { availableClasses, mockStudents } from '@/lib/data/mock-data';
import { getLiveStudents, getLiveInvoices, getLiveSchool, saveLivePaymentInvoice, DATA_UPDATED_EVENT, updateRegisteredStudent, deleteLiveStudents, broadcastLiveUpdate, saveLiveTransportData } from '@/lib/data/live-store';
import { deleteInvoiceFromSupabase } from '@/lib/supabase/services';
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
  Trash2,
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
];

const TRANSPORT_PAYMENTS_KEY = 'schoolflow_transport_monthly_payments_v2';
const TRANSPORT_SUBSCRIPTIONS_KEY = 'schoolflow_transport_subscriptions_v2';

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
  const [showDeleteTransportModal, setShowDeleteTransportModal] = useState(false);
  const [isDeletingTransport, setIsDeletingTransport] = useState(false);

  // Formulaire nouvelle souscription
  const [newSubStudentId, setNewSubStudentId] = useState('');
  const [newSubStop, setNewSubStop] = useState('');
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

  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Lignes et circuits de transport personnalisables par l'établissement
  const [customLines, setCustomLines] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`schoolflow_transport_lines_${schoolSlug}`);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      'Ligne 1 : Abobo Gare - Carrefour Diallo - Établissement',
      'Ligne 2 : Angré 8e Tranche - Petro Ivoire - Établissement',
      'Ligne 3 : Riviera Palmeraie - Rond-point Faya',
      'Ligne 4 : Plateau Dokui - Abobo Samaké',
    ];
  });
  const [newLineName, setNewLineName] = useState('');

  const handleAddCustomLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineName.trim()) return;
    const updated = [...customLines, newLineName.trim()];
    setCustomLines(updated);
    setNewLineName('');
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`schoolflow_transport_lines_${schoolSlug}`, JSON.stringify(updated));
      } catch (e) {}
    }
    setToastMessage(`✓ Ligne « ${newLineName.trim()} » ajoutée avec succès !`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeleteCustomLine = (indexToDelete: number) => {
    const updated = customLines.filter((_, idx) => idx !== indexToDelete);
    setCustomLines(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`schoolflow_transport_lines_${schoolSlug}`, JSON.stringify(updated));
      } catch (e) {}
    }
    setToastMessage('✓ Ligne supprimée.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Synchronisation des élèves et des factures/quittances
  useEffect(() => {
    const activeSlug = (schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug) || 'epc-manoi';
    setStudents(getLiveStudents(mockStudents, activeSlug));
    setInvoices(getLiveInvoices([], activeSlug));
    setCurrentSchool(getLiveSchool(activeSlug, school));

    const handleUpdate = () => {
      setStudents(getLiveStudents(mockStudents, activeSlug));
      setInvoices(getLiveInvoices([], activeSlug));
      setCurrentSchool(getLiveSchool(activeSlug, school));
      if (typeof window !== 'undefined') {
        try {
          const savedPayments = localStorage.getItem(TRANSPORT_PAYMENTS_KEY);
          if (savedPayments) setMonthlyPayments(JSON.parse(savedPayments));
          const savedCustom = localStorage.getItem(TRANSPORT_SUBSCRIPTIONS_KEY);
          if (savedCustom) setCustomTransportMap(JSON.parse(savedCustom));
        } catch (e) {}
      }
    };

    fetch(`/api/sync?slug=${activeSlug}&t=${Date.now()}`)
      .then((res) => res.json())
      .then((res) => {
        if (res && res.success && res.data) {
          if (res.data.transportSubscriptions) {
            setCustomTransportMap(res.data.transportSubscriptions);
            try { localStorage.setItem(TRANSPORT_SUBSCRIPTIONS_KEY, JSON.stringify(res.data.transportSubscriptions)); } catch (e) {}
          }
          if (res.data.transportPayments) {
            setMonthlyPayments(res.data.transportPayments);
            try { localStorage.setItem(TRANSPORT_PAYMENTS_KEY, JSON.stringify(res.data.transportPayments)); } catch (e) {}
          }
          if (res.data.students && Array.isArray(res.data.students) && res.data.students.length > 0) {
            setStudents(getLiveStudents(res.data.students, activeSlug));
          }
        }
      })
      .catch(() => {});

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

  // Liste des abonnés au transport scolaire (inclus élèves avec transport coché ou facturé)
  const subscribers = useMemo(() => {
    const transportInvoiceStudentIds = new Set(
      invoices
        .filter((inv) => inv.feeType === 'Transport' || inv.invoiceNumber?.startsWith('TRP-') || inv.notes?.toLowerCase().includes('transport'))
        .map((inv) => inv.studentId)
    );

    return students
      .filter((stu) => {
        const hasCustom = Boolean(customTransportMap[stu.id]);
        const monthsState = monthlyPayments[stu.id] || {};
        const hasPaidMonths = Object.values(monthsState).some(Boolean);
        const hasInvoice = transportInvoiceStudentIds.has(stu.id);
        return hasCustom || hasPaidMonths || hasInvoice;
      })
      .map((stu) => {
        const custom = customTransportMap[stu.id];
        const cleanAddress = stu.address?.replace(/internat\s*\(oui\)/gi, '').replace(/cantine\s*\(oui\)/gi, '').replace(/transport\s*\(oui\)/gi, '').trim();
        const stop = custom?.stop || (cleanAddress && !cleanAddress.toLowerCase().includes('abidjan,') ? cleanAddress : 'Arrêt selon quartier');
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
        };

        const paidMonths = Object.keys(monthsState).filter((m) => monthsState[m]);
        const paidMonthsCount = paidMonths.length;
        let grossAmount = paidMonthsCount * monthlyRate;
        let totalPaidAmount = Math.max(0, grossAmount - discountAmount);

        // Si aucun mois n'est encore coché manuellement mais qu'un paiement Transport existe dans invoices
        const matchingInvoices = invoices.filter(
          (inv) =>
            (inv.studentId === stu.id || inv.studentName === stu.fullName) &&
            (inv.feeType === 'Transport' || inv.invoiceNumber?.startsWith('TRP-') || inv.notes?.toLowerCase().includes('transport'))
        );
        const invoicePaidTotal = matchingInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

        if (totalPaidAmount === 0 && invoicePaidTotal > 0) {
          totalPaidAmount = invoicePaidTotal;
          grossAmount = invoicePaidTotal + discountAmount;
        }

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
  }, [students, customTransportMap, monthlyPayments, invoices]);

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
    const totalExigible = subscribers.reduce((acc, s) => acc + (s.monthlyRate * 9 - s.discountAmount), 0);
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
    saveLiveTransportData(nextMap, monthlyPayments, schoolSlug);
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
    saveLiveTransportData(newTransportMap, newPayments, schoolSlug);

    // Synchronisation de la quittance / facture de transport dans le journal des encaissements
    const paidMonths = Object.keys(selectedStudentForMonths.monthsState || {}).filter(
      (m) => selectedStudentForMonths.monthsState[m]
    );
    const totalPaid = selectedStudentForMonths.totalPaidAmount;
    const totalExigible = (selectedStudentForMonths.monthlyRate * 9) - (selectedStudentForMonths.discountAmount || 0);
    const remaining = Math.max(0, totalExigible - totalPaid);

    if (totalPaid > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const transportInvoice = {
        id: `inv-transport-${stuId}`,
        invoiceNumber: `TRP-${selectedStudentForMonths.studentNumber?.replace(/\D/g, '') || stuId.replace(/\D/g, '').slice(-4) || '001'}`,
        studentId: selectedStudentForMonths.id,
        studentName: selectedStudentForMonths.fullName,
        studentAvatar: selectedStudentForMonths.avatar || '/avatars/default.png',
        studentGrade: selectedStudentForMonths.grade,
        studentGender: selectedStudentForMonths.gender,
        guardianName: selectedStudentForMonths.guardianName || 'Parent / Tuteur',
        guardianPhone: selectedStudentForMonths.whatsappPhone || selectedStudentForMonths.guardianPhone || '',
        feeType: 'Transport',
        amount: totalExigible,
        discountAmount: selectedStudentForMonths.discountAmount || 0,
        netAmount: totalExigible,
        paidAmount: totalPaid,
        balanceRemaining: remaining,
        paymentMethod: 'Espèces',
        enrollmentType: selectedStudentForMonths.enrollmentType || 'nouveau',
        issueDate: todayStr,
        dueDate: todayStr,
        status: remaining === 0 ? ('paid' as const) : ('partial' as const),
        notes: paidMonths.length > 0 ? `Mois réglés : ${paidMonths.join(', ')}` : 'Transport Scolaire (Navettes)',
      };
      saveLivePaymentInvoice(transportInvoice, schoolSlug);
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
      },
    };
    setMonthlyPayments(nextPayments);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TRANSPORT_SUBSCRIPTIONS_KEY, JSON.stringify(nextCustom));
        localStorage.setItem(TRANSPORT_PAYMENTS_KEY, JSON.stringify(nextPayments));
      } catch (e) {}
    }

    // Créer la transaction de transport pour Septembre et enregistrer l'élève
    const targetStu = students.find((s) => s.id === newSubStudentId);
    if (targetStu) {
      const updatedStu = {
        ...targetStu,
        isTransport: true,
        address: targetStu.address?.includes('Transport (Oui)')
          ? targetStu.address
          : `${targetStu.address || ''} | Transport (Oui)`.trim(),
        updatedAt: new Date().toISOString(),
      };
      updateRegisteredStudent(updatedStu, schoolSlug);
      const todayStr = new Date().toISOString().split('T')[0];
      const paidAmt = Math.max(0, rate - discount);
      const totalExigible = (rate * 9) - discount;
      const remaining = Math.max(0, totalExigible - paidAmt);
      const transportInvoice = {
        id: `inv-transport-${newSubStudentId}`,
        invoiceNumber: `TRP-${targetStu.studentNumber?.replace(/\D/g, '') || newSubStudentId.replace(/\D/g, '').slice(-4) || '001'}`,
        studentId: newSubStudentId,
        studentName: targetStu.fullName,
        studentAvatar: targetStu.avatar || '/avatars/default.png',
        studentGrade: targetStu.grade,
        studentGender: targetStu.gender,
        guardianName: targetStu.guardianName || 'Parent / Tuteur',
        guardianPhone: targetStu.whatsappPhone || targetStu.guardianPhone || '',
        feeType: 'Transport',
        amount: totalExigible,
        discountAmount: discount,
        netAmount: totalExigible,
        paidAmount: paidAmt,
        balanceRemaining: remaining,
        paymentMethod: 'Espèces',
        enrollmentType: targetStu.enrollmentType || 'nouveau',
        issueDate: todayStr,
        dueDate: todayStr,
        status: remaining === 0 ? ('paid' as const) : ('partial' as const),
        notes: 'Mois réglé : Septembre 2026',
      };
      saveLivePaymentInvoice(transportInvoice, schoolSlug);
    }

    saveLiveTransportData(nextCustom, nextPayments, schoolSlug);
    setIsNewSubModalOpen(false);
    setToastMessage('✓ Nouvelle souscription au transport enregistrée avec succès.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Retirer uniquement de l'abonnement de transport
  const handleRemoveFromTransportOnly = async () => {
    if (!selectedStudentForReceipt) return;
    setIsDeletingTransport(true);
    try {
      const studentId = selectedStudentForReceipt.id;
      const studentNumber = selectedStudentForReceipt.studentNumber;
      const matricule = selectedStudentForReceipt.matricule;

      // a. Mettre à jour l'élève (isTransport: false)
      const foundStudent = students.find((s) => s.id === studentId);
      if (foundStudent) {
        const updatedStudent: Student = {
          ...foundStudent,
          isTransport: false,
          notes: (foundStudent.notes || '').replace(/transport\s*\(oui\)/gi, '').trim(),
        };
        updateRegisteredStudent(updatedStudent, schoolSlug);
      }

      // b. Nettoyer customTransportMap
      const nextMap = { ...customTransportMap };
      delete nextMap[studentId];
      if (studentNumber) delete nextMap[studentNumber];
      if (matricule) delete nextMap[matricule];
      setCustomTransportMap(nextMap);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(TRANSPORT_SUBSCRIPTIONS_KEY, JSON.stringify(nextMap));
        } catch (e) {}
      }

      // c. Nettoyer monthlyPayments
      const nextPayments = { ...monthlyPayments };
      delete nextPayments[studentId];
      if (studentNumber) delete nextPayments[studentNumber];
      if (matricule) delete nextPayments[matricule];
      setMonthlyPayments(nextPayments);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(TRANSPORT_PAYMENTS_KEY, JSON.stringify(nextPayments));
        } catch (e) {}
      }

      // d. Supprimer les factures/quittances de transport
      const invoiceId = `inv-transport-${studentId}`;
      if (typeof window !== 'undefined') {
        try {
          const rawInvoices = localStorage.getItem('schoolflow_registered_invoices_v1');
          if (rawInvoices) {
            const prevInvoices: Invoice[] = JSON.parse(rawInvoices);
            const filteredInvoices = prevInvoices.filter(
              (inv) =>
                inv.id !== invoiceId &&
                inv.studentId !== studentId &&
                !inv.invoiceNumber?.startsWith(`TRP-${studentNumber}`) &&
                !inv.invoiceNumber?.startsWith(`QUI-TRP-${studentNumber}`)
            );
            localStorage.setItem('schoolflow_registered_invoices_v1', JSON.stringify(filteredInvoices));
          }
        } catch (e) {}
      }
      deleteInvoiceFromSupabase(invoiceId, schoolSlug).catch(() => {});

      // e. Diffuser l'événement
      broadcastLiveUpdate({
        action: 'transport_removed',
        studentId,
        schoolSlug,
      });
      window.dispatchEvent(new CustomEvent(DATA_UPDATED_EVENT, { detail: { action: 'transport_removed' } }));

      setShowDeleteTransportModal(false);
      setSelectedStudentForReceipt(null);
      setToastMessage(`✓ L'élève ${selectedStudentForReceipt.fullName} a été retiré du transport scolaire.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Erreur lors du retrait du transport:', err);
    } finally {
      setIsDeletingTransport(false);
    }
  };

  // 2. Supprimer définitivement l'élève et tous ses reçus (si doublon accidentel)
  const handleDeleteEntireTransportStudent = async () => {
    if (!selectedStudentForReceipt) return;
    setIsDeletingTransport(true);
    try {
      const studentId = selectedStudentForReceipt.id;
      const studentNumber = selectedStudentForReceipt.studentNumber;
      const matricule = selectedStudentForReceipt.matricule;

      // Nettoyer transport map et payments
      const nextMap = { ...customTransportMap };
      delete nextMap[studentId];
      if (studentNumber) delete nextMap[studentNumber];
      if (matricule) delete nextMap[matricule];
      setCustomTransportMap(nextMap);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(TRANSPORT_SUBSCRIPTIONS_KEY, JSON.stringify(nextMap));
        } catch (e) {}
      }

      const nextPayments = { ...monthlyPayments };
      delete nextPayments[studentId];
      if (studentNumber) delete nextPayments[studentNumber];
      if (matricule) delete nextPayments[matricule];
      setMonthlyPayments(nextPayments);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(TRANSPORT_PAYMENTS_KEY, JSON.stringify(nextPayments));
        } catch (e) {}
      }

      // Supprimer définitivement l'élève et tous ses reçus
      const idsToDelete = [studentId, studentNumber, matricule].filter(Boolean) as string[];
      deleteLiveStudents(idsToDelete, schoolSlug);

      setShowDeleteTransportModal(false);
      setSelectedStudentForReceipt(null);
      setToastMessage(`✓ Reçu et dossier de ${selectedStudentForReceipt.fullName} définitivement supprimés.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Erreur suppression totale transport:', err);
    } finally {
      setIsDeletingTransport(false);
    }
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

      setToastMessage('✅ Le reçu automatique a été copié dans le presse-papiers et WhatsApp est prêt !');
      setTimeout(() => setToastMessage(null), 7000);

      // Ouverture directe du dialogue WhatsApp avec message récapitulatif
      const rawPhone = (sub.whatsappPhone || sub.guardianPhone || '').replace(/\D/g, '');
      const cleanPhone = rawPhone.length === 10 ? `225${rawPhone}` : rawPhone;
      const message = `Bonjour,\nVoici le reçu officiel de cotisation au Transport Scolaire pour votre enfant *${sub.fullName}* (${sub.grade}) pour l'année 2026-2027.\n• Arrêt : ${sub.pickupStop}\n• Total encaissé : ${formatFCFA(sub.totalPaidAmount)}\n• Mois réglés : ${sub.paidMonths.length > 0 ? sub.paidMonths.join(', ') : 'Aucun'}\n• Établissement : ${currentSchool.name}.`;
      const waUrl = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
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
              setNewSubStop('');
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

        {/* Card 3 : Flotte & Lignes de Transport */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between bg-amber-50/15">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-900 font-sans truncate">
                  Flotte & Lignes de Transport
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsItinerairesModalOpen(true)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 transition-all cursor-pointer"
              >
                + Gérer les lignes
              </button>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-amber-900 tracking-tight font-heading whitespace-nowrap">
                {customLines.length === 0 ? '0 Ligne configurée' : `${customLines.length} Ligne${customLines.length > 1 ? 's' : ''} Active${customLines.length > 1 ? 's' : ''}`}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {customLines.length === 0
                ? 'Aucune ligne configurée — Cliquez sur « Gérer les lignes » pour ajouter vos circuits.'
                : 'Lignes personnalisées par l’établissement avec circuits dédiés.'}
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-amber-800 font-medium flex items-center justify-between">
            <span>Configuration des circuits</span>
            <span className="font-bold">
              {customLines.length > 0 ? '✓ Personnalisée & Active' : 'À définir'}
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
                        <span>Mois ({sub.paidMonthsCount}/9)</span>
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
                <span>Enregistrer le tarif</span>
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
                    Reçu de Transport Scolaire
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
                    REÇU OFFICIEL DE TRANSPORT SCOLAIRE
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
                  <span className="text-[10px] text-slate-400 font-bold block">{selectedStudentForReceipt.matricule ? 'ID / Matr. & Classe :' : 'ID & Classe :'}</span>
                  <span className="font-mono font-bold text-slate-900">{selectedStudentForReceipt.studentNumber}{selectedStudentForReceipt.matricule ? ` (${selectedStudentForReceipt.matricule})` : ''} • {selectedStudentForReceipt.grade}</span>
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
                        <div className="font-bold text-slate-900">Transport Scolaire Mensuel</div>
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
                      <td className="py-2 px-3 text-right font-extrabold text-slate-950 font-heading">
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
                  Reçu officiel numéroté émis par le service Transport.
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

              <button
                type="button"
                onClick={() => setShowDeleteTransportModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-all shadow-2xs cursor-pointer"
                title="Supprimer ce reçu ou cet abonnement de transport"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Supprimer ce Reçu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de Confirmation de Suppression de Reçu / Abonnement Transport */}
      {showDeleteTransportModal && selectedStudentForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-950 font-heading">
                  Supprimer ce Reçu / Abonnement de Transport ?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choisissez le mode de suppression pour ce reçu de transport scolaire.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteTransportModal(false)}
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
                <span className="text-slate-500 font-medium">Arrêt de ramassage :</span>
                <span className="font-bold text-emerald-800">
                  {selectedStudentForReceipt.pickupStop}
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
                disabled={isDeletingTransport}
                onClick={handleRemoveFromTransportOnly}
                className="w-full p-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-left transition-all cursor-pointer flex items-start gap-3 group"
              >
                <RotateCcw className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 group-hover:rotate-[-45deg] transition-transform" />
                <div className="flex-1">
                  <span className="text-xs font-bold text-amber-950 block">
                    1. Retirer uniquement du transport (Recommandé)
                  </span>
                  <span className="text-[11px] text-amber-800 mt-0.5 block">
                    L&apos;élève reste scolarisé dans l&apos;école. Seuls son abonnement de car, son reçu et ses mensualités de transport sont supprimés.
                  </span>
                </div>
              </button>

              <button
                type="button"
                disabled={isDeletingTransport}
                onClick={handleDeleteEntireTransportStudent}
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
                disabled={isDeletingTransport}
                onClick={() => setShowDeleteTransportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 3 : GESTION DES LIGNES & ITINÉRAIRES DE TRANSPORT ================= */}
      {isItinerairesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                  <Bus className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 font-heading">
                    Personnaliser les Lignes de Transport
                  </h3>
                  <p className="text-xs text-slate-500">
                    Définissez vous-mêmes les circuits et lignes actives de votre établissement
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

            {/* Formulaire d'ajout d'une nouvelle ligne */}
            <form onSubmit={handleAddCustomLine} className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
              <label className="text-xs font-bold text-amber-950 block">
                Ajouter une nouvelle ligne de transport :
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={newLineName}
                  onChange={(e) => setNewLineName(e.target.value)}
                  placeholder="Ex: Ligne 1 : Abobo Gare - Carrefour Diallo - Établissement"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-amber-300 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/30 transition-all cursor-pointer whitespace-nowrap"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>

            {/* Liste des lignes actives personnalisées */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Lignes Actives Enregistrées ({customLines.length})
                </span>
                <span className="text-[10px] text-slate-400">Modifiables à tout moment</span>
              </div>

              {customLines.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 text-xs italic">
                  Aucune ligne active n&apos;est encore enregistrée. Saisissez le nom d&apos;un circuit ci-dessus et cliquez sur Enregistrer.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  {customLines.map((line, idx) => (
                    <div key={idx} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 truncate">{line}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomLine(idx)}
                        title="Supprimer cette ligne"
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsItinerairesModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
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
