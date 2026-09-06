'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { School } from '@/lib/data/types';
import { defaultSchool } from '@/lib/data/mock-data';
import { getLiveSchool, DATA_UPDATED_EVENT, broadcastLiveUpdate } from '@/lib/data/live-store';
import {
  Menu,
  Bell,
  Calendar,
  ChevronRight,
  MessageSquare,
  CheckCheck,
  Clock,
  Send,
  X,
  ExternalLink,
  ShieldAlert,
  CreditCard,
  UserCheck,
  Camera,
  Upload,
  Pencil,
  Check,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface TopbarProps {
  schoolSlug?: string;
  onMenuToggle: () => void;
  breadcrumbs?: string[];
}

export function Topbar({
  schoolSlug = 'epc-manoi',
  onMenuToggle,
  breadcrumbs = ['Tableau de bord', "Vue d'ensemble"],
}: TopbarProps) {
  const [currentSchool, setCurrentSchool] = useState<School>(defaultSchool);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSession, setActiveSession] = useState<{
    fullName: string;
    email: string;
    phone: string;
    role: string;
    roleId?: string;
    roleBadge?: string;
    department?: string;
    avatarUrl?: string;
  }>({
    fullName: 'LAWANI MOUSSA',
    email: 'direction@epc-manoi.ci',
    phone: '',
    role: 'Fondateur / Promotrice',
    roleId: 'fondateur',
    roleBadge: '👑 Fondateur (Admin)',
    department: 'Présidence & Conseil',
    avatarUrl: '',
  });

  const [showWelcomeGreeting, setShowWelcomeGreeting] = useState(false);

  // Synchronisation dynamique de l'école et de l'année scolaire & session
  useEffect(() => {
    const live = getLiveSchool(schoolSlug, defaultSchool);
    setCurrentSchool(live);

    const loadSession = () => {
      try {
        const stored = localStorage.getItem('schoolflow_active_session_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.fullName) {
            const isFounder = parsed.roleId === 'fondateur';
            const isDirector = parsed.roleId === 'directeur';
            setActiveSession({
              fullName: parsed.fullName,
              email: parsed.email || live.email || 'direction@epc-manoi.ci',
              phone: parsed.phone || '',
              role: isFounder
                ? 'Fondateur / Promotrice'
                : isDirector
                ? 'Directeur Général'
                : (parsed.role || 'Personnel'),
              roleId: parsed.roleId || 'fondateur',
              roleBadge: isFounder
                ? '👑 Fondateur (Admin)'
                : isDirector
                ? '👑 Direction (Admin)'
                : (parsed.roleBadge || 'Personnel'),
              department: parsed.department || (isFounder ? 'Présidence & Conseil' : isDirector ? 'Direction Générale' : 'Direction'),
              avatarUrl: parsed.avatarUrl || '',
            });

            // Affichage automatique du message « Bonjour [Nom] » pendant 8 secondes à la connexion
            if (parsed.showWelcomeGreeting) {
              setShowWelcomeGreeting(true);
              setTimeout(() => {
                setShowWelcomeGreeting(false);
              }, 8000);

              try {
                parsed.showWelcomeGreeting = false;
                localStorage.setItem('schoolflow_active_session_v2', JSON.stringify(parsed));
              } catch (e) {}
            }
            return;
          }
        }
      } catch (e) {}

      setActiveSession({
        fullName: live.founderName || 'LAWANI MOUSSA',
        email: live.email || 'direction@epc-manoi.ci',
        phone: '',
        role: 'Fondateur / Promotrice',
        roleId: 'fondateur',
        roleBadge: '👑 Fondateur (Admin)',
        department: 'Présidence & Conseil',
        avatarUrl: '',
      });
    };

    loadSession();

    const handleUpdate = () => {
      const updatedSchool = getLiveSchool(schoolSlug, defaultSchool);
      setCurrentSchool(updatedSchool);
      loadSession();
      loadNotifications();
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug]);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Téléversement d'une photo de profil personnalisée
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const updated = { ...activeSession, avatarUrl: dataUrl };
      setActiveSession(updated);

      try {
        const stored = localStorage.getItem('schoolflow_active_session_v2');
        const parsed = stored ? JSON.parse(stored) : {};
        const newSession = { ...parsed, avatarUrl: dataUrl };
        localStorage.setItem('schoolflow_active_session_v2', JSON.stringify(newSession));
        broadcastLiveUpdate({
          action: 'session_updated',
          session: newSession,
        });
      } catch (err) {}
    };
    reader.readAsDataURL(file);
  };

  // Fermer la fenêtre de notifications ou profil au clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    if (isNotificationsOpen || isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationsOpen, isProfileOpen]);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = () => {
    if (typeof window === 'undefined') return;
    try {
      // Les enseignants et les parents ne doivent PAS recevoir les notifications des messages parents destinés à la Direction
      const currentRole = activeSession.roleId || 'directeur';
      if (currentRole === 'enseignant' || currentRole === 'parent') {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const raw =
        localStorage.getItem(`schoolflow_parent_messages_v1_${schoolSlug}`) ||
        localStorage.getItem('schoolflow_parent_messages_v1');
      if (raw) {
        const parsed: any[] = JSON.parse(raw);
        const real = parsed.filter(
          (m) =>
            m &&
            !m.parentName?.includes('Mme Touré (Mère de Cheick)') &&
            !m.parentName?.includes('M. Koffi (Père de Marie)') &&
            !m.parentName?.includes('Mme Bamba (Mère de Seydou)') &&
            !m.parentName?.includes('M. Diabaté (Père d’Awa)') &&
            !m.parentName?.includes('Mme Koné (Mère de Jean)')
        );
        const mapped = real.map((m) => {
          const isAbsence = m.category === 'absence';
          const isFinance = m.category === 'finance';
          const isDoc = m.category === 'document';
          const icon = isAbsence ? ShieldAlert : isFinance ? CreditCard : isDoc ? FileText : UserCheck;
          const iconColor = isAbsence
            ? 'text-amber-600 bg-amber-50'
            : isFinance
            ? 'text-emerald-600 bg-emerald-50'
            : isDoc
            ? 'text-indigo-600 bg-indigo-50'
            : 'text-blue-600 bg-blue-50';

          return {
            id: m.id || `msg-${Math.random()}`,
            sender: m.parentName || "Parent d'élève",
            role: m.studentName ? `Parent de ${m.studentName} (${m.studentGrade || ''})` : "Parent d'élève",
            type: m.category || 'info',
            message: m.subject ? `${m.subject} : ${m.message || ''}` : (m.message || ''),
            time: m.timestamp ? (m.timestamp.includes('T') ? m.timestamp.split('T')[0] : m.timestamp) : "Récemment",
            unread: m.status === 'new' || m.unread === true,
            icon,
            iconColor,
          };
        });
        setNotifications(mapped);
        const unread = mapped.filter((n) => n.unread).length;
        setUnreadCount(unread);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (e) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [schoolSlug]);

  const handleMarkAllAsRead = () => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    try {
      const raw =
        localStorage.getItem(`schoolflow_parent_messages_v1_${schoolSlug}`) ||
        localStorage.getItem('schoolflow_parent_messages_v1');
      if (raw) {
        const parsed: any[] = JSON.parse(raw);
        const updated = parsed.map((m) => ({ ...m, status: 'resolved', unread: false }));
        localStorage.setItem(`schoolflow_parent_messages_v1_${schoolSlug}`, JSON.stringify(updated));
        localStorage.setItem('schoolflow_parent_messages_v1', JSON.stringify(updated));
        broadcastLiveUpdate({ action: 'parent_messages_read', schoolSlug });
      }
    } catch (e) {}
  };

  const router = useRouter();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-30 px-3.5 sm:px-6 lg:px-8">
      {/* Input de sélection de photo de profil */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />
      {/* BANNIÈRE FLOTTANTE DE SALUTATION « BONJOUR [NOM] » (AFFICHÉE 8 SECONDES) */}
      {showWelcomeGreeting && (
        <div className="fixed top-18 right-3 sm:right-6 z-50 p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-900 text-white shadow-2xl border border-emerald-500/40 flex items-center gap-3.5 animate-in slide-in-from-top-6 fade-in duration-500 max-w-md backdrop-blur-md">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xl shrink-0 border border-emerald-400/30">
            👋
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black font-heading text-amber-300 flex items-center gap-1.5">
              <span>Bonjour {activeSession.fullName} !</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            </div>
            <p className="text-[11px] text-slate-200 mt-0.5 leading-snug">
              Bienvenue sur votre espace de gestion à <strong className="text-white">{currentSchool.shortName || currentSchool.name}</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWelcomeGreeting(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="w-full max-w-[1600px] h-full mx-auto flex items-center justify-between gap-4">
        {/* Left side: Hamburger button + Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 lg:hidden cursor-pointer"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile School Title Dynamique */}
          <div className="flex items-center gap-1.5 sm:hidden truncate max-w-[200px]">
            <span className="text-xs font-bold text-slate-900 truncate">
              {currentSchool.shortName || currentSchool.name}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 shrink-0">
              {currentSchool.academicYear}
            </span>
          </div>

          {/* Breadcrumb (Pandhowan style) */}
          <nav className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb}>
                  {idx > 0 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  )}
                  <span
                    className={
                      isLast
                        ? 'text-slate-900 font-bold'
                        : 'text-slate-500 hover:text-slate-700'
                    }
                  >
                    {crumb}
                  </span>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Right side: Academic Year + Notifications + User */}
        <div className="flex items-center gap-2.5 sm:gap-4 relative" ref={dropdownRef}>
          {/* Academic Year Dropdown Pill Dynamique */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>{currentSchool.academicYear}</span>
          </div>

          {/* Notification Bell Button */}
          <div className="relative">
            <button
              type="button"
              className={`relative p-2 rounded-xl transition-all cursor-pointer ${
                isNotificationsOpen
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              aria-label="Notifications"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-2 ring-white" />
                </span>
              )}
            </button>

            {/* POPUP / FENÊTRE DE NOTIFICATIONS ET MESSAGES PARENTS */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl border border-slate-200/90 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header Popup */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 font-heading">
                        Messages & Alertes Parents
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {unreadCount > 0 ? `${unreadCount} nouveaux messages` : 'Tout est à jour'}
                      </p>
                    </div>
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer"
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>

                {/* List of Messages */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center space-y-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                        <CheckCheck className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 font-heading">
                        Aucune notification pour le moment
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                        Tout est à jour. Les messages envoyés par les parents d’élèves apparaîtront ici en temps réel.
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const Icon = notif.icon;
                      return (
                        <div
                          key={notif.id}
                          className={`p-3.5 hover:bg-slate-50/80 transition-colors flex gap-3 cursor-pointer ${
                            notif.unread && unreadCount > 0 ? 'bg-emerald-50/20' : ''
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${notif.iconColor}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {notif.sender}
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
                                <Clock className="w-2.5 h-2.5" />
                                {notif.time}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 block">
                              {notif.role}
                            </span>
                            <p className="text-xs text-slate-700 leading-snug line-clamp-2">
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Link to Full Communication Module */}
                <div className="p-3 bg-slate-50 border-t border-slate-100">
                  <Link
                    href={`/${schoolSlug}/admin/communication`}
                    onClick={() => setIsNotificationsOpen(false)}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <span>Ouvrir la Messagerie</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Profil Utilisateur Interactif avec Téléversement de Photo */}
          <div className="relative pl-2 border-l border-slate-200" ref={profileRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2.5 p-1 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer group"
              title="Consulter et modifier mon profil"
            >
              <div className="relative">
                {activeSession.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeSession.avatarUrl}
                    alt={activeSession.fullName}
                    className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shadow-2xs group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-extrabold flex items-center justify-center text-xs shadow-2xs">
                    {activeSession.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {/* Pastille En Ligne active */}
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                </span>
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span
                  suppressHydrationWarning
                  className="text-xs font-black text-slate-900 font-heading leading-tight truncate max-w-[160px]"
                  title={activeSession.fullName}
                >
                  {activeSession.fullName}
                </span>
                <span
                  suppressHydrationWarning
                  className="text-[10px] font-bold text-emerald-700 truncate max-w-[160px]"
                >
                  {activeSession.roleId === 'directeur' ? '👑 Admin' : (activeSession.roleBadge || activeSession.role || 'Personnel')}
                </span>
              </div>
            </button>

            {/* FENÊTRE POPUP PROFIL UTILISATEUR */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-white rounded-3xl border border-slate-200/90 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                
                {/* Header Profil avec Photo, Bouton Caméra & Rôle */}
                <div className="p-5 bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 text-white relative text-center">
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(false)}
                    className="absolute top-3 right-3 p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex flex-col items-center">
                    <div className="relative mb-2">
                      {activeSession.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={activeSession.avatarUrl}
                          alt={activeSession.fullName}
                          className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-400 shadow-md"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-white font-black flex items-center justify-center text-xl border-2 border-emerald-400 shadow-md">
                          {activeSession.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      
                      {/* Bouton Caméra pour changer la photo */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md cursor-pointer transition-transform hover:scale-110"
                        title="Changer ma photo de profil"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h4 className="text-base font-black font-heading tracking-wide">
                      {activeSession.fullName}
                    </h4>
                    <p className="text-xs font-bold text-emerald-300 leading-tight mt-0.5">
                      {activeSession.roleId === 'directeur'
                        ? 'DR • Directeur des Études'
                        : activeSession.roleId === 'comptable'
                        ? 'Comptable / Gestionnaire'
                        : activeSession.roleId === 'secretaire'
                        ? 'Secrétaire de Direction'
                        : activeSession.roleId === 'assistant_direction'
                        ? 'Assistant(e) de Direction'
                        : activeSession.roleId === 'enseignant'
                        ? 'Enseignant / Professeur'
                        : activeSession.roleId === 'fondateur'
                        ? 'Fondateur / Fondatrice'
                        : activeSession.roleId === 'parent'
                        ? "Parent d'Élève"
                        : activeSession.role}
                    </p>
                    <p className="text-[11px] text-amber-300 font-extrabold uppercase tracking-wide mt-1">
                      {activeSession.roleId === 'directeur'
                        ? '👑 Admin • Contrôle Total'
                        : activeSession.roleId === 'fondateur'
                        ? 'Supervision Globale (Lecture Seule)'
                        : activeSession.roleId === 'comptable'
                        ? 'Gestionnaire Financier & Caisse'
                        : activeSession.roleId === 'enseignant'
                        ? 'Corps Enseignant & Notes'
                        : activeSession.roleId === 'secretaire'
                        ? 'Secrétariat & Inscriptions'
                        : activeSession.roleId === 'assistant_direction'
                        ? 'Direction Adjointe & Pédagogie'
                        : activeSession.roleId === 'parent'
                        ? 'Espace Famille & Scolarité'
                        : 'Administration & Scolarités'}
                    </p>
                  </div>
                </div>

                {/* Détails épurés sans répétition */}
                <div className="p-4 space-y-2 text-xs bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 text-[11px]">
                      {activeSession.roleId === 'parent' ? 'Identifiant Famille :' : 'Matricule Officiel :'}
                    </span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {activeSession.roleId === 'parent'
                        ? (activeSession.authCode || 'PAR-FAMILLE')
                        : activeSession.roleId === 'fondateur'
                        ? 'FND-2026-001'
                        : activeSession.roleId === 'directeur'
                        ? 'DIR-2026-001'
                        : activeSession.roleId === 'comptable'
                        ? 'CPT-2026-003'
                        : activeSession.roleId === 'enseignant'
                        ? 'ENS-2026-012'
                        : 'SEC-2026-005'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 text-slate-600 pt-1 border-t border-slate-200/60">
                    <span className="text-slate-400 text-[11px]">Établissement :</span>
                    <span className="font-bold text-slate-900 leading-snug break-words">
                      {currentSchool.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                    <span className="text-slate-400 text-[11px]">Année Scolaire :</span>
                    <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/70">
                      {currentSchool.academicYear}
                    </span>
                  </div>

                  {/* Coordonnées Officielles Renseignées (Lecture Seule) */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/80">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400 text-[11px]">
                        {activeSession.roleId === 'parent' ? 'Email de Contact :' : 'Email Pro :'}
                      </span>
                      <span className="font-mono font-semibold text-emerald-900 text-[11px] truncate max-w-[170px]" title={activeSession.email}>
                        {activeSession.email}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400 text-[11px]">
                        {activeSession.roleId === 'parent' ? 'Numéro Parent / Tuteur :' : 'Contact Direct :'}
                      </span>
                      <span className="font-mono font-bold text-emerald-900 text-[11px]">
                        {activeSession.phone || (
                          <span className="italic text-slate-400 font-sans font-normal text-[10.5px]">
                            Non renseigné
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[10px] text-slate-500 flex items-center gap-1.5 mt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        {activeSession.roleId === 'parent'
                          ? "Coordonnées officielles enregistrées lors de l'inscription de votre enfant."
                          : "Coordonnées certifiées conformes par la Direction de l'école."}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Boutons d'Action : Landing Page & Déconnexion */}
                <div className="p-3 bg-white space-y-2">
                  <Link
                    href="/landing"
                    onClick={() => setIsProfileOpen(false)}
                    className="w-full px-4 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center gap-2 border border-emerald-200 transition-colors"
                  >
                    <span>🌐</span>
                    <span>Landing Page & Tarifs</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push(`/${schoolSlug}/login`);
                    }}
                    className="w-full px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 flex items-center justify-center gap-2 border border-rose-200 transition-colors cursor-pointer"
                  >
                    <span>🔒</span>
                    <span>Verrouiller la session</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
