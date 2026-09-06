'use client';

import React, { useState, useMemo } from 'react';
import { Student, School } from '@/lib/data/types';
import { mockSchools, availableClasses } from '@/lib/data/mock-data';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import {
  X,
  UserPlus,
  Printer,
  CheckCircle,
  Tag,
  MapPin,
  MessageCircle,
  Coins,
  FileText,
  Calendar,
  Sparkles,
  GraduationCap,
} from 'lucide-react';

interface NewStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentCreated: (newStudent: Student) => void;
  nextStudentNumber: string;
  school?: School;
}

export function NewStudentModal({
  isOpen,
  onClose,
  onStudentCreated,
  nextStudentNumber,
  school = mockSchools['college-excellence'],
}: NewStudentModalProps) {
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [grade, setGrade] = useState('6ème');
  const [address, setAddress] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('+225 07 ');
  const [tuitionAmount, setTuitionAmount] = useState<number>(250000);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(250000);
  const [paymentDate, setPaymentDate] = useState('2026-08-27');

  // Compute matricule from student number
  const seqNum = useMemo(() => {
    return parseInt(nextStudentNumber.replace(/\D/g, '') || '51', 10);
  }, [nextStudentNumber]);

  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const matricule = `${26014800 + seqNum}${letters[(seqNum - 1) % letters.length]}`;
  const receiptNumber = `REC-2026-${seqNum.toString().padStart(5, '0')}`;

  const netAmount = Math.max(0, tuitionAmount - discountAmount);
  const balanceRemaining = Math.max(0, netAmount - paidAmount);

  // Quick discount helper
  const handleApplyQuickDiscount = (amount: number) => {
    setDiscountAmount(amount);
    const newNet = Math.max(0, tuitionAmount - amount);
    setPaidAmount(newNet);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastName.trim() || !firstName.trim()) {
      alert('Veuillez renseigner le nom et le prénom de l’élève.');
      return;
    }

    const newStudent: Student = {
      id: `stu-${Date.now()}`,
      studentNumber: nextStudentNumber,
      matricule: matricule,
      lastName: lastName.trim().toUpperCase(),
      firstName: firstName.trim(),
      fullName: `${firstName.trim()} ${lastName.trim().toUpperCase()}`,
      avatar: '',
      grade: grade,
      gender: gender,
      address: address.trim() || 'Abidjan',
      guardianName: guardianName.trim() || `Tuteur de ${firstName.trim()}`,
      guardianPhone: whatsappPhone.trim(),
      whatsappPhone: whatsappPhone.trim(),
      tuitionAmount: tuitionAmount,
      discountAmount: discountAmount,
      netAmount: netAmount,
      paidAmount: paidAmount,
      paymentDate: paymentDate,
      attendanceRate: 100,
      status: 'active',
      tuitionStatus: paidAmount >= netAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
      enrollmentType: 'nouveau',
    };

    onStudentCreated(newStudent);
    onClose();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-6xl overflow-hidden my-auto animate-scaleUp">
        {/* Header de la fenêtre modale */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                  Nouvelle Inscription & Reçu Automatique
                </h3>
                <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-md border border-emerald-200">
                  {nextStudentNumber} • {matricule}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Saisissez les informations à gauche, le reçu officiel de l&apos;école se remplit automatiquement à droite
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-600" />
              <span>Imprimer</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SPLIT LAYOUT : 2 COLONNES (FORMULAIRE À GAUCHE / REÇU AUTOMATIQUE À DROITE) */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[85vh] overflow-y-auto">
          {/* ================= COLONNE DE GAUCHE : FORMULAIRE D'INSCRIPTION ================= */}
          <form onSubmit={handleSubmit} className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <span>Coordonnées de l&apos;Élève</span>
              </h4>
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                Saisie en direct
              </span>
            </div>

            {/* Nom & Prénom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nom de famille *</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ex: KONATE"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold uppercase transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Prénom(s) *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex: Lassina Mouhamed"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold transition-all"
                />
              </div>
            </div>

            {/* Genre & Classe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Genre</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                      gender === 'female'
                        ? 'bg-pink-50 text-pink-700 border-pink-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ♀ Fille
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                      gender === 'male'
                        ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ♂ Garçon
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Classe</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold cursor-pointer"
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
            </div>

            {/* Adresse où l'enfant habite */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Adresse où l&apos;enfant habite *</span>
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Cocody Angré 8ème Tranche, Résidence Bêttina"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Nom du tuteur & Contact WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nom du tuteur / parent</label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Ex: M. Konate Ibrahim"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Contact WhatsApp parent *</span>
                </label>
                <input
                  type="tel"
                  required
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="+225 07 48 92 11 00"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-semibold transition-all"
                />
              </div>
            </div>

            {/* Frais, Réduction & Règlement */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Scolarité (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={tuitionAmount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setTuitionAmount(val);
                      setPaidAmount(Math.max(0, val - discountAmount));
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-extrabold font-mono transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-amber-500" />
                      <span>Réduction</span>
                    </span>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Optionnel
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={discountAmount}
                    onChange={(e) => {
                      const d = parseInt(e.target.value) || 0;
                      setDiscountAmount(d);
                      setPaidAmount(Math.max(0, tuitionAmount - d));
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold font-mono text-amber-700 transition-all"
                  />
                </div>
              </div>

              {/* Boutons de réduction rapide */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-medium">Boutons rapides :</span>
                <button
                  type="button"
                  onClick={() => handleApplyQuickDiscount(0)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-all ${
                    discountAmount === 0
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  0 F
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickDiscount(5000)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                    discountAmount === 5000
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  - 5 000 F
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickDiscount(10000)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                    discountAmount === 10000
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  - 10 000 F
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickDiscount(25000)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                    discountAmount === 25000
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  - 25 000 F
                </button>
              </div>

              {/* Montant versé en espèces & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Montant versé en espèces (FCFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-extrabold font-mono text-emerald-800 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Date du versement</span>
                  </label>
                  <FrenchDateInput
                    value={paymentDate}
                    onChange={setPaymentDate}
                  />
                </div>
              </div>
            </div>

            {/* Boutons d'action du formulaire */}
            <div className="pt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-2xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Valider & Enregistrer l&apos;Élève</span>
              </button>
            </div>
          </form>

          {/* ================= COLONNE DE DROITE : LE REÇU AUTOMATIQUE EN DIRECT ================= */}
          <div className="lg:col-span-6 bg-slate-50/70 rounded-3xl border-2 border-slate-300 p-4 sm:p-5 space-y-3.5 shadow-md">
            {/* Cadre officiel en-tête avec les références de l'école */}
            <div className="border-2 border-slate-900 rounded-2xl p-3 sm:p-3.5 bg-white shadow-2xs">
              <div className="flex items-center justify-between gap-2.5 sm:gap-4">
                {/* Logo de l'école (À gauche — Agrandissement) */}
                <div className="shrink-0 text-center w-20 sm:w-24">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        school.logoUrl ||
                        'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=200&auto=format&fit=crop&q=80'
                      }
                      alt="Logo École"
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                  </div>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-1 block">
                    Logo École
                  </span>
                </div>

                {/* Textes officiels centrés avec nom strictement sur toute la ligne */}
                <div className="flex-1 min-w-0 px-2 overflow-hidden text-center">
                  <h2
                    className="text-xs sm:text-sm md:text-base font-extrabold text-slate-950 font-heading uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis block w-full leading-tight"
                    title={school.name}
                  >
                    {school.name}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] font-bold text-emerald-800 italic mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                    « {school.motto || 'Discipline • Rigueur • Réussite'} »
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-slate-600 mt-0.5 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {school.district || `${school.city} — ${school.country}`} • Tél : {school.phone || '+225 27 22 44 11 00'}
                  </p>
                  <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[8px] sm:text-[9px] font-mono font-bold text-slate-700">
                    <span>{school.approvalNumber || 'Arrêté N° 0452/MENA/DES'}</span>
                    <span>•</span>
                    <span>Code : {school.ministryCode || 'MENA-04829-CI'}</span>
                  </div>
                </div>

                {/* Emblème Officiel du Pays (À droite — Agrandissement) */}
                <div className="shrink-0 text-center w-20 sm:w-24">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        school.countryEmblemUrl ||
                        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png'
                      }
                      alt="Emblème National"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-1 block">
                    {school.country || "Rép. de Côte d'Ivoire"}
                  </span>
                </div>
              </div>
            </div>

            {/* Bandeau Quittance & Date */}
            <div className="bg-slate-900 text-white px-3.5 py-1.5 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold tracking-wider uppercase font-heading text-[11px]">
                  Quittance de Paiement & Inscription
                </span>
              </div>
              <span className="font-mono font-bold text-emerald-300 text-[11px]">
                {receiptNumber}
              </span>
            </div>

            {/* Détails synchronisés en direct */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-bold">
                  Identifiant & Matricule :
                </span>
                <span className="font-mono font-extrabold text-slate-900 text-[11px]">
                  {nextStudentNumber} • {matricule}
                </span>
              </div>

              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-bold">
                  Année Scolaire & Date :
                </span>
                <span className="font-bold text-slate-900 text-[11px]">
                  {school.academicYear} • {formatDate(paymentDate)}
                </span>
              </div>

              <div className="col-span-2 pt-1 border-t border-slate-100">
                <span className="text-[9px] text-slate-400 block uppercase font-bold">
                  Nom & Prénom de l&apos;Élève :
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-950 uppercase font-heading">
                  {lastName || 'NOM'} {firstName || 'PRÉNOM'}
                </span>{' '}
                <span className="ml-1 text-[10px] font-bold text-slate-600">
                  ({gender === 'female' ? '♀ Fille' : '♂ Garçon'})
                </span>
              </div>

              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-bold">
                  Classe d&apos;inscription :
                </span>
                <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-slate-800 text-[10px]">
                  {grade}
                </span>
              </div>

              <div>
                <span className="text-[9px] text-slate-400 block uppercase font-bold">
                  Contact WhatsApp Parent :
                </span>
                <span className="font-mono font-bold text-emerald-800 text-[11px]">
                  {whatsappPhone || '+225 ...'}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-[9px] text-slate-400 block uppercase font-bold">
                  Adresse de Résidence :
                </span>
                <span className="text-slate-700 font-medium text-[11px] truncate block">
                  {address || 'Non spécifiée'}
                </span>
              </div>
            </div>

            {/* Tableau Financier */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs bg-white">
              <table className="w-full">
                <thead className="bg-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 px-3 text-left">Désignation</th>
                    <th className="py-1.5 px-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  <tr>
                    <td className="py-1.5 px-3 text-slate-700 font-medium">
                      Frais de scolarité annuelle ({grade})
                    </td>
                    <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                      {formatFCFA(tuitionAmount)}
                    </td>
                  </tr>

                  {discountAmount > 0 && (
                    <tr className="bg-amber-50/60 text-amber-900 font-semibold">
                      <td className="py-1.5 px-3 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-amber-600" />
                        <span>Réduction accordée</span>
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold font-mono">
                        -{formatFCFA(discountAmount)}
                      </td>
                    </tr>
                  )}

                  {balanceRemaining > 0 ? (
                    <tr className="text-rose-700 bg-rose-50/50 font-bold">
                      <td className="py-1.5 px-3">Reste à payer (Solde)</td>
                      <td className="py-1.5 px-3 text-right font-mono">
                        {formatFCFA(balanceRemaining)}
                      </td>
                    </tr>
                  ) : (
                    <tr className="text-emerald-700 bg-emerald-50/50 font-bold">
                      <td className="py-1.5 px-3">Solde de la Scolarité</td>
                      <td className="py-1.5 px-3 text-right font-mono">
                        0 FCFA (Soldé)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cachet & Signatures */}
            <div className="pt-1 flex items-center justify-between gap-3 text-center bg-white p-2.5 rounded-xl border border-slate-200">
              <div className="space-y-0.5">
                <span className="text-[9px] text-slate-400 font-bold uppercase block">
                  Signature du Parent :
                </span>
                <div className="h-8 border-b border-dashed border-slate-300 w-24 sm:w-28" />
              </div>

              <div className="space-y-0.5">
                <span className="text-[9px] text-slate-400 font-bold uppercase block">
                  La Caisse & Le Comptable :
                </span>
                <div className="h-8 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      school.stampUrl ||
                      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=150&auto=format&fit=crop&q=80'
                    }
                    alt="Cachet Caisse"
                    className="h-8 object-contain opacity-80"
                  />
                </div>
              </div>
            </div>

            {/* Mention légale du bas */}
            <p className="text-[8px] sm:text-[9px] text-slate-400 text-center italic pt-1">
              « {school.receiptFooterNote || 'Tout versement en caisse donne droit à un reçu numéroté immédiat. Aucun remboursement après encaissement.'} »
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
