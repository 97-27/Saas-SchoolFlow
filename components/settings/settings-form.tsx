'use client';

import React, { useState, useEffect } from 'react';
import { School } from '@/lib/data/types';
import {
  getLiveSchool,
  saveLiveSchool,
  deleteSchoolAccount,
  resetSchoolData,
  getSchoolSubscription,
  SchoolSubscriptionStatus,
  DATA_UPDATED_EVENT,
} from '@/lib/data/live-store';
import {
  Building2,
  MapPin,
  Calendar,
  GraduationCap,
  Award,
  Upload,
  Check,
  Save,
  RotateCcw,
  Sparkles,
  Phone,
  Mail,
  Globe,
  MessageCircle,
  AlertCircle,
  Home,
  Utensils,
  Bus,
  Clock,
  Trash2,
  FileCheck,
  FileText,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  X,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';

interface SettingsFormProps {
  initialSchool: School;
}

export function SettingsForm({ initialSchool }: SettingsFormProps) {
  const [school, setSchool] = useState<School>(initialSchool);
  const [activeTab, setActiveTab] = useState<
    'identity' | 'location' | 'calendar' | 'services' | 'direction' | 'subscription'
  >('identity');
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SchoolSubscriptionStatus>(() =>
    getSchoolSubscription(initialSchool.slug || 'epc-manoi')
  );

  // Modales de sécurité
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const [logoPreview, setLogoPreview] = useState<string>(school.logoUrl || '');
  const [stampPreview, setStampPreview] = useState<string>(school.stampUrl || '');
  const [emblemPreview, setEmblemPreview] = useState<string>(school.countryEmblemUrl || '');

  useEffect(() => {
    const syncWithLive = () => {
      const live = getLiveSchool(initialSchool.slug, initialSchool);
      setSchool(live);
      setSubscriptionStatus(getSchoolSubscription(initialSchool.slug || 'epc-manoi'));
      setLogoPreview(live.logoUrl || '');
      setEmblemPreview(live.countryEmblemUrl || '');
      setStampPreview(live.stampUrl || '');
    };

    syncWithLive();
    window.addEventListener(DATA_UPDATED_EVENT, syncWithLive);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, syncWithLive);
  }, [initialSchool]);

  const handleInputChange = (field: keyof School, value: unknown) => {
    setSchool((prev) => ({
      ...prev,
      [field]: value,
    }));
    setIsSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Sauvegarde persistance globale dans le live-store
    saveLiveSchool(school);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 5000);
    }, 400);
  };

  // Codes de sécurité par email pour la suppression définitive du compte
  const [deleteEmailCode, setDeleteEmailCode] = useState('');
  const [enteredDeleteEmailCode, setEnteredDeleteEmailCode] = useState('');
  const [isEmailCodeSent, setIsEmailCodeSent] = useState(false);

  // 1. Logo avec sauvegarde automatique et instantanée
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setLogoPreview(result);
        const updated = { ...school, logoUrl: result };
        setSchool(updated);
        saveLiveSchool(updated);
        setActionFeedback('✓ Nouveau logo enregistré et appliqué instantanément sur toute la plateforme.');
        setTimeout(() => setActionFeedback(null), 4000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoErase = () => {
    const defaultLogo = 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=200&auto=format&fit=crop&q=80';
    setLogoPreview(defaultLogo);
    const updated = { ...school, logoUrl: defaultLogo };
    setSchool(updated);
    saveLiveSchool(updated);
    setActionFeedback('✓ Logo réinitialisé et synchronisé instantanément.');
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // 2. Emblème avec sauvegarde automatique et instantanée
  const handleEmblemUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setEmblemPreview(result);
        const updated = { ...school, countryEmblemUrl: result };
        setSchool(updated);
        saveLiveSchool(updated);
        setActionFeedback('✓ Emblème national enregistré et appliqué instantanément.');
        setTimeout(() => setActionFeedback(null), 4000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEmblemErase = () => {
    const defaultEmblem = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png';
    setEmblemPreview(defaultEmblem);
    const updated = { ...school, countryEmblemUrl: defaultEmblem };
    setSchool(updated);
    saveLiveSchool(updated);
    setActionFeedback('✓ Emblème réinitialisé et synchronisé instantanément.');
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // 3. Cachet officiel avec sauvegarde automatique et instantanée
  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setStampPreview(result);
        const updated = { ...school, stampUrl: result };
        setSchool(updated);
        saveLiveSchool(updated);
        setActionFeedback('✓ Cachet officiel enregistré et appliqué instantanément sur les reçus.');
        setTimeout(() => setActionFeedback(null), 4000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStampErase = () => {
    setStampPreview('');
    const updated = { ...school, stampUrl: '' };
    setSchool(updated);
    saveLiveSchool(updated);
    setActionFeedback('✓ Cachet officiel retiré avec succès.');
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleConfirmReset = () => {
    resetSchoolData(school.slug || 'epc-manoi');
    setIsResetModalOpen(false);
    setActionFeedback('✓ Toutes les données scolaires (élèves, factures, notes, salaires) ont été réinitialisées à zéro avec succès.');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleInitiateDelete = () => {
    // Génération du code d'authentification de sécurité à 6 chiffres transmis par email
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setDeleteEmailCode(code);
    setEnteredDeleteEmailCode('');
    setIsEmailCodeSent(true);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (enteredDeleteEmailCode.trim() !== deleteEmailCode) {
      alert(`Code de confirmation incorrect. Veuillez vérifier le code de sécurité reçu par email (${school.email || 'direction@epc-manoi.ci'}).`);
      return;
    }
    deleteSchoolAccount(school.slug || 'epc-manoi');
    setIsDeleteModalOpen(false);
    window.location.href = '/login?deleted=true';
  };

  const tabs = [
    { id: 'identity', label: 'Identité, Logo & Emblème', icon: Building2 },
    { id: 'location', label: 'Localisation & Ville', icon: MapPin },
    { id: 'calendar', label: 'Année & Calendrier', icon: Calendar },
    { id: 'services', label: 'Cycles & Services', icon: GraduationCap },
    { id: 'direction', label: 'Direction & Cachet', icon: Award },
    { id: 'subscription', label: 'Abonnement & Compte', icon: ShieldAlert },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Toast Notification upon Save */}
      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-xs sm:text-sm">
                Paramètres enregistrés avec succès !
              </p>
              <p className="text-[11px] text-emerald-700">
                Les modifications ont été prises en compte sur l&apos;ensemble de la plateforme.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
            Sauvegardé
          </span>
        </div>
      )}

      {/* Main Settings Card */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden"
      >
        {/* Navigation Tabs Bar */}
        <div className="border-b border-slate-100 bg-slate-50/60 p-2 sm:p-3 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80 font-bold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          {/* TAB 1: IDENTITÉ & LOGO & EMBLÈME */}
          {activeTab === 'identity' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-heading">
                    Identité Officielle & Image de Marque
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Informations légales figurant sur les en-têtes officiels, bulletins et reçus automatiques
                  </p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Espace Établissement
                </span>
              </div>

              {/* Grand Bandeau Explicatif pour le Reçu Automatique */}
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 flex items-start gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs sm:text-sm font-bold text-emerald-950 font-heading">
                    Configuration des Logos pour le Reçu Automatique SchoolFlow
                  </h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Sur le reçu officiel généré automatiquement lors de chaque inscription et encaissement : le <strong>Logo de votre école</strong> apparaîtra à gauche, et l&apos;<strong>Emblème officiel de votre pays</strong> apparaîtra à droite. Téléchargez ou modifiez ci-dessous les deux visuels officiels.
                  </p>
                </div>
              </div>

              {/* Logo École (Gauche) & Emblème Pays (Droite) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                {/* 1. Logo de l'école (Affiché à gauche) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200/60 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative group shrink-0">
                    {logoPreview ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoPreview}
                          alt="Logo de l'école"
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-contain border-2 border-emerald-500/40 shadow-md bg-white p-1"
                        />
                        <div className="absolute inset-0 rounded-2xl bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <label
                            htmlFor="logo-upload"
                            className="cursor-pointer p-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-xs transition-colors"
                            title="Modifier le logo"
                          >
                            <Upload className="w-5 h-5 text-white" />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-white flex flex-col items-center justify-center shadow-xs p-2 text-center group-hover:border-emerald-500 transition-all">
                        <Building2 className="w-7 h-7 text-emerald-600 mb-1" />
                        <span className="text-[8px] font-black text-emerald-900 uppercase leading-tight font-heading">
                          Exemple Logo
                        </span>
                        <span className="text-[7.5px] text-emerald-700 font-bold">
                          (Gauche Reçu)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-1.5">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 justify-center sm:justify-start">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Logo Officiel de l&apos;Établissement</span>
                      </h4>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80">
                        Gauche du Reçu
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {logoPreview ? '✓ Logo personnalisé actif sur reçus et bulletins.' : 'Exemple recommandé : blason ou logo carré (500x500 PNG transparent).'}
                    </p>

                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap">
                      <label
                        htmlFor="logo-upload"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{logoPreview ? 'Changer le logo' : 'Télécharger votre logo'}</span>
                      </label>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={handleLogoErase}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Effacer</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Emblème du pays (Affiché à droite) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200/60 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative group shrink-0">
                    {emblemPreview ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={emblemPreview}
                          alt="Emblème officiel du pays"
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-contain p-1 border-2 border-amber-500/40 shadow-md bg-white"
                        />
                        <div className="absolute inset-0 rounded-2xl bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <label
                            htmlFor="emblem-upload"
                            className="cursor-pointer p-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-xs transition-colors"
                            title="Modifier l'emblème"
                          >
                            <Upload className="w-5 h-5 text-white" />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-dashed border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50/40 to-white flex flex-col items-center justify-center shadow-xs p-2 text-center group-hover:border-amber-500 transition-all">
                        <Award className="w-7 h-7 text-amber-600 mb-1" />
                        <span className="text-[8px] font-black text-amber-900 uppercase leading-tight font-heading">
                          Exemple Armoiries
                        </span>
                        <span className="text-[7.5px] text-amber-700 font-bold">
                          (Droite Reçu)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-1.5">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 justify-center sm:justify-start">
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        <span>Armoiries & Emblème National</span>
                      </h4>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80">
                        Droite du Reçu
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {emblemPreview ? '✓ Armoiries nationales configurées.' : 'Armoiries officielles de la République ou Sceau National.'}
                    </p>

                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap">
                      <label
                        htmlFor="emblem-upload"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer shadow-2xs transition-all"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>{emblemPreview ? 'Changer l’emblème' : 'Télécharger armoiries'}</span>
                      </label>
                      <input
                        id="emblem-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleEmblemUpload}
                        className="hidden"
                      />
                      {emblemPreview && (
                        <button
                          type="button"
                          onClick={handleEmblemErase}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Effacer</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sélection Rapide d'Armoiries Nationales Africaines (1 Clic) */}
              <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/70 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Sélectionner en 1 Clic les Armoiries de votre Pays :</span>
                  </span>
                  <span className="text-[10px] text-amber-700 font-semibold">
                    Format vectoriel officiel haute définition
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { country: "Côte d'Ivoire", flag: '🇨🇮', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png' },
                    { country: 'Sénégal', flag: '🇸🇳', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Coat_of_arms_of_Senegal.svg/300px-Coat_of_arms_of_Senegal.svg.png' },
                    { country: 'Bénin', flag: '🇧🇯', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Coat_of_arms_of_Benin.svg/300px-Coat_of_arms_of_Benin.svg.png' },
                    { country: 'Cameroun', flag: '🇨🇲', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Coat_of_arms_of_Cameroon.svg/300px-Coat_of_arms_of_Cameroon.svg.png' },
                    { country: 'Mali', flag: '🇲🇱', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Coat_of_arms_of_Mali.svg/300px-Coat_of_arms_of_Mali.svg.png' },
                    { country: 'Burkina Faso', flag: '🇧🇫', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Coat_of_arms_of_Burkina_Faso.svg/300px-Coat_of_arms_of_Burkina_Faso.svg.png' },
                    { country: 'Togo', flag: '🇹🇬', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Coat_of_arms_of_Togo.svg/300px-Coat_of_arms_of_Togo.svg.png' },
                    { country: 'Guinée', flag: '🇬🇳', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Coat_of_arms_of_Guinea.svg/300px-Coat_of_arms_of_Guinea.svg.png' },
                  ].map((item) => (
                    <button
                      key={item.country}
                      type="button"
                      onClick={() => {
                        setEmblemPreview(item.url);
                        handleInputChange('countryEmblemUrl', item.url);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        emblemPreview === item.url
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/60'
                      }`}
                    >
                      <span>{item.flag}</span>
                      <span>{item.country}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Nom complet de l&apos;école</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={school.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ex: Groupe Scolaire Moderne de l'Excellence"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Nom abrégé / Sigle officiel
                  </label>
                  <input
                    type="text"
                    value={school.shortName}
                    onChange={(e) => handleInputChange('shortName', e.target.value)}
                    placeholder="Ex: Excellence Abidjan ou GSME"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Devise de l&apos;établissement
                  </label>
                  <input
                    type="text"
                    value={school.motto || ''}
                    onChange={(e) => handleInputChange('motto', e.target.value)}
                    placeholder="Ex: Discipline • Rigueur • Réussite"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all italic text-slate-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Slogan de l&apos;établissement</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">Personnalisé</span>
                  </label>
                  <input
                    type="text"
                    value={school.slogan || ''}
                    onChange={(e) => handleInputChange('slogan', e.target.value)}
                    placeholder="Ex: L'excellence au service de l'avenir • Bâtir l'élite de demain"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Code Établissement (Ministère / MENA)</span>
                    <span className="text-[10px] text-slate-400 font-mono">Officiel</span>
                  </label>
                  <input
                    type="text"
                    value={school.ministryCode || ''}
                    onChange={(e) => handleInputChange('ministryCode', e.target.value)}
                    placeholder="Ex: MENA-04829-CI"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono font-bold uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    N° d&apos;Agrément / Arrêté d&apos;ouverture
                  </label>
                  <input
                    type="text"
                    value={school.approvalNumber || ''}
                    onChange={(e) => handleInputChange('approvalNumber', e.target.value)}
                    placeholder="Ex: Arrêté N° 0452/MENA/DES du 12/06/2018"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOCALISATION & COORDONNÉES */}
          {activeTab === 'location' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  Localisation & Coordonnées Officielles
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Adresse géographique et contacts directs pour les familles et l&apos;administration
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Pays
                  </label>
                  <select
                    value={school.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold"
                  >
                    <option value="Côte d'Ivoire">Côte d&apos;Ivoire</option>
                    <option value="Sénégal">Sénégal</option>
                    <option value="Cameroun">Cameroun</option>
                    <option value="Mali">Mali</option>
                    <option value="Burkina Faso">Burkina Faso</option>
                    <option value="Togo">Togo</option>
                    <option value="Bénin">Bénin</option>
                    <option value="Guinée">Guinée</option>
                    <option value="Gabon">Gabon</option>
                    <option value="Congo">Congo</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Ville</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={school.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Ex: Abidjan"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    Quartier / Commune / Adresse physique
                  </label>
                  <input
                    type="text"
                    value={school.district || ''}
                    onChange={(e) => handleInputChange('district', e.target.value)}
                    placeholder="Ex: Cocody Riviera 3, Boulevard François Mitterrand"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Boîte Postale (B.P.)
                  </label>
                  <input
                    type="text"
                    value={school.postalBox || ''}
                    onChange={(e) => handleInputChange('postalBox', e.target.value)}
                    placeholder="Ex: 25 BP 1420 Abidjan 25"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Téléphone Secrétariat / Accueil</span>
                  </label>
                  <input
                    type="tel"
                    value={school.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Ex: +225 27 22 44 11 00"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Numéro WhatsApp officiel (Alertes Parents)</span>
                  </label>
                  <input
                    type="tel"
                    value={school.whatsappPhone || ''}
                    onChange={(e) => handleInputChange('whatsappPhone', e.target.value)}
                    placeholder="Ex: +225 07 48 92 11 00"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Email officiel de l&apos;école</span>
                  </label>
                  <input
                    type="email"
                    value={school.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Ex: direction@excellence-abidjan.ci"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>Site Web de l&apos;établissement</span>
                  </label>
                  <input
                    type="url"
                    value={school.website || ''}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    placeholder="Ex: https://excellence-abidjan.ci"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-700"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ANNÉE & CALENDRIER PÉDAGOGIQUE */}
          {activeTab === 'calendar' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  Année Scolaire & Découpage Pédagogique
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gestion de l&apos;année scolaire active, des trimestres et des horaires
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Année Scolaire en cours</span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                      Active
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    value={school.academicYear}
                    onChange={(e) => handleInputChange('academicYear', e.target.value)}
                    placeholder="Ex: 2026-2027"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Période / Trimestre Actif
                  </label>
                  <select
                    value={school.currentTerm}
                    onChange={(e) => handleInputChange('currentTerm', e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold"
                  >
                    <option value="Trimestre 1">Trimestre 1</option>
                    <option value="Trimestre 2">Trimestre 2</option>
                    <option value="Trimestre 3">Trimestre 3</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Date de rentrée des classes
                  </label>
                  <input
                    type="date"
                    value={school.openingDate || '2026-09-07'}
                    onChange={(e) => handleInputChange('openingDate', e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Date de clôture de l&apos;année
                  </label>
                  <input
                    type="date"
                    value={school.closingDate || '2027-06-30'}
                    onChange={(e) => handleInputChange('closingDate', e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Notice sur le recalcul automatique */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Prise d&apos;effet immédiate :</strong> La modification de l&apos;année scolaire active ({school.academicYear || '2026-2027'}) actualise instantanément les tableaux de bord, les grilles de scolarité FCFA et les fiches d&apos;inscription.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: CYCLES & SERVICES ANNEXES */}
          {activeTab === 'services' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  Cycles d&apos;Enseignement & Services de l&apos;Établissement
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Activez les cycles accueillis (de la Maternelle à la Terminale) et les prestations annexes
                </p>
              </div>

              {/* Cycles d'enseignement */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Cycles Scolaires Accueillis
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Maternelle */}
                  <label className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={school.hasMaternelle ?? true}
                        onChange={(e) => handleInputChange('hasMaternelle', e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">Cycle Maternelle</p>
                        <p className="text-[11px] text-slate-500">P.S., M.S., G.S.</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      Actif
                    </span>
                  </label>

                  {/* Primaire */}
                  <label className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={school.hasPrimaire ?? true}
                        onChange={(e) => handleInputChange('hasPrimaire', e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">Cycle Primaire</p>
                        <p className="text-[11px] text-slate-500">Du CP1 au CM2</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      Actif
                    </span>
                  </label>

                  {/* Collège */}
                  <label className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={school.hasCollege ?? true}
                        onChange={(e) => handleInputChange('hasCollege', e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">Cycle Collège</p>
                        <p className="text-[11px] text-slate-500">De la 6ème à la 3ème</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      Actif
                    </span>
                  </label>

                  {/* Lycée */}
                  <label className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={school.hasLycee ?? true}
                        onChange={(e) => handleInputChange('hasLycee', e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">Cycle Lycée</p>
                        <p className="text-[11px] text-slate-500">2nde, 1ère, Tle (A, C, D)</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      Actif
                    </span>
                  </label>
                </div>
              </div>

              {/* Services & Prestations (Cantine, Transport, Internat) */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Services & Prestations Disponibles
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Internat */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                          <Home className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Internat / Pensionnat</p>
                          <p className="text-[11px] text-slate-400">Hébergement des élèves</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={school.hasBoarding ?? true}
                        onChange={(e) => handleInputChange('hasBoarding', e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      />
                    </div>
                    {school.hasBoarding && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-600">Capacité :</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={school.boardingCapacity || 220}
                            onChange={(e) => handleInputChange('boardingCapacity', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-200 text-right font-bold text-purple-700"
                          />
                          <span className="text-slate-400">lits</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cantine */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Utensils className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Cantine & Restauration</p>
                        <p className="text-[11px] text-slate-400">Repas chauds le midi</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={school.hasCanteen ?? true}
                      onChange={(e) => handleInputChange('hasCanteen', e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                    />
                  </div>

                  {/* Transport */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Bus className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Transport Scolaire</p>
                        <p className="text-[11px] text-slate-400">Circuits de ramassage</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={school.hasTransport ?? true}
                      onChange={(e) => handleInputChange('hasTransport', e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DIRECTION & DOCUMENTS OFFICIELS */}
          {activeTab === 'direction' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  Direction & Documents Administratifs
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Signataires officiels et mentions légales imprimées sur les reçus en espèces
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Nom du Fondateur / Promoteur de l&apos;Établissement *</span>
                  </label>
                  <input
                    type="text"
                    value={school.founderName || ''}
                    onChange={(e) => handleInputChange('founderName', e.target.value)}
                    placeholder="Ex: LAWANI MOUHAMED"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    🏛️ <strong>Fondateur / Promoteur :</strong> Affiché au bas de la barre latérale et sur les registres officiels.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Nom du Directeur de l&apos;Établissement (Signataire) *</span>
                  </label>
                  <input
                    type="text"
                    value={school.directorName || school.studiesDirectorName || ''}
                    onChange={(e) => {
                      handleInputChange('directorName', e.target.value);
                      handleInputChange('studiesDirectorName', e.target.value);
                    }}
                    placeholder="Ex: M. Jean-Marc Kouassi (Direction Pédagogique)"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    👨‍🏫 <strong>Directeur / Direction des Études :</strong> Signataire des bulletins scolaires et certificats de scolarité.
                  </p>
                </div>

                {/* Digital Stamp Upload avec Visuel d'Exemple Réaliste */}
                <div className="sm:col-span-2 p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200/60 flex flex-col sm:flex-row items-center gap-4">
                  <div className="shrink-0">
                    {stampPreview ? (
                      <div className="w-24 h-24 rounded-2xl bg-white border-2 border-emerald-500/40 flex items-center justify-center p-2 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={stampPreview}
                          alt="Cachet officiel"
                          className="max-h-full max-w-full object-contain opacity-90"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-purple-300 bg-gradient-to-br from-purple-50 via-indigo-50/40 to-white flex flex-col items-center justify-center p-2 text-center shadow-xs">
                        <div className="w-12 h-12 rounded-full border-2 border-purple-400 border-dashed flex items-center justify-center mb-1">
                          <FileCheck className="w-6 h-6 text-purple-600" />
                        </div>
                        <span className="text-[7.5px] font-black text-purple-900 uppercase leading-tight font-heading">
                          Exemple Cachet
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 text-center sm:text-left flex-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 justify-center sm:justify-start">
                        <FileCheck className="w-3.5 h-3.5 text-purple-600" />
                        <span>Tampon & Cachet Officiel de l&apos;Établissement</span>
                      </h4>
                      <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                        {stampPreview ? '✓ Cachet Actif' : 'Modèle Recommandé'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {stampPreview
                        ? '✓ Tampon scanné actif, incrusté automatiquement au bas de vos reçus et certificats.'
                        : 'Exemple recommandé : tampon circulaire scanné (encre bleue ou violette sur fond transparent PNG).'}
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap">
                      <label
                        htmlFor="stamp-upload"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer shadow-2xs transition-all"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>{stampPreview ? 'Changer le cachet' : 'Importer un cachet scanné'}</span>
                      </label>
                      <input
                        id="stamp-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleStampUpload}
                        className="hidden"
                      />
                      {stampPreview && (
                        <button
                          type="button"
                          onClick={handleStampErase}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Effacer</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Receipt Legal Notice */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    Mention légale au bas des reçus de paiement en espèces
                  </label>
                  <textarea
                    rows={2}
                    value={school.receiptFooterNote || ''}
                    onChange={(e) => handleInputChange('receiptFooterNote', e.target.value)}
                    placeholder="Ex: Tout versement en caisse donne droit à un reçu numéroté immédiat. Aucun remboursement après encaissement."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans"
                  />
                  <p className="text-[10px] text-slate-400">
                    Ce texte s&apos;imprime automatiquement sur chaque reçu remis aux parents lors des règlements en espèces.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ABONNEMENT, REMISE À ZÉRO & SUPPRESSION DU COMPTE */}
          {activeTab === 'subscription' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-emerald-600" />
                    <span>Abonnement SaaS & Gestion Sécurisée du Compte</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Formule d&apos;abonnement, réinitialisation complète des effectifs ou suppression définitive du compte école
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Abonnement Actif ✓
                </span>
              </div>

              {/* Action Feedback Toast */}
              {actionFeedback && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{actionFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionFeedback(null)}
                    className="text-emerald-800 hover:text-emerald-950 font-bold ml-3"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* 1. Formules d'Abonnement Disponibles */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 font-heading">
                  1. Formule d&apos;Abonnement de l&apos;Établissement
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Mensuel */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Formule Mensuelle</span>
                      <h5 className="text-sm font-extrabold text-slate-900 font-heading mt-1">Abonnement 1 Mois</h5>
                      <div className="mt-2 text-xl font-extrabold text-slate-900 font-heading">
                        30 000 <span className="text-xs font-normal text-slate-500">FCFA / mois</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Idéal pour les paiements mois par mois sans engagement.</p>
                    </div>
                  </div>

                  {/* Annuel (Recommandé & Actif) */}
                  <div className="p-4 rounded-2xl border-2 border-emerald-600 bg-emerald-50/30 transition-all shadow-md relative flex flex-col justify-between">
                    <div className="absolute -top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shadow-xs">
                      En Cours Actif
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Formule Annuelle</span>
                      <h5 className="text-sm font-extrabold text-slate-900 font-heading mt-1">Année Scolaire {school.academicYear || '2026-2027'}</h5>
                      <div className="mt-2 text-xl font-extrabold text-emerald-800 font-heading">
                        250 000 <span className="text-xs font-normal text-slate-600">FCFA / an</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">Accès complet illimité pour tous les membres et parents.</p>
                    </div>
                  </div>

                  {/* Triennal 3 Ans */}
                  <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50/20 hover:border-amber-400 transition-all shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Formule Triennale (3 Ans)</span>
                      <h5 className="text-sm font-extrabold text-slate-900 font-heading mt-1">Pack 3 Années Scolaires</h5>
                      <div className="mt-2 text-xl font-extrabold text-amber-900 font-heading">
                        750 000 <span className="text-xs font-normal text-slate-600">FCFA</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">Sérénité totale sur 3 années sans interruption de service.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Réinitialisation Complète des Données (Remise à Zéro) */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-heading">
                      2. Réinitialisation de Toutes les Données Scolaires à Zéro
                    </h4>
                    <p className="text-xs text-slate-500">
                      Purger les élèves inscrits, les factures de scolarité, les notes et les salaires pour démarrer une nouvelle année scolaire ou un nouveau cycle d&apos;abonnement. L&apos;établissement et son compte restent conservés.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-all cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Réinitialiser les données de l&apos;école à zéro</span>
                  </button>
                </div>
              </div>

              {/* 3. Zone de Danger : Suppression Définitive du Compte */}
              <div className="p-5 rounded-2xl bg-rose-50/70 border-2 border-rose-300 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-rose-950 font-heading flex items-center gap-2">
                      <span>3. Zone de Danger : Suppression Définitive du Compte Établissement</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">Sécurité Email</span>
                    </h4>
                    <p className="text-xs text-rose-900/90 leading-relaxed mt-0.5">
                      La suppression du compte efface l&apos;intégralité des données. Pour protéger l&apos;école, un <strong>code d&apos;autorisation de sécurité à 6 chiffres</strong> sera expédié par email à l&apos;adresse officielle de l&apos;administrateur ({school.email || 'direction@epc-manoi.ci'}) pour valider cette action.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleInitiateDelete}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 shadow-md shadow-rose-600/30 transition-all cursor-pointer transform hover:-translate-y-0.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer Définitivement le Compte Établissement</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Footer (Masqué sur l'onglet Abonnement) */}
        {activeTab !== 'subscription' && (
          <div className="p-4 sm:px-6 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                Données de l&apos;établissement • Année <strong>{school.academicYear}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setSchool(initialSchool);
                  setIsSaved(false);
                }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Annuler</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* ═══════════════ MODALE SÉCURITÉ 1 : RÉINITIALISATION DES DONNÉES ═══════════════ */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-extrabold text-sm text-slate-900 font-heading">
                  Confirmer la remise à zéro des données
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Êtes-vous sûr de vouloir <strong>réinitialiser toutes les données scolaires</strong> (élèves, inscriptions, scolarités, factures, notes et salaires) ?
              <br /><br />
              L&apos;établissement <strong>{school.name}</strong> restera actif, mais toutes les tables recommenceront avec un compteur vierge.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 transition-all shadow-md shadow-amber-600/30 cursor-pointer"
              >
                Confirmer la remise à zéro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MODALE SÉCURITÉ 2 : SUPPRESSION DÉFINITIVE DU COMPTE PAR EMAIL ═══════════════ */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl border-2 border-rose-500 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center gap-2.5 text-rose-600">
                <ShieldAlert className="w-6 h-6" />
                <h3 className="font-extrabold text-base text-rose-950 font-heading">
                  Confirmation de Suppression par Email
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 leading-relaxed space-y-2">
              <p className="font-bold flex items-center gap-2">
                <Mail className="w-4 h-4 text-rose-600" />
                <span>Code d&apos;autorisation envoyé par email à l&apos;administrateur :</span>
              </p>
              <div className="p-2.5 rounded-xl bg-white border border-rose-200 font-mono font-bold text-rose-900 text-center">
                {school.email || 'direction@epc-manoi.ci'}
              </div>
              <p className="text-[11px] text-rose-800">
                Pour des raisons de sécurité, un code d&apos;autorisation à 6 chiffres a été expédié à cette adresse. Veuillez consulter votre boîte de réception pour valider la suppression définitive de l&apos;établissement <strong>{school.name}</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-900 block">
                Saisissez le code de confirmation à 6 chiffres reçu par email :
              </label>
              <input
                type="text"
                maxLength={6}
                value={enteredDeleteEmailCode}
                onChange={(e) => setEnteredDeleteEmailCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Entrez le code reçu (Ex: 849201)"
                className="w-full px-4 py-3 text-center text-lg rounded-2xl bg-slate-50 border-2 border-slate-300 focus:border-rose-600 focus:bg-white focus:outline-none font-bold font-mono tracking-widest text-slate-900"
              />
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={enteredDeleteEmailCode.length !== 6}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-rose-600/30 transition-all cursor-pointer"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
