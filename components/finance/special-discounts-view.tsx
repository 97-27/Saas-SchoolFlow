'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { School } from '@/lib/data/types';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { getLiveSchool, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import {
  BadgePercent,
  PlusCircle,
  Printer,
  Users,
  CheckCircle2,
  Building2,
  Trash2,
  RotateCcw,
  FileCheck,
  Zap,
  Receipt,
  Download,
  X,
  Copy,
  Smartphone,
  ChevronDown,
  FolderOpen,
  Loader2,
} from 'lucide-react';

export interface ChildItem {
  id: string;
  fullName: string;
  grade: string;
  gender?: 'male' | 'female';
  tuitionAmount: number;
}

export interface PaymentInstallment {
  id: string;
  installmentNumber: number;
  paymentDate: string;
  amount: number;
  paymentMethod: 'Espèces' | 'Orange Money' | 'MTN MoMo' | 'Wave' | 'Moov Money' | 'Virement' | 'Chèque';
  reference?: string;
  receiptNumber: string;
}

export interface FamilyDiscountReceipt {
  id: string;
  receiptNumber: string;
  parentName: string;
  parentPhone: string; // WhatsApp principal
  secondaryPhones?: string[]; // Jusqu'à 2 numéros secondaires (3 numéros au total)
  parentAddress: string;
  discountType: string;
  discountAmountFCFA: number;
  customTotalAmountFCFA?: number;
  customNetToPayFCFA?: number;
  customPaidAmountFCFA?: number;
  issueDate: string;
  children: ChildItem[];
  installments: PaymentInstallment[];
}

// Niveaux scolaires officiels de la Maternelle jusqu'à la 3ème (et secondaires si configuré)
const DEFAULT_CHILDREN_CLASSES = [
  'Maternelle (P.S.)',
  'Maternelle (M.S.)',
  'Maternelle (G.S.)',
  'CP1',
  'CP2',
  'CE1',
  'CE2',
  'CM1',
  'CM2',
  '6ème',
  '5ème',
  '4ème',
  '3ème',
];

const DISCOUNTS_STORAGE_KEY = 'schoolflow_special_discounts_v1';

interface SpecialDiscountsViewProps {
  initialDiscounts?: any[];
  school: School;
  schoolSlug: string;
}

export function SpecialDiscountsView({
  school,
  schoolSlug,
}: SpecialDiscountsViewProps) {
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const sanitizeReceipts = (list: FamilyDiscountReceipt[]): FamilyDiscountReceipt[] => {
    return (list || []).filter(
      (r) =>
        r &&
        !r.parentName?.includes('KOUASSI Kouamé') &&
        !r.parentName?.includes('BAMBA Souleymane') &&
        !r.parentName?.includes('TRAORÉ Mamadou') &&
        !r.parentName?.includes('KOFFI N’Dri') &&
        !r.parentName?.includes('DIALLO Ibrahima') &&
        !r.children?.some((c) =>
          ['Chantal Adjobi', 'Salif Bado', 'Mariam Barry', 'Roland Akoto', 'Estelle N’Guessan', 'Hervé Bamba', 'Kady Sangaré'].some((name) =>
            c.fullName?.includes(name)
          )
        )
    );
  };

  const [savedReceipts, setSavedReceipts] = useState<FamilyDiscountReceipt[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved =
          localStorage.getItem(`${DISCOUNTS_STORAGE_KEY}_${schoolSlug}`) ||
          localStorage.getItem(DISCOUNTS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return sanitizeReceipts(parsed);
        }
      } catch (e) {}
    }
    return [];
  });
  const [selectedReceiptIndex, setSelectedReceiptIndex] = useState<number>(0);
  const [isReceiptDropdownOpen, setIsReceiptDropdownOpen] = useState<boolean>(false);

  // État du reçu en cours d'édition (vide si savedReceipts est vide)
  const firstRec = savedReceipts[0] || null;
  const [parentName, setParentName] = useState<string>(firstRec?.parentName || '');
  const [parentPhone, setParentPhone] = useState<string>(firstRec?.parentPhone || '');
  const [secondaryPhones, setSecondaryPhones] = useState<string[]>(firstRec?.secondaryPhones || []);
  const [parentAddress, setParentAddress] = useState<string>(firstRec?.parentAddress || '');
  const [receiptNumber, setReceiptNumber] = useState<string>(firstRec?.receiptNumber || 'REC-FAM-2026-001');
  const [issueDate, setIssueDate] = useState<string>(firstRec?.issueDate || '01/09/2026');

  // Saisie financière directe et 100% modifiable pour TOUS les champs (Total, Réduction, Net à payer, Somme versée)
  const [manualTotalAmountFCFA, setManualTotalAmountFCFA] = useState<number | null>(firstRec?.customTotalAmountFCFA || null);
  const [discountType, setDiscountType] = useState<string>(firstRec?.discountType || 'Réduction Fratrie');
  const [discountAmountFCFA, setDiscountAmountFCFA] = useState<number>(firstRec?.discountAmountFCFA || 0);
  const [manualNetToPayFCFA, setManualNetToPayFCFA] = useState<number | null>(firstRec?.customNetToPayFCFA || null);
  const [manualPaidAmountFCFA, setManualPaidAmountFCFA] = useState<number | null>(firstRec?.customPaidAmountFCFA || null);

  // Liste des enfants (jusqu'à 10 enfants)
  const [children, setChildren] = useState<ChildItem[]>(firstRec?.children || []);

  // Liste des versements (jusqu'à 5 versements)
  const [installments, setInstallments] = useState<PaymentInstallment[]>(firstRec?.installments || []);

  // Toast & État capture d'image
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Modal WhatsApp Preview Data
  const [whatsAppPreviewData, setWhatsAppPreviewData] = useState<{
    imageUrl: string;
    blob: Blob;
    fileName: string;
    phone: string;
    cleanPhone: string;
    name: string;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentSchool(getLiveSchool(schoolSlug, school));
    const handleUpdate = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, school));
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(`${DISCOUNTS_STORAGE_KEY}_${schoolSlug}`) || localStorage.getItem(DISCOUNTS_STORAGE_KEY);
          const list = saved ? JSON.parse(saved) : [];
          setSavedReceipts(list);
          if (list.length === 0) {
            setParentName('');
            setParentPhone('');
            setSecondaryPhones([]);
            setParentAddress('');
            setReceiptNumber('REC-FAM-2026-001');
            setChildren([]);
            setInstallments([]);
            setDiscountAmountFCFA(0);
            setManualTotalAmountFCFA(null);
            setManualNetToPayFCFA(null);
            setManualPaidAmountFCFA(null);
          }
        } catch (e) {}
      }
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, school]);

  // Fermer le menu déroulant lors d'un clic externe
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsReceiptDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Charger un reçu parmi la liste
  const handleSelectReceipt = (index: number) => {
    setSelectedReceiptIndex(index);
    setIsReceiptDropdownOpen(false);
    const rec = savedReceipts[index];
    setParentName(rec.parentName);
    setParentPhone(rec.parentPhone);
    setSecondaryPhones(rec.secondaryPhones || []);
    setParentAddress(rec.parentAddress);
    setReceiptNumber(rec.receiptNumber);
    setIssueDate(rec.issueDate);
    setDiscountType(rec.discountType);
    setDiscountAmountFCFA(rec.discountAmountFCFA);
    setManualTotalAmountFCFA(rec.customTotalAmountFCFA || null);
    setManualNetToPayFCFA(rec.customNetToPayFCFA || null);
    setManualPaidAmountFCFA(rec.customPaidAmountFCFA || null);
    setChildren(rec.children);
    setInstallments(rec.installments);
  };

  // 1. Calcul de la Somme Totale (Brut)
  const calculatedChildrenTotal = useMemo(() => {
    return children.reduce((acc, c) => acc + (Number(c.tuitionAmount) || 0), 0);
  }, [children]);

  const totalBrutFCFA = useMemo(() => {
    if (manualTotalAmountFCFA !== null && manualTotalAmountFCFA >= 0) {
      return manualTotalAmountFCFA;
    }
    return calculatedChildrenTotal;
  }, [manualTotalAmountFCFA, calculatedChildrenTotal]);

  // 2. Calcul automatique du Taux de Remise Équivalent (%)
  const calculatedPercentage = useMemo(() => {
    if (totalBrutFCFA <= 0) return 0;
    const pct = ((discountAmountFCFA / totalBrutFCFA) * 100);
    return Math.min(100, Math.round(pct * 10) / 10);
  }, [totalBrutFCFA, discountAmountFCFA]);

  // 3. Calcul de la Somme Net À Payer (avec possibilité de saisie directe modifiable)
  const autoNetToPayFCFA = useMemo(() => {
    return Math.max(0, totalBrutFCFA - discountAmountFCFA);
  }, [totalBrutFCFA, discountAmountFCFA]);

  const netToPayFCFA = useMemo(() => {
    if (manualNetToPayFCFA !== null && manualNetToPayFCFA >= 0) {
      return manualNetToPayFCFA;
    }
    return autoNetToPayFCFA;
  }, [manualNetToPayFCFA, autoNetToPayFCFA]);

  // 4. Calcul de la Somme Versée (avec possibilité de saisie directe modifiable)
  const autoPaidFCFA = useMemo(() => {
    return installments.reduce((acc, inst) => acc + (Number(inst.amount) || 0), 0);
  }, [installments]);

  const totalPaidFCFA = useMemo(() => {
    if (manualPaidAmountFCFA !== null && manualPaidAmountFCFA >= 0) {
      return manualPaidAmountFCFA;
    }
    return autoPaidFCFA;
  }, [manualPaidAmountFCFA, autoPaidFCFA]);

  // 5. Calcul du Reste à Payer / Solde
  const remainingBalanceFCFA = useMemo(() => {
    return Math.max(0, netToPayFCFA - totalPaidFCFA);
  }, [netToPayFCFA, totalPaidFCFA]);

  // Statistiques globales calculées sur les reçus enregistrés
  const globalKpis = useMemo(() => {
    let totalKids = 0;
    let girls = 0;
    let boys = 0;
    let totalDiscountVol = 0;

    savedReceipts.forEach((r) => {
      totalDiscountVol += r.discountAmountFCFA || 0;
      r.children.forEach((c) => {
        totalKids++;
        if (c.gender === 'female') girls++;
        else boys++;
      });
    });

    return {
      totalBeneficiaries: totalKids,
      girlsCount: girls,
      boysCount: boys,
      totalDiscountVolume: totalDiscountVol,
      receiptsCount: savedReceipts.length,
    };
  }, [savedReceipts]);

  // Gestion des numéros de contact (jusqu'à 3 numéros)
  const handleAddSecondaryPhone = () => {
    if (secondaryPhones.length >= 2) {
      alert('Vous pouvez enregistrer au maximum 3 numéros de téléphone (1 WhatsApp + 2 secondaires).');
      return;
    }
    setSecondaryPhones([...secondaryPhones, '']);
  };

  const handleUpdateSecondaryPhone = (index: number, val: string) => {
    const copy = [...secondaryPhones];
    copy[index] = val;
    setSecondaryPhones(copy);
  };

  const handleRemoveSecondaryPhone = (index: number) => {
    setSecondaryPhones(secondaryPhones.filter((_, i) => i !== index));
  };

  // Gestion des enfants (jusqu'à 10)
  const handleAddChild = () => {
    if (children.length >= 10) {
      alert('Vous avez atteint la limite maximale de 10 enfants pour ce reçu.');
      return;
    }
    const newChild: ChildItem = {
      id: `ch-${Date.now()}`,
      fullName: '',
      grade: DEFAULT_CHILDREN_CLASSES[Math.min(children.length, DEFAULT_CHILDREN_CLASSES.length - 1)],
      gender: children.length % 2 === 0 ? 'female' : 'male',
      tuitionAmount: 180000,
    };
    setChildren([...children, newChild]);
  };

  const handleUpdateChild = (id: string, field: keyof ChildItem, value: any) => {
    setChildren(
      children.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleRemoveChild = (id: string) => {
    if (children.length <= 1) {
      alert('Un reçu doit comporter au moins un enfant.');
      return;
    }
    setChildren(children.filter((c) => c.id !== id));
  };

  // Gestion des versements (jusqu'à 5)
  const handleAddInstallment = () => {
    if (installments.length >= 5) {
      alert('La limite maximale de 5 versements par reçu est atteinte.');
      return;
    }
    const nextNum = installments.length + 1;
    const newInst: PaymentInstallment = {
      id: `inst-${Date.now()}`,
      installmentNumber: nextNum,
      paymentDate: new Date().toISOString().split('T')[0],
      amount: remainingBalanceFCFA > 0 ? remainingBalanceFCFA : 50000,
      paymentMethod: 'Espèces',
      receiptNumber: `${receiptNumber}/${nextNum}`,
    };
    setInstallments([...installments, newInst]);
    setManualPaidAmountFCFA(null);
  };

  const handleUpdateInstallment = (id: string, field: keyof PaymentInstallment, value: any) => {
    setInstallments(
      installments.map((inst) => (inst.id === id ? { ...inst, [field]: value } : inst))
    );
    setManualPaidAmountFCFA(null);
  };

  const handleRemoveInstallment = (id: string) => {
    setInstallments(installments.filter((inst) => inst.id !== id));
    setManualPaidAmountFCFA(null);
  };

  // Option 1 clic : Règlement en totalité (100% de la somme Net À Payer)
  const handlePayInFull = () => {
    const fullInstallment: PaymentInstallment = {
      id: `inst-full-${Date.now()}`,
      installmentNumber: 1,
      paymentDate: new Date().toISOString().split('T')[0],
      amount: netToPayFCFA,
      paymentMethod: 'Espèces',
      receiptNumber: `${receiptNumber}/1`,
      reference: 'RÈGLEMENT TOTALITÉ',
    };
    setInstallments([fullInstallment]);
    setManualPaidAmountFCFA(netToPayFCFA);
    setToastMessage('✅ Paiement en totalité appliqué avec succès (100% réglé) !');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Réinitialiser / Nouveau reçu vierge
  const handleResetNewReceipt = () => {
    const nextIndex = savedReceipts.length + 1;
    const formattedNext = String(nextIndex).padStart(3, '0');
    const newNum = `REC-FAM-2026-${formattedNext}`;

    setReceiptNumber(newNum);
    setParentName('');
    setParentPhone('');
    setSecondaryPhones([]);
    setParentAddress('');
    setIssueDate('01/09/2026');
    setDiscountType('Réduction 2 enfants');
    setDiscountAmountFCFA(50000);
    setManualTotalAmountFCFA(null);
    setManualNetToPayFCFA(null);
    setManualPaidAmountFCFA(null);
    setChildren([
      { id: `ch-${Date.now()}`, fullName: '', grade: '6ème', gender: 'male', tuitionAmount: 200000 },
    ]);
    setInstallments([]);
    setToastMessage('✨ Nouveau reçu vierge initialisé.');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  // Sauvegarder ou mettre à jour le reçu
  const handleSaveReceipt = () => {
    const updatedReceipt: FamilyDiscountReceipt = {
      id: savedReceipts[selectedReceiptIndex]?.id || `fam-${Date.now()}`,
      receiptNumber,
      parentName: parentName || 'Parent Non Renseigné',
      parentPhone,
      secondaryPhones,
      parentAddress,
      discountType,
      discountAmountFCFA,
      customTotalAmountFCFA: manualTotalAmountFCFA || undefined,
      customNetToPayFCFA: manualNetToPayFCFA || undefined,
      customPaidAmountFCFA: manualPaidAmountFCFA || undefined,
      issueDate,
      children,
      installments,
    };

    const exists = savedReceipts.findIndex((r) => r.receiptNumber === receiptNumber);
    let updatedList: FamilyDiscountReceipt[];
    if (exists >= 0) {
      updatedList = [...savedReceipts];
      updatedList[exists] = updatedReceipt;
    } else {
      updatedList = [...savedReceipts, updatedReceipt];
      setSelectedReceiptIndex(savedReceipts.length);
    }

    setSavedReceipts(updatedList);
    try {
      localStorage.setItem(`${DISCOUNTS_STORAGE_KEY}_${schoolSlug}`, JSON.stringify(updatedList));
      localStorage.setItem(DISCOUNTS_STORAGE_KEY, JSON.stringify(updatedList));
      window.dispatchEvent(new Event(DATA_UPDATED_EVENT));
    } catch (e) {}

    setToastMessage(`💾 Reçu N° ${receiptNumber} sauvegardé dans les archives !`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleCopyReceiptImageToClipboard = async (blob: Blob) => {
    try {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({
            'image/png': blob,
          }),
        ]);
        setToastMessage('✓ Image du reçu copiée dans le presse-papier ! Vous pouvez faire Coller (Ctrl + V) dans WhatsApp.');
        setShowToast(true);
      } else {
        setToastMessage('ℹ️ Image HD du reçu prête pour WhatsApp.');
        setShowToast(true);
      }
    } catch (err) {
      console.warn('Copie presse-papier:', err);
    }
  };

  // Capture et copie d'image directe dans le Presse-Papier + Ouverture Modale WhatsApp (Sans redirection automatique)
  const handleShareWhatsappWithImageCopy = async () => {
    const element = document.getElementById('printable-receipt-card');
    if (!element) return;

    setIsGeneratingImage(true);
    setToastMessage('📸 Capture HD du Reçu Officiel en cours...');
    setShowToast(true);

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsGeneratingImage(false);
          setToastMessage('⚠️ Erreur lors de la capture du reçu.');
          setShowToast(true);
          return;
        }

        // 1. Copier automatiquement dans le presse-papier
        if (navigator.clipboard && (window as any).ClipboardItem) {
          try {
            await navigator.clipboard.write([
              new (window as any).ClipboardItem({
                'image/png': blob,
              }),
            ]);
          } catch (clipErr) {
            console.warn('Clipboard write fallback:', clipErr);
          }
        }

        // 2. Afficher la modale de prévisualisation et partage WhatsApp (sans redirection automatique)
        const imageUrl = URL.createObjectURL(blob);
        const cleanPhone = (parentPhone || '').replace(/\D/g, '');
        const fileName = `Recu_Reduction_${receiptNumber}_${(parentName || 'Parent').replace(/\s+/g, '_')}.png`;

        setWhatsAppPreviewData({
          imageUrl,
          blob,
          fileName,
          phone: parentPhone || '+225 --',
          cleanPhone,
          name: parentName || 'Parent d\'élève',
        });

        setToastMessage('✅ Le reçu automatique a été déjà copié dans votre presse-papiers ! Vous pouvez maintenant aller sur WhatsApp et faire Coller (Ctrl + V).');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 7000);
        setIsGeneratingImage(false);
      }, 'image/png');
    } catch (err) {
      console.error('Erreur génération image reçu:', err);
      setIsGeneratingImage(false);
      setToastMessage('⚠️ Erreur lors de la capture du reçu.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
    }
  };

  const renderDiscountReceiptSlip = (badgeLabel?: string) => {
    return (
      <div
        id="printable-receipt-card"
        className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-800 shadow-xl space-y-5 relative overflow-hidden printable-receipt-area print:p-4 print:border-none print:shadow-none print:w-full print:m-0"
      >
        {/* 1. EN-TÊTE OFFICIEL AVEC LES DEUX LOGOS, NOM, SIGLE, DEVISE, SLOGAN, CONTACTS ET CODE MENA */}
        <div className="pb-4 border-b-2 border-slate-800 flex items-center justify-between gap-4">
          {/* Logo de l'École (Gauche) */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0 border border-emerald-900 overflow-hidden">
            {currentSchool.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentSchool.logoUrl} alt="Logo École" className="w-full h-full object-cover" />
            ) : (
              <span>EPC</span>
            )}
          </div>

          {/* Informations Officielles de l'École */}
          <div className="text-center flex-1 space-y-1">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-heading leading-tight uppercase">
              {currentSchool.name}
            </h2>

            <div className="inline-block px-3 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-950 border border-emerald-300 uppercase tracking-wide">
              ({currentSchool.shortName || 'EPC MANOI'})
            </div>

            <p className="text-[11px] font-bold text-emerald-800 italic">
              {currentSchool.receiptHeaderMotto || currentSchool.motto || '« Faisons de nos enfants les élites de demain. »'}
            </p>

            <p className="text-[10px] text-slate-600 font-medium">
              Situation : {currentSchool.receiptHeaderAddress || currentSchool.district || currentSchool.city || 'Abobo Biabou 2'} • Tél : {currentSchool.receiptHeaderPhone || currentSchool.phone || '+225 01 02 61 14 09'}
            </p>

            {/* Code Établissement / Code MENA */}
            <div className="inline-block bg-slate-900 text-white text-[10px] font-mono font-bold px-3 py-0.5 rounded-md shadow-2xs">
              Code Établissement : {currentSchool.menaCode || currentSchool.ministryCode || '321119'}
            </div>
          </div>

          {/* Armoiries / Emblème du Pays (Droite) */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center p-1 shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentSchool.countryEmblemUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png'}
              alt="Armoiries Nationales"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* 2. TITRE DU REÇU & N° DE REÇU */}
        <div className="text-center bg-slate-950 text-white py-3 px-4 rounded-2xl shadow-sm space-y-1">
          <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest font-heading text-emerald-400">
            REÇU OFFICIEL DE SCOLARITÉ & RÉDUCTION SPÉCIALE {badgeLabel ? `— ${badgeLabel}` : ''}
          </h3>
          <div className="flex items-center justify-center gap-3 text-[11px] font-mono flex-wrap">
            <span className="text-amber-300 font-bold bg-white/10 px-2.5 py-0.5 rounded-md border border-white/10">
              N° {receiptNumber}
            </span>
            <span className="text-slate-300 font-medium">
              Date : <strong className="text-white">{formatDate(issueDate)}</strong>
            </span>
          </div>
        </div>

        {/* 3. COORDONNÉES FAMILLE & CONTACTS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Responsable Légal / Parent :</span>
            <p className="font-black text-slate-900 text-sm">{parentName || '—'}</p>

            <div className="space-y-0.5 text-[11px] font-mono">
              <p className="text-slate-800 font-bold flex items-center gap-1">
                <span>📱 WhatsApp :</span>
                <span className="text-emerald-800 font-extrabold">{parentPhone || '—'}</span>
              </p>
              {secondaryPhones.map((ph, idx) => (
                <p key={idx} className="text-slate-600">
                  📞 Contact {idx + 2} : <strong>{ph}</strong>
                </p>
              ))}
            </div>

            <p className="text-slate-500 text-[11px]">📍 {parentAddress || 'Abidjan, Côte d\'Ivoire'}</p>
          </div>

          <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Motif de Réduction Spéciale :</span>
            <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
              {discountType}
            </span>
            <p className="text-[10px] text-slate-500 mt-1">
              Année Scolaire active : <strong className="text-emerald-800">{currentSchool.academicYear || '2026-2027'}</strong>
            </p>
          </div>
        </div>

        {/* 4. TABLEAU DES ENFANTS BÉNÉFICIAIRES */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>LISTE DES ENFANTS INSCRITS DE LA FAMILLE ({children.length}) :</span>
            <span className="text-[11px] text-slate-400 font-normal">Maternelle à 3ème</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                  <th className="py-2 pl-3 pr-2 w-8 text-center">N°</th>
                  <th className="py-2 px-2">Nom & Prénoms de l&apos;Élève</th>
                  <th className="py-2 px-2 text-center">Classe</th>
                  <th className="py-2 pr-3 pl-2 text-right">Scolarité Initiale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {children.map((child, idx) => (
                  <tr key={child.id} className="hover:bg-slate-50/60">
                    <td className="py-2 pl-3 pr-2 font-mono text-center text-slate-400 text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-2 font-bold text-slate-900">
                      {child.fullName || `Élève N°${idx + 1}`}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                        {child.grade}
                      </span>
                    </td>
                    <td className="py-2 pr-3 pl-2 text-right font-mono font-semibold">
                      {formatFCFA(child.tuitionAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. GRAND RÉCAPITULATIF FINANCIER */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-slate-950 text-white shadow-md">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Somme Totale
            </span>
            <p className="text-xs sm:text-sm font-extrabold font-heading text-slate-200">
              {formatFCFA(totalBrutFCFA)}
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
              Réduction Accordée
            </span>
            <p className="text-xs sm:text-sm font-extrabold font-heading text-amber-300">
              -{formatFCFA(discountAmountFCFA)}
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
              Somme Net À Payer
            </span>
            <p className="text-sm sm:text-base font-extrabold font-heading text-emerald-400">
              {formatFCFA(netToPayFCFA)}
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-blue-400 block tracking-wider">
              Somme Versée
            </span>
            <p className="text-sm sm:text-base font-extrabold font-heading text-white">
              {formatFCFA(totalPaidFCFA)}
            </p>
          </div>
        </div>

        {/* 6. DÉTAIL DES VERSEMENTS + RESTE À PAYER */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>HISTORIQUE DES VERSEMENTS EFFECTUÉS ({installments.length}/5) :</span>
            <span className="text-emerald-700 font-extrabold font-heading text-sm">
              Reste À Payer : {formatFCFA(remainingBalanceFCFA)}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                  <th className="py-1.5 pl-3">Échéance</th>
                  <th className="py-1.5 px-2">Date</th>
                  <th className="py-1.5 px-2">Moyen de Paiement</th>
                  <th className="py-1.5 px-2">N° Reçu</th>
                  <th className="py-1.5 pr-3 text-right">Montant Versé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {installments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-slate-400">
                      Aucun versement enregistré pour ce reçu.
                    </td>
                  </tr>
                ) : (
                  installments.map((inst, i) => (
                    <tr key={inst.id} className="font-medium text-slate-800">
                      <td className="py-1.5 pl-3 font-bold">Versement N°{i + 1}</td>
                      <td className="py-1.5 px-2 font-mono">{formatDate(inst.paymentDate)}</td>
                      <td className="py-1.5 px-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-[10px]">
                          {inst.paymentMethod} {inst.reference ? `(${inst.reference})` : ''}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 font-mono text-slate-500">{inst.receiptNumber}</td>
                      <td className="py-1.5 pr-3 text-right font-mono font-bold text-emerald-800">
                        {formatFCFA(inst.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 7. PIED DE PAGE : CACHET OFFICIEL & SIGNATURE */}
        <div className="pt-4 border-t-2 border-slate-800 flex items-end justify-between text-xs gap-4">
          <div className="space-y-1 max-w-[260px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Mention Obligatoire :</span>
            <p className="text-[10px] text-slate-500 leading-tight italic">
              Ce reçu certifie les versements effectués sous réserve d&apos;encaissement définitif. Aucun remboursement après validation.
            </p>
          </div>

          <div className="text-center space-y-1 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              Cachet Officiel & Direction
            </span>
            <div className="w-36 h-20 rounded-xl border-2 border-dashed border-emerald-600/70 bg-emerald-50/40 flex flex-col items-center justify-center p-1 text-emerald-900 shadow-2xs relative">
              <span className="text-[9px] font-black uppercase tracking-wider">{currentSchool.shortName || 'EPC MANOI'}</span>
              <span className="text-[8px] font-bold text-emerald-700">SERVICE COMPTABILITÉ</span>
              <span className="text-[8px] font-mono text-slate-500 mt-0.5">PAYÉ & CERTIFIÉ ✓</span>
              <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                <Building2 className="w-12 h-12 text-emerald-900" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Toast de notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-emerald-800 text-white shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 print:hidden">
          <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          <span className="font-bold text-xs">{toastMessage}</span>
        </div>
      )}

      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Réductions Spéciales & Reçus Automatiques
            </h1>
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs">
              {currentSchool.academicYear || '2026-2027'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Édition et impression instantanée des reçus officiels pour familles avec réductions et jusqu&apos;à 10 enfants.
          </p>
        </div>
      </div>

      {/* 2. Les 3 Blocs KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 print:hidden">
        {/* Card 1: Total Élèves Bénéficiaires */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Élèves Bénéficiaires Actifs
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-[26px] font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap">
                {globalKpis.totalBeneficiaries} élèves
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Familles réductions
              </span>
            </div>

            {/* Filles / Garçons */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-200/70 font-semibold text-[11px]">
                  ♀ {globalKpis.girlsCount} Filles
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/70 font-semibold text-[11px]">
                  ♂ {globalKpis.boysCount} Garçons
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-pink-400 h-full"
                  style={{ width: `${(globalKpis.girlsCount / (globalKpis.totalBeneficiaries || 1)) * 100}%` }}
                />
                <div
                  className="bg-blue-400 h-full"
                  style={{ width: `${(globalKpis.boysCount / (globalKpis.totalBeneficiaries || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Niveaux scolaires</span>
            <span className="font-semibold text-slate-700">Maternelle à 3ème</span>
          </div>
        </div>

        {/* Card 2: Volume Total Réduit (FCFA) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
                <BadgePercent className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Volume Total Réduit
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-[26px] font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap">
                {formatFCFA(globalKpis.totalDiscountVolume)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Budget social
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Remise moyenne accordée : <strong>{formatFCFA(Math.round(globalKpis.totalDiscountVolume / (globalKpis.totalBeneficiaries || 1)))}</strong> / élève
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-emerald-700 font-medium flex items-center justify-between">
            <span>Impact budgétaire</span>
            <span className="font-bold">Appliqué en caisse</span>
          </div>
        </div>

        {/* Card 3: Reçus Familles Enregistrés */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 shadow-xs">
                <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
                Reçus Familles Actifs
              </h3>
            </div>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl xl:text-[26px] font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap text-purple-950">
                {globalKpis.receiptsCount} Reçus
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Enregistrés
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Gestion centralisée des remises fratrie et règlements en caisse.
            </p>
          </div>
          <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-purple-700 font-medium flex items-center justify-between">
            <span>Édition de reçu</span>
            <span className="font-bold">Instantanée en caisse</span>
          </div>
        </div>
      </div>

      {/* 3. DISPOSITIF REÇU AUTOMATIQUE : FORMULAIRE À GAUCHE (5 COLS) + REÇU OFFICIEL À DROITE (7 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:hidden">
        
        {/* ================= PANNEAU DE CONTRÔLE / FORMULAIRE (5 COLONNES) ================= */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-5 print:hidden">
          
          <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <BadgePercent className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold font-heading text-slate-900 leading-tight">
                  Paramètres du Reçu
                </h2>
                <span className="text-[10px] font-mono font-bold text-emerald-800">
                  N° {receiptNumber}
                </span>
              </div>
            </div>

            {/* Historique des Reçus + Nouveau Reçu Vierge */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsReceiptDropdownOpen(!isReceiptDropdownOpen)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 hover:bg-slate-100 transition-all shadow-2xs cursor-pointer"
                  title="Consulter l'historique des reçus enregistrés"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Historique ({savedReceipts.length})</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isReceiptDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Reçus Enregistrés ({savedReceipts.length})</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Maternelle à 3ème</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 py-1">
                      {savedReceipts.map((rec, idx) => (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => handleSelectReceipt(idx)}
                          className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            selectedReceiptIndex === idx
                              ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200'
                              : 'hover:bg-slate-50 text-slate-700 font-medium'
                          }`}
                        >
                          <div className="space-y-0.5 truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-emerald-700 font-bold">{rec.receiptNumber}</span>
                              <span className="text-[10px] text-slate-400">({rec.children.length} enf.)</span>
                            </div>
                            <p className="truncate font-semibold text-slate-900">{rec.parentName}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[11px] font-mono font-bold text-slate-900 block">
                              {formatFCFA(rec.children.reduce((a, c) => a + c.tuitionAmount, 0) - rec.discountAmountFCFA)}
                            </span>
                            <span className="text-[10px] text-slate-400">{formatDate(rec.issueDate)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleResetNewReceipt}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all shadow-2xs cursor-pointer"
                title="Créer un nouveau reçu vierge"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Nouveau Vierge</span>
              </button>
            </div>
          </div>

          {/* SECTION 1 : COORDONNÉES DU PARENT & TÉLÉPHONE WHATSAPP */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
              1. Coordonnées du Responsable Légal
            </h3>
            
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Nom & Prénoms du Parent *</label>
              <input
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Ex : M. Kouadio Emmanuel"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-900 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Téléphone WhatsApp Principal */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-emerald-600" />
                  <span>Téléphone WhatsApp *</span>
                </label>
                <input
                  type="text"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="+225 07 48 92 11 00"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 font-mono text-slate-800 font-semibold"
                />
              </div>
              
              {/* Date d'inscription avec FrenchDateInput */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Date d&apos;inscription *</label>
                <FrenchDateInput
                  value={issueDate}
                  onChange={setIssueDate}
                />
              </div>
            </div>

            {/* Numéros de Téléphone Secondaires (Jusqu'à 3 numéros) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Autres Numéros de Contact ({1 + secondaryPhones.length}/3) :
                </span>
                {secondaryPhones.length < 2 && (
                  <button
                    type="button"
                    onClick={handleAddSecondaryPhone}
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
                    onChange={(e) => handleUpdateSecondaryPhone(pIdx, e.target.value)}
                    placeholder={`Numéro de contact ${pIdx + 2} (Ex : +225 05 01 22 33 44)`}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSecondaryPhone(pIdx)}
                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    title="Supprimer ce numéro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Adresse / Commune</label>
              <input
                type="text"
                value={parentAddress}
                onChange={(e) => setParentAddress(e.target.value)}
                placeholder="Ex : Abobo Biabou 2, Abidjan"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
              />
            </div>
          </div>

          {/* SECTION 2 : SYNTHÈSE & SAISIE FINANCIÈRE DIRECTE */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-heading flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>2. Synthèse & Saisie Financière</span>
              </h3>
              {(manualTotalAmountFCFA !== null || manualNetToPayFCFA !== null || manualPaidAmountFCFA !== null) && (
                <button
                  type="button"
                  onClick={() => {
                    setManualTotalAmountFCFA(null);
                    setManualNetToPayFCFA(null);
                    setManualPaidAmountFCFA(null);
                  }}
                  className="text-[10px] text-emerald-700 hover:underline"
                >
                  Recalculer auto
                </button>
              )}
            </div>

            {/* Les 4 Blocs de Saisie & Calculs en direct dans le panneau */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-900 text-white shadow-inner">
              {/* 1. Somme Totale */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 block">Somme Totale (FCFA)</label>
                <input
                  type="number"
                  value={totalBrutFCFA}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setManualTotalAmountFCFA(val);
                    setManualNetToPayFCFA(Math.max(0, val - discountAmountFCFA));
                  }}
                  className="w-full px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 font-mono font-extrabold text-white text-right focus:border-emerald-500"
                />
              </div>

              {/* 2. Réduction */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-amber-400 block">Réduction (FCFA)</label>
                <input
                  type="number"
                  value={discountAmountFCFA}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDiscountAmountFCFA(val);
                    setManualNetToPayFCFA(Math.max(0, totalBrutFCFA - val));
                  }}
                  className="w-full px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 font-mono font-extrabold text-amber-300 text-right focus:border-amber-500"
                />
              </div>

              {/* 3. Somme Net À Payer */}
              <div className="space-y-1 pt-1 border-t border-slate-800">
                <label className="text-[10px] uppercase font-bold text-emerald-400 block">Net À Payer (FCFA) *</label>
                <input
                  type="number"
                  value={netToPayFCFA}
                  onChange={(e) => setManualNetToPayFCFA(Number(e.target.value))}
                  className="w-full px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 font-mono font-extrabold text-emerald-400 text-right focus:border-emerald-500"
                />
              </div>

              {/* 4. Somme Versée */}
              <div className="space-y-1 pt-1 border-t border-slate-800">
                <label className="text-[10px] uppercase font-bold text-blue-400 block">Somme Versée (FCFA) *</label>
                <input
                  type="number"
                  value={totalPaidFCFA}
                  onChange={(e) => setManualPaidAmountFCFA(Number(e.target.value))}
                  className="w-full px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 font-mono font-extrabold text-white text-right focus:border-blue-500"
                />
              </div>
            </div>

            {/* BLOC RESTE À PAYER */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
              remainingBalanceFCFA === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold'
                : 'bg-amber-50 border-amber-200 text-amber-950 font-bold'
            }`}>
              <span className="uppercase text-[11px]">Reste À Payer (Solde) :</span>
              <span className="font-extrabold font-mono text-sm">
                {remainingBalanceFCFA === 0 ? '0 FCFA (SOLDÉ ✓)' : formatFCFA(remainingBalanceFCFA)}
              </span>
            </div>
          </div>

          {/* SECTION 3 : MOTIF DE RÉDUCTION */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
              3. Motif de la Réduction
            </h3>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Motif Accordé</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="Réduction 2 enfants">Réduction 2 enfants</option>
                <option value="Réduction 3 enfants">Réduction 3 enfants</option>
                <option value="Enfant du Personnel / Enseignant">Enfant du Personnel / Enseignant</option>
                <option value="Bourse au Mérite & Excellence">Bourse au Mérite & Excellence</option>
                <option value="Cas Social & Solidarité">Cas Social & Solidarité</option>
                <option value="Réduction Forfaitaire">Réduction Forfaitaire</option>
              </select>
            </div>

            {/* Taux de remise appliqué calculé automatiquement */}
            <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-emerald-50 text-emerald-950 border border-emerald-200/80">
              <span className="font-bold text-slate-700">Taux de remise appliqué :</span>
              <span className="font-extrabold text-sm font-heading text-emerald-700">
                {calculatedPercentage}%
              </span>
            </div>
          </div>

          {/* SECTION 4 : ENFANTS BÉNÉFICIAIRES */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                4. Enfants Inscrits ({children.length}/10)
              </h3>
              <button
                type="button"
                onClick={handleAddChild}
                disabled={children.length >= 10}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer disabled:opacity-40"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Ajouter un enfant</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {children.map((child, index) => (
                <div
                  key={child.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 relative group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={child.fullName}
                      onChange={(e) => handleUpdateChild(child.id, 'fullName', e.target.value)}
                      placeholder="Nom & Prénoms de l'enfant"
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-white border border-slate-200 font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                    />
                    {children.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveChild(child.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                        title="Supprimer cet enfant"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pl-7">
                    <select
                      value={child.grade}
                      onChange={(e) => handleUpdateChild(child.id, 'grade', e.target.value)}
                      className="px-2 py-1 text-[11px] rounded-lg bg-white border border-slate-200 font-medium text-slate-700"
                    >
                      {DEFAULT_CHILDREN_CLASSES.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={child.tuitionAmount}
                      onChange={(e) => handleUpdateChild(child.id, 'tuitionAmount', Number(e.target.value))}
                      placeholder="Montant scolarité"
                      className="px-2 py-1 text-[11px] font-mono font-bold text-slate-800 rounded-lg bg-white border border-slate-200 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 5 : HISTORIQUE DES VERSEMENTS */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                5. Versements Effectués ({installments.length}/5)
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePayInFull}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg border border-amber-300 transition-colors cursor-pointer"
                  title="Régler l'intégralité du solde en 1 versement unique"
                >
                  <Zap className="w-3 h-3" />
                  <span>Payer en totalité</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddInstallment}
                  disabled={installments.length >= 5}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Versement</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {installments.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Aucun versement enregistré. Cliquez sur « + Versement » ou « Payer en totalité ».
                </div>
              ) : (
                installments.map((inst, idx) => (
                  <div
                    key={inst.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-700">Versement N°{idx + 1}</span>
                      <input
                        type="number"
                        value={inst.amount}
                        onChange={(e) => handleUpdateInstallment(inst.id, 'amount', Number(e.target.value))}
                        className="w-28 px-2 py-1 rounded-lg bg-white border border-slate-200 font-mono font-bold text-emerald-800 text-right text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveInstallment(inst.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={inst.paymentDate}
                        onChange={(e) => handleUpdateInstallment(inst.id, 'paymentDate', e.target.value)}
                        className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-mono"
                      />
                      <select
                        value={inst.paymentMethod}
                        onChange={(e) => handleUpdateInstallment(inst.id, 'paymentMethod', e.target.value)}
                        className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-semibold"
                      >
                        <option value="Espèces">Espèces</option>
                        <option value="Orange Money">Orange Money</option>
                        <option value="MTN MoMo">MTN MoMo</option>
                        <option value="Wave">Wave</option>
                        <option value="Moov Money">Moov Money</option>
                        <option value="Virement">Virement</option>
                        <option value="Chèque">Chèque</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bouton de sauvegarde du reçu */}
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSaveReceipt}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileCheck className="w-4 h-4" />
              <span>Sauvegarder ce Reçu dans les Archives</span>
            </button>
          </div>
        </div>

        {/* ================= REÇU OFFICIEL EN DIRECT (7 COLONNES SUR ÉCRAN) ================= */}
        <div className="lg:col-span-7 space-y-4 print:hidden">
          {/* Barre d'action rapide sur le reçu */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Reçu actif :</span>
              <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                {receiptNumber}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
                title="Imprimer le reçu officiel sur une page A4"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                <span>Imprimer le Reçu</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsappWithImageCopy}
                disabled={isGeneratingImage}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-400 hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                title="Copier l'image HD du reçu dans le presse-papier et ouvrir WhatsApp"
              >
                {isGeneratingImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>{isGeneratingImage ? 'Capture en cours...' : 'Partager sur WhatsApp'}</span>
              </button>
            </div>
          </div>

          {/* Rendu du Reçu à l'écran */}
          {renderDiscountReceiptSlip()}
        </div>
      </div>

      {/* ================= SECTION D'IMPRESSION OFFICIELLE (1 SEUL REÇU PAR PAGE A4) ================= */}
      <div id="official-discount-receipt-print" className="hidden print:block print:w-full printable-receipt-area">
        {renderDiscountReceiptSlip('EXEMPLAIRE OFFICIEL')}
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
                    Photo HD du Reçu de Scolarité
                  </h3>
                  <p className="text-xs text-slate-500">
                    Parent : <strong className="text-slate-900 font-mono whitespace-nowrap">{whatsAppPreviewData.phone}</strong> ({whatsAppPreviewData.name})
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
                alt="Photo officielle du reçu de réduction"
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
                        `*Reçu Officiel de Scolarité — ${currentSchool.shortName || currentSchool.name || 'EPC MANOI'}*\n*N° Reçu :* ${receiptNumber}\n*Date :* ${formatDate(issueDate)}\n*Responsable Légal :* ${parentName}\n*Élèves Inscrits (${children.length}) :* ${children.map((c) => `${c.fullName || 'Élève'} (${c.grade})`).join(', ')}\n-------------------------------\n*Somme Totale :* ${formatFCFA(totalBrutFCFA)}\n*Réduction Spéciale :* -${formatFCFA(discountAmountFCFA)}\n*Net À Payer :* ${formatFCFA(netToPayFCFA)}\n*Somme Versée :* ${formatFCFA(totalPaidFCFA)}\n*Reste À Payer :* ${formatFCFA(remainingBalanceFCFA)}\n-------------------------------\n_(L'image HD du reçu est copiée : faites Coller / Ctrl+V directement dans WhatsApp)._\n\n_Reçu officiel certifié par le Service Comptabilité de ${currentSchool.shortName || currentSchool.name || 'EPC MANOI'}._`
                      )}`
                    : `https://wa.me/?text=${encodeURIComponent(
                        `*Reçu Officiel de Scolarité — ${currentSchool.shortName || currentSchool.name || 'EPC MANOI'}*\n*N° Reçu :* ${receiptNumber}\n*Date :* ${formatDate(issueDate)}\n*Responsable Légal :* ${parentName}\n*Élèves Inscrits (${children.length}) :* ${children.map((c) => `${c.fullName || 'Élève'} (${c.grade})`).join(', ')}\n-------------------------------\n*Somme Totale :* ${formatFCFA(totalBrutFCFA)}\n*Réduction Spéciale :* -${formatFCFA(discountAmountFCFA)}\n*Net À Payer :* ${formatFCFA(netToPayFCFA)}\n*Somme Versée :* ${formatFCFA(totalPaidFCFA)}\n*Reste À Payer :* ${formatFCFA(remainingBalanceFCFA)}\n-------------------------------\n_(L'image HD du reçu est copiée : faites Coller / Ctrl+V directement dans WhatsApp)._\n\n_Reçu officiel certifié par le Service Comptabilité de ${currentSchool.shortName || currentSchool.name || 'EPC MANOI'}._`
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
