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
  verifyUserAuthCodeForLogin,
  updateFullStaffUser,
  broadcastLiveUpdate,
  DATA_UPDATED_EVENT,
} from '@/lib/data/live-store';

export type UserRole =
  | 'directeur'
  | 'assistant_direction'
  | 'fondateur'
  | 'educateur'
  | 'informaticien'
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
  fondateur: {
    id: 'fondateur',
    title: 'Fondateur / Promotrice (Admin Suprême — Contrôle Total)',
    badge: '👑 Fondateur (Admin)',
    department: 'Présidence & Conseil d’Administration',
    defaultAuthCode: 'FND-2026',
    defaultUserName: 'LAWANI MOUSSA',
    description: 'Propriétaire et Fondateur de l’école. Accès total et illimité à l’ensemble des modules.',
    allowedModules: 'Tableau de bord, Administration, Scolarités, Caisse, Salaires, Pédagogie, Bulletins, Paramètres',
    isAdmin: true,
  },
  directeur: {
    id: 'directeur',
    title: 'Directeur des Études (Admin — Direction des Études)',
    badge: '👑 Direction (Admin)',
    department: 'Direction des Études',
    defaultAuthCode: 'DIR-2026',
    defaultUserName: 'LAWANI MOUHAMED',
    description: 'Directeur des Études : Gestion pédagogique, administrative et financière globale de l’établissement.',
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
  educateur: {
    id: 'educateur',
    title: 'Éducateur / Conseiller d’Éducation (Vie Scolaire)',
    badge: '🛡️ Éducateur (Vie Scolaire)',
    department: 'Vie Scolaire & Discipline',
    defaultAuthCode: 'EDU-2026',
    defaultUserName: 'M. Kouamé Yao',
    description: 'Suivi de la discipline, retards, assiduité, autorisations et encadrement des élèves.',
    allowedModules: 'Présences, Classes, Notes Diverses, Communication Parents, Bulletins',
  },
  informaticien: {
    id: 'informaticien',
    title: 'Informaticien / Responsable IT (Systèmes & Réseau)',
    badge: '💻 Informaticien (IT)',
    department: 'Systèmes d’Information & Informatique',
    defaultAuthCode: 'INF-2026',
    defaultUserName: 'Ing. Franck N’Guessan',
    description: 'Administration technique, maintenance du parc informatique, réseau et sécurité des données.',
    allowedModules: 'Tableau de bord, Administration, Paramètres, Sécurité, Sauvegardes',
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
    defaultUserName: 'M. Cissé Ousmane',
    description: 'Saisie des notes, appel des présences par classe, bulletins scolaires et communication.',
    allowedModules: 'Présences & Absences, Pédagogie & Notes, Bulletins Scolaires',
  },
  parent: {
    id: 'parent',
    title: 'Parent d’Élève',
    badge: '👨‍👩‍👧 Parent',
    department: 'Espace Famille',
    defaultAuthCode: 'PAR-2026',
    defaultUserName: 'M. & Mme Konate',
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

const PLAN_DETAILS_MAP: Record<string, { name: string; price: number; period: string }> = {
  mensuel: { name: 'Plan Mensuel', price: 30000, period: '/ mois' },
  annuel: { name: 'Plan 1 An Scolaire', price: 250000, period: '/ an' },
  triennal: { name: 'Plan 3 Ans VIP', price: 750000, period: '/ 3 ans' },
};

function getPlanDetails(planId: string) {
  return PLAN_DETAILS_MAP[planId] || PLAN_DETAILS_MAP['annuel'];
}

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
  const [parentPhone, setParentPhone] = useState('');
  const [authCodeInput, setAuthCodeInput] = useState('');

  // Formulaire de Nouveau Compte & Abonnement
  const [signupResponsableName, setSignupResponsableName] = useState('');
  const [signupFounderName, setSignupFounderName] = useState('');
  const [signupSchoolName, setSignupSchoolName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'mensuel' | 'annuel' | 'triennal'>('annuel');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'wave' | 'orange' | 'card'>('wave');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [activationCode, setActivationCode] = useState('');

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
      setErrorMessage(
        '❌ Ce compte établissement a été définitivement supprimé. Veuillez souscrire à un nouvel abonnement pour créer un nouvel espace.'
      );
      return;
    }

    const trimmedName = userName.trim();
    if (!trimmedName) {
      setErrorMessage('Veuillez saisir votre Nom et Prénoms.');
      return;
    }

    const nameParts = trimmedName.split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      setErrorMessage('Veuillez saisir votre Nom ET au moins un Prénom (ex : Konate Lassina).');
      return;
    }

    const cleanEmail = loginEmail.trim();
    if (!cleanEmail) {
      setErrorMessage('Veuillez renseigner votre Adresse Email Professionnelle obligatoire.');
      return;
    }

    // Vérification stricte : l'école / le compte doit avoir un abonnement actif souscrit
    const identifier = cleanEmail || trimmedName;
    const subCheck = verifySchoolSubscriptionForLogin(identifier, schoolSlug);
    if (!subCheck.isValid) {
      setErrorMessage(
        subCheck.reason ||
          '❌ Accès refusé : Aucun abonnement actif n’est associé à cet établissement. Veuillez d’abord créer un compte et souscrire un abonnement.'
      );
      return;
    }

    let matchedParentStudents: Student[] = [];

    // Validation spécifique et stricte pour les parents d'élèves
    if (selectedRole === 'parent') {
      if (!trimmedName || trimmedName.length < 2) {
        setErrorMessage("Veuillez renseigner votre Nom et Prénoms de parent / tuteur légal.");
        return;
      }
      const cleanPhone = parentPhone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 8) {
        setErrorMessage("Veuillez renseigner le numéro de téléphone WhatsApp ou tuteur renseigné lors de l'inscription de votre enfant.");
        return;
      }

      const authCheck = verifyUserAuthCodeForLogin(
        'parent',
        '',
        trimmedName,
        schoolSlug,
        parentPhone
      );

      if (!authCheck.isValid) {
        setErrorMessage(
          authCheck.reason ||
            "❌ Accès refusé : Vos coordonnées ne figurent pas dans la base des élèves enregistrés de l'établissement."
        );
        return;
      }

      matchedParentStudents = (authCheck as any).matchedStudents || [];
    }

    // Validation du Code d'Authentification pour les utilisateurs (Secrétaire, Comptable, Enseignant, etc.)
    // Seuls le Fondateur et le Directeur bénéficient d'un accès direct sans code d'authentification
    let verifiedStaffUser: any = null;
    if (selectedRole !== 'fondateur' && selectedRole !== 'directeur') {
      if (selectedRole !== 'parent' && !authCodeInput.trim()) {
        setErrorMessage(`Veuillez saisir votre Code d'Authentification officiel transmis par la Direction.`);
        return;
      }

      if (selectedRole !== 'parent') {
        const authCheck = verifyUserAuthCodeForLogin(
          selectedRole,
          authCodeInput,
          trimmedName,
          schoolSlug,
          parentPhone
        );

        if (!authCheck.isValid) {
          setErrorMessage(
            authCheck.reason ||
              `❌ Code d'authentification invalide pour le poste de ${ROLE_CONFIGS[selectedRole].title}.`
          );
          return;
        }
        verifiedStaffUser = authCheck.staffUser;
      }
    }

    const cleanAuthCode =
      authCodeInput.trim().toUpperCase() ||
      (selectedRole === 'fondateur' ? 'FND-2026' : selectedRole === 'directeur' ? 'DIR-2026' : 'STAFF-AUTH');

    setIsLoading(true);

    setTimeout(() => {
      const isSupremeAdmin = selectedRole === 'fondateur' || selectedRole === 'directeur';
      const isParent = selectedRole === 'parent';
      const firstChild = matchedParentStudents[0];

      // Synchronisation du profil personnel (Fondateur, Directeur, Collaborateurs)
      const allStaff = getLiveStaffUsers(schoolSlug);
      const matchedStaff = verifiedStaffUser || allStaff.find((s) => s.roleId === selectedRole);

      // Si l'utilisateur s'est connecté avec une adresse email, l'enregistrer dans Administration & Codes
      if (matchedStaff && cleanEmail && matchedStaff.email !== cleanEmail) {
        matchedStaff.email = cleanEmail;
        updateFullStaffUser(matchedStaff, schoolSlug);
      }

      // Pour les parents : profil alimenté par le numéro officiel renseigné à l'inscription et son email de connexion
      const officialParentName = firstChild?.guardianName || (trimmedName ? `${civility} ${trimmedName}` : 'Parent d’Élève');
      const officialParentPhone = firstChild?.whatsappPhone || firstChild?.guardianPhone || parentPhone;
      const officialParentEmail = cleanEmail || loginEmail;

      const finalFullName = isParent
        ? officialParentName
        : (matchedStaff?.fullName || (trimmedName ? `${civility} ${trimmedName}` : (ROLE_CONFIGS[selectedRole]?.defaultUserName || 'Personnel')));

      const finalEmail = isParent
        ? officialParentEmail
        : (cleanEmail || (matchedStaff?.email && !matchedStaff.email.includes('etablissement.ci') && !matchedStaff.email.includes('epc-manoi.ci') ? matchedStaff.email : ''));

      const finalPhone = isParent
        ? officialParentPhone
        : (matchedStaff?.phone || '');
      const roleBadge =
        selectedRole === 'fondateur'
          ? '👑 Fondateur (Admin)'
          : selectedRole === 'directeur'
          ? '👑 Direction (Admin)'
          : ROLE_CONFIGS[selectedRole].badge;
      const roleTitle =
        selectedRole === 'fondateur'
          ? 'Fondateur / Promotrice'
          : selectedRole === 'directeur'
          ? 'DR'
          : (verifiedStaffUser?.role || ROLE_CONFIGS[selectedRole].title);

      const sessionData = {
        fullName: finalFullName,
        civility: civility,
        pureName: verifiedStaffUser?.fullName || trimmedName,
        role: roleTitle,
        roleId: selectedRole,
        roleBadge: roleBadge,
        department: ROLE_CONFIGS[selectedRole].department,
        email: finalEmail,
        phone: finalPhone,
        authCode: cleanAuthCode,
        isAdmin: isSupremeAdmin,
        matchedChildrenIds: matchedParentStudents.map((s) => s.id),
        avatarUrl:
          selectedRole === 'fondateur' || selectedRole === 'directeur'
            ? 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80'
            : selectedRole === 'secretaire'
            ? 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&auto=format&fit=crop&q=80'
            : selectedRole === 'comptable'
            ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
            : selectedRole === 'educateur'
            ? 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop&q=80'
            : selectedRole === 'informaticien'
            ? 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80'
            : selectedRole === 'parent'
            ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        loginTime: new Date().toISOString(),
      };

      try {
        localStorage.setItem('schoolflow_active_session_v2', JSON.stringify(sessionData));
        recordStaffLogin(selectedRole, finalFullName, cleanAuthCode, schoolSlug);
        broadcastLiveUpdate({
          action: 'user_login',
          user: sessionData,
          schoolSlug,
        });
      } catch (err) {
        console.error('Erreur stockage session:', err);
      }

      setSuccessToast({
        title: 'Authentification réussie !',
        subtitle: `Bienvenue, ${finalFullName} (${roleBadge})`,
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
    }, 500);
  };

  // ═══════════════════════════════════════════════════════════════
  // 2. GESTION DU NOUVEAU COMPTE & PRISE D'ABONNEMENT ÉTABLISSEMENT
  // ═══════════════════════════════════════════════════════════════
  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // 1. Validation des champs d'identité
    if (
      !signupResponsableName.trim() ||
      !signupFounderName.trim() ||
      !signupSchoolName.trim() ||
      !signupEmail.trim()
    ) {
      setErrorMessage('Veuillez renseigner tous les champs obligatoires (*).');
      return;
    }

    const cleanSignupPhone = signupPhone.trim();
    if (!cleanSignupPhone || cleanSignupPhone.replace(/\D/g, '').length < 8) {
      setErrorMessage('Veuillez renseigner un numéro de téléphone / WhatsApp valide.');
      return;
    }

    // 2. Validation du moyen de paiement
    if (selectedPaymentMethod === 'wave' || selectedPaymentMethod === 'orange') {
      const cleanPayPhone = paymentPhone.replace(/\D/g, '');
      if (!cleanPayPhone || cleanPayPhone.length < 8) {
        setErrorMessage(
          `Veuillez saisir le numéro de compte ${selectedPaymentMethod === 'wave' ? 'Wave' : 'Orange Money'} pour le règlement.`
        );
        return;
      }
    } else if (selectedPaymentMethod === 'card') {
      const cleanCard = cardNumber.replace(/\D/g, '');
      if (cleanCard.length < 16 || !cardExpiry.trim() || !cardCvc.trim()) {
        setErrorMessage('Veuillez renseigner un numéro de carte à 16 chiffres valide, la date d’expiration (MM/AA) et le CVC.');
        return;
      }
    }

    setIsLoading(true);

    setTimeout(() => {
      // Générer le slug de l'école
      const slug =
        signupSchoolName
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '') || `ecole-${Date.now()}`;

      // Créer et enregistrer la nouvelle école dans le live-store
      const newSchool: School = {
        id: `school_${Date.now()}`,
        slug: slug,
        name: signupSchoolName.trim().toUpperCase(),
        shortName: '',
        logoColor: '#059669',
        academicYear: '2026-2027',
        currentTerm: 'Trimestre 1',
        termType: 'trimestriel',
        phone: cleanSignupPhone,
        whatsappPhone: cleanSignupPhone,
        email: signupEmail.trim(),
        motto: '',
        slogan: '',
        city: '',
        country: 'Côte d’Ivoire',
        district: '',
        ministryCode: '',
        founderName: signupFounderName.trim() || (slug === 'epc-manoi' ? 'LAWANI MOUSSA' : 'Fondateur / Promoteur'),
        directorName: signupResponsableName.trim(),
        studiesDirectorName: signupResponsableName.trim(),
        logoUrl: '',
        stampUrl: '',
        countryEmblemUrl: '',
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
          role: 'Directeur des Études',
          roleId: 'directeur',
          roleBadge: '👑 Admin',
          department: 'Direction des Études',
          email: signupEmail.trim(),
          phone: cleanSignupPhone,
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
      className="min-h-screen w-full bg-gradient-to-br from-[#064e3b] via-[#0f172a] to-[#062c1d] flex flex-col justify-start items-center p-2.5 sm:p-5 md:p-6 lg:p-8 py-5 sm:py-8 lg:py-10 overflow-x-hidden overflow-y-auto font-sans"
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
      <div className="w-full max-w-xl lg:max-w-5xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:grid lg:grid-cols-12 border border-white/20 my-2 sm:my-4 lg:my-auto shrink-0 transition-all">
        
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
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="font-semibold leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* MODE 1 : FORMULAIRE DE CONNEXION (COMPTES EXISTANTS) */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {authMode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4 animate-in fade-in">
                {/* 1. Sélection du Poste */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                    <span>1. Poste / Fonction dans l'Établissement *</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">9 Profils d'Accès</span>
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={selectedRole}
                      onChange={(e) => {
                        setSelectedRole(e.target.value as UserRole);
                        setErrorMessage('');
                      }}
                      className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-xs font-bold text-slate-900 transition-all appearance-none cursor-pointer shadow-2xs"
                    >
                      <option value="fondateur">👑 Fondateur / Promotrice (Admin Suprême — Contrôle Total)</option>
                      <option value="directeur">👑 Directeur / Directrice des Études (Admin Principal)</option>
                      <option value="assistant_direction">📋 Assistant(e) de Direction</option>
                      <option value="educateur">🛡️ Éducateur / Conseiller d’Éducation (Vie Scolaire)</option>
                      <option value="informaticien">💻 Informaticien / Responsable IT (Systèmes & Réseau)</option>
                      <option value="comptable">💼 Comptable / Gestionnaire Financier</option>
                      <option value="secretaire">📝 Secrétaire de Direction</option>
                      <option value="enseignant">👨‍🏫 Enseignant / Professeur</option>
                      <option value="parent">👨‍👩‍👧 Parent d'Élève (Espace Famille)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* 2. Civilité & Nom et Prénoms */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 block text-xs">
                    2. Civilité, Nom et Prénoms *
                  </label>
                  <div className="flex gap-2">
                    <div className="w-[74px] shrink-0">
                      <select
                        value={civility}
                        onChange={(e) => setCivility(e.target.value as any)}
                        className="w-full px-2 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-bold text-slate-900 transition-all cursor-pointer text-center shadow-2xs"
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
                        autoComplete="off"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Ex : Konate Lassina Mouhamed"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Adresse Email Professionnelle (OBLIGATOIRE) */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                    <span>3. Adresse Email Professionnelle *</span>
                    <span className="text-[10px] text-emerald-700 font-bold">Obligatoire</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      autoComplete="off"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="Ex : direction@ecole.ci"
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                    />
                  </div>
                </div>

                {/* 4. Téléphone si parent */}
                {selectedRole === 'parent' && (
                  <div className="space-y-1.5 animate-in fade-in">
                    <label className="font-bold text-slate-800 block text-xs">
                      4. Numéro de Téléphone Parent / WhatsApp *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        required
                        autoComplete="off"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="Ex : +225 07 48 92 11 00"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-bold text-slate-900 transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Code d'Authentification Officiel (Requis pour Secrétaire, Comptable, Assistant(e), Éducateur, Informaticien, Enseignant) */}
                {selectedRole !== 'fondateur' && selectedRole !== 'directeur' && selectedRole !== 'parent' && (
                  <div className="space-y-1.5 animate-in fade-in">
                    <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                        <span>4. Code d&apos;Authentification Sécurisé *</span>
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Attribué par la Direction
                      </span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        value={authCodeInput}
                        onChange={(e) => setAuthCodeInput(e.target.value.toUpperCase())}
                        placeholder="Entrez votre code d'accès attribué"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-black tracking-wider text-slate-900 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal shadow-2xs uppercase"
                      />
                    </div>
                    <p className="text-[10.5px] text-slate-500">
                      Entrez le code d&apos;accès configuré par la Direction dans la page Administration.
                    </p>
                  </div>
                )}

                {/* Information Accès Maître Fondateur / Directeur */}
                {(selectedRole === 'fondateur' || selectedRole === 'directeur') && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-900 shadow-2xs">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-[11px] font-medium leading-tight">
                      👑 Accès Administrateur Principal direct activé pour le {selectedRole === 'fondateur' ? 'Fondateur' : 'Directeur'}.
                    </span>
                  </div>
                )}

                {/* Bouton de Connexion */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Authentification et ouverture de session...</span>
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
              <form onSubmit={handleSignupSubmit} autoComplete="off" className="space-y-3.5 animate-in fade-in pb-2">
                
                {/* 1. Responsable & Fondateur */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs">
                      Nom et Prénoms du Directeur des Études (Responsable) *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        value={signupResponsableName}
                        onChange={(e) => setSignupResponsableName(e.target.value)}
                        placeholder="Ex : Dr. Konate Oumar (Directeur des Études)"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      ℹ️ Renseignez le nom officiel du Directeur des Études qui gérera l’établissement.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                      <span>Noms et Prénoms du Fondateur *</span>
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Promoteur</span>
                    </label>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        value={signupFounderName}
                        onChange={(e) => setSignupFounderName(e.target.value)}
                        placeholder="Ex : M. LAWANI MOUSSA (Fondateur Légal)"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                    <p className="text-[10px] text-amber-700 font-medium">
                      🏛️ Renseignez le nom du Fondateur / Propriétaire légal de l’école (ex : LAWANI MOUSSA).
                    </p>
                  </div>
                </div>

                {/* 2. Nom de l'École & Email Professionnel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs">
                      Nom de l'Établissement *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        value={signupSchoolName}
                        onChange={(e) => setSignupSchoolName(e.target.value)}
                        placeholder="Ex : Groupe Scolaire Excellence"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs">
                      Adresse Email Professionnelle *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        required
                        autoComplete="off"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="Ex : direction@excellence.ci"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Téléphone / WhatsApp Simplifié */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block text-xs">
                    Téléphone / Contact WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      autoComplete="off"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      placeholder="Ex : +225 07 48 92 11 00"
                      className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-bold text-slate-900 transition-all placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 shadow-2xs"
                    />
                  </div>
                </div>

                {/* 4. Forfait d'Abonnement Sélectionné */}
                <div className="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                        Forfait d'Abonnement Sélectionné
                      </span>
                      <span className="text-xs font-black text-slate-900 font-heading">
                        {getPlanDetails(selectedPlan).name} ({formatFCFA(getPlanDetails(selectedPlan).price)})
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/landing#tarifs"
                    className="text-[10px] font-bold text-emerald-700 bg-white hover:bg-emerald-100/70 px-2.5 py-1.5 rounded-xl border border-emerald-200 transition-colors shadow-2xs shrink-0"
                  >
                    Changer
                  </Link>
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
                  {(selectedPaymentMethod === 'wave' || selectedPaymentMethod === 'orange') && (
                    <div className={`p-3 rounded-2xl space-y-1.5 animate-in fade-in ${
                      selectedPaymentMethod === 'wave' ? 'bg-cyan-50/60 border border-cyan-200' : 'bg-orange-50/60 border border-orange-200'
                    }`}>
                      <label className="font-bold text-slate-900 block text-[11px] flex items-center justify-between">
                        <span>Numéro {selectedPaymentMethod === 'wave' ? 'Wave' : 'Orange Money'} de Règlement *</span>
                        <span className="text-[10px] text-slate-600 font-normal">Débit sécurisé</span>
                      </label>
                      <div className="relative">
                        <Smartphone className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          value={paymentPhone}
                          onChange={(e) => setPaymentPhone(e.target.value)}
                          placeholder="Ex : +225 07 01 02 03 04"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
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

                  {/* Code d'activation / Dérogation Commerciale */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                    <label className="font-bold text-slate-800 block text-[11px] flex items-center justify-between">
                      <span>Code d'activation / Bon de commande (Optionnel)</span>
                      <span className="text-[10px] text-emerald-700 font-bold font-mono">+225 01 70 36 36 56</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        autoComplete="off"
                        value={activationCode}
                        onChange={(e) => setActivationCode(e.target.value)}
                        placeholder="Code d'activation"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 uppercase"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Saisissez votre code d'activation pour un déblocage immédiat de l'établissement.
                    </p>
                  </div>
                </div>

                {/* Bouton Soumission Abonnement */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-lg shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Validation du paiement & création de l'espace...</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Activer l'Abonnement ({formatFCFA(getPlanDetails(selectedPlan).price)}) & Créer l'Espace</span>
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
    </div>
  );
}
