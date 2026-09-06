'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { School } from '@/lib/data/types';
import { availableClasses } from '@/lib/data/mock-data';
import { getLiveSchool, getSchoolSubscription, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import {
  UserCheck,
  Users,
  Search,
  Plus,
  Filter,
  Phone,
  MessageCircle,
  MapPin,
  FileText,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Edit3,
  Trash2,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Award,
  BookOpen,
  Briefcase,
  X,
  FileBadge2,
} from 'lucide-react';

export interface TeacherRecord {
  id: string;
  matricule: string;
  lastName: string;
  firstName: string;
  gender: 'male' | 'female';
  phone: string;
  whatsappPhone: string;
  email: string;
  address: string;
  cycle: 'Maternelle' | 'Primaire' | 'Collège' | 'Administration';
  grades: string[];
  subject: string;
  qualification: string;
  employmentType: 'Titulaire' | 'Contractuel' | 'Vacataire';
  hireDate: string;
  documents: {
    birthCertificate: boolean; // Extrait d'acte de naissance
    criminalRecord: boolean; // Casier judiciaire
    residenceCertificate: boolean; // Certificat de résidence
    teachingAuthorization: boolean; // Autorisation d'enseigner MENA
    diploma: boolean; // Diplôme académique / pédagogique
    cni: boolean; // CNI / Pièce d'identité
    cv: boolean; // CV
  };
}

const initialTeachers: TeacherRecord[] = [
  {
    id: 'tch-001',
    matricule: 'ENS-2026-001',
    lastName: 'KOUAME',
    firstName: 'Koffi Patrice',
    gender: 'male',
    phone: '+225 07 48 12 34 56',
    whatsappPhone: '+225 07 48 12 34 56',
    email: 'koffi.kouame@epc-manoi.ci',
    address: 'Cocody Angré 8ème Tranche, Cité Soleil 2',
    cycle: 'Collège',
    grades: ['6ème', '5ème', '4ème', '3ème'],
    subject: 'Mathématiques & Sciences Physiques',
    qualification: 'Master 2 Mathématiques • CAPES',
    employmentType: 'Titulaire',
    hireDate: '2021-09-01',
    documents: {
      birthCertificate: true,
      criminalRecord: true,
      residenceCertificate: true,
      teachingAuthorization: true,
      diploma: true,
      cni: true,
      cv: true,
    },
  },
  {
    id: 'tch-002',
    matricule: 'ENS-2026-002',
    lastName: 'TRAORE',
    firstName: 'Mariam',
    gender: 'female',
    phone: '+225 05 67 89 10 11',
    whatsappPhone: '+225 05 67 89 10 11',
    email: 'mariam.traore@epc-manoi.ci',
    address: 'Riviera Palmeraie, Cité SIPIM',
    cycle: 'Collège',
    grades: ['6ème', '5ème', '4ème', '3ème'],
    subject: 'Français & Lettres Modernes',
    qualification: 'Licence Lettres Modernes • Autorisation MENA',
    employmentType: 'Titulaire',
    hireDate: '2022-09-15',
    documents: {
      birthCertificate: true,
      criminalRecord: true,
      residenceCertificate: true,
      teachingAuthorization: true,
      diploma: true,
      cni: true,
      cv: true,
    },
  },
  {
    id: 'tch-003',
    matricule: 'ENS-2026-003',
    lastName: 'BAKAYOKO',
    firstName: 'Amadou',
    gender: 'male',
    phone: '+225 01 23 45 67 89',
    whatsappPhone: '+225 01 23 45 67 89',
    email: 'amadou.bakayoko@epc-manoi.ci',
    address: 'Abobo Baoulé, Face Pharmacie du Centre',
    cycle: 'Primaire',
    grades: ['CM2'],
    subject: 'Maître d’École CM2 (Toutes Matières)',
    qualification: 'Diplôme CAFOP Instituteur Ordinaire',
    employmentType: 'Titulaire',
    hireDate: '2020-10-01',
    documents: {
      birthCertificate: true,
      criminalRecord: true,
      residenceCertificate: true,
      teachingAuthorization: true,
      diploma: true,
      cni: true,
      cv: true,
    },
  },
  {
    id: 'tch-004',
    matricule: 'ENS-2026-004',
    lastName: 'YAPO',
    firstName: 'Akissi Estelle',
    gender: 'female',
    phone: '+225 07 11 22 33 44',
    whatsappPhone: '+225 07 11 22 33 44',
    email: 'estelle.yapo@epc-manoi.ci',
    address: 'Bingerville, Cité Feh Kessé',
    cycle: 'Maternelle',
    grades: ['Maternelle (G.S.)'],
    subject: 'Éducatrice Préscolaire Maternelle',
    qualification: 'Certificat d’Aptitude Préscolaire (CAP Maternelle)',
    employmentType: 'Titulaire',
    hireDate: '2023-09-01',
    documents: {
      birthCertificate: true,
      criminalRecord: true,
      residenceCertificate: true,
      teachingAuthorization: true,
      diploma: true,
      cni: true,
      cv: true,
    },
  },
  {
    id: 'tch-005',
    matricule: 'ENS-2026-005',
    lastName: 'N’GUESSAN',
    firstName: 'Yao Sylvain',
    gender: 'male',
    phone: '+225 05 99 88 77 66',
    whatsappPhone: '+225 05 99 88 77 66',
    email: 'sylvain.nguessan@epc-manoi.ci',
    address: 'Yopougon Maroc, Carrefour Antenne',
    cycle: 'Collège',
    grades: ['6ème', '5ème', '4ème', '3ème'],
    subject: 'Histoire-Géographie & Éducation Civique',
    qualification: 'Master Histoire-Géo • CAPES',
    employmentType: 'Titulaire',
    hireDate: '2022-09-01',
    documents: {
      birthCertificate: true,
      criminalRecord: true,
      residenceCertificate: true,
      teachingAuthorization: true,
      diploma: true,
      cni: true,
      cv: true,
    },
  },
  {
    id: 'tch-006',
    matricule: 'ENS-2026-006',
    lastName: 'DIOMANDE',
    firstName: 'Fanta',
    gender: 'female',
    phone: '+225 01 55 44 33 22',
    whatsappPhone: '+225 01 55 44 33 22',
    email: 'fanta.diomande@epc-manoi.ci',
    address: 'Cocody Danga, Boulevard de France',
    cycle: 'Collège',
    grades: ['5ème', '4ème', '3ème'],
    subject: 'Sciences de la Vie et de la Terre (SVT)',
    qualification: 'Licence Biologie • En cours MENA',
    employmentType: 'Contractuel',
    hireDate: '2024-09-01',
    documents: {
      birthCertificate: true,
      criminalRecord: false,
      residenceCertificate: true,
      teachingAuthorization: false,
      diploma: true,
      cni: true,
      cv: true,
    },
  },
  {
    id: 'tch-007',
    matricule: 'ENS-2026-007',
    lastName: 'KONE',
    firstName: 'Ibrahim',
    gender: 'male',
    phone: '+225 07 66 55 44 33',
    whatsappPhone: '+225 07 66 55 44 33',
    email: 'ibrahim.kone@epc-manoi.ci',
    address: 'Plateau Dokui, Rue des Ambassades',
    cycle: 'Primaire',
    grades: ['CE1'],
    subject: 'Maître d’École CE1',
    qualification: 'CAFOP Instituteur Adjoint',
    employmentType: 'Titulaire',
    hireDate: '2021-10-01',
    documents: {
      birthCertificate: true,
      criminalRecord: true,
      residenceCertificate: true,
      teachingAuthorization: true,
      diploma: true,
      cni: true,
      cv: true,
    },
  },
  {
    id: 'tch-008',
    matricule: 'ENS-2026-008',
    lastName: 'BAMBA',
    firstName: 'Assétou',
    gender: 'female',
    phone: '+225 05 33 22 11 00',
    whatsappPhone: '+225 05 33 22 11 00',
    email: 'assetou.bamba@epc-manoi.ci',
    address: 'Koumassi Remblais, Cité Prodomo',
    cycle: 'Maternelle',
    grades: ['Maternelle (P.S.)', 'Maternelle (M.S.)'],
    subject: 'Éducatrice Préscolaire Petite & Moyenne Section',
    qualification: 'CAP Petite Enfance & Maternelle',
    employmentType: 'Titulaire',
    hireDate: '2023-01-10',
    documents: {
      birthCertificate: true,
      criminalRecord: true,
      residenceCertificate: true,
      teachingAuthorization: true,
      diploma: true,
      cni: true,
      cv: true,
    },
  },
];

interface StaffViewProps {
  school: School;
  schoolSlug: string;
}

const TEACHERS_STORAGE_KEY = 'schoolflow_teachers_data_v3';

export function StaffView({ school, schoolSlug }: StaffViewProps) {
  const getInitialTeachers = (): TeacherRecord[] => {
    if (typeof window !== 'undefined') {
      try {
        const sub = getSchoolSubscription(schoolSlug);
        if (sub?.isDataReset) {
          return [];
        }
        const saved =
          localStorage.getItem(`${TEACHERS_STORAGE_KEY}_${schoolSlug}`) ||
          localStorage.getItem(TEACHERS_STORAGE_KEY);
        if (saved) {
          const parsed: TeacherRecord[] = JSON.parse(saved);
          // Nettoyer automatiquement toute ancienne donnée comportant le Lycée
          const sanitized = parsed
            .filter((t) => (t.cycle as string) !== 'Lycée')
            .map((t) => ({
              ...t,
              grades: t.grades.filter(
                (g) =>
                  !g.toLowerCase().includes('2nde') &&
                  !g.toLowerCase().includes('1ère') &&
                  !g.toLowerCase().includes('terminale')
              ),
            }));
          return sanitized.length > 0 ? sanitized : initialTeachers;
        }
        // Pour les nouveaux établissements ou après reset, liste vierge
        if (schoolSlug !== 'epc-manoi' && schoolSlug !== 'college-excellence') {
          return [];
        }
      } catch (e) {
        // ignore
      }
    }
    return initialTeachers;
  };

  const [teachers, setTeachers] = useState<TeacherRecord[]>(getInitialTeachers);

  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCycle, setSelectedCycle] = useState('all');
  const [selectedDocFilter, setSelectedDocFilter] = useState('all');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSchool(getLiveSchool(schoolSlug, school));
    setTeachers(getInitialTeachers());

    const handleUpdate = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, school));
      setTeachers(getInitialTeachers());
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, school]);

  // Sauvegarder dans localStorage
  const saveTeachersToStorage = (updatedList: TeacherRecord[]) => {
    setTeachers(updatedList);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${TEACHERS_STORAGE_KEY}_${schoolSlug}`, JSON.stringify(updatedList));
        if (schoolSlug === 'epc-manoi' || schoolSlug === 'college-excellence') {
          localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(updatedList));
        }
      } catch (e) {
        // ignore
      }
    }
  };

  // Formulaire d'ajout
  const [formLastName, setFormLastName] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formGender, setFormGender] = useState<'male' | 'female'>('male');
  const [formPhone, setFormPhone] = useState('+225 ');
  const [formAddress, setFormAddress] = useState('');
  const [formCycle, setFormCycle] = useState<'Maternelle' | 'Primaire' | 'Collège'>('Collège');
  const [formSubject, setFormSubject] = useState('');
  const [formGrades, setFormGrades] = useState('6ème');
  const [formQualification, setFormQualification] = useState('');

  // Pièces administratives
  const [hasBirth, setHasBirth] = useState(true);
  const [hasCriminal, setHasCriminal] = useState(true);
  const [hasResidence, setHasResidence] = useState(true);
  const [hasAuth, setHasAuth] = useState(true);
  const [hasDiploma, setHasDiploma] = useState(true);
  const [hasCni, setHasCni] = useState(true);
  const [hasCv, setHasCv] = useState(true);

  const isDocComplete = (t: TeacherRecord) =>
    t.documents.birthCertificate &&
    t.documents.criminalRecord &&
    t.documents.residenceCertificate &&
    t.documents.teachingAuthorization &&
    t.documents.diploma &&
    t.documents.cni &&
    t.documents.cv;

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        t.lastName.toLowerCase().includes(q) ||
        t.firstName.toLowerCase().includes(q) ||
        t.matricule.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q) ||
        t.grades.some((g) => g.toLowerCase().includes(q));

      const matchesCycle = selectedCycle === 'all' || t.cycle === selectedCycle;
      const complete = isDocComplete(t);
      const matchesDoc =
        selectedDocFilter === 'all' ||
        (selectedDocFilter === 'complete' && complete) ||
        (selectedDocFilter === 'incomplete' && !complete);

      return matchesSearch && matchesCycle && matchesDoc;
    });
  }, [teachers, searchQuery, selectedCycle, selectedDocFilter]);

  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: TeacherRecord = {
      id: `tch-${(teachers.length + 1).toString().padStart(3, '0')}`,
      matricule: `ENS-2026-${(teachers.length + 1).toString().padStart(3, '0')}`,
      lastName: formLastName.trim().toUpperCase(),
      firstName: formFirstName.trim(),
      gender: formGender,
      phone: formPhone.trim(),
      whatsappPhone: formPhone.trim(),
      email: `${formFirstName.toLowerCase().replace(/\s+/g, '')}.${formLastName.toLowerCase()}@${schoolSlug}.ci`,
      address: formAddress.trim(),
      cycle: formCycle,
      grades: formGrades.split(',').map((g) => g.trim()),
      subject:
        formCycle === 'Maternelle'
          ? 'Éducatrice Préscolaire (Toutes Matières)'
          : formCycle === 'Primaire'
          ? 'Maître d’École (Toutes Matières)'
          : formSubject.trim() || 'Enseignement Secondaire',
      qualification: formQualification.trim() || 'Autorisation d’Enseigner MENA',
      employmentType: 'Titulaire',
      hireDate: new Date().toISOString().split('T')[0],
      documents: {
        birthCertificate: hasBirth,
        criminalRecord: hasCriminal,
        residenceCertificate: hasResidence,
        teachingAuthorization: hasAuth,
        diploma: hasDiploma,
        cni: hasCni,
        cv: hasCv,
      },
    };

    const updated = [newRecord, ...teachers];
    saveTeachersToStorage(updated);
    setShowAddModal(false);
    setToastMessage(`✓ Enseignant(e) ${newRecord.lastName} ${newRecord.firstName} ajouté(e) avec succès !`);
    setTimeout(() => setToastMessage(null), 5000);

    // Reset
    setFormLastName('');
    setFormFirstName('');
    setFormAddress('');
    setFormSubject('');
  };

  const toggleDoc = (teacherId: string, docKey: keyof TeacherRecord['documents']) => {
    setTeachers((prev) =>
      prev.map((t) => {
        if (t.id === teacherId) {
          const updated = {
            ...t,
            documents: {
              ...t.documents,
              [docKey]: !t.documents[docKey],
            },
          };
          if (selectedTeacher && selectedTeacher.id === teacherId) {
            setSelectedTeacher(updated);
          }
          return updated;
        }
        return t;
      })
    );
  };

  const handleSaveTeacherDossier = () => {
    if (!selectedTeacher) return;
    saveTeachersToStorage(teachers);
    const teacherName = `${selectedTeacher.lastName} ${selectedTeacher.firstName}`;
    setSelectedTeacher(null);
    setToastMessage(`✓ Pièces et statut du dossier de ${teacherName} enregistrés avec succès !`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Enseignants & Personnel Pédagogique
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Dossiers administratifs, adresses, classes tenues et autorisations d&apos;enseigner — {currentSchool.name}
          </p>
        </div>

        {/* Actions Rapides */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Enseignant</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-950 font-bold ml-4 p-1 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 2. Cartes Statistiques KPI Style Pandhowan Harmonisé */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Effectif Enseignants */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
              Effectif Enseignants
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {teachers.length}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {teachers.length > 0 ? '100% Déclarés' : '0 Déclaré'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            {teachers.length > 0 ? 'Corps professoral & maîtres d’école' : 'Aucun enseignant enregistré'}
          </p>
        </div>

        {/* Autorisations MENA */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
              Autorisations MENA
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {teachers.length > 0
                ? `${teachers.filter((t) => t.documents.teachingAuthorization).length} / ${teachers.length}`
                : '0 / 0'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Conformité
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            {teachers.length > 0 ? 'Agréments ministériels validés' : 'Aucun dossier en cours'}
          </p>
        </div>

        {/* Cycles d'Enseignement */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
              Cycles d&apos;Enseignement
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {new Set(teachers.map((t) => t.cycle).filter(Boolean)).size} {new Set(teachers.map((t) => t.cycle).filter(Boolean)).size > 1 ? 'Cycles' : 'Cycle'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
              {teachers.length > 0 ? 'Actifs' : 'Inactifs'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            {teachers.length > 0
              ? Array.from(new Set(teachers.map((t) => t.cycle).filter(Boolean))).join(', ')
              : 'Aucun cycle assigné'}
          </p>
        </div>

        {/* Dossiers Complets */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans truncate">
              Dossiers 100% Complets
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {teachers.filter((t) => isDocComplete(t)).length}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Pièces Vérifiées
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            {teachers.length > 0 ? 'Extrait, Casier, Résidence, Diplômes' : 'Aucun dossier actif'}
          </p>
        </div>
      </div>

      {/* 3. Tableau des Enseignants & Dossiers */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, matière, classe, matricule, adresse..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="all">Tous les Cycles</option>
              <option value="Maternelle">Cycle Maternelle</option>
              <option value="Primaire">Cycle Primaire</option>
              <option value="Collège">Cycle Collège</option>
            </select>

            <select
              value={selectedDocFilter}
              onChange={(e) => setSelectedDocFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="all">Tous les Dossiers</option>
              <option value="complete">Dossiers 100% Complets</option>
              <option value="incomplete">Pièces Manquantes</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 pl-6 pr-3 align-middle">Matricule & Enseignant</th>
                <th className="py-3.5 px-3 align-middle">Matière & Qualification</th>
                <th className="py-3.5 px-3 text-center align-middle">Cycle & Classes Tenues</th>
                <th className="py-3.5 px-3 align-middle">Adresse & WhatsApp</th>
                <th className="py-3.5 px-3 text-center align-middle">Pièces Fournies (Extrait, Casier, Résidence...)</th>
                <th className="py-3.5 pr-6 px-3 text-center align-middle">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 align-middle">
                    Aucun enseignant ne correspond aux critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((tch) => {
                  const isComplete = isDocComplete(tch);
                  return (
                    <tr key={tch.id} className="hover:bg-emerald-50/20 transition-colors">
                      {/* Enseignant */}
                      <td className="py-4 pl-6 pr-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-black uppercase text-xs shrink-0 border border-slate-200">
                            {tch.firstName[0]}{tch.lastName[0]}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-950 block font-heading text-sm uppercase leading-tight">
                              {tch.lastName} {tch.firstName}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500 font-semibold block mt-0.5">
                              {tch.matricule} • {tch.employmentType}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Matière & Diplôme */}
                      <td className="py-4 px-3 align-middle">
                        <span className="font-bold text-slate-900 block leading-tight">{tch.subject}</span>
                        <span className="text-[11px] text-emerald-800 font-semibold block mt-0.5">
                          🎓 {tch.qualification}
                        </span>
                      </td>

                      {/* Cycle & Classes Tenues */}
                      <td className="py-4 px-3 text-center align-middle">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            {tch.cycle}
                          </span>
                          <div className="flex items-center gap-1 flex-wrap justify-center max-w-[220px]">
                            {tch.grades.map((g, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px] border border-slate-200">
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Adresse & Contact */}
                      <td className="py-4 px-3 align-middle">
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>{tch.address}</span>
                          </p>
                          <p className="font-mono text-[11px] text-emerald-900 font-bold flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{tch.whatsappPhone}</span>
                          </p>
                        </div>
                      </td>

                      {/* Statuts des Pièces Jointes */}
                      <td className="py-4 px-3 text-center align-middle">
                        <div className="inline-flex items-center gap-1 flex-wrap justify-center max-w-[320px]">
                          {/* Extrait */}
                          <span
                            title={tch.documents.birthCertificate ? 'Extrait de naissance fourni' : 'Extrait manquant'}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                              tch.documents.birthCertificate ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            Extrait {tch.documents.birthCertificate ? '✓' : '✕'}
                          </span>

                          {/* Casier Judiciaire */}
                          <span
                            title={tch.documents.criminalRecord ? 'Casier judiciaire conforme' : 'Casier judiciaire manquant'}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                              tch.documents.criminalRecord ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            Casier Judiciaire {tch.documents.criminalRecord ? '✓' : '✕'}
                          </span>

                          {/* Certificat de Résidence */}
                          <span
                            title={tch.documents.residenceCertificate ? 'Certificat de résidence fourni' : 'Certificat de résidence manquant'}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                              tch.documents.residenceCertificate ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            Résidence {tch.documents.residenceCertificate ? '✓' : '✕'}
                          </span>

                          {/* Autorisation MENA */}
                          <span
                            title={tch.documents.teachingAuthorization ? 'Autorisation d’Enseigner MENA' : 'Autorisation MENA Manquante'}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                              tch.documents.teachingAuthorization ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            MENA {tch.documents.teachingAuthorization ? '✓' : '✕'}
                          </span>

                          {/* Diplôme */}
                          <span
                            title={tch.documents.diploma ? 'Diplôme certifié' : 'Diplôme non fourni'}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                              tch.documents.diploma ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            Diplôme {tch.documents.diploma ? '✓' : '✕'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 pr-6 px-3 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => setSelectedTeacher(tch)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Voir Dossier</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal Visualisation Complète du Dossier Enseignant */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-lg">
                  {selectedTeacher.firstName[0]}{selectedTeacher.lastName[0]}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 font-heading uppercase">
                    {selectedTeacher.lastName} {selectedTeacher.firstName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Matricule {selectedTeacher.matricule} • {selectedTeacher.employmentType}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeacher(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Détails profil */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Matière enseignée</span>
                <span className="font-bold text-slate-900">{selectedTeacher.subject}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cycle & Niveau</span>
                <span className="font-bold text-purple-900">{selectedTeacher.cycle}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Adresse de résidence</span>
                <span className="font-bold text-slate-900">{selectedTeacher.address}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">WhatsApp direct</span>
                <span className="font-mono font-bold text-emerald-800">{selectedTeacher.whatsappPhone}</span>
              </div>
              <div className="col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Classes sous sa responsabilité</span>
                <span className="font-bold text-slate-900">{selectedTeacher.grades.join(' • ')}</span>
              </div>
            </div>

            {/* Checklist des Pièces du Dossier */}
            <div className="space-y-2.5 pt-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                <span>Pièces Justificatives & Dossier Administratif</span>
                <span className="text-[10px] text-slate-400">Cliquez pour valider/invalider</span>
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {[
                  { key: 'birthCertificate' as const, label: 'Extrait d’Acte de Naissance', desc: 'État civil certifié' },
                  { key: 'criminalRecord' as const, label: 'Casier Judiciaire (Bulletin N° 3)', desc: 'Extrait de casier judiciaire datant de moins de 3 mois' },
                  { key: 'residenceCertificate' as const, label: 'Certificat de Résidence', desc: 'Justificatif officiel de domicile' },
                  { key: 'teachingAuthorization' as const, label: 'Autorisation d’Enseigner MENA', desc: 'Agrément ministériel obligatoire' },
                  { key: 'diploma' as const, label: 'Diplôme Académique / Pédagogique', desc: 'CAP, CAFOP, Licence, Master' },
                  { key: 'cni' as const, label: 'Carte Nationale d’Identité (CNI / Passeport)', desc: 'Pièce d’identité officielle en cours de validité' },
                  { key: 'cv' as const, label: 'Curriculum Vitae (CV) & Contrat', desc: 'Parcours professionnel et contrat de travail' },
                ].map((doc) => {
                  const isChecked = selectedTeacher.documents[doc.key];
                  return (
                    <div
                      key={doc.key}
                      onClick={() => toggleDoc(selectedTeacher.id, doc.key)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked ? 'bg-emerald-50/60 border-emerald-300' : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-900">{doc.label}</p>
                        <p className="text-[10.5px] text-slate-500">{doc.desc}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ml-2 ${
                        isChecked ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                      }`}>
                        {isChecked ? 'Conforme ✓' : 'Manquant ✕'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedTeacher(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Fermer sans enregistrer
              </button>

              <button
                type="button"
                onClick={handleSaveTeacherDossier}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Valider & Enregistrer le Dossier</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal Ajouter un Enseignant */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-heading">
                    Ajouter un Nouvel Enseignant
                  </h3>
                  <p className="text-xs text-slate-400">
                    Enregistrement au registre du personnel de l&apos;école
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTeacher} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nom de famille *</label>
                  <input
                    type="text"
                    required
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Ex: KONATE"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Prénoms *</label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="Ex: Lassina Mouhamed"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cycle d&apos;enseignement *</label>
                  <select
                    value={formCycle}
                    onChange={(e) => setFormCycle(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold cursor-pointer"
                  >
                    <option value="Maternelle">Maternelle</option>
                    <option value="Primaire">Primaire</option>
                    <option value="Collège">Collège</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Classe(s) assignée(s) *</label>
                  <input
                    type="text"
                    required
                    value={formGrades}
                    onChange={(e) => setFormGrades(e.target.value)}
                    placeholder="Ex: 6ème, 5ème ou CM2"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Matière enseignée (Uniquement pour Collège) */}
              {formCycle === 'Collège' ? (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Matière enseignée *</label>
                  <input
                    type="text"
                    required
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="Ex: Mathématiques, Français, SVT, Histoire-Géo, Anglais..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-center gap-2 text-emerald-800 text-[11px] font-medium">
                  <span>ℹ️</span>
                  <span>
                    {formCycle === 'Maternelle'
                      ? 'Enseignement Préscolaire Global (Toutes activités & apprentissages de la Maternelle)'
                      : 'Enseignement Primaire Polyvalent (Maître d’École prenant en charge toutes les disciplines)'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Téléphone & WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Adresse de résidence *</label>
                  <input
                    type="text"
                    required
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Ex: Cocody Angré 8ème Tranche"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Statuts des documents à l'embauche */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="font-bold text-slate-800 block">Pièces fournies pour le dossier administratif :</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={hasBirth} onChange={(e) => setHasBirth(e.target.checked)} className="rounded text-emerald-600" />
                    <span>Extrait de Naissance</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={hasCriminal} onChange={(e) => setHasCriminal(e.target.checked)} className="rounded text-emerald-600" />
                    <span>Casier Judiciaire</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={hasResidence} onChange={(e) => setHasResidence(e.target.checked)} className="rounded text-emerald-600" />
                    <span>Certificat de Résidence</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={hasAuth} onChange={(e) => setHasAuth(e.target.checked)} className="rounded text-emerald-600" />
                    <span>Autorisation MENA</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={hasDiploma} onChange={(e) => setHasDiploma(e.target.checked)} className="rounded text-emerald-600" />
                    <span>Diplôme vérifié</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={hasCni} onChange={(e) => setHasCni(e.target.checked)} className="rounded text-emerald-600" />
                    <span>CNI / Passeport</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer col-span-2">
                    <input type="checkbox" checked={hasCv} onChange={(e) => setHasCv(e.target.checked)} className="rounded text-emerald-600" />
                    <span>Curriculum Vitae (CV) & Contrat de travail</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 cursor-pointer"
                >
                  Enregistrer l&apos;Enseignant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
