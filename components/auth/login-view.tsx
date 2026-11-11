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
  MapPin,
} from 'lucide-react';
import { School, Student } from '@/lib/data/types';
import { defaultSchool, mockStudents, mockSchools, availableClasses } from '@/lib/data/mock-data';
import { formatFCFA } from '@/lib/utils/formatters';
import {
  getLiveSchool,
  getLiveStaffUsers,
  getLiveStudents,
  getRegisteredSchools,
  recordStaffLogin,
  isSchoolDeleted,
  restoreSchoolAccount,
  saveLiveSchool,
  registerSchoolWithSubscription,
  updateFullStaffUser,
  updateStaffLoginContact,
  broadcastLiveUpdate,
  addLiveStaffUser,
  DATA_UPDATED_EVENT,
} from '@/lib/data/live-store';
import { getAllSchoolsFromSupabase, saveStaffUserToSupabase } from '@/lib/supabase/remote';
import { homePage } from '@/lib/auth/roles';

export type UserRole =
  | 'directeur'
  | 'assistant_direction'
  | 'fondateur'
  | 'fondateur_adjoint'
  | 'informaticien'
  | 'educateur'
  | 'comptable'
  | 'secretaire'
  | 'enseignant'
  | 'parent'
  | 'eleve';

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
    title: 'Fondateur (Contrôle Total)',
    badge: '👑 Fondateur (Contrôle Total)',
    department: 'Présidence & Conseil d’Administration',
    defaultAuthCode: 'FND-2026',
    defaultUserName: '',
    description: 'Propriétaire et Fondateur de l’école. Accès total et illimité à l’ensemble des modules.',
    allowedModules: 'Tableau de bord, Administration, Scolarités, Caisse, Salaires, Pédagogie, Bulletins, Paramètres',
    isAdmin: true,
  },
  directeur: {
    id: 'directeur',
    title: 'Directeur des Études (Contrôle)',
    badge: '👑 Directeur des Études (Contrôle)',
    department: 'Direction des Études',
    defaultAuthCode: 'DIR-2026',
    defaultUserName: '',
    description: 'Directeur des Études : élèves, documents, pédagogie, communication parents, personnel et santé.',
    allowedModules: 'Vue d’ensemble, Documents, Gestion pédagogique, Communication Parents, Personnel, Santé, Notes diverses',
  },
  fondateur_adjoint: {
    id: 'fondateur_adjoint',
    title: 'Fondateur adjoint (DGA)',
    badge: '🏛️ Fondateur adjoint',
    department: 'Présidence & Conseil d’Administration',
    defaultAuthCode: 'DGA-2026',
    defaultUserName: '',
    description: 'Adjoint du Fondateur : mêmes accès que le Fondateur, crée les postes et les codes du personnel.',
    allowedModules: 'Toutes les pages, Administration & Codes, Paramètres',
    isAdmin: true,
  },
  informaticien: {
    id: 'informaticien',
    title: 'Informaticien',
    badge: '💻 Informaticien',
    department: 'Informatique',
    defaultAuthCode: 'INF-2026',
    defaultUserName: '',
    description: 'Suivi technique de la plateforme : consultation de toutes les pages sauf Administration & Codes et Paramètres.',
    allowedModules: 'Toutes les pages (consultation), sauf Administration & Codes et Paramètres',
  },
  assistant_direction: {    id: 'assistant_direction',
    title: 'Assistant(e) de Direction',
    badge: '📋 Assistant(e) Direction',
    department: 'Direction Adjointe',
    defaultAuthCode: 'AST-2026',
    defaultUserName: '',
    description: 'Assistance à la direction, gestion des classes, suivi du personnel et communication.',
    allowedModules: 'Vue d’ensemble, Classes & Niveaux, Enseignants & Personnel, Communication Parents, Notes Diverses',
  },
  educateur: {
    id: 'educateur',
    title: 'Éducateur / Conseiller d’Éducation',
    badge: '🛡️ Éducateur / Conseiller d’Éducation',
    department: 'Vie Scolaire & Discipline',
    defaultAuthCode: 'EDU-2026',
    defaultUserName: '',
    description: 'Suivi de la discipline, retards, assiduité, autorisations et encadrement des élèves.',
    allowedModules: 'Présences, Classes, Notes Diverses, Communication Parents, Bulletins',
  },
  comptable: {
    id: 'comptable',
    title: 'Comptable / Gestionnaire Financier',
    badge: '💼 Comptable',
    department: 'Comptabilité & Caisse',
    defaultAuthCode: 'CPT-2026',
    defaultUserName: '',
    description: 'Gestion des paiements de scolarité, effectifs, prestations, réductions, salaires et finances.',
    allowedModules: 'Tableau de bord, Inscriptions, Vue d’ensemble, Services, Comptabilité & Finances, Réductions, Salaires, Personnel, Santé',
  },
  secretaire: {
    id: 'secretaire',
    title: 'Secrétaire de Direction',
    badge: '📝 Secrétaire',
    department: 'Secrétariat & Accueil',
    defaultAuthCode: 'SEC-2026',
    defaultUserName: '',
    description: 'Accueil et documents scolaires officiels (consultation).',
    allowedModules: 'Vue d’ensemble, Documents Scolaires, Services & Prestations (consultation)',
  },
  enseignant: {
    id: 'enseignant',
    title: 'Enseignant / Professeur',
    badge: '👨‍🏫 Enseignant',
    department: 'Corps Enseignant',
    defaultAuthCode: 'ENS-2026',
    defaultUserName: '',
    description: 'Connexion avec votre numéro de téléphone et votre matière. Saisie des notes, appel des présences, pointage.',
    allowedModules: 'Présences & Absences, Pédagogie & Notes, Bulletins Scolaires',
  },
  eleve: {
    id: 'eleve',
    title: 'Élève',
    badge: '🎒 Élève',
    department: 'Espace Élève',
    defaultAuthCode: '',
    defaultUserName: '',
    description: 'Connexion avec ton matricule, ta classe, ton nom et le numéro de ton parent. Consultation de tes notes et bulletins.',
    allowedModules: 'Mes Notes & Bulletins, Notes Diverses',
  },
  parent: {
    id: 'parent',
    title: 'Parent d’Élève',
    badge: '👨‍👩‍👧 Parent',
    department: 'Espace Famille',
    defaultAuthCode: 'PAR-2026',
    defaultUserName: '',
    description: 'Consultation des notes et bulletins de vos enfants, assiduité et communication avec l’école.',
    allowedModules: 'Notes & Bulletins des Enfants, Communication Parents',
  },
};

const TEACHER_LOGIN_MEMORY_KEY = 'schoolflow_teacher_login_v1';

/**
 * Mémoire de connexion de CE navigateur : à la première connexion réussie, le nom, le téléphone et
 * l'email sont retenus. Ensuite, dès que la personne tape son nom (ou clique dessus) ou son
 * numéro, son email revient tout seul — plus besoin de le ressaisir. Rien n'est affiché tant que
 * la personne n'a pas tapé SON nom ou SON numéro (jamais les coordonnées d'un autre d'office).
 */
const LOGIN_PROFILES_KEY = 'schoolflow_login_profiles_v1';
type LoginProfile = { roleId: string; name: string; email: string; phone: string };
const normName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(mr|mme|mlle|m\.?)\s+/, '').replace(/\s+/g, ' ').trim();
const phoneTail = (s: string) => s.replace(/\D/g, '').slice(-8);
function readLoginProfiles(): LoginProfile[] {
  try {
    const v = JSON.parse(localStorage.getItem(LOGIN_PROFILES_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function rememberLoginProfile(p: LoginProfile) {
  try {
    const list = readLoginProfiles().filter((x) => !(x.roleId === p.roleId && normName(x.name) === normName(p.name)));
    localStorage.setItem(LOGIN_PROFILES_KEY, JSON.stringify([p, ...list].slice(0, 20)));
  } catch {}
}
function findLoginProfile(roleId: string, name: string, phone: string): LoginProfile | undefined {
  const list = readLoginProfiles().filter((x) => x.roleId === roleId);
  const n = normName(name);
  const t = phoneTail(phone);
  return (
    (n.length >= 3 ? list.find((x) => normName(x.name) === n) : undefined) ||
    (t.length === 8 ? list.find((x) => phoneTail(x.phone) === t) : undefined)
  );
}
const TEACHER_SUBJECTS = [
  'Français',
  'Arabe',
  'Anglais',
  'Mathématiques',
  'Physique-Chimie',
  'SVT',
  'Histoire-Géographie',
  'Éducation civique et morale',
  'Éducation islamique',
  'Coran',
  'Espagnol',
  'Allemand',
  'Informatique',
  'EPS',
  'Arts plastiques',
  'Musique',
  'Toutes les matières (Primaire / Maternelle)',
];

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
  const [isExpiredSchool, setIsExpiredSchool] = useState(false);
  const activeSlug = currentSchool?.slug || schoolSlug;

  // Formulaire de Connexion (Comptes Existants)
  const [selectedRole, setSelectedRole] = useState<UserRole>('directeur');
  const [civility, setCivility] = useState<'Mr' | 'Mme' | 'Mlle'>('Mr');
  const [userName, setUserName] = useState('');
  const [schoolSigle, setSchoolSigle] = useState(initialSchool.shortName || initialSchool.name || '');
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [authCodeInput, setAuthCodeInput] = useState('');
  const [loginAvatar, setLoginAvatar] = useState('');
  // Email (et téléphone) retrouvés dès que la personne a tapé son nom ou son numéro.
  useEffect(() => {
    if (selectedRole === 'parent' || selectedRole === 'enseignant') return;
    const p = findLoginProfile(selectedRole, userName, parentPhone);
    if (!p) return;
    if (!loginEmail.trim() && p.email) setLoginEmail(p.email);
    if (!parentPhone.trim() && p.phone) setParentPhone(p.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, parentPhone, selectedRole]);

  // Enseignant : matière et classe (le numéro est mémorisé par ce navigateur).
  // Plusieurs matières et plusieurs classes possibles (cases à cocher).
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);
  const [teacherOtherSubject, setTeacherOtherSubject] = useState('');
  const [teacherPin, setTeacherPin] = useState('');
  // Élève : matricule et classe.
  const [studentMatricule, setStudentMatricule] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const teacherSubject = [...teacherSubjects, ...(teacherOtherSubject.trim() ? [teacherOtherSubject.trim()] : [])].join(', ');
  const teacherClass = teacherClasses.join(', ');
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  useEffect(() => {
    if (selectedRole !== 'enseignant') return;
    try {
      const saved = JSON.parse(localStorage.getItem(TEACHER_LOGIN_MEMORY_KEY) || 'null');
      if (saved) {
        if (saved.phone) setParentPhone(String(saved.phone));
        if (Array.isArray(saved.subjects)) {
          setTeacherSubjects(saved.subjects.filter((s: string) => TEACHER_SUBJECTS.includes(s)));
          const other = saved.subjects.filter((s: string) => !TEACHER_SUBJECTS.includes(s)).join(', ');
          if (other) setTeacherOtherSubject(other);
        }
        if (Array.isArray(saved.classes)) setTeacherClasses(saved.classes);
      }
    } catch (e) {}
  }, [selectedRole]);

  // Annuaire de l'école lu en base (/api/auth/directory) : un téléphone qui ouvre le lien pour la
  // première fois n'a rien en mémoire et doit quand même reconnaître l'école et ses membres.
  const [directoryStaff, setDirectoryStaff] = useState<{ id: string; fullName: string; roleId: string }[] | null>(null);
  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    setDirectoryStaff(null);
    fetch(`/api/auth/directory?slug=${encodeURIComponent(activeSlug)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success) return;
        setDirectoryStaff(Array.isArray(json.staff) ? json.staff : []);
        if (json.school?.slug) {
          setCurrentSchool((prev) => ({
            ...prev,
            slug: json.school.slug,
            name: json.school.name || prev?.name,
            shortName: json.school.shortName || prev?.shortName,
            logoUrl: json.school.logoUrl || prev?.logoUrl,
          }));
          if (json.school.shortName) setSchoolSigle(String(json.school.shortName).toUpperCase());
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeSlug]);

  // Liste globale de tous les établissements enregistrés (abonnés et par défaut)
  const allSchoolsList = React.useMemo(() => {
    if (!mounted) return [];
    try {
      const registered = getRegisteredSchools();
      const mockList = Object.values(mockSchools);
      const combined = [...registered, ...mockList];
      const seen = new Set<string>();
      return combined.filter((s) => {
        const key = (s.shortName || s.slug || s.name || '').toUpperCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch (e) {
      return [];
    }
  }, [mounted]);

  // Détection et basculement automatique de l'établissement dès la saisie du sigle
  const handleSigleChange = (val: string) => {
    const rawVal = val.toUpperCase();
    setSchoolSigle(rawVal);
    const clean = rawVal.trim();
    if (!clean) return;

    try {
      const registered = getRegisteredSchools();
      const mockList = Object.values(mockSchools);
      const allCandidates = [...registered, ...mockList];

      const match = allCandidates.find(
        (s) =>
          (s.shortName && s.shortName.toUpperCase() === clean) ||
          (s.slug && s.slug.toUpperCase() === clean) ||
          (s.slug && s.slug.toUpperCase() === clean.toLowerCase()) ||
          (s.name && s.name.toUpperCase() === clean) ||
          (s.name && s.name.toUpperCase().includes(clean))
      );

      if (match) {
        setCurrentSchool(match);
        setIsDeletedSchool(isSchoolDeleted(match.slug));
        // Rien n'est pré-rempli avec les informations de quelqu'un d'autre : la personne tape
        // son nom, ou clique elle-même sur son nom dans « Personnel identifié ».
        setUserName('');
        setLoginAvatar('');
      }
    } catch (e) {
      console.error('Erreur recherche établissement par sigle:', e);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLoginAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Formulaire de Nouveau Compte & Abonnement
  const [signupResponsableName, setSignupResponsableName] = useState('');
  const [signupFounderName, setSignupFounderName] = useState('');
  const [signupSchoolName, setSignupSchoolName] = useState('');
  const [signupSchoolShortName, setSignupSchoolShortName] = useState('');
  const [signupSchoolAddress, setSignupSchoolAddress] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'mensuel' | 'annuel' | 'triennal'>('annuel');
  const [isSelectingPlan, setIsSelectingPlan] = useState(false);
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

      if (params.get('expired') === 'true') {
        setIsExpiredSchool(true);
        setErrorMessage(
          "❌ Abonnement expiré. L'accès à l'espace de gestion est suspendu. Veuillez renouveler votre abonnement pour continuer à utiliser SchoolFlow."
        );
      }
    }

    // Synchronisation automatique des établissements abonnés depuis Supabase Cloud. Ecrit
    // dans la MEME cle que celle lue par getRegisteredSchools()/verifySchoolSubscriptionForLogin
    // ('schoolflow_registered_schools_v2') - un ancien decalage de nom de cle (v1 vs v2) faisait
    // que cette synchronisation n'etait jamais vue par la verification d'abonnement : un membre
    // du personnel se connectant pour la premiere fois sur un appareil qui n'avait jamais servi
    // a l'inscription de l'ecole se voyait refuser l'acces meme avec un abonnement actif.
    getAllSchoolsFromSupabase().then((remoteSchools) => {
      if (remoteSchools && remoteSchools.length > 0) {
        try {
          const current = getRegisteredSchools();
          const map = new Map<string, School>();
          for (const s of current) map.set(s.slug, s);
          for (const s of remoteSchools) map.set(s.slug, s);
          localStorage.setItem('schoolflow_registered_schools_v2', JSON.stringify(Array.from(map.values())));
          window.dispatchEvent(new Event(DATA_UPDATED_EVENT));
        } catch (e) {}
      }
    });
  }, [schoolSlug]);

  useEffect(() => {
    const liveSc = getLiveSchool(schoolSlug, initialSchool);
    setCurrentSchool(liveSc);
    if (liveSc?.shortName) setSchoolSigle(liveSc.shortName);
    const handleUpdate = () => {
      const updatedSc = getLiveSchool(schoolSlug, initialSchool);
      setCurrentSchool(updatedSc);
      if (updatedSc?.shortName) setSchoolSigle(updatedSc.shortName);
      setIsDeletedSchool(isSchoolDeleted(schoolSlug));
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, initialSchool]);

  // ═══════════════════════════════════════════════════════════════
  // 1. GESTION DE LA CONNEXION (COMPTES ET PERSONNELS EXISTANTS)
  // ═══════════════════════════════════════════════════════════════
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (isDeletedSchool) {
      setErrorMessage(
        '❌ Ce compte établissement a été définitivement supprimé. Veuillez souscrire à un nouvel abonnement pour créer un nouvel espace.'
      );
      return;
    }

    // Remarque : isExpiredSchool (posé depuis l'URL ?expired=true après un renvoi par proxy.ts)
    // n'est qu'informatif ici — il ne bloque pas la resoumission, car il peut être obsolète
    // (renouvellement effectué depuis). La vérification réelle et à jour est faite par le
    // serveur, contre la base Cloud (voir /api/auth/login ci-dessous).

    // La civilité (Mr/Mme/Mlle) est déjà choisie séparément via son propre menu et sera
    // préfixée plus bas (ex: `${civility} ${trimmedName}`) : si la personne a aussi tapé "Mr"
    // ou "M." au début de son nom par habitude, on obtenait "Mr Mr LAWANI..." sur le profil,
    // partout où ce nom était ensuite affiché. On retire ce préfixe déjà tapé avant de laisser
    // la civilité du menu s'appliquer seule.
    // Enseignants : connexion par numéro de téléphone + matière (+ classe), sans nom ni code.
    const isTeacherLogin = selectedRole === 'enseignant';
    const trimmedName = isTeacherLogin
      ? ''
      : userName.trim().replace(/^(mr|mme|mlle|m\.?|monsieur|madame|mademoiselle)\.?\s+/i, '').trim();
    if (!isTeacherLogin) {
      if (!trimmedName) {
        setErrorMessage('Veuillez saisir votre Nom et Prénoms.');
        return;
      }
      const nameParts = trimmedName.split(/\s+/).filter(Boolean);
      if (nameParts.length < 2) {
        setErrorMessage('Veuillez saisir votre Nom ET au moins un Prénom (ex : Konate Lassina).');
        return;
      }
    }

    const isStudentLogin = selectedRole === 'eleve';
    if (isStudentLogin && !studentMatricule.trim()) {
      setErrorMessage("Saisis ton matricule (ou ton numéro d'élève, ex : ID-045).");
      return;
    }
    if (isStudentLogin && !studentGrade) {
      setErrorMessage('Choisis ta classe.');
      return;
    }

    const cleanEmail = loginEmail.trim();
    if (!isTeacherLogin && !isStudentLogin && !cleanEmail) {
      setErrorMessage('Veuillez renseigner votre Adresse Email Professionnelle obligatoire.');
      return;
    }
    if (isTeacherLogin && !teacherSubject.trim()) {
      setErrorMessage('Cochez au moins une matière que vous enseignez (ex : Français, Arabe, Anglais).');
      return;
    }
    if (isTeacherLogin && teacherClasses.length === 0) {
      setErrorMessage('Cochez au moins une classe dans laquelle vous enseignez.');
      return;
    }
    if (isTeacherLogin && !/^\d{4}$/.test(teacherPin.trim())) {
      setErrorMessage('Saisissez votre code personnel à 4 chiffres (donné par la Direction).');
      return;
    }

    // Vérification obligatoire du contact téléphonique / WhatsApp pour TOUS les utilisateurs
    const cleanPhone = parentPhone.trim();
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 8) {
      setErrorMessage(
        selectedRole === 'parent'
          ? "Veuillez renseigner le numéro de téléphone WhatsApp ou tuteur renseigné lors de l'inscription de votre enfant."
          : isStudentLogin
          ? "Saisis le numéro de téléphone de ton parent (celui donné à l'inscription)."
          : "Veuillez renseigner obligatoirement votre numéro de téléphone / WhatsApp professionnel direct."
      );
      return;
    }

    // Pour tous les membres du personnel (y compris Fondateur et Directeur), le code d'authentification officiel est strictement requis
    if (selectedRole !== 'parent' && !isTeacherLogin && !isStudentLogin && !authCodeInput.trim()) {
      setErrorMessage(
        selectedRole === 'fondateur'
          ? "Veuillez saisir votre Code d'Authentification officiel de Fondateur."
          : selectedRole === 'directeur'
          ? "Veuillez saisir votre Code d'Authentification officiel de Directeur."
          : `Veuillez saisir votre Code d'Authentification officiel transmis par la Direction.`
      );
      return;
    }

    setIsLoading(true);

    // La décision de connexion est prise par le serveur (/api/auth/login), contre la base Cloud :
    // abonnement, nom officiel, code personnel ou, pour un parent, nom du tuteur + téléphone. Le
    // serveur pose lui-même le cookie de session signé (httpOnly). Les anciennes vérifications
    // faites ici dans le navigateur ne protégeaient rien : il suffisait de fabriquer le cookie.
    let loginResult: any = null;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: activeSlug,
          roleId: selectedRole,
          fullName: trimmedName,
          code: isTeacherLogin ? teacherPin.trim() : authCodeInput.trim(),
          phone: cleanPhone,
          email: cleanEmail,
          subject: isTeacherLogin ? teacherSubject.trim() : undefined,
          teachingClass: isTeacherLogin ? teacherClass : undefined,
          matricule: isStudentLogin ? studentMatricule.trim() : undefined,
          grade: isStudentLogin ? studentGrade : undefined,
        }),
      });
      loginResult = await res.json().catch(() => null);
      if (!res.ok || !loginResult?.success) {
        if (res.status === 403 && /expir/i.test(loginResult?.error || '')) setIsExpiredSchool(true);
        setErrorMessage(
          loginResult?.error || '❌ Connexion impossible pour le moment. Vérifiez votre connexion internet et réessayez.'
        );
        setIsLoading(false);
        return;
      }
    } catch (err) {
      setErrorMessage('❌ Connexion impossible : le serveur est injoignable. Vérifiez votre connexion internet et réessayez.');
      setIsLoading(false);
      return;
    }

    const matchedParentStudents: Student[] = loginResult.matchedStudents || [];
    const verifiedStaffUser: any = loginResult.staffUser || null;

    // Les parents n'ont pas de code d'authentification à saisir : leur code d'identité
    // stable et UNIQUE est dérivé de leur numéro de téléphone/WhatsApp officiel vérifié à
    // l'instant par le serveur. Avant ce correctif, TOUS les
    // parents (potentiellement 1000 à 3000 familles) recevaient le même code générique
    // "STAFF-AUTH" — sur un même appareil, la photo de profil du premier parent connecté
    // s'affichait alors chez tous les parents suivants (ex: photo du Directeur vue par un
    // parent). Le numéro de téléphone étant vérifié contre la fiche de l'élève, il est
    // stable d'une connexion à l'autre pour une même famille et jamais partagé entre familles.
    const cleanAuthCode =
      selectedRole === 'parent'
        ? `PARENT-${cleanPhone.replace(/\D/g, '') || Date.now()}`
        : isStudentLogin
        ? `ELEVE-${matchedParentStudents[0]?.id || ''}`
        : isTeacherLogin
        ? String(loginResult.authCode || '').toUpperCase()
        : authCodeInput.trim().toUpperCase();

    // Nom, téléphone et email retenus pour la prochaine connexion sur ce navigateur.
    if (selectedRole !== 'parent' && !isTeacherLogin && !isStudentLogin && trimmedName) {
      rememberLoginProfile({ roleId: selectedRole, name: trimmedName, email: cleanEmail, phone: cleanPhone });
    }

    // L'enseignant n'a plus qu'à vérifier ses informations la prochaine fois.
    if (isTeacherLogin) {
      try {
        localStorage.setItem(
          TEACHER_LOGIN_MEMORY_KEY,
          // Jamais le code à 4 chiffres : seulement le numéro, les matières et les classes.
          JSON.stringify({
            phone: cleanPhone,
            subjects: [...teacherSubjects, ...(teacherOtherSubject.trim() ? [teacherOtherSubject.trim()] : [])],
            classes: teacherClasses,
          })
        );
      } catch (e) {}
    }

    // Plus d'attente artificielle (il y avait 1,2 s de pauses avant d'ouvrir la page).
    setTimeout(() => {
      const isSupremeAdmin = selectedRole === 'fondateur' || selectedRole === 'fondateur_adjoint';
      const isParent = selectedRole === 'parent';
      const firstChild = matchedParentStudents[0];

      // Synchronisation du profil personnel (Fondateur, Directeur, Collaborateurs)
      const allStaff = getLiveStaffUsers(activeSlug);
      const matchedStaff = verifiedStaffUser || (cleanAuthCode ? allStaff.find((s) => s.authCode.toUpperCase() === cleanAuthCode) : undefined);

      // Pour les parents : profil alimenté par le numéro officiel renseigné à l'inscription et son email de connexion
      const officialParentName = firstChild?.guardianName || (trimmedName ? `${civility} ${trimmedName}` : 'Parent d’Élève');
      const officialParentPhone = firstChild?.whatsappPhone || firstChild?.guardianPhone || parentPhone;
      const officialParentEmail = cleanEmail || loginEmail;

      // Coordonnées : priorité absolue aux coordonnées renseignées par l'utilisateur
      const formattedInputName = trimmedName ? `${civility ? `${civility} ` : ''}${trimmedName}`.trim() : '';
      const finalFullName = isParent
        ? officialParentName
        : isStudentLogin
        ? (firstChild?.fullName || trimmedName)
        : (formattedInputName || verifiedStaffUser?.fullName || matchedStaff?.fullName || ROLE_CONFIGS[selectedRole]?.defaultUserName || 'Personnel');

      const finalEmail = isParent
        ? officialParentEmail
        : (cleanEmail || verifiedStaffUser?.email || (matchedStaff?.email && !matchedStaff.email.includes('etablissement.ci') && !matchedStaff.email.includes('epc-manoi.ci') ? matchedStaff.email : ''));

      const finalPhone = isParent
        ? officialParentPhone
        : (cleanPhone || verifiedStaffUser?.phone || matchedStaff?.phone || '');

      // Enregistrer immédiatement les coordonnées saisies (nom, email pro, téléphone et photo) sur la fiche du collaborateur
      if (!isParent && !isStudentLogin && cleanAuthCode && (cleanEmail || cleanPhone || formattedInputName || loginAvatar)) {
        updateStaffLoginContact(cleanAuthCode, {
          fullName: finalFullName,
          email: finalEmail,
          phone: finalPhone,
          avatarUrl: loginAvatar || undefined,
        }, activeSlug);
        // La liste du personnel n'est plus téléchargée avant la connexion (elle contient les
        // codes d'accès) : on enregistre donc aussi directement la fiche vérifiée par le serveur.
        if (verifiedStaffUser) {
          saveStaffUserToSupabase(
            {
              fullName: finalFullName.replace(/\s*\((Fondateur|Fondatrice|Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim(),
              email: finalEmail,
              phone: finalPhone,
              roleId: verifiedStaffUser.roleId,
              role: verifiedStaffUser.role,
              authCode: cleanAuthCode,
              status: verifiedStaffUser.status || 'Actif',
              avatarUrl: loginAvatar || verifiedStaffUser.avatarUrl || undefined,
            },
            activeSlug
          ).catch(() => {});
        }
      }
      const roleBadge =
        selectedRole === 'fondateur'
          ? '👑 Fondateur (Contrôle Total)'
          : selectedRole === 'directeur'
          ? '👑 Directeur des Études (Contrôle)'
          : ROLE_CONFIGS[selectedRole].badge;
      const roleTitle =
        selectedRole === 'fondateur'
          ? 'Fondateur (Contrôle Total)'
          : selectedRole === 'directeur'
          ? 'Directeur des Études (Contrôle)'
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
        teachingSubject: isTeacherLogin ? teacherSubject.trim() : undefined,
        teachingClass: isTeacherLogin ? teacherClass : undefined,
        // Photo strictement personnelle : uniquement clée sur le code d'authentification
        // unique de la personne. Les anciennes clés par rôle et la clé globale "custom"
        // faisaient qu'une photo importée par une personne s'affichait ensuite chez toute
        // autre personne du même rôle (ou de n'importe quel rôle) sur le même navigateur —
        // ex: un parent voyait la photo du Directeur.
        avatarUrl: (() => {
          if (loginAvatar) {
            try {
              if (cleanAuthCode) localStorage.setItem(`schoolflow_user_avatar_${cleanAuthCode.toUpperCase()}`, loginAvatar);
            } catch (e) {}
            return loginAvatar;
          }

          let persistentAvatar = '';
          try {
            persistentAvatar =
              verifiedStaffUser?.avatarUrl ||
              (cleanAuthCode ? localStorage.getItem(`schoolflow_user_avatar_${cleanAuthCode.toUpperCase()}`) : null) ||
              matchedStaff?.avatarUrl ||
              '';
          } catch (e) {}

          // Aucune photo personnelle enregistrée : aucun visage générique trompeur, un
          // simple espace réservé neutre en attendant que la personne importe la sienne.
          return persistentAvatar || '';
        })(),
        loginTime: new Date().toISOString(),
      };

      try {
        localStorage.setItem('schoolflow_active_session_v2', JSON.stringify(sessionData));
        recordStaffLogin(selectedRole, finalFullName, cleanAuthCode, activeSlug);
        broadcastLiveUpdate({
          action: 'user_login',
          user: sessionData,
          schoolSlug: activeSlug,
        });
        // Le cookie de session (lu par proxy.ts) a déjà été posé par /api/auth/login, signé et
        // en httpOnly : le navigateur ne l'écrit plus lui-même.
      } catch (err) {
        console.error('Erreur stockage session:', err);
      }

      setSuccessToast({
        title: 'Authentification réussie !',
        subtitle: `Bienvenue, ${finalFullName} (${roleBadge})`,
      });
      setIsLoading(false);

      // Page d'arrivée du poste (lib/auth/roles.ts) : le Directeur n'a plus le Tableau de bord.
      const destinationUrl = `/${activeSlug}/admin/${homePage(selectedRole)}`;

      router.push(destinationUrl);
    }, 0);
  };

  // ═══════════════════════════════════════════════════════════════
  // 2. GESTION DU NOUVEAU COMPTE & PRISE D'ABONNEMENT ÉTABLISSEMENT
  // ═══════════════════════════════════════════════════════════════
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // 1. Validation des champs d'identité — le nom du Fondateur n'est PAS exigé séparément : dans
    // une petite école, le Directeur et le Fondateur sont souvent la même personne, et forcer la
    // saisie d'un second nom (parfois inventé juste pour passer le formulaire) n'apportait aucune
    // sécurité réelle, seulement de la friction inutile à l'inscription.
    if (
      !signupResponsableName.trim() ||
      !signupSchoolName.trim() ||
      !signupSchoolShortName.trim() ||
      !signupSchoolAddress.trim() ||
      !signupEmail.trim()
    ) {
      setErrorMessage('Veuillez renseigner tous les champs obligatoires (*) incluant le sigle et l’adresse de l’établissement.');
      return;
    }

    const cleanSignupPhone = signupPhone.trim();
    if (!cleanSignupPhone || cleanSignupPhone.replace(/\D/g, '').length < 8) {
      setErrorMessage('Veuillez renseigner un numéro de téléphone / WhatsApp valide.');
      return;
    }

    // Le moyen de paiement n'est pas encore relié à un prestataire réel (aucun appel Wave /
    // Orange Money / carte bancaire n'est effectué ici) : bloquer la création de l'espace tant
    // que ces champs ne sont pas remplis n'apportait aucune sécurité réelle, seulement de la
    // friction pour une école qui veut découvrir l'interface avant de finaliser son règlement.
    // L'abonnement est donc activé immédiatement ; les coordonnées de paiement, si renseignées,
    // restent enregistrées sur la fiche école pour la facturation à venir.

    setIsLoading(true);

    // Création réelle côté serveur (/api/auth/signup) : établissement, fiches Directeur et
    // Fondateur avec des codes d'accès aléatoires cryptographiques, et cookie de session signé.
    // Le serveur garantit aussi l'unicité du slug (INSERT avec nouvelles tentatives en cas de
    // collision) : plus besoin de télécharger la liste de toutes les écoles dans le navigateur.
    let result: any = null;
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: signupSchoolName,
          shortName: signupSchoolShortName,
          address: signupSchoolAddress,
          email: signupEmail,
          phone: cleanSignupPhone,
          responsableName: signupResponsableName,
          founderName: signupFounderName,
          plan: selectedPlan,
        }),
      });
      result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) {
        setErrorMessage(
          result?.error ||
            '❌ Impossible de créer votre espace pour le moment (problème de connexion au serveur). Veuillez réessayer dans quelques instants.'
        );
        setIsLoading(false);
        return;
      }
    } catch (err) {
      setErrorMessage('❌ Impossible de créer votre espace pour le moment : le serveur est injoignable. Veuillez réessayer dans quelques instants.');
      setIsLoading(false);
      return;
    }

    const newSchool: School = result.school;
    const slug: string = newSchool.slug;
    const directorAuthCode: string = result.directorAuthCode;
    const founderAuthCode: string = result.founderAuthCode;

    try {
      registerSchoolWithSubscription(newSchool);

      // Copies locales des fiches Directeur & Fondateur (déjà enregistrées en base par le serveur).
      addLiveStaffUser(
        {
          id: `staff-directeur-${Date.now()}`,
          fullName: signupResponsableName.trim(),
          role: 'Directeur des Études (Contrôle)',
          roleId: 'directeur',
          email: signupEmail.trim(),
          phone: cleanSignupPhone,
          authCode: directorAuthCode,
          status: 'Actif',
        },
        slug
      );
      addLiveStaffUser(
        {
          id: `staff-fondateur-${Date.now() + 1}`,
          fullName: signupFounderName.trim() || signupResponsableName.trim(),
          role: 'Fondateur (Contrôle Total)',
          roleId: 'fondateur',
          email: signupEmail.trim(),
          phone: cleanSignupPhone,
          authCode: founderAuthCode,
          status: 'Actif',
        },
        slug
      );

      // Sauvegarder la session active en tant que Directeur Administrateur
      const sessionData = {
        fullName: `Dr. ${signupResponsableName.trim()}`,
        civility: 'Mr',
        pureName: signupResponsableName.trim(),
        role: 'Directeur des Études (Contrôle)',
        roleId: 'directeur',
        roleBadge: '👑 Directeur des Études (Contrôle)',
        department: 'Direction des Études',
        email: signupEmail.trim(),
        phone: cleanSignupPhone,
        authCode: directorAuthCode,
        loginTime: new Date().toISOString(),
      };
      localStorage.setItem('schoolflow_active_session_v2', JSON.stringify(sessionData));
      window.dispatchEvent(new Event(DATA_UPDATED_EVENT));
    } catch (err) {
      console.error('Erreur création école:', err);
    }

    const cloudWarning = result.staffSaved
      ? ''
      : ' ⚠️ Votre code d’accès n’a pas pu être confirmé en ligne — s’il ne fonctionne pas depuis un autre appareil, contactez le support SchoolFlow.';

    setSuccessToast({
      title: cloudWarning ? 'Abonnement activé — vérification requise' : 'Abonnement activé avec succès !',
      subtitle: `Bienvenue à l’établissement « ${signupSchoolName} ». Votre code d’accès Directeur est ${directorAuthCode} — retrouvable à tout moment dans Administration.${cloudWarning}`,
    });
    setIsLoading(false);

    setTimeout(() => {
      router.push(`/${slug}/admin/dashboard`);
    }, cloudWarning ? 6000 : 3500);
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
                {/* 0. Sigle de l'Établissement */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sigle de l&apos;Établissement *</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {currentSchool.name || 'Établissement Actif'}
                    </span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      list="registered-schools-sigles"
                      value={schoolSigle}
                      onChange={(e) => handleSigleChange(e.target.value)}
                      placeholder="Ex : EPC MANOI"
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-black tracking-wider text-slate-900 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal shadow-2xs uppercase"
                    />
                    <datalist id="registered-schools-sigles">
                      {allSchoolsList.map((s) => (
                        <option key={s.id || s.slug} value={s.shortName || s.name}>
                          {s.name} ({s.shortName || s.slug})
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

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
                        const newRole = e.target.value as UserRole;
                        setSelectedRole(newRole);
                        setErrorMessage('');
                        // Changer de poste efface ce qui était saisi : jamais de nom ni de photo
                        // d'un autre membre affichés automatiquement.
                        setUserName('');
                        setLoginAvatar('');
                        setAuthCodeInput('');
                      }}
                      className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-xs font-bold text-slate-900 transition-all appearance-none cursor-pointer shadow-2xs"
                    >
                      <option value="fondateur">👑 Fondateur (Contrôle Total)</option>
                      <option value="fondateur_adjoint">🏛️ Fondateur adjoint (DGA)</option>
                      <option value="directeur">👑 Directeur des Études (Contrôle)</option>
                      <option value="assistant_direction">📋 Assistant(e) de Direction</option>
                      <option value="educateur">🛡️ Éducateur / Conseiller d’Éducation</option>
                      <option value="comptable">💼 Comptable / Gestionnaire Financier</option>
                      <option value="secretaire">📝 Secrétaire de Direction</option>
                      <option value="informaticien">💻 Informaticien</option>
                      <option value="enseignant">👨‍🏫 Enseignant / Professeur</option>
                      <option value="parent">👨‍👩‍👧 Parent d'Élève (Espace Famille)</option>
                      <option value="eleve">🎒 Élève</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {selectedRole !== 'enseignant' && (<>
                {/* Photo de Profil (Optionnelle à la connexion, enregistrée définitivement) */}
                {selectedRole !== 'eleve' && (
                <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-11 h-11 rounded-xl bg-white border border-emerald-300 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                      {loginAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={loginAvatar} alt="Photo profil" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Photo de Profil</span>
                      <span className="text-[10px] text-slate-500">
                        {loginAvatar ? '✓ Photo enregistrée définitivement' : 'Optionnelle — Sauvegardée dès la 1ère connexion'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-[11px] font-bold hover:bg-emerald-100 cursor-pointer shadow-2xs transition-all inline-flex items-center gap-1.5">
                      <span>{loginAvatar ? 'Changer' : 'Ajouter'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                )}

                {/* 2. Civilité & Nom et Prénoms */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                    <span>2. Civilité, Nom et Prénoms *</span>
                    {selectedRole !== 'parent' && selectedRole !== 'eleve' && (
                      <span className="text-[10px] text-slate-500 font-medium">Nom officiel du collaborateur</span>
                    )}
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

                  {/* Affichage direct des membres du personnel enregistrés pour ce rôle */}
                  {selectedRole !== 'parent' && selectedRole !== 'eleve' && (
                    <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10.5px] font-semibold text-slate-500">Personnel identifié :</span>
                      {(() => {
                        // Seulement les VRAIS comptes créés par la Direction (jamais les fiches de
                        // démonstration intégrées à l'application), et uniquement pour ce poste.
                        // Source : l'annuaire de la base (tous appareils) ; à défaut, la mémoire locale.
                        const localStaff = getLiveStaffUsers(activeSlug).filter(
                          (s) => s.id !== 'staff-founder' && s.id !== 'staff-001' && !/^(FND|DIR)-2026$/i.test(s.authCode || '')
                        );
                        const allStaff: { id: string; fullName: string; roleId: string; avatarUrl?: string }[] =
                          directoryStaff !== null
                            ? directoryStaff.map((d) => ({
                                ...d,
                                avatarUrl: localStaff.find((l) => l.id === d.id)?.avatarUrl,
                              }))
                            : localStaff;
                        const matchedRoleStaff = allStaff.filter((s) => s.roleId === selectedRole);

                        if (matchedRoleStaff.length === 0) {
                          return (
                            <span className="text-[11px] text-amber-800 bg-amber-50/90 px-2.5 py-1 rounded-lg border border-amber-300 font-semibold inline-flex items-center gap-1.5 shadow-2xs">
                              ⚠️ Aucun compte créé pour ce poste (Non reconnu)
                            </span>
                          );
                        }

                        return matchedRoleStaff.map((staff) => (
                          <button
                            key={staff.id}
                            type="button"
                            onClick={() => {
                              // Nom et photo seulement : email, téléphone et code doivent être
                              // saisis manuellement par la personne, jamais pré-remplis.
                              setUserName(staff.fullName);
                              if (staff.avatarUrl) setLoginAvatar(staff.avatarUrl);
                            }}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs ${
                              userName.trim().toUpperCase() === staff.fullName.trim().toUpperCase()
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                            title="Cliquer pour renseigner automatiquement ce nom et ses accès"
                          >
                            <span>👤 {staff.fullName}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                {/* 3. Adresse Email Professionnelle (OBLIGATOIRE) — pas pour un élève */}
                {selectedRole !== 'eleve' && (
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
                )}

                </>)}

                {/* 4. Numéro de Téléphone / WhatsApp (OBLIGATOIRE POUR TOUS) */}
                <div className="space-y-1.5 animate-in fade-in">
                  <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                    <span>
                      {selectedRole === 'enseignant' ? '2. ' : selectedRole === 'eleve' ? '3. ' : '4. '}
                      {selectedRole === 'parent'
                        ? "Numéro de Téléphone Parent / WhatsApp *"
                        : selectedRole === 'eleve'
                        ? 'Numéro de téléphone de ton parent *'
                        : selectedRole === 'enseignant'
                        ? 'Votre numéro de téléphone (enregistré par la Direction) *'
                        : "Numéro de Téléphone Direct / WhatsApp *"}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold">Obligatoire</span>
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
                  <p className="text-[10px] text-slate-500">
                    {selectedRole === 'parent'
                      ? "ℹ️ Renseignez le numéro exact fourni lors de l'inscription de votre enfant (avec indicatif du pays)."
                      : selectedRole === 'eleve'
                      ? 'ℹ️ Le numéro que ton parent a donné à l’inscription.'
                      : selectedRole === 'enseignant'
                      ? 'ℹ️ Le numéro donné à la Direction. Ce navigateur s’en souviendra pour la prochaine fois.'
                      : "ℹ️ Ce numéro sera automatiquement enregistré sur votre profil officiel de l'école."}
                  </p>
                </div>

                {/* Élève : matricule + classe */}
                {selectedRole === 'eleve' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-800 block text-xs flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                        <span>4. Matricule *</span>
                      </label>
                      <input
                        type="text"
                        autoComplete="off"
                        value={studentMatricule}
                        onChange={(e) => setStudentMatricule(e.target.value.toUpperCase())}
                        placeholder="Ex : 26014829K ou ID-045"
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-black tracking-wider text-slate-900 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal shadow-2xs uppercase"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-800 block text-xs flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>5. Ta classe *</span>
                      </label>
                      <div className="relative">
                        <select
                          value={studentGrade}
                          onChange={(e) => setStudentGrade(e.target.value)}
                          className="w-full px-3.5 pr-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-bold text-slate-900 transition-all appearance-none cursor-pointer shadow-2xs"
                        >
                          <option value="">Choisir…</option>
                          {availableClasses.filter((c) => c !== 'Toutes les classes').map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Enseignant : matières et classes enseignées (cases à cocher) + code à 4 chiffres */}
                {selectedRole === 'enseignant' && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                          <span>3. Matières enseignées *</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">Cochez une ou plusieurs</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5 p-2.5 rounded-2xl bg-slate-50 border border-slate-300 shadow-2xs">
                        {TEACHER_SUBJECTS.map((s) => {
                          const on = teacherSubjects.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setTeacherSubjects((l) => toggleIn(l, s))}
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                                on
                                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                              }`}
                            >
                              {on && <Check className="w-3 h-3" />}
                              {s}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        value={teacherOtherSubject}
                        onChange={(e) => setTeacherOtherSubject(e.target.value)}
                        placeholder="Autre matière (facultatif)"
                        className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          <span>4. Classes enseignées *</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">Cochez une ou plusieurs</span>
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-2.5 rounded-2xl bg-slate-50 border border-slate-300 shadow-2xs">
                        {availableClasses.filter((c) => c !== 'Toutes les classes').map((c) => {
                          const on = teacherClasses.includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setTeacherClasses((l) => toggleIn(l, c))}
                              className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1 ${
                                on
                                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                              }`}
                            >
                              {on && <Check className="w-3 h-3" />}
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                          <span>5. Code personnel à 4 chiffres *</span>
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Donné par la Direction
                        </span>
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showAuthCode ? 'text' : 'password'}
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={4}
                          value={teacherPin}
                          onChange={(e) => setTeacherPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="••••"
                          className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-sm font-mono font-black tracking-[0.5em] text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAuthCode(!showAuthCode)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                          title={showAuthCode ? 'Masquer le code' : 'Afficher le code'}
                        >
                          {showAuthCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Code d'Authentification Officiel (Requis pour Fondateur, Directeur et tous les Personnels) */}
                {selectedRole !== 'parent' && selectedRole !== 'enseignant' && (
                  <div className="space-y-1.5 animate-in fade-in">
                    <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                        <span>5. Code d&apos;Authentification Sécurisé *</span>
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Code Secret Requis
                      </span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showAuthCode ? "text" : "password"}
                        required
                        autoComplete="off"
                        value={authCodeInput}
                        onChange={(e) => setAuthCodeInput(e.target.value.toUpperCase())}
                        placeholder="Entrer le code"
                        className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-black tracking-wider text-slate-900 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal shadow-2xs uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAuthCode(!showAuthCode)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                        title={showAuthCode ? "Masquer le code secret" : "Afficher le code secret"}
                      >
                        {showAuthCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10.5px] text-slate-500">
                      Le code d&apos;authentification officiel est strictement confidentiel et requis pour déverrouiller l&apos;accès.
                    </p>
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
                        placeholder="Ex : M. KOFFI KOUAME ERIC"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      ℹ️ Renseignez le nom officiel du Directeur des Études qui gérera l’établissement.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                      <span>Noms et Prénoms du Fondateur</span>
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Promoteur (facultatif)</span>
                    </label>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        autoComplete="off"
                        value={signupFounderName}
                        onChange={(e) => setSignupFounderName(e.target.value)}
                        placeholder="Laisser vide si le Directeur est aussi le Fondateur"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                    <p className="text-[10.5px] text-amber-800 font-semibold flex items-center gap-1 mt-0.5">
                      🏛️ Uniquement si le Fondateur est une personne différente du Directeur.
                    </p>
                  </div>
                </div>

                {/* 2. Nom de l'École & Sigle Officiel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs">
                      Nom officiel de l'Établissement *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        value={signupSchoolName}
                        onChange={(e) => {
                          setSignupSchoolName(e.target.value);
                          if (!signupSchoolShortName) {
                            const words = e.target.value.trim().split(/\s+/);
                            if (words.length > 1) {
                              setSignupSchoolShortName(words.map((w) => w[0]).join('').toUpperCase().slice(0, 8));
                            }
                          }
                        }}
                        placeholder="Ex : Groupe Scolaire Excellence"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-semibold text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                      <span>Sigle de l'Établissement *</span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Clé de Connexion</span>
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        value={signupSchoolShortName}
                        onChange={(e) => setSignupSchoolShortName(e.target.value.toUpperCase())}
                        placeholder="Ex : GSE ou EPC MANOI"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-mono font-black text-slate-900 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal uppercase shadow-2xs"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      🔑 Permet d'identifier votre école et de retrouver tous les membres à la connexion.
                    </p>
                  </div>
                </div>

                {/* 3. Email & Téléphone / WhatsApp */}
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
                        autoComplete="off"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="Ex : direction@excellence.ci"
                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                  </div>

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
                </div>

                {/* 4. Commune, Ville & Adresse Géographique */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block text-xs">
                    Commune, Ville & Adresse Géographique de l'École *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      value={signupSchoolAddress}
                      onChange={(e) => setSignupSchoolAddress(e.target.value)}
                      placeholder="Ex : Cocody Angré 8ème Tranche, Abidjan"
                      className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
                    />
                  </div>
                </div>

                {/* 5. Forfait d'Abonnement Sélectionné & Choix Direct des 3 Formules */}
                <div className="space-y-2 pt-0.5">
                  {!isSelectingPlan ? (
                    <div className="p-3 bg-emerald-50/90 border border-emerald-300 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Sparkles className="w-4 h-4 text-amber-300" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                            Forfait d'Abonnement Sélectionné
                          </span>
                          <span className="text-xs font-black text-slate-900 font-heading">
                            {getPlanDetails(selectedPlan).name} — {formatFCFA(getPlanDetails(selectedPlan).price)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSelectingPlan(true)}
                        className="text-[11px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300 transition-all shadow-2xs shrink-0 cursor-pointer"
                      >
                        Changer
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900 text-white border border-emerald-500/50 rounded-2xl space-y-2.5 shadow-xl animate-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-white">Sélectionnez votre formule d'abonnement :</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsSelectingPlan(false)}
                          className="text-slate-400 hover:text-white text-xs font-bold px-2 py-0.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          ✕ Fermer
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { id: 'mensuel' as const, name: 'Formule Mensuelle', price: '30 000 FCFA', period: '/ mois scolaire', note: 'Sans engagement', badge: 'Flexible' },
                          { id: 'annuel' as const, name: 'Formule Annuelle (1 An)', price: '250 000 FCFA', period: '/ an complet', note: 'Économisez 20 000 FCFA', badge: '⭐ Populaire' },
                          { id: 'triennal' as const, name: 'Formule 3 Ans Scolaires', price: '750 000 FCFA', period: '/ 3 années', note: 'Économisez 60 000 FCFA', badge: '👑 VIP Élite' },
                        ].map((plan) => (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => {
                              setSelectedPlan(plan.id);
                              setIsSelectingPlan(false);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                              selectedPlan === plan.id
                                ? 'bg-emerald-600/30 border-emerald-400 text-white ring-2 ring-emerald-400 shadow-md'
                                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                selectedPlan === plan.id ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                              }`}>
                                {plan.badge}
                              </span>
                              {selectedPlan === plan.id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                            </div>
                            <div className="text-xs font-bold leading-snug">{plan.name}</div>
                            <div className="text-xs font-black text-amber-300 font-heading mt-0.5">
                              {plan.price} <span className="text-[9px] font-normal text-slate-400">{plan.period}</span>
                            </div>
                            <div className="text-[10px] text-slate-300 mt-1">{plan.note}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
