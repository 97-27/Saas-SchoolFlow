'use client';

import React, { useState, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { School } from '@/lib/data/types';
import { defaultSchool } from '@/lib/data/mock-data';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { getLiveSchool, getLiveStaffUsers, DATA_UPDATED_EVENT, StaffUser } from '@/lib/data/live-store';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import {
  DollarSign,
  PlusCircle,
  Search,
  RotateCcw,
  Printer,
  FileCheck,
  Building2,
  Calendar,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Receipt,
  Download,
  Eye,
  X,
  Sparkles,
  Layers,
  Check,
  User,
  Users,
  Wallet,
  Briefcase,
  ReceiptText,
  FileSpreadsheet,
  Award,
  ChevronDown,
  Clock,
  ShieldCheck,
  MessageSquare,
  Share2,
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

const DEFAULT_SALARIES: SalaryPayment[] = [
  {
    id: 'sal-001',
    receiptNumber: 'SAL-2026-001',
    civility: 'Mr',
    staffName: 'Kouamé Konan',
    role: 'Professeur de Mathématiques & Sciences',
    matricule: 'ENS-2026-004',
    phone: '+225 07 48 92 11 00',
    payPeriod: 'Septembre 2026',
    paymentDate: '30/09/2026',
    baseSalary: 280000,
    bonuses: 35000,
    deductions: 0,
    netSalary: 315000,
    paymentMethod: 'Virement bancaire',
    transactionRef: 'VIR-BNI-984210',
    authorizedBy: 'Direction Générale',
    notes: 'Salaire complet + prime de rentrée scolaire et coordination de niveau 3ème.',
    createdAt: '2026-09-30T10:00:00Z',
  },
  {
    id: 'sal-002',
    receiptNumber: 'SAL-2026-002',
    civility: 'Mme',
    staffName: 'Aïcha Diop',
    role: 'Comptable & Responsable Caisse',
    matricule: 'CPT-2026-003',
    phone: '+225 07 33 44 55 66',
    payPeriod: 'Septembre 2026',
    paymentDate: '30/09/2026',
    baseSalary: 320000,
    bonuses: 25000,
    deductions: 10000,
    netSalary: 335000,
    paymentMethod: 'Wave',
    transactionRef: 'WAVE-PAY-88231',
    authorizedBy: 'Fondateur',
    notes: 'Salaire mensuel de gestion et suivi des encaissements scolarités.',
    createdAt: '2026-09-30T11:30:00Z',
  },
  {
    id: 'sal-003',
    receiptNumber: 'SAL-2026-003',
    civility: 'Mme',
    staffName: 'Mariam Traoré',
    role: 'Secrétaire de Direction & Accueil',
    matricule: 'SEC-2026-005',
    phone: '+225 07 55 66 77 88',
    payPeriod: 'Septembre 2026',
    paymentDate: '30/09/2026',
    baseSalary: 220000,
    bonuses: 15000,
    deductions: 0,
    netSalary: 235000,
    paymentMethod: 'Espèces',
    transactionRef: 'CAISSE-ESP-0941',
    authorizedBy: 'Direction Générale',
    notes: 'Rémunération mensuelle secrétariat & gestion des inscriptions.',
    createdAt: '2026-09-30T14:00:00Z',
  },
  {
    id: 'sal-004',
    receiptNumber: 'SAL-2026-004',
    civility: 'Mr',
    staffName: 'Jean-Marc Kouassi',
    role: 'Directeur Général des Études',
    matricule: 'DIR-2026-001',
    phone: '+225 07 45 67 89 01',
    payPeriod: 'Septembre 2026',
    paymentDate: '30/09/2026',
    baseSalary: 550000,
    bonuses: 50000,
    deductions: 0,
    netSalary: 600000,
    paymentMethod: 'Virement bancaire',
    transactionRef: 'VIR-SGCI-441029',
    authorizedBy: 'Conseil d\'Administration',
    notes: 'Traitement de direction générale et primes de supervision pédagogique.',
    createdAt: '2026-09-30T09:00:00Z',
  },
];

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

  const [salaries, setSalaries] = useState<SalaryPayment[]>(DEFAULT_SALARIES);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);

  useEffect(() => {
    setCurrentSchool(getLiveSchool(schoolSlug, initialSchool || defaultSchool));
    setStaffUsers(getLiveStaffUsers());
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSalaries(JSON.parse(stored));
    } catch (e) {}

    const handleUpdate = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, initialSchool || defaultSchool));
      setStaffUsers(getLiveStaffUsers());
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setSalaries(JSON.parse(stored));
      } catch (e) {}
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, initialSchool]);

  const saveSalaries = (newList: SalaryPayment[]) => {
    setSalaries(newList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
      window.dispatchEvent(new Event(DATA_UPDATED_EVENT));
    } catch (e) {}
  };

  // État du reçu actuellement sélectionné pour l'aperçu et l'impression
  const [selectedSalary, setSelectedSalary] = useState<SalaryPayment>(() => salaries[0] || DEFAULT_SALARIES[0]);

  // Formulaire d'enregistrement
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [civility, setCivility] = useState<'Mr' | 'Mme' | 'Mlle'>('Mr');
  const [staffName, setStaffName] = useState<string>('');
  const [role, setRole] = useState<string>('Professeur de Mathématiques');
  const [matricule, setMatricule] = useState<string>('ENS-2026-004');
  const [phone, setPhone] = useState<string>('+225 07 00 00 00 00');
  const [payPeriod, setPayPeriod] = useState<string>('Octobre 2026');
  const [paymentDate, setPaymentDate] = useState<string>('31/10/2026');
  const [baseSalary, setBaseSalary] = useState<number>(280000);
  const [bonuses, setBonuses] = useState<number>(20000);
  const [deductions, setDeductions] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Virement bancaire' | 'Chèque' | 'Espèces' | 'Wave' | 'Orange Money' | 'MTN MoMo'>('Virement bancaire');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [authorizedBy, setAuthorizedBy] = useState<string>('Direction Générale');
  const [notes, setNotes] = useState<string>('');

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
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
      paymentDate: paymentDate || '31/10/2026',
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
      const matchMethod = methodFilter === 'ALL' || sal.paymentMethod === methodFilter;

      return matchSearch && matchPeriod && matchMethod;
    });
  }, [salaries, searchQuery, periodFilter, methodFilter]);

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

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = async () => {
    const receiptElement = document.getElementById('official-receipt-print');
    if (!receiptElement) return;

    showToast('📸 Génération de l\'image HD du reçu en cours...');

    try {
      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        // 1. Copier directement dans le presse-papier pour Coller (Ctrl + V) dans WhatsApp
        let copied = false;
        if (navigator.clipboard && (window as any).ClipboardItem) {
          try {
            await navigator.clipboard.write([
              new (window as any).ClipboardItem({
                'image/png': blob,
              }),
            ]);
            copied = true;
          } catch (err) {
            console.warn('Copie presse-papier image non disponible:', err);
          }
        }

        // 2. Téléchargement automatique de l'image
        const imageUri = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Recu_Salaire_${selectedSalary.receiptNumber}_${selectedSalary.staffName.replace(/\s+/g, '_')}.png`;
        link.href = imageUri;
        link.click();

        // 3. Ouvrir WhatsApp avec message d'accompagnement
        const cleanPhone = selectedSalary.phone.replace(/[^0-9]/g, '');
        const message = `📋 *${(currentSchool.name || 'ÉTABLISSEMENT SCOLAIRE').toUpperCase()}*
🧾 *BULLETIN & REÇU OFFICIEL DE SALAIRE N° ${selectedSalary.receiptNumber}*
👤 Bénéficiaire : *${selectedSalary.civility} ${selectedSalary.staffName}* (${selectedSalary.role})
🆔 Matricule : *${selectedSalary.matricule}*
📅 Période : *${selectedSalary.payPeriod}*
💰 *NET VERSÉ : ${formatFCFA(selectedSalary.netSalary)}*

${copied ? '✓ Image HD copiée dans votre presse-papier (Faites Coller / Ctrl+V directement dans WhatsApp).' : '✓ L\'image HD du reçu officiel a été téléchargée sur votre appareil.'}

_Quittance officielle délivrée par le Service Comptabilité & Finances via SchoolFlow._`;

        const encoded = encodeURIComponent(message);
        const waUrl = cleanPhone
          ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
          : `https://api.whatsapp.com/send?text=${encoded}`;

        window.open(waUrl, '_blank');
        showToast(
          copied
            ? '✅ Image du reçu prête ! Collez-la (Ctrl + V) dans WhatsApp.'
            : '✅ Image du reçu générée et téléchargée pour WhatsApp.'
        );
      }, 'image/png');
    } catch (err) {
      console.error('Erreur génération image reçu:', err);
      showToast('⚠️ Erreur lors de la capture de l\'image du reçu.');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-emerald-700 text-white shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 border border-emerald-500">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ═══════════════ EN-TÊTE DE LA PAGE ═══════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading tracking-tight">
                Salaires du Personnel & Reçus
              </h1>
              <p className="text-xs text-slate-500 font-sans">
                Émission des bulletins de paie certifiés, quittances de salaires et gestion des rémunérations en <strong className="text-slate-800">FCFA</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Imprimer le Bulletin Actuel</span>
          </button>
        </div>
      </div>

      {/* ═══════════════ 4 CARTES KPI STATISTIQUES FINANCIÈRES ═══════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* ================= COLONNE GAUCHE (5 COLONNES) : FORMULAIRE DE SAISIE DE SALAIRE ================= */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 font-heading">
                Paiement de Salaire & Quittance
              </h2>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Nouveau Reçu
            </span>
          </div>

          <form onSubmit={handleCreateSalary} className="space-y-4 text-xs">
            
            {/* Sélection rapide personnel existant */}
            {staffUsers.length > 0 && (
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px]">
                  Sélectionner un membre du personnel existant :
                </label>
                <div className="relative">
                  <select
                    value={selectedStaffId}
                    onChange={(e) => handleStaffSelect(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 appearance-none cursor-pointer"
                  >
                    <option value="">-- Choisir dans la liste du personnel ou saisir librement --</option>
                    {staffUsers
                      .filter((staff) => staff.roleId !== 'fondateur')
                      .map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.fullName} ({staff.role})
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Civilité & Nom Prénoms du Bénéficiaire */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block text-[11px]">
                Civilité, Nom et Prénoms du Bénéficiaire *
              </label>
              <div className="flex gap-2">
                <select
                  value={civility}
                  onChange={(e) => setCivility(e.target.value as any)}
                  className="w-20 px-2 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-bold text-slate-900 text-center cursor-pointer"
                >
                  <option value="Mr">Mr</option>
                  <option value="Mme">Mme</option>
                  <option value="Mlle">Mlle</option>
                </select>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Ex : Kouamé Konan"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Fonction / Matière & Matricule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px]">
                  Fonction / Matière *
                </label>
                <input
                  type="text"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Ex : Professeur de Mathématiques"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px]">
                  Matricule / N° Embauche
                </label>
                <input
                  type="text"
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value)}
                  placeholder="Ex : ENS-2026-004"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-bold text-slate-900 uppercase"
                />
              </div>
            </div>

            {/* Période / Mois de Paie & Date de Paiement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px]">
                  Mois / Période de Paie *
                </label>
                <select
                  value={payPeriod}
                  onChange={(e) => setPayPeriod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-bold text-slate-900 cursor-pointer"
                >
                  {PAY_PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block text-[11px]">
                  Date de Paiement (JJ/MM/AAAA) *
                </label>
                <FrenchDateInput
                  value={paymentDate}
                  onChange={setPaymentDate}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-medium text-slate-900"
                />
              </div>
            </div>

            {/* GRILLE FINANCIÈRE : SALAIRE BASE + PRIMES - RETENUES */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>Détail Financier (FCFA)</span>
                <span className="text-emerald-700">Calcul Automatique</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 block">
                    Salaire de Base *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={baseSalary || ''}
                    onChange={(e) => setBaseSalary(Number(e.target.value))}
                    placeholder="250000"
                    className="w-full px-2.5 py-2 rounded-xl bg-white border border-slate-300 focus:border-emerald-600 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700 block">
                    + Primes / Heures
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={bonuses || ''}
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
                    value={deductions || ''}
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

        {/* ================= COLONNE DROITE (7 COLONNES) : BULLETIN & REÇU OFFICIEL IMPRIMABLE ================= */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Barre d'action rapide sur le reçu */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs no-print">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Reçu sélectionné :</span>
              <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                {selectedSalary.receiptNumber}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Bouton Partager sur WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer hover:scale-102"
                title="Envoyer le récapitulatif complet du reçu sur WhatsApp"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Partager sur WhatsApp</span>
              </button>

              {/* Bouton Imprimer A4 */}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer A4</span>
              </button>
            </div>
          </div>

          {/* REÇU AUTOMATIQUE OFFICIEL DE SALAIRE (STYLE CONFORME MENA) */}
          <div
            id="official-receipt-print"
            className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-300 shadow-xl relative overflow-hidden text-slate-800 space-y-5 printable-receipt-area"
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

              {/* Centre : République, Nom Officiel + Sigle Centré, Slogan, Situation & Code MENA */}
              <div className="text-center flex-1 px-2 space-y-1">
                <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-slate-800">
                  {currentSchool.country === 'Sénégal' ? 'RÉPUBLIQUE DU SÉNÉGAL' : 'RÉPUBLIQUE DE CÔTE D’IVOIRE'}
                </div>
                <p className="text-[8.5px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  « Union • Discipline • Travail »
                </p>

                {/* Nom entier de l'école (sur sa propre ligne, grand et bien centré) */}
                <h3
                  suppressHydrationWarning
                  className="text-xs sm:text-sm md:text-base font-black text-slate-900 font-heading uppercase tracking-tight leading-snug"
                >
                  {currentSchool.name}
                </h3>

                {/* Sigle de l'école entre parenthèses sur la ligne du dessous */}
                {currentSchool.shortName && (
                  <p
                    suppressHydrationWarning
                    className="text-xs sm:text-sm font-extrabold text-emerald-800 font-heading tracking-wider"
                  >
                    ({currentSchool.shortName})
                  </p>
                )}

                {/* Slogan officiel */}
                <p
                  suppressHydrationWarning
                  className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 italic"
                >
                  « {currentSchool.receiptHeaderSlogan || currentSchool.slogan || currentSchool.motto || "L'excellence au service du savoir"} »
                </p>

                <p suppressHydrationWarning className="text-[9.5px] sm:text-[10px] text-slate-600">
                  Situation : {currentSchool.district || currentSchool.city || 'Abidjan'} • Tél : {currentSchool.phone || '+225 01 31 43 92 21'}
                </p>

                <div className="inline-block bg-slate-900 text-white text-[9.5px] sm:text-[10px] font-mono font-bold px-3 py-0.5 rounded-md shadow-2xs">
                  Code Établissement : {currentSchool.ministryCode || currentSchool.menaCode || 'MENA-04829-CI'}
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
                BULLETIN & REÇU DE PAIEMENT DE SALAIRE
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
                      <td className="py-2 px-3 text-right font-mono text-slate-400">-</td>
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
        </div>
      </div>

      {/* ═══════════════ TABLEAU RÉCAPITULATIF DE TOUS LES SALAIRES VERSÉS ═══════════════ */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
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
    </div>
  );
}
