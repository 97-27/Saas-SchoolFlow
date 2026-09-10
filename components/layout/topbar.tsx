'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { School } from '@/lib/data/types';
import { defaultSchool } from '@/lib/data/mock-data';
import {
  getLiveSchool,
  getLiveStaffUsers,
  saveLiveStaffUsers,
  saveLiveSchool,
  DATA_UPDATED_EVENT,
  broadcastLiveUpdate,
} from '@/lib/data/live-store';
import { uploadAvatarToSupabase } from '@/lib/supabase/services';
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
  FileText,
  Camera,
  Upload,
  Pencil,
  Edit2,
  Check,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface TopbarProps {
  onMenuClick?: () => void;
  onMenuToggle?: () => void;
  title?: string;
  schoolSlug?: string;
  breadcrumbs?: string[];
}

export function Topbar({
  onMenuClick,
  onMenuToggle,
  title = "Tableau de Bord Administratif & Pédagogique",
  schoolSlug = 'epc-manoi',
  breadcrumbs = ['Tableau de bord', "Vue d'ensemble"],
}: TopbarProps) {
  const router = useRouter();
  const [currentSchool, setCurrentSchool] = useState<School>(() => getLiveSchool(schoolSlug, defaultSchool));
  const [activeSession, setActiveSession] = useState<{
    fullName: string;
    email: string;
    phone: string;
    role: string;
    roleId: string;
    roleBadge: string;
    department: string;
    avatarUrl: string;
    authCode?: string;
  }>({
    fullName: currentSchool.founderName || 'Direction',
    email: '',
    phone: '',
    role: 'Administration',
    roleId: 'directeur',
    roleBadge: '👑 Admin',
    department: 'Direction Générale',
    avatarUrl: '',
    authCode: '',
  });

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showWelcomeGreeting, setShowWelcomeGreeting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger la session active réelle
  useEffect(() => {
    const loadSession = () => {
      const live = getLiveSchool(schoolSlug, defaultSchool);
      const allStaff = getLiveStaffUsers(schoolSlug);

      try {
        const stored = localStorage.getItem('schoolflow_active_session_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.fullName) {
            const isFounder = parsed.roleId === 'fondateur';
            const isDirector = parsed.roleId === 'directeur';

            // Chercher le membre correspondant dans liveStaffUsers STRICTEMENT par son code d'accès officiel
            const staffMember = parsed.authCode && !isFounder && !isDirector
              ? allStaff.find((s) => s.authCode?.toUpperCase() === parsed.authCode?.toUpperCase())
              : undefined;

            const cleanEmail =
              parsed.email ||
              (staffMember?.email && !staffMember.email.includes('etablissement.ci') && !staffMember.email.includes('epc-manoi.ci')
                ? staffMember.email
                : (staffMember?.email || ''));

            const pureFullName = (parsed.fullName || staffMember?.fullName || '').replace(/\s*\((Fondateur|Fondatrice|Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim();

            // Photo strictement personnelle, clée uniquement sur le code d'accès unique de la
            // personne. Les anciennes clés par nom/rôle et la clé globale "custom" faisaient
            // qu'une photo importée par une personne s'affichait chez n'importe qui d'autre
            // sur le même navigateur (ex: un parent voyait la photo du Directeur).
            const cleanCode = (parsed.authCode || staffMember?.authCode || '').toUpperCase();
            const persistentAvatar =
              (cleanCode ? localStorage.getItem(`schoolflow_user_avatar_${cleanCode}`) : null) ||
              staffMember?.avatarUrl ||
              parsed.avatarUrl ||
              '';

            setActiveSession({
              fullName: pureFullName || parsed.fullName,
              email: cleanEmail,
              phone: parsed.phone || staffMember?.phone || '',
              role: isFounder
                ? 'Fondateur & Promoteur'
                : isDirector
                ? 'Directeur des Études (Admin)'
                : (staffMember?.role || parsed.role || 'Personnel'),
              roleId: parsed.roleId || 'directeur',
              roleBadge: isFounder
                ? '👑 Fondateur (Admin)'
                : isDirector
                ? '👑 Direction (Admin)'
                : (parsed.roleBadge || 'Personnel'),
              department: parsed.department || (isFounder ? 'Présidence & Conseil' : isDirector ? 'Direction Générale' : 'Direction'),
              avatarUrl: persistentAvatar,
              authCode: cleanCode,
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

      // Valeur par défaut
      const defaultDir = allStaff.find((s) => s.roleId === 'directeur');
      const defaultName = (defaultDir?.fullName || live.directorName || 'LAWANI MOUHAMED').replace(/\s*\((Fondateur|Fondatrice|Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim();
      const persistentDirAvatar =
        localStorage.getItem('schoolflow_user_avatar_DIR-2026') ||
        defaultDir?.avatarUrl ||
        '';

      setActiveSession({
        fullName: defaultName,
        email: defaultDir?.email || '',
        phone: defaultDir?.phone || '',
        role: 'Directeur des Études (Admin)',
        roleId: 'directeur',
        roleBadge: '👑 Direction (Admin)',
        department: 'Direction des Études',
        avatarUrl: persistentDirAvatar,
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

  // État pour la modification en direct des coordonnées du profil
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  const startEditingProfile = () => {
    setEditFullName(activeSession.fullName || '');
    setEditEmail(activeSession.email || '');
    setEditPhone(activeSession.phone || '');
    setIsEditingContact(true);
    setProfileSuccessMsg(null);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = editFullName.replace(/\s*\((Fondateur|Fondatrice|Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim();
    const cleanEmail = editEmail.trim();
    const cleanPhone = editPhone.trim();

    const updated = {
      ...activeSession,
      fullName: cleanName || activeSession.fullName,
      email: cleanEmail,
      phone: cleanPhone,
    };
    setActiveSession(updated);

    try {
      const stored = localStorage.getItem('schoolflow_active_session_v2');
      const parsed = stored ? JSON.parse(stored) : {};
      const newSession = {
        ...parsed,
        fullName: cleanName || parsed.fullName,
        pureName: cleanName || parsed.pureName,
        email: cleanEmail,
        phone: cleanPhone,
      };
      localStorage.setItem('schoolflow_active_session_v2', JSON.stringify(newSession));
    } catch (e) {}

    try {
      const allStaff = getLiveStaffUsers(schoolSlug);
      const nextStaff = allStaff.map((s) => {
        if (s.roleId === activeSession.roleId || s.authCode === (activeSession as any).authCode || s.id === 'staff-founder' || s.id === 'staff-001') {
          if (s.roleId === activeSession.roleId) {
            return {
              ...s,
              fullName: cleanName || s.fullName,
              email: cleanEmail,
              phone: cleanPhone,
            };
          }
        }
        return s;
      });
      saveLiveStaffUsers(nextStaff, schoolSlug);
    } catch (e) {}

    try {
      if (activeSession.roleId === 'fondateur' && cleanName) {
        saveLiveSchool({ ...currentSchool, founderName: cleanName });
      } else if (activeSession.roleId === 'directeur' && cleanName) {
        saveLiveSchool({ ...currentSchool, directorName: cleanName, studiesDirectorName: cleanName });
      }
    } catch (e) {}

    broadcastLiveUpdate({
      action: 'session_updated',
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
    });

    setProfileSuccessMsg('Vos coordonnées ont été enregistrées avec succès !');
    setIsEditingContact(false);
    setTimeout(() => {
      setProfileSuccessMsg(null);
    }, 4000);
  };

  // Téléversement d'une photo de profil personnalisée
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optimisation & compression haute fidélité (max 400x400) pour fluidité et persistance instantanée
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      const maxDim = 400;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
      }
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Envoi asynchrone vers Supabase Cloud Storage
      canvas.toBlob(async (blob) => {
        let finalAvatarUrl = compressedDataUrl;
        if (blob) {
          const userIdentifier = (
            (activeSession as any)?.authCode ||
            activeSession.roleId ||
            'user'
          ).toLowerCase().replace(/[^a-z0-9]/g, '_');
          const fileName = `avatar_${schoolSlug}_${userIdentifier}_${Date.now()}.jpg`;
          try {
            const cloudUrl = await uploadAvatarToSupabase(blob, fileName);
            if (cloudUrl) {
              finalAvatarUrl = cloudUrl;
            }
          } catch (e) {}
        }

        const updated = { ...activeSession, avatarUrl: finalAvatarUrl };
        setActiveSession(updated);

        try {
          const stored = localStorage.getItem('schoolflow_active_session_v2');
          const parsed = stored ? JSON.parse(stored) : {};
          const newSession = { ...parsed, avatarUrl: finalAvatarUrl };
          localStorage.setItem('schoolflow_active_session_v2', JSON.stringify(newSession));

          // Clé indélébile de sauvegarde permanente strictement par code d'accès personnel.
          // Les anciennes clés par rôle et par nom (et la clé globale "custom") faisaient
          // qu'une photo importée par une personne s'affichait ensuite chez toute autre
          // personne du même rôle ou homonyme sur le même navigateur.
          if (parsed.authCode) {
            localStorage.setItem(`schoolflow_user_avatar_${parsed.authCode.toUpperCase()}`, finalAvatarUrl);
          }

          // Sauvegarder également dans le registre du personnel Cloud (staffUsers) — uniquement
          // la personne exacte identifiée par son code d'accès, jamais par rôle ou nom partagé.
          const allStaff = getLiveStaffUsers(schoolSlug);
          const nextStaff = allStaff.map((s) => {
            if (parsed.authCode && s.authCode?.toUpperCase() === parsed.authCode.toUpperCase()) {
              return { ...s, avatarUrl: finalAvatarUrl };
            }
            return s;
          });
          saveLiveStaffUsers(nextStaff, schoolSlug);

          broadcastLiveUpdate({
            action: 'session_updated',
            session: newSession,
            avatarUrl: finalAvatarUrl,
            schoolSlug,
          });

          setProfileSuccessMsg('Photo de profil mise à jour et synchronisée avec le Cloud !');
          setTimeout(() => setProfileSuccessMsg(null), 4000);
        } catch (err) {}
      }, 'image/jpeg', 0.85);
    };
    img.src = objectUrl;
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



  // Clé locale des réponses de la Direction que CE parent a déjà ouvertes dans la cloche de
  // notifications — les messages parents n'ont pas de champ "vu par le parent" séparé du
  // statut interne utilisé par la Direction (qui ne doit pas être modifié par le parent).
  const PARENT_SEEN_REPLIES_KEY = 'schoolflow_parent_seen_replies_v1';

  const loadParentNotifications = () => {
    try {
      const session: any = activeSession;
      const cleanAuthCode = (session.authCode || '').toUpperCase();
      const myPhoneDigits = (session.phone || '').replace(/\D/g, '');
      const myName = (session.fullName || '').toLowerCase().trim();

      const raw =
        localStorage.getItem(`schoolflow_parent_messages_v1_${schoolSlug}`) ||
        localStorage.getItem('schoolflow_parent_messages_v1');
      const allMsgs: any[] = raw ? JSON.parse(raw) : [];

      const seenRaw = cleanAuthCode ? localStorage.getItem(`${PARENT_SEEN_REPLIES_KEY}_${cleanAuthCode}`) : null;
      const seenIds: string[] = seenRaw ? JSON.parse(seenRaw) : [];

      const myRepliedMessages = allMsgs.filter((m) => {
        if (!m || !m.directorReply) return false;
        const mPhone = (m.parentPhone || '').replace(/\D/g, '');
        const mName = (m.parentName || '').toLowerCase().trim();
        return (myPhoneDigits && mPhone === myPhoneDigits) || (myName && mName === myName);
      });

      const mapped = myRepliedMessages
        .sort((a, b) => (a.directorReplyAt || a.timestamp || '') < (b.directorReplyAt || b.timestamp || '') ? 1 : -1)
        .map((m) => ({
          id: m.id,
          sender: 'La Direction de l’École',
          role: `Réponse à : ${m.subject || 'votre message'}`,
          type: m.category || 'info',
          message: m.directorReply,
          time: (m.directorReplyAt || m.timestamp || '').includes('T')
            ? (m.directorReplyAt || m.timestamp).split('T')[0]
            : (m.directorReplyAt || m.timestamp || 'Récemment'),
          unread: !seenIds.includes(m.id),
          icon: CheckCheck,
          iconColor: 'text-emerald-600 bg-emerald-50',
        }));

      setNotifications(mapped);
      setUnreadCount(mapped.filter((n) => n.unread).length);
    } catch (e) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const loadNotifications = () => {
    if (typeof window === 'undefined') return;
    try {
      const currentRole = activeSession.roleId || 'directeur';

      // Les parents ont leurs propres notifications : uniquement les réponses écrites par la
      // Direction à LEURS messages (jamais les messages des autres parents destinés à la
      // Direction). Les enseignants n'ont accès à aucune notification de messagerie parent.
      if (currentRole === 'parent') {
        loadParentNotifications();
        return;
      }
      if (currentRole === 'enseignant') {
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

  // Pour un parent, la réponse de la Direction peut arriver alors qu'il navigue sur une page
  // qui ne tire pas elle-même le cloud (ex: Notes & Bulletins) — on tire ici périodiquement
  // pour que la cloche de notification reste à jour en temps quasi réel, où que le parent soit.
  useEffect(() => {
    if (activeSession.roleId !== 'parent') return;
    const pull = () => {
      fetch(`/api/sync?slug=${encodeURIComponent(schoolSlug)}&t=${Date.now()}`)
        .then((res) => res.json())
        .then((result) => {
          const cloudAll: any[] = Array.isArray(result?.data?.parentMessages) ? result.data.parentMessages : [];
          if (cloudAll.length === 0) return;
          try {
            const rawLocal = localStorage.getItem(`schoolflow_parent_messages_v1_${schoolSlug}`);
            const localAll: any[] = rawLocal ? JSON.parse(rawLocal) : [];
            const byId = new Map<string, any>();
            localAll.forEach((m) => byId.set(m.id, m));
            cloudAll.forEach((m) => byId.set(m.id, m));
            const merged = Array.from(byId.values());
            localStorage.setItem(`schoolflow_parent_messages_v1_${schoolSlug}`, JSON.stringify(merged));
            localStorage.setItem('schoolflow_parent_messages_v1', JSON.stringify(merged));
          } catch (e) {}
          loadParentNotifications();
        })
        .catch(() => {});
    };
    pull();
    const interval = setInterval(pull, 45000);
    return () => clearInterval(interval);
  }, [activeSession.roleId, schoolSlug]);

  const handleMarkAllAsRead = () => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));

    if (activeSession.roleId === 'parent') {
      // Le parent ne peut jamais changer le statut interne (traité/en cours) réservé à la
      // Direction : on marque seulement, localement, les réponses comme vues par ce parent.
      try {
        const cleanAuthCode = ((activeSession as any).authCode || '').toUpperCase();
        if (!cleanAuthCode) return;
        const ids = notifications.map((n) => n.id);
        const seenRaw = localStorage.getItem(`${PARENT_SEEN_REPLIES_KEY}_${cleanAuthCode}`);
        const prevSeen: string[] = seenRaw ? JSON.parse(seenRaw) : [];
        const nextSeen = Array.from(new Set([...prevSeen, ...ids]));
        localStorage.setItem(`${PARENT_SEEN_REPLIES_KEY}_${cleanAuthCode}`, JSON.stringify(nextSeen));
      } catch (e) {}
      return;
    }

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
            onClick={onMenuClick || onMenuToggle}
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

                {/* Footer Link to Full Communication Module — chaque rôle reste dans son propre
                    espace : un parent qui clique ici ne doit jamais basculer sur la boîte de
                    réception interne de la Direction (/communication), réservée au personnel. */}
                <div className="p-3 bg-slate-50 border-t border-slate-100">
                  <Link
                    href={
                      activeSession.roleId === 'parent'
                        ? `/${schoolSlug}/admin/messagerie-parent`
                        : `/${schoolSlug}/admin/communication`
                    }
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      if (activeSession.roleId === 'parent') handleMarkAllAsRead();
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <span>{activeSession.roleId === 'parent' ? 'Voir mes messages' : 'Ouvrir la Messagerie'}</span>
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
                      {activeSession.roleId === 'parent'
                        ? 'Identifiant Famille :'
                        : activeSession.roleId === 'fondateur'
                        ? 'Réf. Promoteur & Mandat :'
                        : 'Matricule Officiel :'}
                    </span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {activeSession.roleId === 'parent'
                        ? (activeSession.roleBadge || 'PAR-FAMILLE')
                        : activeSession.roleId === 'fondateur'
                        ? 'FND-001 (Promoteur)'
                        : activeSession.roleId === 'directeur'
                        ? 'DIR-001 (Direction)'
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

                  {/* Mode Modification des Coordonnées en direct */}
                  {isEditingContact ? (
                    <form onSubmit={handleSaveProfile} className="space-y-3 pt-2 border-t border-slate-200">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Nom et Prénoms *
                        </label>
                        <input
                          type="text"
                          required
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          placeholder="Nom et Prénoms"
                          className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Email Professionnel
                        </label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Ex: direction@ecole.ci"
                          className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-mono font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Contact Téléphonique / WhatsApp
                        </label>
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="Ex: +225 07 48 92 11 00"
                          className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingContact(false)}
                          className="w-1/2 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="w-1/2 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm transition-all cursor-pointer"
                        >
                          💾 Enregistrer
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Coordonnées Officielles Renseignées (Lecture Seule) */
                    <div className="space-y-2 pt-2 border-t border-slate-200/80">
                      {profileSuccessMsg && (
                        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-300 text-[11px] text-emerald-800 font-bold flex items-center gap-1.5 animate-in fade-in">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{profileSuccessMsg}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 text-[11px]">
                          {activeSession.roleId === 'parent' ? 'Email de Contact :' : 'Email Pro :'}
                        </span>
                        {activeSession.email && activeSession.email.trim() ? (
                          <span className="font-mono font-semibold text-emerald-900 text-[11px] truncate max-w-[170px]" title={activeSession.email}>
                            {activeSession.email}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded text-[10.5px] border border-amber-200/60">
                            Non renseigné
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 text-[11px]">
                          {activeSession.roleId === 'parent' ? 'Numéro Parent / Tuteur :' : 'Contact Direct :'}
                        </span>
                        {activeSession.phone && activeSession.phone.trim() ? (
                          <span className="font-mono font-bold text-emerald-900 text-[11px]">
                            {activeSession.phone}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded text-[10.5px] border border-amber-200/60">
                            Non renseigné
                          </span>
                        )}
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[10px] text-slate-500 flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {activeSession.roleId === 'parent'
                              ? "Coordonnées officielles d'inscription."
                              : "Coordonnées certifiées par l'école."}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={startEditingProfile}
                          className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 shrink-0 ml-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 text-[10.5px] transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Modifier</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Boutons d'Action : Landing Page (Fondateur/Directeur uniquement) & Déconnexion */}
                <div className="p-3 bg-white space-y-2">
                  {(activeSession.roleId === 'fondateur' || activeSession.roleId === 'directeur') && (
                    <Link
                      href="/landing"
                      onClick={() => setIsProfileOpen(false)}
                      className="w-full px-4 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center gap-2 border border-emerald-200 transition-colors"
                    >
                      <span>🌐</span>
                      <span>Landing Page & Tarifs</span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      try {
                        localStorage.removeItem('schoolflow_active_session_v2');
                      } catch (e) {}
                      // Efface le cookie lu par proxy.ts : sans ça, le lien admin resterait
                      // accessible sans reconnexion malgré le bouton "Verrouiller".
                      document.cookie = 'sf_admin_session=; path=/; max-age=0; SameSite=Lax';
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
