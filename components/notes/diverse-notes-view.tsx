'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { School, Student } from '@/lib/data/types';
import { formatDate } from '@/lib/utils/formatters';
import { availableClasses, mockStudents } from '@/lib/data/mock-data';
import { getLiveSchool, getLiveStudents, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import {
  NotebookPen,
  PlusCircle,
  Search,
  Filter,
  RotateCcw,
  Printer,
  FileCheck,
  Building2,
  Calendar,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Clock,
  User,
  Users,
  Eye,
  X,
  Sparkles,
  Layers,
  Check,
  Bookmark,
  Share2,
  GraduationCap,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

export interface DiverseNote {
  id: string;
  noteNumber: string;
  title: string;
  category: 'Pédagogique' | 'Administratif' | 'Discipline & Vie Scolaire' | 'Direction Générale' | 'Comptabilité & Caisse' | 'Conseil & Réunion' | 'Santé & Social' | 'Divers';
  priority: 'Normale' | 'Importante' | 'Urgente' | 'Basse';
  targetType: 'Général (Établissement)' | 'Classe Spécifique' | 'Élève Particulier' | 'Personnel Enseignant';
  targetGrade?: string;
  targetStudentName?: string;
  author: string;
  date: string;
  note1: string; // Note 1 demandée par l'utilisateur
  note2: string; // Note 2 demandée par l'utilisateur
  note3: string; // Note 3 demandée par l'utilisateur
  summary?: string;
  status: 'En cours' | 'Traité / Validé' | 'En attente' | 'Archivé';
  isConfidential?: boolean;
}

const DIVERSE_NOTES_STORAGE_KEY = 'schoolflow_diverse_notes_v1';

const INITIAL_MOCK_NOTES: DiverseNote[] = [
  {
    id: 'note-001',
    noteNumber: 'NOTE-2026-001',
    title: 'Dispositif de Soutien Pédagogique — Rentrée 2026-2027',
    category: 'Pédagogique',
    priority: 'Importante',
    targetType: 'Classe Spécifique',
    targetGrade: 'CM2',
    targetStudentName: 'Kouadio Aya Grâce',
    author: 'M. Amadou Fall (Directeur des Études)',
    date: '2026-09-08',
    note1: 'Évaluation diagnostique initiale réalisée avec succès en mathématiques et expression écrite.',
    note2: 'Mise en place de séances de renforcement les mercredis après-midi (14h00 - 16h00).',
    note3: 'Point d’étape programmé avec les parents à la fin du 1er mois pour évaluer la progression.',
    summary: 'Plan d’accompagnement personnalisé validé par le conseil de classe pour consolider les acquis avant le passage en 6ème.',
    status: 'En cours',
    isConfidential: false,
  },
  {
    id: 'note-002',
    noteNumber: 'NOTE-2026-002',
    title: 'Organisation des Conseils de Classes du 1er Trimestre',
    category: 'Direction Générale',
    priority: 'Urgente',
    targetType: 'Général (Établissement)',
    author: 'Direction Générale (EPC MANOI)',
    date: '2026-09-15',
    note1: 'Clôture de la saisie des notes et moyennes fixée au vendredi 20 novembre 2026.',
    note2: 'Publication des plannings de passage pour la Maternelle, le Primaire et le Secondaire.',
    note3: 'Génération automatique des bulletins numériques via SchoolFlow avec envoi WhatsApp aux parents.',
    summary: 'Directives officielles adressées à l’ensemble du corps professoral pour le bon déroulement des délibérations.',
    status: 'En cours',
    isConfidential: false,
  },
  {
    id: 'note-003',
    noteNumber: 'NOTE-2026-003',
    title: 'Suivi de Discipline & Ponctualité aux Cours',
    category: 'Discipline & Vie Scolaire',
    priority: 'Normale',
    targetType: 'Classe Spécifique',
    targetGrade: '4ème',
    targetStudentName: 'Koné Mariam',
    author: 'Surveillant Général',
    date: '2026-09-22',
    note1: 'Entretien individuel mené avec l’élève et engagement formel de respect des horaires.',
    note2: 'Notification d’assiduité transmise au parent via le portail WhatsApp.',
    note3: 'Assiduité exemplaire constatée sur les deux dernières semaines de cours.',
    summary: 'Régularisation de la situation de ponctualité effectuée en accord avec la famille.',
    status: 'Traité / Validé',
    isConfidential: false,
  },
  {
    id: 'note-004',
    noteNumber: 'NOTE-2026-004',
    title: 'Point d’Audit Financier & Encaissements de Scolarité',
    category: 'Comptabilité & Caisse',
    priority: 'Importante',
    targetType: 'Général (Établissement)',
    author: 'Service Comptabilité',
    date: '2026-09-28',
    note1: 'Taux de recouvrement global de rentrée supérieur à 88% des prévisions budgétaires.',
    note2: 'Traitement finalisé de l’ensemble des dossiers de réductions spéciales fratrie.',
    note3: 'Clôture et rapprochement bancaire hebdomadaire certifié sans aucun écart de caisse.',
    summary: 'Synthèse comptable mensuelle soumise à la direction de l’établissement.',
    status: 'Traité / Validé',
    isConfidential: true,
  },
  {
    id: 'note-005',
    noteNumber: 'NOTE-2026-005',
    title: 'Commission Hygiène & Menus de la Restauration Scolaire',
    category: 'Santé & Social',
    priority: 'Basse',
    targetType: 'Personnel Enseignant',
    author: 'Responsable Demi-Pension',
    date: '2026-10-02',
    note1: 'Validation des menus équilibrés pour le mois d’octobre (plats locaux et fruits frais).',
    note2: 'Vérification scrupuleuse des fiches médicales et régimes sans arachides / sans lactose.',
    note3: 'Contrôle quotidien de la chaîne du froid et du protocole sanitaire.',
    summary: 'Rapport de conformité nutritionnelle approuvé par l’infirmerie scolaire.',
    status: 'Traité / Validé',
    isConfidential: false,
  },
];

const CATEGORIES_LIST = [
  'Toutes les catégories',
  'Pédagogique',
  'Administratif',
  'Discipline & Vie Scolaire',
  'Direction Générale',
  'Comptabilité & Caisse',
  'Conseil & Réunion',
  'Santé & Social',
  'Divers',
];

const PRIORITIES_LIST = ['Toutes les priorités', 'Urgente', 'Importante', 'Normale', 'Basse'];
const STATUS_LIST = ['Tous les statuts', 'En cours', 'Traité / Validé', 'En attente', 'Archivé'];

interface DiverseNotesViewProps {
  school: School;
  schoolSlug: string;
}

export function DiverseNotesView({ school, schoolSlug }: DiverseNotesViewProps) {
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const [students, setStudents] = useState<Student[]>([]);

  // Liste des notes persistées
  const [notes, setNotes] = useState<DiverseNote[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DIVERSE_NOTES_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_MOCK_NOTES;
  });

  // Filtres & Recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Toutes les catégories');
  const [priorityFilter, setPriorityFilter] = useState('Toutes les priorités');
  const [statusFilter, setStatusFilter] = useState('Tous les statuts');
  const [gradeFilter, setGradeFilter] = useState('Toutes les classes');

  // Modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedNoteForView, setSelectedNoteForView] = useState<DiverseNote | null>(null);
  const [editingNote, setEditingNote] = useState<DiverseNote | null>(null);

  // Formulaire d'ajout / modification de note
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<DiverseNote['category']>('Pédagogique');
  const [formPriority, setFormPriority] = useState<DiverseNote['priority']>('Normale');
  const [formTargetType, setFormTargetType] = useState<DiverseNote['targetType']>('Général (Établissement)');
  const [formTargetGrade, setFormTargetGrade] = useState('CM2');
  const [formTargetStudentName, setFormTargetStudentName] = useState('');
  const [formAuthor, setFormAuthor] = useState('Direction des Études');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNote1, setFormNote1] = useState('');
  const [formNote2, setFormNote2] = useState('');
  const [formNote3, setFormNote3] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formStatus, setFormStatus] = useState<DiverseNote['status']>('En cours');
  const [formIsConfidential, setFormIsConfidential] = useState(false);

  // Notifications toast
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Synchronisation avec le store
  useEffect(() => {
    setCurrentSchool(getLiveSchool(schoolSlug, school));
    setStudents(getLiveStudents(mockStudents, schoolSlug));

    const handleUpdate = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, school));
      setStudents(getLiveStudents(mockStudents, schoolSlug));
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, school]);

  // Sauvegarder dans localStorage
  const saveNotesToStorage = (updatedList: DiverseNote[]) => {
    setNotes(updatedList);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DIVERSE_NOTES_STORAGE_KEY, JSON.stringify(updatedList));
      } catch (e) {}
    }
  };

  // Filtrage intelligent
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const matchSearch =
        !searchQuery ||
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.noteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.note1.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.note2.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.note3.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.targetStudentName && n.targetStudentName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory =
        categoryFilter === 'Toutes les catégories' || n.category === categoryFilter;

      const matchPriority =
        priorityFilter === 'Toutes les priorités' || n.priority === priorityFilter;

      const matchStatus =
        statusFilter === 'Tous les statuts' || n.status === statusFilter;

      const matchGrade =
        gradeFilter === 'Toutes les classes' ||
        n.targetGrade === gradeFilter ||
        n.targetType === 'Général (Établissement)';

      return matchSearch && matchCategory && matchPriority && matchStatus && matchGrade;
    });
  }, [notes, searchQuery, categoryFilter, priorityFilter, statusFilter, gradeFilter]);

  // Statistiques clés
  const stats = useMemo(() => {
    const total = notes.length;
    const urgentCount = notes.filter((n) => n.priority === 'Urgente' || n.priority === 'Importante').length;
    const pedagogicCount = notes.filter((n) => n.category === 'Pédagogique' || n.category === 'Conseil & Réunion').length;
    const resolvedCount = notes.filter((n) => n.status === 'Traité / Validé').length;
    return { total, urgentCount, pedagogicCount, resolvedCount };
  }, [notes]);

  // Ouvrir la modale d'ajout
  const handleOpenAddModal = () => {
    const nextNum = notes.length + 1;
    const formatted = String(nextNum).padStart(3, '0');
    setEditingNote(null);
    setFormTitle('');
    setFormCategory('Pédagogique');
    setFormPriority('Normale');
    setFormTargetType('Général (Établissement)');
    setFormTargetGrade('CM2');
    setFormTargetStudentName('');
    setFormAuthor('Direction des Études');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormNote1('');
    setFormNote2('');
    setFormNote3('');
    setFormSummary('');
    setFormStatus('En cours');
    setFormIsConfidential(false);
    setIsAddModalOpen(true);
  };

  // Ouvrir la modale de modification
  const handleOpenEditModal = (note: DiverseNote) => {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormCategory(note.category);
    setFormPriority(note.priority);
    setFormTargetType(note.targetType);
    setFormTargetGrade(note.targetGrade || 'CM2');
    setFormTargetStudentName(note.targetStudentName || '');
    setFormAuthor(note.author);
    setFormDate(note.date);
    setFormNote1(note.note1);
    setFormNote2(note.note2);
    setFormNote3(note.note3);
    setFormSummary(note.summary || '');
    setFormStatus(note.status);
    setFormIsConfidential(note.isConfidential || false);
    setIsAddModalOpen(true);
  };

  // Enregistrer ou Mettre à jour une note
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      alert('Veuillez renseigner le titre de la note.');
      return;
    }

    if (editingNote) {
      // Modification
      const updated: DiverseNote = {
        ...editingNote,
        title: formTitle,
        category: formCategory,
        priority: formPriority,
        targetType: formTargetType,
        targetGrade: formTargetType === 'Classe Spécifique' ? formTargetGrade : undefined,
        targetStudentName: formTargetType === 'Élève Particulier' ? formTargetStudentName : undefined,
        author: formAuthor,
        date: formDate,
        note1: formNote1,
        note2: formNote2,
        note3: formNote3,
        summary: formSummary,
        status: formStatus,
        isConfidential: formIsConfidential,
      };

      const newList = notes.map((n) => (n.id === editingNote.id ? updated : n));
      saveNotesToStorage(newList);
      setToastMessage(`✏️ Note N° ${editingNote.noteNumber} mise à jour avec succès !`);
    } else {
      // Nouvelle note
      const nextNum = notes.length + 1;
      const formatted = String(nextNum).padStart(3, '0');
      const newNote: DiverseNote = {
        id: `note-${Date.now()}`,
        noteNumber: `NOTE-2026-${formatted}`,
        title: formTitle,
        category: formCategory,
        priority: formPriority,
        targetType: formTargetType,
        targetGrade: formTargetType === 'Classe Spécifique' ? formTargetGrade : undefined,
        targetStudentName: formTargetType === 'Élève Particulier' ? formTargetStudentName : undefined,
        author: formAuthor,
        date: formDate,
        note1: formNote1,
        note2: formNote2,
        note3: formNote3,
        summary: formSummary,
        status: formStatus,
        isConfidential: formIsConfidential,
      };

      const newList = [newNote, ...notes];
      saveNotesToStorage(newList);
      setToastMessage(`✨ Nouvelle note ${newNote.noteNumber} enregistrée avec succès !`);
    }

    setIsAddModalOpen(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Supprimer une note
  const handleDeleteNote = (id: string, noteNumber: string) => {
    if (confirm(`Confirmez-vous la suppression définitive de la note ${noteNumber} ?`)) {
      const newList = notes.filter((n) => n.id !== id);
      saveNotesToStorage(newList);
      if (selectedNoteForView?.id === id) {
        setSelectedNoteForView(null);
      }
      setToastMessage(`🗑️ Note ${noteNumber} supprimée.`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    }
  };

  // Réinitialiser les filtres
  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('Toutes les catégories');
    setPriorityFilter('Toutes les priorités');
    setStatusFilter('Tous les statuts');
    setGradeFilter('Toutes les classes');
  };

  const getPriorityBadgeClass = (priority: DiverseNote['priority']) => {
    switch (priority) {
      case 'Urgente':
        return 'bg-rose-50 text-rose-700 border-rose-200/80 font-bold';
      case 'Importante':
        return 'bg-amber-50 text-amber-800 border-amber-200/80 font-bold';
      case 'Normale':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-bold';
      case 'Basse':
        return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
    }
  };

  const getStatusBadgeClass = (status: DiverseNote['status']) => {
    switch (status) {
      case 'Traité / Validé':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-bold';
      case 'En cours':
        return 'bg-blue-50 text-blue-700 border-blue-200/80 font-bold';
      case 'En attente':
        return 'bg-amber-50 text-amber-800 border-amber-200/80 font-bold';
      case 'Archivé':
        return 'bg-slate-100 text-slate-500 border-slate-200 font-medium';
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-slate-950 text-white shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-bold text-xs">{toastMessage}</span>
        </div>
      )}

      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Notes Diverses & Mémos
            </h1>
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs">
              {currentSchool.academicYear || '2026-2027'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Carnet centralisé des notes administratives, pédagogiques, comptes-rendus et observations officielles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Imprimer la Liste</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouvelle Note</span>
          </button>
        </div>
      </div>

      {/* 2. Les Cartes KPI Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 print:hidden">
        {/* Card 1: Total Notes */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
              <NotebookPen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-sans">
                Total Notes & Mémos
              </h3>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {stats.total}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Actives
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Maternelle, Primaire, Secondaire & Direction
          </p>
        </div>

        {/* Card 2: Urgentes & Importantes */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-sans">
                Prioritaires & Urgentes
              </h3>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {stats.urgentCount}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              À traiter
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Nécessite une action ou un suivi immédiat
          </p>
        </div>

        {/* Card 3: Pédagogie & Conseils */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-sans">
                Notes Pédagogiques
              </h3>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {stats.pedagogicCount}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Conseils / Suivi
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Dispositifs d&apos;apprentissage & évaluations
          </p>
        </div>

        {/* Card 4: Traitées / Validées */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-sans">
                Traitées & Validées
              </h3>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {stats.resolvedCount}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
              Validées ✓
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Objectifs atteints & dossiers clôturés
          </p>
        </div>
      </div>

      {/* 3. Barre d'outils et de Filtrage */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          
          {/* Recherche textuelle */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par titre, note 1, note 2, note 3, auteur..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-800"
            />
          </div>

          {/* Filtre Catégorie */}
          <div className="lg:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800 focus:bg-white cursor-pointer"
            >
              {CATEGORIES_LIST.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre Priorité */}
          <div className="lg:col-span-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800 focus:bg-white cursor-pointer"
            >
              {PRIORITIES_LIST.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre Classe / Portée */}
          <div className="lg:col-span-2">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800 focus:bg-white cursor-pointer"
            >
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Bouton Réinitialiser */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              title="Réinitialiser les filtres"
              className="w-full lg:w-auto p-2 rounded-xl text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <span>
            Affichage de <strong>{filteredNotes.length}</strong> note(s) sur <strong>{notes.length}</strong> au total
          </span>
          <span className="text-emerald-700 font-bold">
            Classement chronologique officiel
          </span>
        </div>
      </div>

      {/* 4. Liste / Tableau des Notes Diverses */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <NotebookPen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Aucune note ne correspond à vos critères</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Modifiez vos termes de recherche ou réinitialisez les filtres pour afficher toutes les notes enregistrées.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser les filtres</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-4 group"
              >
                {/* En-tête de la Note */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                        {note.noteNumber}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800">
                        {note.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] border ${getPriorityBadgeClass(note.priority)}`}>
                        Priorité {note.priority}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] border ${getStatusBadgeClass(note.status)}`}>
                        {note.status}
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 font-heading tracking-tight">
                      {note.title}
                    </h2>
                  </div>

                  {/* Actions Rapides */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedNoteForView(note)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Consulter et Imprimer la fiche officielle"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>Fiche & Imprimer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(note)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                      title="Modifier cette note"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id, note.noteNumber)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Supprimer cette note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* LES 3 BLOCS DE NOTES DEMANDÉS (Note 1, Note 2, Note 3) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  
                  {/* Bloc Note 1 */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">
                        1
                      </span>
                      <span className="uppercase tracking-wider text-[11px] font-heading">Note 1 / Point Principal</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {note.note1 || '—'}
                    </p>
                  </div>

                  {/* Bloc Note 2 */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-blue-800 font-bold text-xs">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                        2
                      </span>
                      <span className="uppercase tracking-wider text-[11px] font-heading">Note 2 / Point d&apos;Action</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {note.note2 || '—'}
                    </p>
                  </div>

                  {/* Bloc Note 3 */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-purple-800 font-bold text-xs">
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center">
                        3
                      </span>
                      <span className="uppercase tracking-wider text-[11px] font-heading">Note 3 / Remarque & Suivi</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {note.note3 || '—'}
                    </p>
                  </div>
                </div>

                {/* Métadonnées & Pied de carte */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-500">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Date : <strong className="text-slate-800">{formatDate(note.date)}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Auteur : <strong className="text-slate-800">{note.author}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      Portée :{' '}
                      <strong className="text-emerald-800">
                        {note.targetType} {note.targetGrade ? `(${note.targetGrade})` : ''}
                        {note.targetStudentName ? `— Élève : ${note.targetStudentName}` : ''}
                      </strong>
                    </span>
                  </div>

                  {note.summary && (
                    <span className="text-[11px] italic text-slate-400 truncate max-w-md">
                      « {note.summary} »
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= MODALE 1 : NOUVELLE NOTE / MODIFICATION ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <NotebookPen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 font-heading">
                    {editingNote ? `Modifier la Note ${editingNote.noteNumber}` : 'Nouvelle Note Diverse'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Saisie complète des 3 notes, de la date et des paramètres officiels
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              
              {/* Titre & Objet */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Titre / Objet de la Note *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex : Dispositif de Soutien Pédagogique — CM2"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Catégorie & Priorité */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Catégorie *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800"
                  >
                    {CATEGORIES_LIST.filter((c) => c !== 'Toutes les catégories').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Niveau de Priorité *</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800"
                  >
                    <option value="Normale">Normale</option>
                    <option value="Importante">Importante</option>
                    <option value="Urgente">Urgente 🚨</option>
                    <option value="Basse">Basse</option>
                  </select>
                </div>
              </div>

              {/* Date & Auteur */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Date de la Note *</label>
                  <FrenchDateInput value={formDate} onChange={setFormDate} />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Auteur / Signataire *</label>
                  <input
                    type="text"
                    required
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="Ex : M. Amadou Fall (Directeur des Études)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Portée & Cible (Établissement, Classe ou Élève particulier) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="font-bold text-slate-700 block uppercase tracking-wider text-[11px]">
                  Portée & Destinataire de la Note :
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={formTargetType}
                    onChange={(e) => setFormTargetType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-semibold text-slate-800"
                  >
                    <option value="Général (Établissement)">Général (Établissement)</option>
                    <option value="Classe Spécifique">Classe Spécifique</option>
                    <option value="Élève Particulier">Élève Particulier</option>
                    <option value="Personnel Enseignant">Personnel Enseignant</option>
                  </select>

                  {formTargetType === 'Classe Spécifique' && (
                    <select
                      value={formTargetGrade}
                      onChange={(e) => setFormTargetGrade(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-semibold text-slate-800"
                    >
                      {availableClasses.filter((c) => c !== 'Toutes les classes').map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  )}

                  {formTargetType === 'Élève Particulier' && (
                    <select
                      value={formTargetStudentName}
                      onChange={(e) => setFormTargetStudentName(e.target.value)}
                      className="w-full sm:col-span-2 px-3 py-2 rounded-xl bg-white border border-slate-200 font-semibold text-slate-800"
                    >
                      <option value="">-- Sélectionner l&apos;élève ciblé ({students.length} élèves) --</option>
                      {students.map((stu) => (
                        <option key={stu.id} value={stu.fullName}>
                          {stu.studentNumber} • {stu.fullName} ({stu.grade})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* LES 3 CHAMPS DE NOTES DEMANDÉS PAR L'UTILISATEUR */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 block uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Les 3 Notes & Observations Spécifiques</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Note 1, Note 2 et Note 3</span>
                </div>

                {/* Champ Note 1 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center">1</span>
                    <span>Note 1 (Point Principal / Constat initial) *</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formNote1}
                    onChange={(e) => setFormNote1(e.target.value)}
                    placeholder="Saisissez la première note ou observation..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white font-medium text-slate-800"
                  />
                </div>

                {/* Champ Note 2 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-blue-950 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center">2</span>
                    <span>Note 2 (Point d&apos;Action / Mesure adoptée)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={formNote2}
                    onChange={(e) => setFormNote2(e.target.value)}
                    placeholder="Saisissez la deuxième note ou plan d'action..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white font-medium text-slate-800"
                  />
                </div>

                {/* Champ Note 3 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-purple-950 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white font-bold text-[9px] flex items-center justify-center">3</span>
                    <span>Note 3 (Remarque finale / Suivi & Échéance)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={formNote3}
                    onChange={(e) => setFormNote3(e.target.value)}
                    placeholder="Saisissez la troisième note ou conclusion..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Statut & Synthèse */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Statut du Dossier *</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800"
                  >
                    <option value="En cours">En cours</option>
                    <option value="Traité / Validé">Traité / Validé ✓</option>
                    <option value="En attente">En attente</option>
                    <option value="Archivé">Archivé</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Synthèse Rapide (Optionnel)</label>
                  <input
                    type="text"
                    value={formSummary}
                    onChange={(e) => setFormSummary(e.target.value)}
                    placeholder="Bref résumé en 1 phrase..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium"
                  />
                </div>
              </div>

              {/* Boutons d'action de formulaire */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  {editingNote ? 'Mettre à Jour la Note' : 'Enregistrer la Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODALE 2 : FICHE OFFICIELLE DÉTAILLÉE & IMPRESSION DU MÉMO ================= */}
      {selectedNoteForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95 max-h-[95vh] overflow-y-auto print:max-h-none print:p-0 print:border-none print:shadow-none">
            
            {/* Barre d'action supérieure */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                  {selectedNoteForView.noteNumber}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-xs border ${getPriorityBadgeClass(selectedNoteForView.priority)}`}>
                  {selectedNoteForView.priority}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer ce Mémo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNoteForView(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Fiche Officielle avec En-Tête de l'École */}
            <div id="printable-memo-card" className="space-y-6">
              
              {/* En-Tête Officiel */}
              <div className="pb-4 border-b-2 border-slate-800 flex items-center justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0 border border-emerald-900 overflow-hidden">
                  {currentSchool.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentSchool.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span>SF</span>
                  )}
                </div>

                <div className="text-center flex-1 space-y-0.5">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-heading uppercase leading-tight">
                    {currentSchool.name}
                  </h2>
                  <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-950 border border-emerald-300">
                    ({currentSchool.shortName || 'EPC MANOI'})
                  </div>
                  <p className="text-[10px] font-bold text-emerald-800 italic">
                    {currentSchool.motto || '« Discipline • Rigueur • Réussite »'}
                  </p>
                  <p className="text-[9px] font-bold text-amber-700 italic">
                    {currentSchool.slogan || '✦ Former les élites et leaders de demain pour un avenir radieux'}
                  </p>
                  <div className="inline-block bg-slate-900 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded shadow-2xs">
                    Code : {currentSchool.ministryCode || 'MENA-04829-CI'}
                  </div>
                </div>

                <div className="w-14 h-14 rounded-2xl flex items-center justify-center p-1 shrink-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentSchool.countryEmblemUrl || 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png'}
                    alt="Armoiries"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Titre & Bannière */}
              <div className="bg-slate-950 text-white py-3 px-4 rounded-2xl text-center space-y-1">
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-emerald-400 font-heading">
                  FICHE OFFICIELLE DE NOTE DIVERSE & MÉMO
                </h3>
                <div className="flex items-center justify-center gap-3 text-[11px] font-mono">
                  <span>N° {selectedNoteForView.noteNumber}</span>
                  <span>•</span>
                  <span>Date : {formatDate(selectedNoteForView.date)}</span>
                </div>
              </div>

              {/* Objet & Portée */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Objet de la Note :</span>
                    <h4 className="font-extrabold text-slate-900 text-sm mt-0.5">{selectedNoteForView.title}</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-800">
                    {selectedNoteForView.category}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-400">Auteur / Émetteur :</span>{' '}
                    <strong className="text-slate-800">{selectedNoteForView.author}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Portée / Cible :</span>{' '}
                    <strong className="text-emerald-800">
                      {selectedNoteForView.targetType} {selectedNoteForView.targetGrade ? `(${selectedNoteForView.targetGrade})` : ''}
                      {selectedNoteForView.targetStudentName ? `— ${selectedNoteForView.targetStudentName}` : ''}
                    </strong>
                  </div>
                </div>
              </div>

              {/* DÉTAIL DES 3 NOTES OFFICIELLES */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-heading">
                  Détail des 3 Notes & Décisions :
                </h4>

                {/* Note 1 */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">1</span>
                    <span className="uppercase text-[11px]">Note 1 — Point Principal / Évaluation</span>
                  </div>
                  <p className="text-xs text-slate-800 pl-6 leading-relaxed">
                    {selectedNoteForView.note1 || 'Aucune note 1 renseignée.'}
                  </p>
                </div>

                {/* Note 2 */}
                <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-blue-950 font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">2</span>
                    <span className="uppercase text-[11px]">Note 2 — Mesures & Plan d&apos;Action</span>
                  </div>
                  <p className="text-xs text-slate-800 pl-6 leading-relaxed">
                    {selectedNoteForView.note2 || 'Aucune note 2 renseignée.'}
                  </p>
                </div>

                {/* Note 3 */}
                <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-purple-950 font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center">3</span>
                    <span className="uppercase text-[11px]">Note 3 — Remarque Finale & Échéance</span>
                  </div>
                  <p className="text-xs text-slate-800 pl-6 leading-relaxed">
                    {selectedNoteForView.note3 || 'Aucune note 3 renseignée.'}
                  </p>
                </div>
              </div>

              {/* Cachet & Signature */}
              <div className="pt-4 border-t-2 border-slate-800 flex items-end justify-between text-xs gap-4">
                <div className="space-y-1 max-w-[260px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Mention Officielle :</span>
                  <p className="text-[10px] text-slate-500 italic">
                    Document officiel enregistré dans les archives administratives de l&apos;établissement scolaire.
                  </p>
                </div>

                <div className="text-center space-y-1 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Visa & Direction
                  </span>
                  <div className="w-36 h-20 rounded-xl border-2 border-dashed border-emerald-600/70 bg-emerald-50/40 flex flex-col items-center justify-center p-1 text-emerald-900 relative shadow-2xs">
                    <span className="text-[9px] font-black uppercase tracking-wider">{currentSchool.shortName || 'EPC MANOI'}</span>
                    <span className="text-[8px] font-bold text-emerald-700">DIRECTION PÉDAGOGIQUE</span>
                    <span className="text-[8px] font-mono text-slate-500 mt-0.5">ENREGISTRÉ ✓</span>
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                      <Building2 className="w-12 h-12 text-emerald-900" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pied de modale */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end print:hidden">
              <button
                type="button"
                onClick={() => setSelectedNoteForView(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
