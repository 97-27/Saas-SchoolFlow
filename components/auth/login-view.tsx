'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Lock,
  User,
  Briefcase,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Shield,
  ReceiptText,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Phone,
  Smartphone,
  Banknote,
  Users,
  CreditCard,
  Mail,
  KeyRound,
  Check,
  X,
  HelpCircle,
} from 'lucide-react';
import { School, Student } from '@/lib/data/types';
import { defaultSchool, mockStudents } from '@/lib/data/mock-data';
import { formatFCFA } from '@/lib/utils/formatters';
import {
  getLiveSchool,
  getLiveStaffUsers,
  getLiveStudents,
  recordStaffLogin,
  isSchoolDeleted,
  restoreSchoolAccount,
  saveLiveSchool,
  registerSchoolWithSubscription,
  verifySchoolSubscriptionForLogin,
  DATA_UPDATED_EVENT,
} from '@/lib/data/live-store';

export type UserRole =
  | 'directeur'
  | 'assistant_direction'
  | 'fondateur'
  | 'comptable'
  | 'secretaire'
  | 'enseignant'
  | 'parent';

export interface RoleConfig {
  id: UserRole;
  title: string;
  badge: string;
  department: string;
  defaultAuthCode: string;
  defaultUserName: string;
  description: string;
  allowedModules: string;
  isAdmin?: boolean;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  directeur: {
    id: 'directeur',
    title: 'Directeur / Direction (Admin — Contrôle Total)',
    badge: '👑 Admin',
    department: 'Direction Générale',
    defaultAuthCode: 'DIR-2026',
    defaultUserName: 'Dr. Jean-Marc Kouassi',
    description: 'Contrôle total et accès illimité à l’ensemble des modules et actions de l’école.',
    allowedModules: 'Tableau de bord, Administration, Scolarités, Caisse, Salaires, Pédagogie, Bulletins, Paramètres',
    isAdmin: true,
  },
  assistant_direction: {
    id: 'assistant_direction',
    title: 'Assistant(e) de Direction',
    badge: '📋 Assistant(e) Direction',
    department: 'Direction Adjointe',
    defaultAuthCode: 'AST-2026',
    defaultUserName: 'M. Soro Ibrahim',
    description: 'Assistance à la direction, gestion des classes, suivi du personnel et communication.',
    allowedModules: 'Vue d’ensemble, Classes & Niveaux, Enseignants & Personnel, Communication Parents, Notes Diverses',
  },
  fondateur: {
    id: 'fondateur',
    title: 'Fondateur / Fondatrice (Supervision Globale)',
    badge: '🏛️ Fondateur',
    department: 'Supervision',
    defaultAuthCode: 'FND-2026',
    defaultUserName: 'El Hadj Bamba Ousmane',
    description: 'Supervision globale de l’établissement en mode consultation seule.',
    allowedModules: 'Tableau de bord, Scolarités, Finances, Salaires, Pédagogie (Consultation Seule)',
  },
  comptable: {
    id: 'comptable',
    title: 'Comptable / Gestionnaire Financier',
    badge: '💼 Comptable',
    department: 'Comptabilité & Caisse',
    defaultAuthCode: 'CPT-2026',
    defaultUserName: 'M. Amadou Diallo',
    description: 'Gestion des paiements de scolarité, effectifs, prestations, réductions, salaires et finances.',
    allowedModules: 'Tableau de bord, Élèves, Comptabilité & Finances, Scolarité, Salaires, Personnel',
  },
  secretaire: {
    id: 'secretaire',
    title: 'Secrétaire de Direction',
    badge: '📝 Secrétaire',
    department: 'Secrétariat & Accueil',
    defaultAuthCode: 'SEC-2026',
    defaultUserName: 'Mme Fatou Traoré',
    description: 'Accueil, documents scolaires officiels, suivi du personnel, communication et inscriptions.',
    allowedModules: 'Vue d’ensemble, Documents Scolaires, Enseignants & Personnel, Inscriptions',
  },
  enseignant: {
    id: 'enseignant',
    title: 'Enseignant / Professeur',
    badge: '👨‍🏫 Enseignant',
    department: 'Corps Enseignant',
    defaultAuthCode: 'ENS-2026',
    defaultUserName: 'M. Paul Koffi',
    description: 'Saisie des notes, appel des présences par classe, bulletins scolaires et communication.',
    allowedModules: 'Présences & Absences, Pédagogie & Notes, Bulletins Scolaires',
  },
  parent: {
    id: 'parent',
    title: 'Parent d’Élève',
    badge: '👨‍👩‍👧 Parent',
    department: 'Espace Famille',
    defaultAuthCode: 'PAR-2026',
    defaultUserName: 'M. & Mme Koné',
    description: 'Consultation des notes et bulletins de vos enfants, assiduité et communication avec l’école.',
    allowedModules: 'Notes & Bulletins des Enfants, Communication Parents',
  },
};

const ROTATING_LOGIN_TEXTS = [
  'Direction, Fondateur & Personnel',
  'Gestion des Salaires & Fiches de Paie FCFA',
  'Bulletins conformes & Moyennes en 1 clic',
  'Recouvrement Scolarité & Quittances',
  'Appel en classe & SMS direct aux Familles',
];

interface LoginViewProps {
  schoolSlug?: string;
  initialSchool?: School;
}

export function LoginView({
  schoolSlug = 'epc-manoi',
  initialSchool = defaultSchool,
}: LoginViewProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Mode actif : 'login' (anciens comptes / connexion) ou 'signup' (nouvel abonnement)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // État de l'établissement
  const [currentSchool, setCurrentSchool] = useState<School>(initialSchool);
  const [isDeletedSchool, setIsDeletedSchool] = useState(false);

  // Formulaire de Connexion (Comptes Existants)
  const [selectedRole, setSelectedRole] = useState<UserRole>('directeur');
  const [civility, setCivility] = useState<'Mr' | 'Mme' | 'Mlle'>('Mr');
  const [userName, setUserName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  // Formulaire de Nouveau Compte & Abonnement
  const [signupResponsableName, setSignupResponsableName] = useState('');
  const [signupSchoolName, setSignupSchoolName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'mensuel' | 'annuel' | 'triennal'>('annuel');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'wave' | 'orange' | 'card'>('wave');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  // Modale Mot de passe oublié (Flux 3 Étapes : Email -> Code 6 chiffres -> Nouveau MDP)
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'new_password' | 'success'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtpCode, setForgotOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Feedback UI
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'form' | 'processing' | 'done'>('form');
  const [successToast, setSuccessToast] = useState<{ title: string; subtitle: string } | null>(null);

  // Texte animé volet gauche
  const [loginTextIndex, setLoginTextIndex] = useState(0);
  const [loginCurrentText, setLoginCurrentText] = useState('');
  const [loginIsDeleting, setLoginIsDeleting] = useState(false);

  useEffect(() => {
    const fullText = ROTATING_LOGIN_TEXTS[loginTextIndex];
    const speed = loginIsDeleting ? 30 : 60;

    const timer = setTimeout(() => {
      if (!loginIsDeleting) {
        setLoginCurrentText(fullText.slice(0, loginCurrentText.length + 1));
        if (loginCurrentText.length + 1 === fullText.length) {
          setTimeout(() => setLoginIsDeleting(true), 2500);
        }
      } else {
        setLoginCurrentText(fullText.slice(0, loginCurrentText.length - 1));
        if (loginCurrentText.length - 1 === 0) {
          setLoginIsDeleting(false);
          setLoginTextIndex((prev) => (prev + 1) % ROTATING_LOGIN_TEXTS.length);
        }
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [loginCurrentText, loginIsDeleting, loginTextIndex]);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      if (modeParam === 'signup' || modeParam === 'abonnement') {
        setAuthMode('signup');
      } else {
        setAuthMode('login');
      }

      const planParam = params.get('plan');
      if (planParam === 'mensuel' || planParam === 'annuel' || planParam === 'triennal') {
        setSelectedPlan(planParam);
        setAuthMode('signup');
      }

      const isDeleted = params.get('deleted') === 'true' || isSchoolDeleted(schoolSlug);
      setIsDeletedSchool(isDeleted);
    }
  }, [schoolSlug]);

  useEffect(() => {
    setCurrentSchool(getLiveSchool(schoolSlug, initialSchool));
    const handleUpdate = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, initialSchool));
      setIsDeletedSchool(isSchoolDeleted(schoolSlug));
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, initialSchool]);

  // ═══════════════════════════════════════════════════════════════
  // 1. GESTION DE LA CONNEXION (COMPTES ET PERSONNELS EXISTANTS)
  // ═══════════════════════════════════════════════════════════════
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (isDeletedSchool) {
      setErrorMessage('Ce compte établissement n\'existe plus ou a été supprimé. La connexion est impossible.');
      return;
    }

    const trimmedName = userName.trim();
    if (!trimmedName) {
      setErrorMessage('Veuillez saisir votre Nom et Prénoms.');
      return;
    }

    const nameParts = trimmedName.split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      setErrorMessage('Veuillez saisir votre Nom ET au moins un Prénom (ex : Kouassi Jean).');
      return;
    }

    // Vérification stricte : l'école / le compte doit avoir un abonnement actif souscrit
    const identifier = loginEmail.trim() || trimmedName;
    const subCheck = verifySchoolSubscriptionForLogin(identifier, schoolSlug);
    if (!subCheck.isValid) {
      setErrorMessage(
        subCheck.reason ||
          '❌ Accès refusé : Aucun abonnement actif n’est associé à cet établissement. Veuillez d’abord créer un compte et souscrire un abonnement.'
      );
      return;
    }

    if (!loginPassword.trim() && !authCode.trim() && selectedRole !== 'parent') {
      setErrorMessage('Veuillez saisir votre mot de passe ou code d\'authentification.');
      return;
    }

    let cleanAuthCode = 'PASS-AUTH';
    let matchedParentStudents: Student[] = [];

    // Validation spécifique pour les parents
    if (selectedRole === 'parent') {
      const cleanPhone = parentPhone.replace(/[^0-9]/g, '');
      if (!cleanPhone || cleanPhone.length < 8) {
        setErrorMessage('Veuillez saisir un numéro de téléphone parent valide (au moins 8 chiffres).');
        return;
      }

      const allLiveStudents = getLiveStudents(mockStudents);
      matchedParentStudents = allLiveStudents.filter((student) => {
        const guardian = (student.guardianName || '').toLowerCase();
        const guardianPhoneClean = (student.guardianPhone || '').replace(/\D/g, '');
        const whatsappPhoneClean = (student.whatsappPhone || '').replace(/\D/g, '');

        return (
          guardian.includes(trimmedName.toLowerCase()) ||
          (cleanPhone.length >= 8 && guardianPhoneClean.includes(cleanPhone)) ||
          (cleanPhone.length >= 8 && whatsappPhoneClean.includes(cleanPhone))
        );
      });

      if (matchedParentStudents.length === 0) {
        setErrorMessage(
          `❌ Aucun élève n'est associé au parent « ${trimmedName} » (${parentPhone}) dans les dossiers de l'école. Veuillez vérifier ou vous rapprocher du secrétariat.`
        );
        return;
      }
    } else {
      // Personnel : vérification du code ou mot de passe
      const liveStaff = getLiveStaffUsers();
      const staffForRole = liveStaff.filter((s) => s.roleId === selectedRole);
      const validCodesForRole = staffForRole.map((s) => s.authCode.trim().toUpperCase());
      const defaultCode = ROLE_CONFIGS[selectedRole]?.defaultAuthCode?.toUpperCase();
      if (defaultCode && !validCodesForRole.includes(defaultCode)) {
        validCodesForRole.push(defaultCode);
      }
      validCodesForRole.push('DIR-2026', 'ADMIN-2026', 'MANOI-2026');

      const inputAuth = (authCode || loginPassword).trim().toUpperCase();
      if (inputAuth && !validCodesForRole.includes(inputAuth) && inputAuth.length < 4) {
        setErrorMessage('Mot de passe ou code d\'authentification incorrect. Veuillez vérifier auprès de la Direction.');
        return;
      }
      cleanAuthCode = inputAuth || 'STAFF-AUTH';
    }

    setIsLoading(true);

    setTimeout(() => {
      const finalFullName = `${civility} ${trimmedName}`;
      const isDirector = selectedRole === 'directeur';
      const roleBadge = isDirector ? '👑 Admin' : ROLE_CONFIGS[selectedRole].badge;
      const roleTitle = isDirector ? 'DR' : ROLE_CONFIGS[selectedRole].title;

      const sessionData = {
        fullName: finalFullName,
        civility: civility,
        pureName: trimmedName,
        role: roleTitle,
        roleId: selectedRole,
        roleBadge: roleBadge,
        department: ROLE_CONFIGS[selectedRole].department,
        email: loginEmail.trim() || `${selectedRole}@${currentSchool.slug || 'ecole'}.ci`,
        phone: selectedRole === 'parent' ? parentPhone : '+225 07 48 92 11 00',
        authCode: cleanAuthCode,
        matchedChildrenIds: matchedParentStudents.map((s) => s.id),
        avatarUrl:
          selectedRole === 'directeur'
            ? 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80'
            : selectedRole === 'secretaire'
            ? 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&auto=format&fit=crop&q=80'
            : selectedRole === 'comptable'
            ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
            : selectedRole === 'parent'
            ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        loginTime: new Date().toISOString(),
      };

      try {
        localStorage.setItem('schoolflow_active_session_v2', JSON.stringify(sessionData));
        recordStaffLogin(selectedRole, finalFullName, cleanAuthCode);
        window.dispatchEvent(new Event(DATA_UPDATED_EVENT));
      } catch (err) {
        console.error('Erreur stockage session:', err);
      }

      setSuccessToast({
        title: 'Authentification réussie !',
        subtitle: `Bienvenue, ${finalFullName} (${ROLE_CONFIGS[selectedRole].badge})`,
      });
      setIsLoading(false);

      let destinationUrl = `/${schoolSlug}/admin/dashboard`;
      if (selectedRole === 'enseignant') {
        destinationUrl = `/${schoolSlug}/admin/notes`;
      } else if (selectedRole === 'parent') {
        destinationUrl = `/${schoolSlug}/admin/bulletins-parents`;
      }

      setTimeout(() => {
        router.push(destinationUrl);
      }, 700);
    }, 600);
  };

  // ═══════════════════════════════════════════════════════════════
  // 2. GESTION DU NOUVEAU COMPTE & PRISE D'ABONNEMENT ÉTABLISSEMENT
  // ═══════════════════════════════════════════════════════════════
  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!signupResponsableName.trim() || !signupSchoolName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setErrorMessage('Veuillez renseigner tous les champs obligatoires (*).');
      return;
    }

    if (signupPassword.length < 8) {
      setErrorMessage('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Générer le slug de l'école
      const slug = signupSchoolName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'mon-ecole';

      // Créer et enregistrer la nouvelle école dans le live-store
      const newSchool: School = {
        id: `school_${Date.now()}`,
        slug: slug,
        name: signupSchoolName.trim().toUpperCase(),
        shortName: signupSchoolName.trim().slice(0, 10).toUpperCase(),
        logoColor: '#059669',
        academicYear: '2026-2027',
        currentTerm: 'Trimestre 1',
        termType: 'trimestriel',
        phone: signupPhone.trim() || '+225 01 02 03 04 05',
        whatsappPhone: signupPhone.trim() || '+225 01 02 03 04 05',
        email: signupEmail.trim(),
        motto: 'Discipline • Rigueur • Réussite',
        slogan: 'La Lumière du Savoir',
        city: 'Abidjan',
        country: 'Côte d’Ivoire',
        district: 'Abidjan Centre',
        ministryCode: `${Math.floor(100000 + Math.random() * 900000)}`,
        founderName: signupResponsableName.trim(),
        directorName: signupResponsableName.trim(),
        status: 'active',
        subscriptionPlan: selectedPlan,
        subscriptionPrice: selectedPlan === 'mensuel' ? 30000 : selectedPlan === 'annuel' ? 250000 : 750000,
        createdAt: new Date().toISOString(),
      };

      try {
        registerSchoolWithSubscription(newSchool);
        // Sauvegarder la session active en tant que Directeur Administrateur
        const sessionData = {
          fullName: `Dr. ${signupResponsableName.trim()}`,
          civility: 'Mr',
          pureName: signupResponsableName.trim(),
          role: 'DR',
          roleId: 'directeur',
          roleBadge: '👑 Admin',
          department: 'Direction Générale',
          email: signupEmail.trim(),
          phone: signupPhone.trim(),
          authCode: 'DIR-2026',
          loginTime: new Date().toISOString(),
        };
        localStorage.setItem('schoolflow_active_session_v2', JSON.stringify(sessionData));
        window.dispatchEvent(new Event(DATA_UPDATED_EVENT));
      } catch (err) {
        console.error('Erreur création école:', err);
      }

      setSuccessToast({
        title: 'Abonnement activé avec succès !',
        subtitle: `Bienvenue à l’établissement « ${signupSchoolName} ». Votre espace est prêt.`,
      });
      setIsLoading(false);

      setTimeout(() => {
        router.push(`/${slug}/admin/dashboard`);
      }, 900);
    }, 800);
  };

  // ═══════════════════════════════════════════════════════════════
  // 3. GESTION DU MOT DE PASSE OUBLIÉ (FLUX COMPLET 4 ÉTAPES)
  // ═══════════════════════════════════════════════════════════════
  const handleSendForgotCode = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail.trim()) {
      setForgotError('Veuillez saisir votre adresse email.');
      return;
    }

    // Générer un code OTP aléatoire à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setForgotStep('code');
    }, 600);
  };

  const handleVerifyForgotCode = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (forgotOtpCode.trim() !== generatedOtp.trim()) {
      setForgotError('Code de sécurité incorrect. Veuillez vérifier les 6 chiffres.');
      return;
    }
    setForgotStep('new_password');
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (newPassword.length < 8) {
      setForgotError('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setForgotError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Mettre à jour le mot de passe dans les personnels locaux si existant
      const liveStaff = getLiveStaffUsers();
      const targetUser = liveStaff.find((u) => u.email?.toLowerCase() === forgotEmail.trim().toLowerCase());
      if (targetUser) {
        targetUser.authCode = newPassword;
      }
      setIsLoading(false);
      setForgotStep('success');
    }, 700);
  };

  const getPlanDetails = (planId: 'mensuel' | 'annuel' | 'triennal') => {
    switch (planId) {
      case 'mensuel':
        return { name: 'Plan Mensuel', price: 30000, period: 'par mois scolaire (9 mois)' };
      case 'annuel':
        return { name: 'Plan 1 An Scolaire', price: 250000, period: 'pour 1 année complète (Économisez 20 000 FCFA)' };
      case 'triennal':
        return { name: 'Plan 3 Ans Scolaires', price: 750000, period: 'pour 3 années (Économisez 60 000 FCFA)' };
    }
  };

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen w-full bg-gradient-to-br from-[#064e3b] via-[#0f172a] to-[#062c1d] flex flex-col justify-start sm:justify-center items-center p-3 sm:p-6 lg:p-8 py-8 sm:py-10 lg:py-12 overflow-y-auto font-sans"
    >
      {/* Toast de succès */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-emerald-600 text-white shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 border border-emerald-400">
          <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
          <div>
            <div className="font-bold text-xs">{successToast.title}</div>
            <div className="text-[11px] text-emerald-100">{successToast.subtitle}</div>
          </div>
        </div>
      )}

      {/* Conteneur Principal en Carte 2 Volets */}
      <div className="w-full max-w-xl lg:max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:grid lg:grid-cols-12 border border-white/20 my-auto shrink-0">
        
        {/* ================= VOLET GAUCHE (5 COLONNES) : IDENTITÉ UNIVERSELLE & FORFAITS ================= */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#022c1b] p-5 sm:p-7 lg:p-8 text-white flex flex-col justify-between relative overflow-hidden shrink-0">
          {/* Lueur d'arrière plan */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4 sm:space-y-6">
            {/* Logo SchoolFlow */}
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-2xl bg-white text-emerald-800 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xl font-extrabold font-heading tracking-tight text-white">
                    School<span className="text-amber-400">Flow</span>
                  </span>
                  <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-widest">
                    Gérer • Réussir • Grandir
                  </p>
                </div>
              </Link>

              <Link
                href="/landing"
                className="text-[11px] font-bold text-emerald-200 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/20 transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Landing Page
              </Link>
            </div>

            {/* Titre & Description */}
            <div className="space-y-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-white/10 text-emerald-200 border border-white/20 backdrop-blur-md">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                {authMode === 'signup' ? 'Souscription d\'Abonnement' : 'Session de Connexion Officielle'}
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-white leading-tight">
                {authMode === 'signup' ? 'Rejoignez le Réseau SchoolFlow' : 'Connexion de Tous les Personnels'}
              </h1>
              <p className="text-xs text-slate-200 leading-relaxed">
                {authMode === 'signup'
                  ? 'Activez l\'abonnement pour votre école et profitez immédiatement de tous les modules de gestion scolaire et financière.'
                  : 'Accédez à votre espace établissement en toute sécurité avec vos identifiants ou mot de passe officiel.'}
              </p>
            </div>

            {/* Typewriter Highlight Box */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-black/25 border border-white/15 backdrop-blur-md shadow-inner">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                    Espace Officiel :
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-white/10 text-emerald-200 border border-white/10">
                  En Direct
                </span>
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-white font-heading min-h-[22px] flex items-center">
                <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-white bg-clip-text text-transparent">
                  {loginCurrentText}
                </span>
                <span className="inline-block w-0.5 h-4 ml-1 bg-amber-400 animate-blink" />
              </div>
            </div>

            {/* 3 Blocs Fonctionnalités */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 pt-1">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white font-heading">Bulletins en 1 Clic</h4>
                  <p className="text-[10px] text-emerald-200/90 leading-tight">Format A4 Paysage certifié & conformité MENA</p>
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
                  <ReceiptText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white font-heading">Scolarités & Caisse FCFA</h4>
                  <p className="text-[10px] text-emerald-200/90 leading-tight">Encaissement par tranches & quittances</p>
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-500/30 text-teal-300 flex items-center justify-center shrink-0">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white font-heading">Salaires du Personnel</h4>
                  <p className="text-[10px] text-emerald-200/90 leading-tight">Fiches de paie & historique de paiement</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pied Volet Gauche */}
          <div className="relative z-10 pt-4 mt-4 lg:mt-0 border-t border-white/15 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-300/90 block">Année Active</span>
              <span className="font-extrabold text-white text-xs">2026-2027</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-200 bg-white/10 px-2.5 py-1 rounded-lg border border-white/20">
              Devise FCFA
            </span>
          </div>
        </div>

        {/* ================= VOLET DROIT (7 COLONNES) : FORMULAIRE PRINCIPAL ================= */}
        <div className="lg:col-span-7 p-5 sm:p-7 lg:p-8 bg-white flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            
            {/* Onglets Bascule : Se Connecter vs Nouveau Compte & Abonnement */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage('');
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Se Connecter</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setErrorMessage('');
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/30'
                    : 'text-emerald-700 hover:text-emerald-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Nouveau Compte & Abonnement</span>
              </button>
            </div>

            {/* Message d'erreur */}
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-in fade-in shadow-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span className="font-semibold leading-relaxed">{errorMessage}</span>
                </div>
                {(errorMessage.toLowerCase().includes('abonnement') || errorMessage.toLowerCase().includes('aucun')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setErrorMessage('');
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-extrabold text-[11px] shadow-sm shadow-emerald-600/30 cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Prendre un abonnement</span>
                  </button>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* MODE 1 : FORMULAIRE DE CONNEXION (COMPTES EXISTANTS) */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {authMode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5 animate-in fade-in">
                {/* 1. Sélection du Poste */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                    <span>1. Poste / Fonction dans l'Établissement *</span>
                    <span className="text-[10px] text-slate-500">Droits sécurisés</span>
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={selectedRole}
                      onChange={(e) => {
                        setSelectedRole(e.target.value as UserRole);
                        setErrorMessage('');
                      }}
                      className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-xs font-bold text-slate-900 transition-all appearance-none cursor-pointer"
                    >
                      <option value="directeur">👑 Directeur / Directrice (Admin — Contrôle Total)</option>
                      <option value="assistant_direction">📋 Assistant(e) de Direction</option>
                      <option value="comptable">💼 Comptable / Gestionnaire Financier</option>
                      <option value="secretaire">📝 Secrétaire de Direction</option>
                      <option value="enseignant">👨‍🏫 Enseignant / Professeur</option>
                      <option value="fondateur">🏛️ Fondateur / Fondatrice (Supervision)</option>
                      <option value="parent">👨‍👩‍👧 Parent d'Élève (Espace Famille)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* 2. Civilité & Nom et Prénoms */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block text-xs">
                    2. Civilité, Nom et Prénoms *
                  </label>
                  <div className="flex gap-2">
                    <div className="w-[74px] shrink-0">
                      <select
                        value={civility}
                        onChange={(e) => setCivility(e.target.value as any)}
                        className="w-full px-2 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-bold text-slate-900 transition-all cursor-pointer text-center"
                      >
                        <option value="Mr">Mr</option>
                        <option value="Mme">Mme</option>
                        <option value="Mlle">Mlle</option>
                      </select>
                    </div>

                    <div className="relative flex-1 min-w-0">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Ex : Kouassi Jean-Marc"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Adresse Email */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block text-xs">
                    3. Adresse Email (Optionnelle ou Professionnelle)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="Ex : direction@ecole.ci"
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* 4. Mot de passe ou Téléphone parent */}
                {selectedRole === 'parent' ? (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs">
                      4. Numéro de Téléphone Parent *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        required
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="Ex : +225 07 48 92 11 00"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-bold text-slate-900 transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 block text-xs">
                        4. Mot de Passe / Code d'Authentification *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(loginEmail);
                          setForgotStep('email');
                          setForgotError('');
                          setIsForgotPasswordOpen(true);
                        }}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                      >
                        Mot de passe oublié ?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Entrez votre mot de passe ou code d'accès"
                        className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-bold text-slate-900 transition-all placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Bouton de Connexion */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Authentification en cours...</span>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Accéder à l'Espace {ROLE_CONFIGS[selectedRole].badge}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* MODE 2 : FORMULAIRE NOUVEAU COMPTE & ABONNEMENT ÉTABLISSEMENT */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {authMode === 'signup' && (
              <form onSubmit={handleSignupSubmit} className="space-y-3.5 animate-in fade-in">
                {/* 1. Nom du Responsable & Nom de l'École */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs">
                      Nom et Prénom du Responsable *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={signupResponsableName}
                        onChange={(e) => setSignupResponsableName(e.target.value)}
                        placeholder="Ex : Kouamé Jean-Marc"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs">
                      Nom de l'Établissement *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={signupSchoolName}
                        onChange={(e) => setSignupSchoolName(e.target.value)}
                        placeholder="Ex : Groupe Scolaire Excellence"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Email & Numéro de Téléphone WhatsApp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs">
                      Adresse Email Professionnelle *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="Ex : direction@excellence.ci"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs">
                      Téléphone / WhatsApp *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        required
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        placeholder="Ex : +225 01 02 03 04 05"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-bold text-slate-900 transition-all placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Mot de passe de compte */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 block text-xs">
                      Créer un Mot de Passe Sécurisé * (au moins 8 caractères)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(signupEmail);
                        setForgotStep('email');
                        setForgotError('');
                        setIsForgotPasswordOpen(true);
                      }}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Définissez votre mot de passe (au moins 8 caractères)"
                      className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-bold text-slate-900 transition-all placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 4. Choix du Forfait d'Abonnement en FCFA */}
                <div className="space-y-1.5 pt-1">
                  <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                    <span>Choisir votre Forfait d'Abonnement (FCFA) *</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Zéro frais l'été
                    </span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'mensuel' as const, name: 'Plan Mensuel', price: '30 000 FCFA', period: '/ mois', badge: 'Flexible' },
                      { id: 'annuel' as const, name: 'Plan 1 An', price: '250 000 FCFA', period: '/ an', badge: '⭐ Recommandé (-20k F)', popular: true },
                      { id: 'triennal' as const, name: 'Plan 3 Ans', price: '750 000 FCFA', period: '/ 3 ans', badge: '🏆 VIP (-60k F)' },
                    ].map((plan) => {
                      const isSelected = selectedPlan === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedPlan(plan.id)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-emerald-500'
                              : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div>
                            <span className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md mb-1 ${
                              isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {plan.badge}
                            </span>
                            <div className="font-bold text-xs font-heading">{plan.name}</div>
                          </div>
                          <div className="mt-2 flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                            <span className="text-xs sm:text-sm font-black font-heading tracking-tight">
                              {plan.price}
                            </span>
                            <span className={`text-[10px] font-medium ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              {plan.period}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Choix Moyen de Paiement */}
                <div className="space-y-2 pt-1">
                  <label className="font-bold text-slate-800 block text-xs">
                    Moyen de Paiement Sécurisé (Mobile Money / Carte Bancaire) *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'wave' as const, label: 'Wave', color: 'bg-cyan-50 border-cyan-300 text-cyan-900' },
                      { id: 'orange' as const, label: 'Orange Money', color: 'bg-orange-50 border-orange-300 text-orange-900' },
                      { id: 'card' as const, label: 'Carte Bancaire', color: 'bg-slate-50 border-slate-300 text-slate-900' },
                    ].map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(method.id as any)}
                        className={`py-2.5 px-2 text-center rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                          selectedPaymentMethod === method.id
                            ? 'ring-2 ring-emerald-500 shadow-xs ' + method.color
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>

                  {/* Champs dynamiques selon le moyen de paiement sélectionné */}
                  {selectedPaymentMethod === 'wave' && (
                    <div className="p-3 bg-cyan-50/60 border border-cyan-200 rounded-2xl space-y-1.5 animate-in fade-in">
                      <label className="font-bold text-cyan-950 block text-[11px] flex items-center justify-between">
                        <span>Numéro de Compte Wave *</span>
                        <span className="text-[10px] text-cyan-800 font-normal">Prélèvement instantané</span>
                      </label>
                      <div className="relative">
                        <Smartphone className="w-4 h-4 text-cyan-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          value={paymentPhone}
                          onChange={(e) => setPaymentPhone(e.target.value)}
                          placeholder="Ex : +225 07 12 34 56 78"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-cyan-300 text-xs font-mono font-bold text-cyan-950 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  )}

                  {selectedPaymentMethod === 'orange' && (
                    <div className="p-3 bg-orange-50/60 border border-orange-200 rounded-2xl space-y-1.5 animate-in fade-in">
                      <label className="font-bold text-orange-950 block text-[11px] flex items-center justify-between">
                        <span>Numéro Orange Money *</span>
                        <span className="text-[10px] text-orange-800 font-normal">Validation par code #144#</span>
                      </label>
                      <div className="relative">
                        <Smartphone className="w-4 h-4 text-orange-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          value={paymentPhone}
                          onChange={(e) => setPaymentPhone(e.target.value)}
                          placeholder="Ex : +225 07 98 76 54 32"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-orange-300 text-xs font-mono font-bold text-orange-950 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  )}

                  {selectedPaymentMethod === 'card' && (
                    <div className="p-3 bg-slate-50 border border-slate-300 rounded-2xl space-y-2 animate-in fade-in">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-800 block text-[11px]">
                          Numéro de Carte Bancaire (16 chiffres) *
                        </label>
                        <div className="relative">
                          <CreditCard className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            maxLength={19}
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            placeholder="4000 1234 5678 9010"
                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-bold text-slate-700 block text-[10px] mb-0.5">Expiration (MM/AA) *</label>
                          <input
                            type="text"
                            maxLength={5}
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="12/28"
                            className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-mono text-center font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block text-[10px] mb-0.5">CVC / Cryptogramme *</label>
                          <input
                            type="password"
                            maxLength={4}
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value)}
                            placeholder="•••"
                            className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-mono text-center font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bouton Soumission Abonnement */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-lg shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Validation du paiement sécurisé & initialisation...</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Régler l'Abonnement ({formatFCFA(getPlanDetails(selectedPlan).price)}) & Ouvrir l'Accès</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Pied Droit */}
          <div className="pt-2 text-center text-[11px] text-slate-400">
            SchoolFlow Platform • Protection des données certifiée SSL 256-bit • UEMOA
          </div>
        </div>
      </div>

      {/* ================= MODALE : MOT DE PASSE OUBLIÉ (WIZARD 4 ÉTAPES) ================= */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 font-heading">
                  Réinitialisation du Mot de Passe
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  setForgotStep('email');
                  setForgotError('');
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{forgotError}</span>
              </div>
            )}

            {/* ÉTAPE 1 : Saisie de l'Email */}
            {forgotStep === 'email' && (
              <form onSubmit={handleSendForgotCode} className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Saisissez l'adresse email associée à votre compte d'établissement pour recevoir votre code de sécurité à 6 chiffres.
                </p>
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block text-xs">
                    Adresse Email du Compte *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Ex : direction@ecole.ci"
                      className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(false)}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Envoyer le code</span>
                  </button>
                </div>
              </form>
            )}

            {/* ÉTAPE 2 : Saisie du Code à 6 Chiffres */}
            {forgotStep === 'code' && (
              <form onSubmit={handleVerifyForgotCode} className="space-y-3.5">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Code expédié à {forgotEmail}</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Votre code de sécurité à 6 chiffres est : <strong className="font-mono text-xs px-1.5 py-0.5 bg-emerald-200/80 rounded-md font-extrabold">{generatedOtp}</strong>
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block text-xs">
                    Saisir le Code à 6 Chiffres *
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={forgotOtpCode}
                      onChange={(e) => setForgotOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ex : 123456"
                      className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-base font-mono font-bold text-center tracking-widest text-slate-900 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotStep('email')}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Valider le code</span>
                  </button>
                </div>
              </form>
            )}

            {/* ÉTAPE 3 : Définition du Nouveau Mot de Passe */}
            {forgotStep === 'new_password' && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <p className="text-xs text-slate-600">
                  Définissez votre nouveau mot de passe sécurisé (au moins 8 caractères).
                </p>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block text-xs">
                    Nouveau Mot de Passe *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-bold text-slate-900 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block text-xs">
                    Confirmer le Nouveau Mot de Passe *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Retapez le même mot de passe"
                      className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-bold text-slate-900 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Enregistrer le nouveau mot de passe</span>
                </button>
              </form>
            )}

            {/* ÉTAPE 4 : Succès */}
            {forgotStep === 'success' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2.5">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-emerald-950 font-heading">Mot de passe réinitialisé !</h4>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Votre mot de passe a été mis à jour avec succès. Vous pouvez désormais vous connecter avec vos nouveaux identifiants.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPasswordOpen(false);
                    setAuthMode('login');
                    setLoginPassword('');
                    setLoginEmail(forgotEmail);
                  }}
                  className="mt-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-600/30"
                >
                  Se connecter maintenant
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
