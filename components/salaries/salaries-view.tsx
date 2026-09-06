'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { School } from '@/lib/data/types';
import { defaultSchool } from '@/lib/data/mock-data';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { getLiveSchool, getLiveStaffUsers, DATA_UPDATED_EVENT, StaffUser } from '@/lib/data/live-store';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import {
  Printer,
  Trash2,
  CheckCircle2,
  Receipt,
  Download,
  Eye,
  X,
  Sparkles,
  Check,
  User,
  Users,
  Wallet,
  Briefcase,
  FileSpreadsheet,
  Award,
  ChevronDown,
  Smartphone,
  Copy,
  Search,
} from 'lucide-react';

export interface SalaryPayment {
  id: string;
  receiptNumber: string;
  staffName: string;
  civility: 'Mr' | 'Mme' | 'Mlle';
  role: string;
  matricule: string;
  phone: string;
  payPeriod: string; // ex: "Octobre 2026"
  paymentDate: string; // JJ/MM/AAAA
  baseSalary: number; // in FCFA
  bonuses: number; // in FCFA (Primes & Heures sup)
  deductions: number; // in FCFA (Retenues & Avances)
  netSalary: number; // in FCFA
  paymentMethod: 'Virement bancaire' | 'Chèque' | 'Espèces' | 'Wave' | 'Orange Money' | 'MTN MoMo';
  transactionRef: string;
  authorizedBy: string;
  notes?: string;
  createdAt: string;
}

const STORAGE_KEY = 'schoolflow_staff_salaries_v1';

const EMPTY_SALARY: SalaryPayment = {
  id: '',
  receiptNumber: 'SAL-2026-001',
  civility: 'Mr',
  staffName: '—',
  role: 'Membre du personnel',
  matricule: 'EMP-001',
  phone: '—',
  payPeriod: 'Septembre 2026',
  paymentDate: '30/09/2026',
  baseSalary: 0,
  bonuses: 0,
  deductions: 0,
  netSalary: 0,
  paymentMethod: 'Virement bancaire',
  transactionRef: '—',
  authorizedBy: 'Direction Générale',
  notes: '',
  createdAt: '',
};

const PAY_PERIODS = [
  'Septembre 2026',
  'Octobre 2026',
  'Novembre 2026',
  'Décembre 2026',
  'Janvier 2027',
  'Février 2027',
  'Mars 2027',
  'Avril 2027',
  'Mai 2027',
  'Juin 2027',
];

interface SalariesViewProps {
  schoolSlug?: string;
  initialSchool?: School;
}

export function SalariesView({
  schoolSlug = 'college-excellence',
  initialSchool,
}: SalariesViewProps) {
  const [currentSchool, setCurrentSchool] = useState<School>(
    () => initialSchool || defaultSchool
  );

  const sanitizeSalaries = (list: SalaryPayment[]): SalaryPayment[] => {
    return (list || []).filter(
      (s) =>
        s &&
        !s.receiptNumber?.startsWith('SAL-2026-') &&
        !s.staffName?.includes('KOUAME KOUASSI') &&
        !s.staffName?.includes('TOURE ABOUBACAR') &&
        !s.staffName?.includes('MENSAH AKOUVI') &&
        !s.staffName?.includes('DIALLO SOULEYMANE') &&
        !s.staffName?.includes('BAMBA FATOU') &&
        !s.staffName?.includes('YAO BROU')
    );
  };

  const [salaries, setSalaries] = useState<SalaryPayment[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored =
          localStorage.getItem(`${STORAGE_KEY}_${schoolSlug}`) || localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return sanitizeSalaries(parsed);
        }
      } catch (e) {}
    }
    return [];
  });
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);

  // État du reçu actuellement sélectionné pour l'aperçu et l'impression
  const [selectedSalary, setSelectedSalary] = useState<SalaryPayment>(() => salaries[0] || EMPTY_SALARY);

  useEffect(() => {
    setCurrentSchool(getLiveSchool(schoolSlug, initialSchool || defaultSchool));
    setStaffUsers(getLiveStaffUsers(schoolSlug));
    try {
      const stored =
        localStorage.getItem(`${STORAGE_KEY}_${schoolSlug}`) || localStorage.getItem(STORAGE_KEY);
      const list = stored ? JSON.parse(stored) : [];
      const cleaned = sanitizeSalaries(list);
      if (cleaned.length !== list.length) {
        localStorage.setItem(`${STORAGE_KEY}_${schoolSlug}`, JSON.stringify(cleaned));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }
      setSalaries(cleaned);
      setSelectedSalary(cleaned[0] || EMPTY_SALARY);
    } catch (e) {}

    const handleUpdate = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, initialSchool || defaultSchool));
      setStaffUsers(getLiveStaffUsers(schoolSlug));
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY}_${schoolSlug}`) || localStorage.getItem(STORAGE_KEY);
        const list = stored ? JSON.parse(stored) : [];
        setSalaries(list);
        setSelectedSalary(list[0] || EMPTY_SALARY);
      } catch (e) {}
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, initialSchool]);

  const saveSalaries = (newList: SalaryPayment[]) => {
    setSalaries(newList);
    try {
      localStorage.setItem(`${STORAGE_KEY}_${schoolSlug}`, JSON.stringify(newList));
      if (schoolSlug === 'epc-manoi' || schoolSlug === 'college-excellence') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
      }
      window.dispatchEvent(new Event(DATA_UPDATED_EVENT));
    } catch (e) {}
  };

  // Formulaire d'enregistrement
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [civility, setCivility] = useState<'Mr' | 'Mme' | 'Mlle'>('Mr');
  const [staffName, setStaffName] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [matricule, setMatricule] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [payPeriod, setPayPeriod] = useState<string>('Septembre 2026');
  const [paymentDate, setPaymentDate] = useState<string>('30/09/2026');
  const [baseSalary, setBaseSalary] = useState<number | ''>('');
  const [bonuses, setBonuses] = useState<number | ''>('');
  const [deductions, setDeductions] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'Virement bancaire' | 'Chèque' | 'Espèces' | 'Wave' | 'Orange Money' | 'MTN MoMo'>('Virement bancaire');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [authorizedBy, setAuthorizedBy] = useState<string>('Direction Générale');
  const [notes, setNotes] = useState<string>('');

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Synchronisation lors du choix d'un membre du personnel existant
  const handleStaffSelect = (staffId: string) => {
    setSelectedStaffId(staffId);
    if (!staffId) return;
    const found = staffUsers.find((s) => s.id === staffId);
    if (found) {
      const parts = found.fullName.split(' ');
      if (parts[0] === 'Mr' || parts[0] === 'M.' || parts[0] === 'Mme' || parts[0] === 'Mlle') {
        setCivility(parts[0] === 'M.' ? 'Mr' : (parts[0] as any));
        setStaffName(parts.slice(1).join(' '));
      } else {
        setStaffName(found.fullName);
      }
      setRole(found.role || found.subjectOrGrade || 'Membre du Personnel');
      setMatricule(found.authCode ? `EMP-${found.authCode}` : `EMP-${found.id}`);
      setPhone(found.phone || '+225 07 00 00 00 00');
    }
  };

  // Calcul du net à payer
  const calculatedNet = Math.max(0, Number(baseSalary || 0) + Number(bonuses || 0) - Number(deductions || 0));

  // Soumission du paiement de salaire
  const handleCreateSalary = (e: React.FormEvent) => {
    e.preventDefault();

    if (!staffName.trim()) {
      showToast('⚠️ Veuillez renseigner le nom et prénoms du bénéficiaire.');
      return;
    }

    const nextIndex = salaries.length + 1;
    const recNum = `SAL-2026-${String(nextIndex).padStart(3, '0')}`;
    const cleanRef = transactionRef.trim() || `PAY-${paymentMethod.slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const newPayment: SalaryPayment = {
      id: `sal-${Date.now()}`,
      receiptNumber: recNum,
      civility: civility,
      staffName: staffName.trim(),
      role: role.trim() || 'Enseignant / Personnel',
      matricule: matricule.trim() || `EMP-2026-${String(nextIndex).padStart(3, '0')}`,
      phone: phone.trim() || '+225 07 00 00 00 00',
      payPeriod: payPeriod,
      paymentDate: paymentDate || '30/09/2026',
      baseSalary: Number(baseSalary) || 0,
      bonuses: Number(bonuses) || 0,
      deductions: Number(deductions) || 0,
      netSalary: calculatedNet,
      paymentMethod: paymentMethod,
      transactionRef: cleanRef,
      authorizedBy: authorizedBy.trim() || 'Direction Générale',
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [newPayment, ...salaries];
    saveSalaries(updated);
    setSelectedSalary(newPayment);
    showToast(`✅ Bulletin & Reçu de salaire ${recNum} généré avec succès pour ${civility} ${staffName} !`);

    // Reset partiel
    setTransactionRef('');
    setNotes('');
  };

  const handleDeleteSalary = (id: string, recNum: string) => {
    if (confirm(`Confirmez-vous la suppression du reçu de salaire ${recNum} ?`)) {
      const filtered = salaries.filter((s) => s.id !== id);
      saveSalaries(filtered);
      if (selectedSalary.id === id && filtered.length > 0) {
        setSelectedSalary(filtered[0]);
      } else if (filtered.length === 0) {
        setSelectedSalary(EMPTY_SALARY);
      }
      showToast(`🗑️ Reçu de salaire ${recNum} supprimé.`);
    }
  };

  // Filtrage des salaires
  const filteredSalaries = useMemo(() => {
    return salaries.filter((sal) => {
      const matchSearch =
        sal.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sal.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sal.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sal.matricule.toLowerCase().includes(searchQuery.toLowerCase());

      const matchPeriod = periodFilter === 'ALL' || sal.payPeriod === periodFilter;

      return matchSearch && matchPeriod;
    });
  }, [salaries, searchQuery, periodFilter]);

  // Statistiques globales
  const totalMasseSalariale = useMemo(() => {
    return salaries.reduce((sum, s) => sum + s.netSalary, 0);
  }, [salaries]);

  const totalPrimes = useMemo(() => {
    return salaries.reduce((sum, s) => sum + s.bonuses, 0);
  }, [salaries]);

  const totalDeductions = useMemo(() => {
    return salaries.reduce((sum, s) => sum + s.deductions, 0);
  }, [salaries]);

  const [whatsAppPreviewData, setWhatsAppPreviewData] = useState<{
    imageUrl: string;
    blob: Blob;
    fileName: string;
    phone: string;
    cleanPhone: string;
    name: string;
  } | null>(null);
  const [isCapturingWhatsApp, setIsCapturingWhatsApp] = useState(false);
  const receiptCardRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyReceiptImageToClipboard = async (blob: Blob) => {
    try {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({
            'image/png': blob,
          }),
        ]);
        showToast('✓ Image du reçu copiée dans le presse-papier ! Vous pouvez faire Coller (Ctrl + V) dans WhatsApp.');
      } else {
        showToast('ℹ️ Image HD du reçu prête pour WhatsApp.');
      }
    } catch (err) {
      console.warn('Copie presse-papier:', err);
    }
  };

  const handleShareWhatsApp = async () => {
    const receiptElement = receiptCardRef.current || document.getElementById('salary-receipt-card');
    if (!receiptElement) return;

    setIsCapturingWhatsApp(true);
    showToast('📸 Capture HD du bulletin de salaire en cours...');

    try {
      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 8000,
      });

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
          console.warn('dataUrl fallback error:', fetchErr);
        }
      }

      if (!blob) {
        setIsCapturingWhatsApp(false);
        showToast('⚠️ Erreur lors de la capture du reçu.');
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
        } catch (err) {
          console.warn('Clipboard write fallback:', err);
        }
      }

      // 2. Afficher la modale de prévisualisation et partage WhatsApp
      const imageUrl = URL.createObjectURL(blob);
      const cleanPhone = (selectedSalary.phone || '').replace(/[^0-9]/g, '');
      setWhatsAppPreviewData({
        imageUrl,
        blob,
        fileName: `Bulletin_Salaire_${selectedSalary.receiptNumber}_${(selectedSalary.staffName || 'Personnel').replace(/\s+/g, '_')}.png`,
        phone: selectedSalary.phone || '+225 --',
        cleanPhone,
        name: `${selectedSalary.civility} ${selectedSalary.staffName}`,
      });

      showToast('✅ Le reçu automatique a été déjà copié dans votre presse-papiers ! Vous pouvez maintenant aller sur WhatsApp et faire Coller (Ctrl + V).');
      setIsCapturingWhatsApp(false);
    } catch (err) {
      console.error('Erreur génération image reçu:', err);
      setIsCapturingWhatsApp(false);
      showToast('⚠️ Erreur lors de la capture du reçu.');
    }
  };

  const renderSalaryReceiptSlip = (badgeLabel?: string, isPrint = false) => {
    return (
      <div
        ref={isPrint ? undefined : receiptCardRef}
        id={isPrint ? "salary-receipt-card-print" : "salary-receipt-card"}
        className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-300 shadow-xl relative overflow-hidden text-slate-800 space-y-5 printable-receipt-area print:p-4 print:border-none print:shadow-none print:w-full print:m-0"
      >
        {/* 1. EN-TÊTE OFFICIEL DE L'ÉTABLISSEMENT — 3 COLONNES CENTRÉES */}
        <div className="flex items-center justify-between gap-3 sm:gap-4 border-b-2 border-slate-800 pb-4 relative z-10">
          {/* Gauche : Logo École */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-slate-200 p-1.5 shrink-0 flex items-center justify-center overflow-hidden shadow-2xs">
            {currentSchool.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentSchool.logoUrl}
                alt="Logo École"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-base font-black text-emerald-800">
                {currentSchool.shortName?.slice(0, 3) || 'EPC'}
              </span>
            )}
          </div>

          {/* Centre : Nom Officiel + Sigle Centré, Slogan, Situation & Code MENA */}
          <div className="text-center flex-1 px-2 space-y-1">
            <h3
              suppressHydrationWarning
              className="text-xs sm:text-sm md:text-base font-black text-slate-900 font-heading uppercase tracking-tight leading-snug"
            >
              {currentSchool.name}
            </h3>

            {currentSchool.shortName && (
              <p
                suppressHydrationWarning
                className="text-xs sm:text-sm font-extrabold text-emerald-800 font-heading tracking-wider"
              >
                ({currentSchool.shortName})
              </p>
            )}

            <p
              suppressHydrationWarning
              className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 italic"
            >
              « {currentSchool.receiptHeaderSlogan || currentSchool.slogan || currentSchool.motto || "Faisons de nos enfants les élites de demain."} »
            </p>

            <p suppressHydrationWarning className="text-[9.5px] sm:text-[10px] text-slate-600">
              Situation : {currentSchool.district || currentSchool.city || 'Abobo Biabou 2'} • Tél : {currentSchool.phone || '+225 01 02 61 14 09'}
            </p>

            <div className="inline-block bg-slate-900 text-white text-[9.5px] sm:text-[10px] font-mono font-bold px-3 py-0.5 rounded-md shadow-2xs">
              Code Établissement : {currentSchool.ministryCode || currentSchool.menaCode || '321119'}
            </div>
          </div>

          {/* Droite : Armoiries / Emblème du Pays */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center p-1 shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentSchool.countryEmblemUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png'}
              alt="Armoiries Nationales"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* 2. TITRE PRINCIPAL DU REÇU */}
        <div className="text-center space-y-1 relative z-10 py-1">
          <div className="inline-block px-4 py-1 rounded-full bg-slate-900 text-white font-heading text-xs sm:text-sm font-extrabold uppercase tracking-wider shadow-sm">
            BULLETIN & REÇU DE PAIEMENT DE SALAIRE {badgeLabel ? `— ${badgeLabel}` : ''}
          </div>
          <div className="flex items-center justify-center gap-3 text-xs font-mono">
            <span className="font-bold text-slate-700">N° Quittance :</span>
            <span className="font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
              {selectedSalary.receiptNumber}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 font-sans">Date : <strong>{selectedSalary.paymentDate}</strong></span>
          </div>
        </div>

        {/* 3. CADRE IDENTITÉ DU SALARIÉ / ENSEIGNANT */}
        <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200 relative z-10 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10.5px] text-slate-500 font-medium block">Nom & Prénoms du Salarié :</span>
              <span className="text-sm font-extrabold text-slate-900 font-heading">
                {selectedSalary.civility} {selectedSalary.staffName}
              </span>
            </div>
            <div>
              <span className="text-[10.5px] text-slate-500 font-medium block">Fonction / Poste occupé :</span>
              <span className="text-xs font-bold text-slate-800">
                {selectedSalary.role}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 font-medium block">Matricule Employé :</span>
              <span className="font-mono font-bold text-slate-900">{selectedSalary.matricule}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-medium block">Mois de Traitement :</span>
              <span className="font-bold text-emerald-800">{selectedSalary.payPeriod}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-medium block">Mode de Règlement :</span>
              <span className="font-semibold text-slate-800">{selectedSalary.paymentMethod}</span>
            </div>
          </div>
        </div>

        {/* 4. TABLEAU DE DÉCOMPTE COMPTABLE DU SALAIRE */}
        <div className="border border-slate-300 rounded-2xl overflow-hidden relative z-10">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-300">
              <tr>
                <th className="py-2.5 px-4 text-left">Désignation & Rubriques</th>
                <th className="py-2.5 px-3 text-right">Gains (FCFA)</th>
                <th className="py-2.5 px-4 text-right">Retenues (FCFA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2 px-4 font-semibold text-slate-900">Salaire de Base Brut Mensuel</td>
                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatFCFA(selectedSalary.baseSalary)}</td>
                <td className="py-2 px-4 text-right font-mono text-slate-400">-</td>
              </tr>
              {selectedSalary.bonuses > 0 && (
                <tr className="bg-emerald-50/40">
                  <td className="py-2 px-4 font-semibold text-emerald-900">
                    + Primes de Rendement, Indemnités & Heures Sup.
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">+{formatFCFA(selectedSalary.bonuses)}</td>
                  <td className="py-2 px-4 text-right font-mono text-slate-400">-</td>
                </tr>
              )}
              {selectedSalary.deductions > 0 && (
                <tr className="bg-rose-50/40">
                  <td className="py-2 px-4 font-semibold text-rose-900">
                    - Retenues & Avances sur Salaire
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-slate-400">-</td>
                  <td className="py-2 px-4 text-right font-mono font-bold text-rose-700">-{formatFCFA(selectedSalary.deductions)}</td>
                </tr>
              )}
              {/* Ligne TOTAL NET */}
              <tr className="bg-slate-900 text-white font-extrabold">
                <td className="py-3 px-4 uppercase tracking-wider text-xs font-heading">
                  NET TOTAL VERSÉ AU SALARIÉ
                </td>
                <td colSpan={2} className="py-3 px-4 text-right font-mono text-base sm:text-lg font-heading text-amber-300">
                  {formatFCFA(selectedSalary.netSalary)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Observations / Référence */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <span className="text-slate-600">
            Réf. Pièce : <strong className="font-mono text-slate-900">{selectedSalary.transactionRef}</strong>
          </span>
          <span className="text-slate-600">
            Ordonnancé par : <strong className="text-slate-900">{selectedSalary.authorizedBy}</strong>
          </span>
        </div>

        {/* 5. DOUBLE BLOC DES SIGNATURES & CACHET OFFICIEL */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-slate-200 relative z-10">
          {/* Signature Salarié */}
          <div className="space-y-1 text-center">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 block">
              L&apos;Employé(e) / Bénéficiaire
            </span>
            <p className="text-[9px] text-slate-400 italic">
              « Lu, approuvé et certifié exact »
            </p>
            <div className="h-20 flex items-end justify-center pb-1">
              <span className="text-[10px] font-mono text-slate-400">Émargement</span>
            </div>
          </div>

          {/* Signature & Cachet Comptabilité Générale */}
          <div className="space-y-1 text-center">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-900 block">
              L&apos;Économe / Comptabilité Générale
            </span>
            <p className="text-[9px] text-emerald-800 font-bold">
              Service Comptabilité & Finances
            </p>
            <div className="h-20 flex items-center justify-center relative">
              {/* Tampon / Cachet Officiel de l'école */}
              <div className="w-28 h-16 rounded-xl border-2 border-dashed border-emerald-600/70 bg-emerald-50/60 flex flex-col items-center justify-center p-1 transform rotate-[-3deg] shadow-xs">
                <span className="text-[7.5px] font-black text-emerald-900 uppercase tracking-tighter">
                  {currentSchool.shortName || currentSchool.name || 'EPC MANOI'}
                </span>
                <span className="text-[7px] font-bold text-emerald-700 uppercase">
                  COMPTABILITÉ GÉNÉRALE
                </span>
                <span className="text-[7.5px] font-extrabold text-emerald-800">
                  PAYÉ LE {selectedSalary.paymentDate}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bas de page légal */}
        <div className="pt-2 text-center text-[9px] text-slate-400 border-t border-slate-100">
          Ce document officiel tient lieu de quittance libératoire de salaire pour la période indiquée. Émis via SchoolFlow Africa.
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-7 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-emerald-700 text-white shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 border border-emerald-500 print:hidden">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ═══════════════ EN-TÊTE DE LA PAGE ═══════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading tracking-tight">
              Salaires du Personnel & Reçus
            </h1>
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs">
              {currentSchool.academicYear || '2026-2027'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-sans">
            Émission des bulletins de paie certifiés, quittances de salaires et gestion des rémunérations en <strong className="text-slate-800">FCFA</strong>.
          </p>
        </div>
      </div>

      {/* ═══════════════ 4 CARTES KPI STATISTIQUES FINANCIÈRES ═══════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 print:hidden">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-heading">
                Masse Salariale Versée
              </h3>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading tracking-tight mt-0.5">
                {formatFCFA(totalMasseSalariale)}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-md self-start border border-emerald-200">
            Total {salaries.length} salaires versés
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-heading">
                Bulletins & Reçus Émis
              </h3>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading tracking-tight mt-0.5">
                {salaries.length}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-md self-start border border-blue-200">
            Personnel & Enseignants
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-heading">
                Primes & Heures Sup.
              </h3>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading tracking-tight mt-0.5">
                {formatFCFA(totalPrimes)}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-md self-start border border-amber-200">
            Bonifications & coordinations
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-heading">
                Retenues & Avances
              </h3>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading tracking-tight mt-0.5">
                {formatFCFA(totalDeductions)}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-rose-700 font-semibold bg-rose-50 px-2.5 py-0.5 rounded-md self-start border border-rose-200">
            Avances sur salaire déduites
          </span>
        </div>
      </div>

      {/* ═══════════════ GRILLE PRINCIPALE (FORMULAIRE À GAUCHE + REÇU AUTOMATIQUE À DROITE) ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start print:hidden">
        
        {/* ================= COLONNE GAUCHE (5 COLONNES) : FORMULAIRE DE SAISIE DE SALAIRE ================= */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs space-y-5 print:hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 font-heading">
                Paiement de Salaire & Quittance
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Saisie libre & dynamique
            </span>
          </div>

          <form onSubmit={handleCreateSalary} className="space-y-4">
            {/* Sélection d'un membre existant */}
            {staffUsers.length > 0 && (
              <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-1.5">
                <label className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Remplissage automatique depuis la liste du Personnel :</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedStaffId}
                    onChange={(e) => handleStaffSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-300 text-xs font-bold text-slate-900 cursor-pointer shadow-2xs appearance-none"
                  >
                    <option value="">Sélectionner un enseignant / membre du personnel...</option>
                    {staffUsers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} — {s.role || s.subjectOrGrade || 'Personnel'} ({s.phone || 'Sans tél'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Civilité & Nom */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block text-[11px]">
                Civilité, Nom et Prénoms du Bénéficiaire *
              </label>
              <div className="flex gap-2">
                <div className="w-20 shrink-0">
                  <select
                    value={civility}
                    onChange={(e) => setCivility(e.target.value as any)}
                    className="w-full px-2 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-bold text-slate-900 cursor-pointer text-center"
                  >
                    <option value="Mr">Mr</option>
                    <option value="Mme">Mme</option>
                    <option value="Mlle">Mlle</option>
                  </select>
                </div>
                <div className="relative flex-1">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="Ex : KONATE Lassina Mouhamed"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Fonction & Matricule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px]">
                  Poste / Fonction *
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Ex : Professeur de Mathématiques"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px]">
                  N° Matricule / Code Employé
                </label>
                <input
                  type="text"
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value)}
                  placeholder="Ex : EMP-2026-001"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-medium text-slate-900"
                />
              </div>
            </div>

            {/* Téléphone WhatsApp Salarié */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block text-[11px] flex items-center justify-between">
                <span>Téléphone / WhatsApp du Salarié</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Pour envoi du reçu</span>
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex : +225 07 45 88 99 00"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-medium text-slate-900"
                />
              </div>
            </div>

            {/* Période du Salaire & Date de Paiement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px]">
                  Mois de Traitement *
                </label>
                <select
                  value={payPeriod}
                  onChange={(e) => setPayPeriod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-bold text-slate-900 cursor-pointer"
                >
                  {PAY_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px]">
                  Date de Versement *
                </label>
                <FrenchDateInput
                  value={paymentDate}
                  onChange={setPaymentDate}
                />
              </div>
            </div>

            {/* Rubriques Financières : Salaire de Base, Primes, Retenues */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 font-heading">
                  Rubriques & Décompte Financier (FCFA)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">En FCFA</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 block">
                    Salaire de Base Brut *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={baseSalary === 0 ? '' : baseSalary}
                    onChange={(e) => setBaseSalary(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-2.5 py-2 rounded-xl bg-white border border-slate-300 focus:border-emerald-600 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700 block">
                    + Primes / Heures Sup.
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={bonuses === 0 ? '' : bonuses}
                    onChange={(e) => setBonuses(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-2.5 py-2 rounded-xl bg-white border border-slate-300 focus:border-emerald-600 text-xs font-mono font-bold text-emerald-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-rose-700 block">
                    - Retenues / Avance
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={deductions === 0 ? '' : deductions}
                    onChange={(e) => setDeductions(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-2.5 py-2 rounded-xl bg-white border border-slate-300 focus:border-rose-600 text-xs font-mono font-bold text-rose-800"
                  />
                </div>
              </div>

              {/* Ligne Net à Payer */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800">
                  Net à Verser au Salarié :
                </span>
                <span className="text-sm font-extrabold font-heading text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-xl border border-emerald-200">
                  {formatFCFA(calculatedNet)}
                </span>
              </div>
            </div>

            {/* Mode de Paiement & Référence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px]">
                  Mode de Règlement *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-bold text-slate-900 cursor-pointer"
                >
                  <option value="Virement bancaire">Virement bancaire</option>
                  <option value="Wave">Wave Mobile</option>
                  <option value="Orange Money">Orange Money</option>
                  <option value="MTN MoMo">MTN MoMo</option>
                  <option value="Chèque">Chèque Bancaire</option>
                  <option value="Espèces">Espèces en Caisse</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px]">
                  N° Transaction / Pièce
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="Ex : VIR-SGCI-992140"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-medium text-slate-900"
                />
              </div>
            </div>

            {/* Autorisé Par & Observations */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block text-[11px]">
                Validé & Ordonnancé par
              </label>
              <input
                type="text"
                value={authorizedBy}
                onChange={(e) => setAuthorizedBy(e.target.value)}
                placeholder="Ex : Direction Générale / Fondateur"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block text-[11px]">
                Observations / Motifs (Optionnel)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex : Heures de renforcement classe de 3ème + prime d'assiduité."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900"
              />
            </div>

            {/* Bouton de Soumission */}
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Valider le Salaire & Générer le Reçu Officiel</span>
            </button>
          </form>
        </div>

        {/* ================= COLONNE DROITE (7 COLONNES) : BULLETIN & REÇU OFFICIEL SUR ÉCRAN ================= */}
        <div className="lg:col-span-7 space-y-4 print:hidden">
          {/* Barre d'action rapide sur le reçu */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Reçu sélectionné :</span>
              <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                {selectedSalary.receiptNumber}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Bouton Imprimer Reçu */}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
                title="Imprimer uniquement ce bulletin et reçu de salaire"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                <span>Imprimer le Reçu</span>
              </button>

              {/* Bouton Partager sur WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                disabled={isCapturingWhatsApp}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-400 hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                title="Copier l'image HD du reçu dans le presse-papier et ouvrir WhatsApp"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isCapturingWhatsApp ? 'Capture en cours...' : 'Partager sur WhatsApp'}</span>
              </button>
            </div>
          </div>

          {/* Rendu du Reçu à l'écran */}
          {renderSalaryReceiptSlip()}
        </div>
      </div>

      {/* ================= SECTION D'IMPRESSION OFFICIELLE (1 SEUL REÇU PAR PAGE A4) ================= */}
      <div id="official-salary-receipt-print" className="hidden print:block print:w-full printable-receipt-area">
        {renderSalaryReceiptSlip('EXEMPLAIRE OFFICIEL', true)}
      </div>

      {/* ================= TABLEAU RÉCAPITULATIF DE TOUS LES SALAIRES VERSÉS ================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-heading">
              Historique des Salaires & Rémunérations ({filteredSalaries.length})
            </h2>
            <p className="text-xs text-slate-500">
              Consultez, recherchez ou réimprimez les bulletins de salaire émis.
            </p>
          </div>

          {/* Filtres de recherche */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher salarié, rôle, reçu..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800"
              />
            </div>

            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <option value="ALL">Tous les mois</option>
              {PAY_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10.5px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">N° Reçu</th>
                <th className="py-3 px-3.5">Salarié / Bénéficiaire</th>
                <th className="py-3 px-3.5">Poste / Fonction</th>
                <th className="py-3 px-3.5">Période</th>
                <th className="py-3 px-3.5 text-right">Salaire Net</th>
                <th className="py-3 px-3.5">Règlement</th>
                <th className="py-3 px-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredSalaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Aucun salaire trouvé pour cette sélection.
                  </td>
                </tr>
              ) : (
                filteredSalaries.map((sal) => {
                  const isSelected = selectedSalary.id === sal.id;
                  return (
                    <tr
                      key={sal.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                        {sal.receiptNumber}
                      </td>
                      <td className="py-3 px-3.5 font-bold text-slate-900">
                        {sal.civility} {sal.staffName}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600">{sal.role}</td>
                      <td className="py-3 px-3.5 font-semibold text-emerald-800">
                        {sal.payPeriod}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                        {formatFCFA(sal.netSalary)}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {sal.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSalary(sal);
                              window.scrollTo({ top: 300, behavior: 'smooth' });
                            }}
                            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                            title="Afficher et imprimer le reçu"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSalary(sal.id, sal.receiptNumber)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
                    Photo HD du Bulletin de Salaire
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bénéficiaire : <strong className="text-slate-900 font-mono whitespace-nowrap">{whatsAppPreviewData.phone}</strong> ({whatsAppPreviewData.name})
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
                alt="Photo officielle du reçu de salaire"
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
                  Vous pouvez maintenant aller directement sur WhatsApp et faire <strong>Coller (Ctrl + V)</strong> dans la discussion pour envoyer le bulletin officiel.
                </p>
              </div>
            </div>

            {/* Actions principales */}
            <div className="space-y-2 pt-1">
              <a
                href={
                  whatsAppPreviewData.cleanPhone
                    ? `https://wa.me/${whatsAppPreviewData.cleanPhone}?text=${encodeURIComponent(
                        `📋 *${(currentSchool.name || 'ÉTABLISSEMENT SCOLAIRE').toUpperCase()}*\n🧾 *BULLETIN & REÇU OFFICIEL DE SALAIRE N° ${selectedSalary.receiptNumber}*\n👤 Bénéficiaire : *${selectedSalary.civility} ${selectedSalary.staffName}* (${selectedSalary.role})\n🆔 Matricule : *${selectedSalary.matricule}*\n📅 Période : *${selectedSalary.payPeriod}*\n💰 *NET VERSÉ : ${formatFCFA(selectedSalary.netSalary)}*\n\n_(L'image HD du reçu est copiée : faites Coller / Ctrl+V directement dans WhatsApp)._\n\n_Quittance officielle délivrée par le Service Comptabilité & Finances._`
                      )}`
                    : `https://wa.me/?text=${encodeURIComponent(
                        `📋 *${(currentSchool.name || 'ÉTABLISSEMENT SCOLAIRE').toUpperCase()}*\n🧾 *BULLETIN & REÇU OFFICIEL DE SALAIRE N° ${selectedSalary.receiptNumber}*\n👤 Bénéficiaire : *${selectedSalary.civility} ${selectedSalary.staffName}* (${selectedSalary.role})\n🆔 Matricule : *${selectedSalary.matricule}*\n📅 Période : *${selectedSalary.payPeriod}*\n💰 *NET VERSÉ : ${formatFCFA(selectedSalary.netSalary)}*\n\n_(L'image HD du reçu est copiée : faites Coller / Ctrl+V directement dans WhatsApp)._\n\n_Quittance officielle délivrée par le Service Comptabilité & Finances._`
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
