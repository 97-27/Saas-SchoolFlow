'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student, School } from '@/lib/data/types';
import { GenderBadge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/formatters';
import { availableClasses } from '@/lib/data/mock-data';
import {
  getLiveStudents,
  getLiveSchool,
  deleteLiveStudents,
  DATA_UPDATED_EVENT,
  DOCS_STATUS_KEY,
  StudentDocumentRecord,
  OtherDocItem,
} from '@/lib/data/live-store';
import {
  FileText,
  Search,
  Filter,
  Download,
  PlusCircle,
  ChevronDown,
  RotateCcw,
  Printer,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileCheck,
  FolderOpen,
  X,
  FileSpreadsheet,
  CheckCheck,
  Paperclip,
  Trash2,
  AlertTriangle,
  FilePlus,
  Layers,
} from 'lucide-react';

interface DocumentsViewProps {
  initialStudents: Student[];
  school: School;
  schoolSlug: string;
  initialSearch?: string;
}

export function DocumentsView({
  initialStudents,
  school,
  schoolSlug,
  initialSearch = '',
}: DocumentsViewProps) {
  // 1. Synchronisation temps réel
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [currentSchool, setCurrentSchool] = useState<School>(school);

  // État des documents par élève : STRICTEMENT « En attente » par défaut jusqu'au téléchargement réel
  const [docRecords, setDocRecords] = useState<Record<string, StudentDocumentRecord>>(() => {
    const records: Record<string, StudentDocumentRecord> = {};
    initialStudents.forEach((s) => {
      records[s.id] = {
        studentId: s.id,
        hasBirthCertificate: false,
        hasReportCard: false,
        hasRegistrationForm: false,
        otherDocs: [],
        lastUpdated: '2026-08-28',
      };
    });

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DOCS_STATUS_KEY);
        if (saved) {
          return { ...records, ...JSON.parse(saved) };
        }
      } catch (err) {
        console.error('Erreur lecture doc status', err);
      }
    }
    return records;
  });

  const loadDocsStatus = () => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DOCS_STATUS_KEY);
        if (saved) {
          setDocRecords(JSON.parse(saved));
        }
      } catch (err) {
        console.error('Erreur rechargement doc status', err);
      }
    }
  };

  useEffect(() => {
    setStudents(getLiveStudents(initialStudents, schoolSlug));
    setCurrentSchool(getLiveSchool(schoolSlug, school));
    loadDocsStatus();

    const handleUpdate = () => {
      setStudents(getLiveStudents(initialStudents, schoolSlug));
      setCurrentSchool(getLiveSchool(schoolSlug, school));
      loadDocsStatus();
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [initialStudents, schoolSlug, school]);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedClass, setSelectedClass] = useState('Toutes les classes');
  const [selectedStatus, setSelectedStatus] = useState('all'); // all, complete, incomplete

  // State for Checkbox selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentToDelete, setStudentToDelete] = useState<Student[] | null>(null);

  // State for Add Document Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStudentForDoc, setSelectedStudentForDoc] = useState<string>('');
  const [selectedStudentObj, setSelectedStudentObj] = useState<Student | null>(null);
  const [docType, setDocType] = useState<'extrait' | 'bulletin' | 'fiche' | 'autre'>('extrait');
  const [customDocTitle, setCustomDocTitle] = useState('');
  const [docRef, setDocRef] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadSuccessToast, setUploadSuccessToast] = useState<string | null>(null);
  const [showMissingFileAlert, setShowMissingFileAlert] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal pour voir les autres documents d'un élève
  const [viewOtherDocsStudent, setViewOtherDocsStudent] = useState<{ stu: Student; docs: OtherDocItem[] } | null>(null);

  // Filtered & Sorted students
  const filteredStudents = useMemo(() => {
    const list = students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        s.studentNumber.toLowerCase().includes(q) ||
        (s.matricule && s.matricule.toLowerCase().includes(q)) ||
        s.lastName.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.fullName.toLowerCase().includes(q);

      const matchesClass =
        selectedClass === 'Toutes les classes' ||
        s.grade.toLowerCase() === selectedClass.toLowerCase();

      const doc = docRecords[s.id] || {
        hasBirthCertificate: false,
        hasReportCard: false,
        hasRegistrationForm: false,
        otherDocs: [],
      };
      const isComplete =
        doc.hasBirthCertificate &&
        doc.hasReportCard &&
        doc.hasRegistrationForm;

      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'complete' && isComplete) ||
        (selectedStatus === 'incomplete' && !isComplete);

      return matchesSearch && matchesClass && matchesStatus;
    });

    // Tri par ID décroissant
    return list.sort((a, b) => {
      const numA = parseInt(a.studentNumber.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.studentNumber.replace(/\D/g, ''), 10) || 0;
      return numB - numA;
    });
  }, [students, searchQuery, selectedClass, selectedStatus, docRecords]);

  // Statistiques exactes
  const stats = useMemo(() => {
    const totalStudents = students.length;
    let completeCount = 0;
    let birthCertCount = 0;
    let reportCardCount = 0;
    let registrationFormCount = 0;
    let totalOtherDocsCount = 0;
    let pendingBirthCount = 0;
    let pendingReportCount = 0;
    let pendingRegistrationCount = 0;

    students.forEach((stu) => {
      const doc = docRecords[stu.id] || {
        studentId: stu.id,
        hasBirthCertificate: false,
        hasReportCard: false,
        hasRegistrationForm: false,
        otherDocs: [],
        lastUpdated: '2026-08-28',
      };

      if (doc.hasBirthCertificate) birthCertCount++;
      else pendingBirthCount++;

      if (doc.hasReportCard) reportCardCount++;
      else pendingReportCount++;

      if (doc.hasRegistrationForm) registrationFormCount++;
      else pendingRegistrationCount++;

      if (doc.otherDocs && doc.otherDocs.length > 0) {
        totalOtherDocsCount += doc.otherDocs.length;
      }

      const isComplete = doc.hasBirthCertificate && doc.hasReportCard && doc.hasRegistrationForm;
      if (isComplete) {
        completeCount++;
      }
    });

    const totalPendingDocsCount = pendingBirthCount + pendingReportCount + pendingRegistrationCount;
    const totalDocsNumérisés = birthCertCount + reportCardCount + registrationFormCount + totalOtherDocsCount;
    const completionRate = totalStudents > 0 ? ((completeCount / totalStudents) * 100).toFixed(1) : '0';

    return {
      totalStudents,
      completeCount,
      birthCertCount,
      reportCardCount,
      registrationFormCount,
      totalOtherDocsCount,
      totalPendingDocsCount,
      totalDocsNumérisés,
      completionRate,
    };
  }, [students, docRecords]);

  // Checkbox selection
  const toggleSelectAll = () => {
    if (filteredStudents.length === 0) return;
    const allSelected = filteredStudents.every((s) => selectedStudentIds.includes(s.id));
    if (allSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredStudents.some((s) => s.id === id)));
    } else {
      const newIds = Array.from(new Set([...selectedStudentIds, ...filteredStudents.map((s) => s.id)]));
      setSelectedStudentIds(newIds);
    }
  };

  const toggleSelectOne = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Ouvrir modal d'ajout
  const handleOpenAddModalForStudent = (stu: Student) => {
    setSelectedStudentObj(stu);
    setSelectedStudentForDoc(stu.id);
    setUploadedFileName(null);
    setDocRef('');
    setCustomDocTitle('');
    setIsAddModalOpen(true);
  };

  const handleOpenAddModalGlobal = () => {
    const firstStu = students[0] || null;
    setSelectedStudentObj(null);
    setSelectedStudentForDoc(firstStu?.id || '');
    setUploadedFileName(null);
    setDocRef('');
    setCustomDocTitle('');
    setIsAddModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFileName(e.target.files[0].name);
    }
  };

  // Soumission et enregistrement du document
  const handleAddDocumentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForDoc) {
      return;
    }

    if (!uploadedFileName) {
      setShowMissingFileAlert(true);
      return;
    }

    setDocRecords((prev) => {
      const current = prev[selectedStudentForDoc] || {
        studentId: selectedStudentForDoc,
        hasBirthCertificate: false,
        hasReportCard: false,
        hasRegistrationForm: false,
        otherDocs: [],
        lastUpdated: '2026-08-28',
      };

      const updated = {
        ...current,
        otherDocs: [...(current.otherDocs || [])],
        lastUpdated: formatDate(new Date().toISOString()),
      };

      if (docType === 'extrait') {
        updated.hasBirthCertificate = true;
      } else if (docType === 'bulletin') {
        updated.hasReportCard = true;
      } else if (docType === 'fiche') {
        updated.hasRegistrationForm = true;
      } else if (docType === 'autre') {
        const title = customDocTitle.trim() || 'Document divers';
        const newOtherDoc: OtherDocItem = {
          id: `doc-${Date.now()}`,
          title,
          fileName: uploadedFileName || `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
          ref: docRef.trim() || undefined,
          date: formatDate(new Date().toISOString()),
        };
        updated.otherDocs.push(newOtherDoc);
      }

      const nextRecords = { ...prev, [selectedStudentForDoc]: updated };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(DOCS_STATUS_KEY, JSON.stringify(nextRecords));
          // Émettre l'événement global pour actualisation instantanée de Classes et Niveaux
          window.dispatchEvent(
            new CustomEvent(DATA_UPDATED_EVENT, {
              detail: { docRecords: nextRecords },
            })
          );
        } catch (err) {
          console.error('Erreur sauvegarde doc status', err);
        }
      }
      return nextRecords;
    });

    const studentFound = students.find((s) => s.id === selectedStudentForDoc);
    const docLabels: Record<string, string> = {
      extrait: "Extrait d'acte de naissance",
      bulletin: 'Bulletin scolaire',
      fiche: "Fiche scolaire d'admission",
      autre: customDocTitle.trim() || 'Document divers',
    };

    setUploadSuccessToast(
      `✓ Document « ${docLabels[docType]} » enregistré avec succès pour ${studentFound ? studentFound.fullName : 'l’élève'} !`
    );
    setTimeout(() => setUploadSuccessToast(null), 6000);
    setIsAddModalOpen(false);
    setUploadedFileName(null);
    setDocRef('');
    setCustomDocTitle('');
  };

  // Suppression d'un autre document
  const handleDeleteOtherDoc = (studentId: string, docId: string) => {
    setDocRecords((prev) => {
      const current = prev[studentId];
      if (!current) return prev;
      const updated = {
        ...current,
        otherDocs: current.otherDocs.filter((d) => d.id !== docId),
      };
      const next = { ...prev, [studentId]: updated };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(DOCS_STATUS_KEY, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });

    if (viewOtherDocsStudent) {
      setViewOtherDocsStudent((prev) =>
        prev ? { ...prev, docs: prev.docs.filter((d) => d.id !== docId) } : null
      );
    }
  };

  // Export Excel CSV
  const handleExportExcel = () => {
    const studentsToExport =
      selectedStudentIds.length > 0
        ? students.filter((s) => selectedStudentIds.includes(s.id))
        : filteredStudents;

    const header = [
      'ID Élève',
      'Matricule MENA',
      'Nom',
      'Prénoms',
      'Classe',
      'Genre',
      'Extrait de Naissance',
      'Bulletin Scolaire',
      'Fiche Scolaire',
      'Autres Documents',
      'Statut Global Dossier',
      'Dernière Mise à Jour',
    ].join(';');

    const rows = studentsToExport.map((stu) => {
      const doc = docRecords[stu.id] || {
        hasBirthCertificate: false,
        hasReportCard: false,
        hasRegistrationForm: false,
        otherDocs: [],
        lastUpdated: '2026-08-28',
      };
      const isComplete = doc.hasBirthCertificate && doc.hasReportCard && doc.hasRegistrationForm;

      return [
        stu.studentNumber,
        stu.matricule,
        stu.lastName,
        stu.firstName,
        stu.grade,
        stu.gender === 'female' ? 'Féminin' : 'Masculin',
        doc.hasBirthCertificate ? 'Numérisé' : 'En attente',
        doc.hasReportCard ? 'Récupéré' : 'En attente',
        doc.hasRegistrationForm ? 'Complète' : 'Incomplète',
        `${doc.otherDocs?.length || 0} document(s)`,
        isComplete ? 'Complet (100%)' : 'Incomplet',
        doc.lastUpdated,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `SchoolFlow_Documents_Scolaires_${school.shortName || 'EPC'}_2026-2027.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setUploadSuccessToast(
      `✓ Fichier Excel / CSV exporté avec succès (${studentsToExport.length} dossiers inclus) !`
    );
    setTimeout(() => setUploadSuccessToast(null), 5000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Documents & Dossiers Scolaires
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Extraits de naissance, bulletins, fiches scolaires et documents divers — {currentSchool.name}
          </p>
        </div>

        {/* Actions en haut */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModalGlobal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Ajouter une pièce</span>
          </button>
        </div>
      </div>

      {/* Toast de succès */}
      {uploadSuccessToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{uploadSuccessToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Cartes Statistiques KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 print:hidden">
        {/* Total Élèves */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FolderOpen className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
              Total Dossiers Élèves
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 font-heading">
              {stats.totalStudents}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {stats.completionRate}% complets
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Dossiers répertoriés</p>
        </div>

        {/* Pièces Téléchargées */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
              Pièces Enregistrées
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 font-heading">
              {stats.totalDocsNumérisés}
            </span>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {stats.totalOtherDocsCount} divers
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Extraits, bulletins, fiches & divers</p>
        </div>

        {/* Documents en Attente */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200/80 shadow-xs flex flex-col justify-between bg-amber-50/15">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-900 font-sans">
              Documents en Attente
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-900 font-heading">
              {stats.totalPendingDocsCount}
            </span>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
              À recevoir
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Pièces non encore téléchargées</p>
        </div>

        {/* Dossiers 100% Complets */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200/80 shadow-xs flex flex-col justify-between bg-emerald-50/15">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <CheckCheck className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-900 font-sans">
              Dossiers 100% Conformes
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-900 font-heading">
              {stats.completeCount}
            </span>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
              sur {stats.totalStudents}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Tous documents validés</p>
        </div>
      </div>

      {/* 3. Table des Documents */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-3.5 sm:p-4 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Recherche */}
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par élève, matricule, classe..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Filtre Classe */}
          <div className="relative flex-1 sm:flex-none min-w-[140px]">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 cursor-pointer"
            >
              <option value="Toutes les classes">Toutes les classes</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filtre Statut */}
          <div className="relative flex-1 sm:flex-none min-w-[130px]">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 cursor-pointer"
            >
              <option value="all">Tous statuts</option>
              <option value="complete">✓ Dossiers complets</option>
              <option value="incomplete">⏳ Pièces en attente</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Reset */}
          {(searchQuery || selectedClass !== 'Toutes les classes' || selectedStatus !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedClass('Toutes les classes');
                setSelectedStatus('all');
              }}
              className="p-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Effacer</span>
            </button>
          )}

          {/* Indicateur de sélection + Bouton Supprimer */}
          {selectedStudentIds.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs shadow-2xs ml-auto animate-in fade-in flex-wrap">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {selectedStudentIds.length} {selectedStudentIds.length > 1 ? 'dossiers sélectionnés' : 'dossier sélectionné'}
              </span>

              <button
                type="button"
                onClick={() => {
                  const list = students.filter((s) => selectedStudentIds.includes(s.id));
                  setStudentToDelete(list);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all cursor-pointer ml-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStudentIds([])}
                className="text-emerald-700 hover:text-emerald-950 underline text-[11px] ml-1 cursor-pointer"
              >
                Désélectionner
              </button>
            </div>
          )}
        </div>

        {/* Table des Dossiers Scolaires */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead className="sticky top-0 z-10 shadow-2xs">
              <tr className="bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 pl-5 pr-3 w-10">
                  <input
                    type="checkbox"
                    checked={
                      filteredStudents.length > 0 &&
                      filteredStudents.every((s) => selectedStudentIds.includes(s.id))
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3 whitespace-nowrap">ID Élève</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Matricule</th>
                <th className="py-3.5 px-3 whitespace-nowrap min-w-[180px]">Élève</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Classe</th>
                {/* 4 COLONNES DE PIÈCES */}
                <th className="py-3.5 px-3 text-center whitespace-nowrap">1. Extrait</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">2. Bulletin</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">3. Fiche Scolaire</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">4. Autres Documents</th>
                <th className="py-3.5 pr-5 pl-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Aucun dossier élève ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu) => {
                  const doc = docRecords[stu.id] || {
                    hasBirthCertificate: false,
                    hasReportCard: false,
                    hasRegistrationForm: false,
                    otherDocs: [],
                  };
                  const isSelected = selectedStudentIds.includes(stu.id);
                  const otherDocsCount = doc.otherDocs?.length || 0;

                  return (
                    <tr
                      key={stu.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-emerald-50/50' : 'hover:bg-emerald-50/20'
                      }`}
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(stu.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 text-[11px] whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {stu.studentNumber}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono font-bold text-slate-700 text-[11px] whitespace-nowrap">
                        {stu.matricule || '26014801A'}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-900 uppercase">
                            {stu.lastName}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {stu.firstName}
                          </span>
                          <GenderBadge gender={stu.gender} />
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap shadow-2xs">
                          {stu.grade}
                        </span>
                      </td>

                      {/* 1. Extrait d'acte de naissance */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {doc.hasBirthCertificate ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                            <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Numérisé ✓</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>En attente</span>
                          </span>
                        )}
                      </td>

                      {/* 2. Bulletin scolaire */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {doc.hasReportCard ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                            <span>Récupéré ✓</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>En attente</span>
                          </span>
                        )}
                      </td>

                      {/* 3. Fiche scolaire */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {doc.hasRegistrationForm ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Complète ✓</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Incomplète</span>
                          </span>
                        )}
                      </td>

                      {/* 4. Autres Documents (Documents divers jusqu'à 3-5 documents) */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {otherDocsCount > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setViewOtherDocsStudent({
                                stu,
                                docs: doc.otherDocs,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs hover:bg-purple-100 transition-colors cursor-pointer"
                            title="Cliquer pour voir et gérer les autres documents"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                            <span>{otherDocsCount} {otherDocsCount > 1 ? 'docs ajoutés ✓' : 'doc ajouté ✓'}</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-slate-400 bg-slate-100 border border-slate-200">
                            <span>0 doc (En attente)</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pr-5 pl-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenAddModalForStudent(stu)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 transition-all cursor-pointer shadow-2xs"
                        >
                          <Upload className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ajouter pièce</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Total affiché : <strong className="text-slate-900 font-bold">{filteredStudents.length}</strong> dossiers scolaires
          </span>
          <span className="text-[11px] text-slate-400">
            Téléchargez une pièce pour passer automatiquement son statut au vert
          </span>
        </div>
      </div>

      {/* ================= MODALE : AJOUTER UNE PIÈCE (STRICTEMENT 4 TYPES) ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                    Ajouter une Pièce au Dossier Élève
                  </h3>
                  <p className="text-xs text-slate-500">
                    Numérisation et rattachement certifié au registre officiel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDocumentSubmit} className="space-y-4 text-xs">
              {/* Affichage de l'Élève */}
              {selectedStudentObj ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-sm uppercase">
                      {selectedStudentObj.firstName[0]}{selectedStudentObj.lastName[0]}
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase text-slate-950 font-heading block">
                        {selectedStudentObj.fullName}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-900 font-bold block">
                        {selectedStudentObj.studentNumber} • {selectedStudentObj.matricule} • {selectedStudentObj.grade}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
                    Élève sélectionné
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Sélectionner l&apos;élève *</label>
                  <select
                    value={selectedStudentForDoc}
                    onChange={(e) => setSelectedStudentForDoc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 font-semibold cursor-pointer"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.studentNumber} • {s.fullName} ({s.grade})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Type de Pièce : STRICTEMENT 4 CHOIX */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Type de pièce à joindre *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-800 cursor-pointer"
                >
                  <option value="extrait">1. L&apos;extrait d&apos;acte de naissance</option>
                  <option value="bulletin">2. Le bulletin scolaire</option>
                  <option value="fiche">3. La fiche scolaire d&apos;admission</option>
                  <option value="autre">4. Autre document (documents divers)</option>
                </select>
              </div>

              {/* Si Autre Document : Nom personnalisé */}
              {docType === 'autre' && (
                <div className="space-y-1 animate-in fade-in">
                  <label className="font-bold text-purple-900">
                    Intitulé / Nom du document divers *
                  </label>
                  <input
                    type="text"
                    required
                    value={customDocTitle}
                    onChange={(e) => setCustomDocTitle(e.target.value)}
                    placeholder="Ex: Certificat de scolarité, Carnet de santé, Certificat médical..."
                    className="w-full px-3 py-2 rounded-xl bg-purple-50/50 border border-purple-200 focus:bg-white focus:ring-2 focus:ring-purple-500/20 font-medium"
                  />
                </div>
              )}

              {/* Référence */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Référence ou Numéro de la pièce (Optionnel)</label>
                <input
                  type="text"
                  value={docRef}
                  onChange={(e) => setDocRef(e.target.value)}
                  placeholder="Ex: Acte N° 4819 du 14/02/2018"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>

              {/* Zone de Dépôt / Téléchargement du Fichier */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`p-5 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all ${
                  uploadedFileName
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20'
                }`}
              >
                {uploadedFileName ? (
                  <div className="space-y-1">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
                    <span className="font-bold text-emerald-950 block text-xs truncate max-w-xs mx-auto">
                      {uploadedFileName}
                    </span>
                    <span className="text-[10px] text-emerald-700 block">
                      Fichier prêt pour le rattachement officiel • Cliquez pour changer
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-7 h-7 text-slate-400 mx-auto" />
                    <span className="font-bold text-slate-700 block text-xs">
                      Cliquez pour sélectionner le document PDF ou image
                    </span>
                    <span className="text-[10.5px] text-slate-400 block">
                      Formats acceptés : PDF, PNG, JPG, DOCX (Max 15 Mo)
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Enregistrer la Pièce</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODALE : GESTION DES AUTRES DOCUMENTS D'UN ÉLÈVE ================= */}
      {viewOtherDocsStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                  <Paperclip className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 font-heading">
                    Autres Documents Rattachés
                  </h3>
                  <p className="text-xs text-slate-500">
                    {viewOtherDocsStudent.stu.fullName} ({viewOtherDocsStudent.stu.grade})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewOtherDocsStudent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {viewOtherDocsStudent.docs.length === 0 ? (
                <p className="py-6 text-center text-slate-400">Aucun document divers rattaché.</p>
              ) : (
                viewOtherDocsStudent.docs.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-2xl bg-purple-50/50 border border-purple-200 flex items-center justify-between gap-3"
                  >
                    <div>
                      <strong className="font-bold text-purple-950 block">{d.title}</strong>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {d.fileName} {d.ref ? `• Réf: ${d.ref}` : ''} • {d.date}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteOtherDoc(viewOtherDocsStudent.stu.id, d.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                      title="Supprimer ce document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const s = viewOtherDocsStudent.stu;
                  setViewOtherDocsStudent(null);
                  handleOpenAddModalForStudent(s);
                  setDocType('autre');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-900 bg-purple-100 hover:bg-purple-200 transition-all cursor-pointer"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>Ajouter un autre doc</span>
              </button>

              <button
                type="button"
                onClick={() => setViewOtherDocsStudent(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE : SUPPRESSION DÉFINITIVE D'ÉLÈVES ================= */}
      {studentToDelete && studentToDelete.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 font-heading">
                    {studentToDelete.length === 1 ? "Suppression de l'élève" : `Suppression de ${studentToDelete.length} élèves`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Action définitive sur l&apos;ensemble de l&apos;établissement
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-1.5">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Confirmation irréversible</span>
                </div>
                <p className="text-[11.5px] leading-relaxed">
                  Êtes-vous certain de vouloir supprimer {studentToDelete.length === 1 ? "cet élève" : "ces élèves"} ? {studentToDelete.length === 1 ? "Il sera automatiquement retiré" : "Ils seront automatiquement retirés"} de toutes les vues de l&apos;application (Vue d&apos;ensemble, Scolarité, Documents, Classes, Notes, Présences, etc.).
                </p>
              </div>

              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 bg-slate-50">
                {studentToDelete.map((s) => (
                  <div key={s.id} className="py-1.5 flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-slate-900 uppercase font-heading block">{s.fullName}</strong>
                      <span className="font-mono text-[10px] text-slate-500">{s.studentNumber} • {s.matricule} • {s.grade}</span>
                    </div>
                    <GenderBadge gender={s.gender} />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const ids = studentToDelete.map((s) => s.id);
                  deleteLiveStudents(ids);
                  setSelectedStudentIds((prev) => prev.filter((id) => !ids.includes(id)));
                  setStudentToDelete(null);
                  setUploadSuccessToast(
                    ids.length === 1
                      ? "L'élève a été supprimé avec succès de l'ensemble des modules."
                      : `${ids.length} élèves ont été supprimés avec succès de l'ensemble des modules.`
                  );
                  setTimeout(() => setUploadSuccessToast(null), 5000);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
              >
                Confirmer la Suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE PERSONNALISÉE : DOCUMENT OBLIGATOIRE MANQUANT ================= */}
      {showMissingFileAlert && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-slate-950 font-heading">
                Document Obligatoire Requis
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Veuillez obligatoirement sélectionner ou déposer un fichier (PDF, image ou document) avant d&apos;enregistrer la pièce.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowMissingFileAlert(false);
                fileInputRef.current?.click();
              }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Choisir un Fichier Maintenant</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
