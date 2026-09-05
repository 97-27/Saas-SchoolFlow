'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student, School } from '@/lib/data/types';
import { formatFCFA, formatDate } from '@/lib/utils/formatters';
import {
  getLiveStudents,
  getLiveSchool,
  DATA_UPDATED_EVENT,
  DOCS_STATUS_KEY,
  OtherDocItem,
  StudentDocumentRecord,
} from '@/lib/data/live-store';
import { GenderBadge } from '@/components/ui/badge';
import {
  School as SchoolIcon,
  Users,
  Search,
  Plus,
  Filter,
  Phone,
  MessageCircle,
  MapPin,
  FileText,
  Printer,
  FileSpreadsheet,
  MoreHorizontal,
  GraduationCap,
  Sparkles,
  Layers,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit,
  User,
  X,
  Paperclip,
  FileCheck,
} from 'lucide-react';

interface ClassesViewProps {
  initialStudents: Student[];
  school: School;
  schoolSlug: string;
}

// Fonction pour déterminer la date de naissance réaliste
const getStudentBirthDate = (stu: Student): string => {
  if (stu.dateOfBirth) return stu.dateOfBirth;
  const numVal = parseInt(stu.studentNumber?.replace(/\D/g, '') || '1', 10);
  const grade = stu.grade || '';

  let year = 2014;
  if (grade.includes('Maternelle') || grade.includes('P.S.')) year = 2022;
  else if (grade.includes('M.S.')) year = 2021;
  else if (grade.includes('G.S.')) year = 2020;
  else if (grade.includes('CP1')) year = 2019;
  else if (grade.includes('CP2')) year = 2018;
  else if (grade.includes('CE1')) year = 2017;
  else if (grade.includes('CE2')) year = 2016;
  else if (grade.includes('CM1')) year = 2015;
  else if (grade.includes('CM2')) year = 2014;
  else if (grade.includes('6ème')) year = 2013;
  else if (grade.includes('5ème')) year = 2012;
  else if (grade.includes('4ème')) year = 2011;
  else if (grade.includes('3ème')) year = 2010;
  else if (grade.includes('2nde')) year = 2009;
  else if (grade.includes('1ère')) year = 2008;
  else if (grade.includes('Terminale') || grade.includes('Tle')) year = 2007;

  const month = ((numVal * 4) % 12 + 1).toString().padStart(2, '0');
  const day = ((numVal * 7) % 28 + 1).toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function ClassesView({
  initialStudents,
  school,
  schoolSlug,
}: ClassesViewProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [currentSchool, setCurrentSchool] = useState<School>(school);

  // 5 Blocs : 'all' | 'maternelle' | 'primaire' | 'college' | 'lycee'
  const [selectedCycle, setSelectedCycle] = useState<'all' | 'maternelle' | 'primaire' | 'college' | 'lycee'>('all');
  const [selectedClass, setSelectedClass] = useState<string>('Toutes les classes');
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [selectedStudentDoc, setSelectedStudentDoc] = useState<Student | null>(null);

  // Documents synchronisés depuis Documents Scolaires (DOCS_STATUS_KEY)
  const [docRecords, setDocRecords] = useState<Record<string, StudentDocumentRecord>>({});

  const loadDocumentsStatus = () => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DOCS_STATUS_KEY);
        if (saved) {
          setDocRecords(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Erreur lecture doc status in classes-view', e);
      }
    }
  };

  // Synchronisation des élèves, école et documents
  useEffect(() => {
    setStudents(getLiveStudents(initialStudents, schoolSlug));
    setCurrentSchool(getLiveSchool(schoolSlug, school));
    loadDocumentsStatus();

    const handleUpdate = () => {
      setStudents(getLiveStudents(initialStudents, schoolSlug));
      setCurrentSchool(getLiveSchool(schoolSlug, school));
      loadDocumentsStatus();
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [initialStudents, schoolSlug, school]);

  // Définition des 4 Blocs de Cycles (Toutes les Classes, Maternelle, Primaire, Collège)
  const cyclesConfig = useMemo(() => {
    return {
      all: {
        label: 'Toutes les Classes',
        sub: 'Vue globale de tous les élèves',
        icon: SchoolIcon,
        classes: [
          'Toutes les classes',
          'Maternelle (P.S.)',
          'Maternelle (M.S.)',
          'Maternelle (G.S.)',
          'CP1',
          'CP2',
          'CE1',
          'CE2',
          'CM1',
          'CM2',
          '6ème',
          '5ème',
          '4ème',
          '3ème',
        ],
      },
      maternelle: {
        label: 'Cycle Maternelle',
        sub: 'P.S., M.S. et G.S.',
        icon: Sparkles,
        classes: ['Maternelle (P.S.)', 'Maternelle (M.S.)', 'Maternelle (G.S.)'],
      },
      primaire: {
        label: 'Cycle Primaire',
        sub: 'Du CP1 jusqu’au CM2',
        icon: GraduationCap,
        classes: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'],
      },
      college: {
        label: 'Cycle Collège',
        sub: 'De la 6ème à la 3ème',
        icon: Building2,
        classes: ['6ème', '5ème', '4ème', '3ème'],
      },
    };
  }, []);

  const handleCycleChange = (cycle: 'all' | 'maternelle' | 'primaire' | 'college') => {
    setSelectedCycle(cycle);
    setSelectedClass(cyclesConfig[cycle].classes[0]);
  };

  // Élèves selon le cycle et la classe choisie
  const scopedStudents = useMemo(() => {
    if (selectedCycle === 'all') {
      if (selectedClass === 'Toutes les classes') {
        return students;
      }
      return students.filter((s) => s.grade.toLowerCase() === selectedClass.toLowerCase());
    }

    const validClasses = cyclesConfig[selectedCycle].classes;
    if (selectedClass === 'Toutes les classes' || !validClasses.includes(selectedClass)) {
      return students.filter((s) => validClasses.includes(s.grade));
    }
    return students.filter((s) => s.grade.toLowerCase() === selectedClass.toLowerCase());
  }, [students, selectedCycle, selectedClass, cyclesConfig]);

  // Élèves filtrés par recherche et genre
  const filteredStudents = useMemo(() => {
    return scopedStudents.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        s.lastName.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.fullName.toLowerCase().includes(q) ||
        s.matricule.toLowerCase().includes(q) ||
        s.studentNumber.toLowerCase().includes(q) ||
        s.guardianName.toLowerCase().includes(q);

      const matchesGender = genderFilter === 'all' || s.gender === genderFilter;
      return matchesSearch && matchesGender;
    });
  }, [scopedStudents, searchQuery, genderFilter]);

  // Statistiques calculées
  const classStats = useMemo(() => {
    const total = scopedStudents.length;
    const girls = scopedStudents.filter((s) => s.gender === 'female').length;
    const boys = scopedStudents.filter((s) => s.gender === 'male').length;
    const fullyPaid = scopedStudents.filter((s) => s.tuitionStatus === 'paid').length;
    const capacity = selectedClass === 'Toutes les classes' ? students.length : 40;
    const occupancyRate = capacity > 0 ? ((total / capacity) * 100).toFixed(0) : '100';

    return {
      total,
      girls,
      boys,
      fullyPaid,
      capacity,
      occupancyRate,
    };
  }, [scopedStudents, selectedClass, students.length]);

  return (
    <div className="space-y-6 pb-12">
      {/* 0. Section Imprimable A4 Officielle pour Liste de Classe (Format PAYSAGE / LANDSCAPE) */}
      <div className="hidden print:block print-landscape printable-class-list bg-white text-slate-900 p-4 font-sans space-y-3">
        {/* En-tête officiel Paysage */}
        <div className="border-b-2 border-slate-900 pb-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex flex-col items-center justify-center font-heading shrink-0">
              <span className="text-xs font-black leading-none">EPC</span>
              <span className="text-[7px] font-bold text-emerald-200">MANOI</span>
            </div>
            <div>
              <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-600 block">
                RÉPUBLIQUE DE CÔTE D&apos;IVOIRE • MINISTÈRE DE L&apos;ÉDUCATION NATIONALE
              </span>
              <h1 className="text-sm sm:text-base font-black font-heading uppercase text-slate-950 mt-0.5">
                {currentSchool.name} ({currentSchool.shortName || 'EPC MANOI'})
              </h1>
              <p className="text-[9.5px] text-slate-600 font-medium">
                Code Établissement : {currentSchool.ministryCode || '321119'} • Tél : {currentSchool.phone || '+225 27 22 44 11 00'} • {currentSchool.city || 'Abidjan'}
              </p>
            </div>
          </div>

          <div className="text-right space-y-0.5">
            <span className="text-xs font-bold text-slate-900 block font-heading">
              Année Scolaire {currentSchool.academicYear}
            </span>
            <span className="inline-block px-2.5 py-0.5 rounded bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider">
              LISTE OFFICIELLE : {selectedClass}
            </span>
            <p className="text-[10px] text-slate-700 font-bold">
              Effectif : {filteredStudents.length} élèves ({classStats.girls} Filles • {classStats.boys} Garçons)
            </p>
          </div>
        </div>

        {/* Tableau imprimé Format Paysage */}
        <table className="w-full text-left border-collapse border border-slate-900 text-[10.5px]">
          <thead>
            <tr className="bg-slate-200 border-b border-slate-900 text-[9.5px] font-black uppercase text-slate-800 text-center">
              <th className="p-1.5 border-r border-slate-900 w-8">N°</th>
              <th className="p-1.5 border-r border-slate-900 w-24">Matricule</th>
              <th className="p-1.5 border-r border-slate-900 text-left">Nom & Prénoms</th>
              <th className="p-1.5 border-r border-slate-900 text-center w-20">Né(e) le</th>
              <th className="p-1.5 border-r border-slate-900 text-center w-12">Genre</th>
              <th className="p-1.5 border-r border-slate-900 text-left">Parent / Tuteur</th>
              <th className="p-1.5 border-r border-slate-900 text-center w-28">Contact Parent</th>
              <th className="p-1.5 border-r border-slate-900 text-left">Résidence / Quartier</th>
              <th className="p-1.5 border-slate-900 text-center w-28">Émargement / Obs.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 text-[10px]">
            {filteredStudents.map((stu, idx) => (
              <tr key={stu.id} className="hover:bg-slate-50">
                <td className="p-1.5 border-r border-slate-300 text-center font-bold">{idx + 1}</td>
                <td className="p-1.5 border-r border-slate-300 font-mono font-bold text-slate-800 text-center">{stu.matricule}</td>
                <td className="p-1.5 border-r border-slate-300 font-bold uppercase text-slate-900">{stu.fullName}</td>
                <td className="p-1.5 border-r border-slate-300 text-center font-mono">
                  {formatDate(getStudentBirthDate(stu))}
                </td>
                <td className="p-1.5 border-r border-slate-300 text-center font-bold">
                  {stu.gender === 'female' ? '♀ F' : '♂ M'}
                </td>
                <td className="p-1.5 border-r border-slate-300 font-medium">{stu.guardianName}</td>
                <td className="p-1.5 border-r border-slate-300 font-mono text-center">
                  {stu.whatsappPhone || stu.guardianPhone}
                </td>
                <td className="p-1.5 border-r border-slate-300 truncate max-w-[140px]">{stu.address || currentSchool.district || 'Abobo'}</td>
                <td className="p-1.5 border-slate-300"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures officielles au bas du tirage Paysage */}
        <div className="grid grid-cols-2 gap-8 pt-3 border-t-2 border-slate-900 text-center text-[10px]">
          <div>
            <p className="font-bold text-slate-800 uppercase">Le Professeur Principal</p>
            <div className="h-10 flex items-center justify-center italic text-slate-400 text-[9px]">
              Vu & Approuvé
            </div>
          </div>
          <div>
            <p className="font-bold text-slate-900 uppercase">La Direction des Études (Cachet & Signature)</p>
            <div className="h-10 flex items-center justify-center">
              <span className="text-[9px] font-black text-emerald-800 border border-emerald-600 rounded-full px-3 py-0.5 bg-emerald-50">
                ★ SCEAU OFFICIEL MANOI ★
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Header principal Écran */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Classes & Niveaux Pédagogiques
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Répertoire nominatif par classe, dates de naissance et dossiers scolaires — {currentSchool.name}
          </p>
        </div>

        {/* Actions Rapides */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" />
            <span>Imprimer la Liste ({selectedClass})</span>
          </button>
        </div>
      </div>

      {/* Styles d'impression Paysage */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm 8mm 8mm 8mm;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          .print\\:hidden, header, nav, aside, footer {
            display: none !important;
          }
          .printable-class-list {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* 2. LES 4 BLOCS DU HAUT (Toutes les Classes, Maternelle, Primaire, Collège) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        {(Object.keys(cyclesConfig) as Array<keyof typeof cyclesConfig>).map((cycKey) => {
          const cyc = cyclesConfig[cycKey];
          const Icon = cyc.icon;
          const isActive = selectedCycle === cycKey;

          return (
            <button
              key={cycKey}
              type="button"
              onClick={() => handleCycleChange(cycKey)}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {cycKey === 'all' ? `${students.length} élèves` : `${students.filter((s) => cyc.classes.includes(s.grade)).length} élèves`}
                </span>
              </div>
              <div>
                <span className="text-xs font-extrabold block truncate font-heading">{cyc.label}</span>
                <span className={`text-[10.5px] block truncate mt-0.5 ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {cyc.sub}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Sélecteur de Classe Spécifique */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3 print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Division de classe ({cyclesConfig[selectedCycle].label}) :
          </span>
          <span className="text-xs text-slate-500 font-medium">
            Total affiché : <strong className="text-slate-900 font-bold">{filteredStudents.length} élèves</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {cyclesConfig[selectedCycle].classes.map((cls) => {
            const isAllClass = cls === 'Toutes les classes';
            const countInClass = isAllClass
              ? selectedCycle === 'all'
                ? students.length
                : students.filter((s) => cyclesConfig[selectedCycle].classes.includes(s.grade)).length
              : students.filter((s) => s.grade === cls).length;

            const isSelected = selectedClass === cls;

            return (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{cls}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {countInClass}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Cartes Statistiques de la Classe */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 print:hidden">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Effectif Sélectionné</span>
          <span className="text-2xl font-black text-slate-950 font-heading">{classStats.total} élèves</span>
          <span className="text-[10px] text-slate-500 block">{selectedClass}</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-pink-200/80 shadow-xs bg-pink-50/20">
          <span className="text-[11px] font-bold text-pink-700 uppercase tracking-wider block">Filles Inscrites</span>
          <span className="text-2xl font-black text-pink-900 font-heading">♀ {classStats.girls}</span>
          <span className="text-[10px] text-pink-700 block">
            {classStats.total > 0 ? ((classStats.girls / classStats.total) * 100).toFixed(0) : 0}% de l&apos;effectif
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-blue-200/80 shadow-xs bg-blue-50/20">
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Garçons Inscrits</span>
          <span className="text-2xl font-black text-blue-900 font-heading">♂ {classStats.boys}</span>
          <span className="text-[10px] text-blue-700 block">
            {classStats.total > 0 ? ((classStats.boys / classStats.total) * 100).toFixed(0) : 0}% de l&apos;effectif
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Dossiers Répertoriés</span>
          <span className="text-2xl font-black text-emerald-900 font-heading">{classStats.total} dossiers</span>
          <span className="text-[10px] text-emerald-700 block">Synchronisation active</span>
        </div>
      </div>

      {/* 5. Tableau des Élèves */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden print:hidden">
        {/* Toolbar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, prénom, matricule..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
              className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">Tous genres</option>
              <option value="female">♀ Filles uniquement</option>
              <option value="male">♂ Garçons uniquement</option>
            </select>
          </div>
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 pl-6 pr-3 w-12 text-center">N°</th>
                <th className="py-3.5 px-3">Matricule & Identifiant</th>
                <th className="py-3.5 px-3">Nom de Famille</th>
                <th className="py-3.5 px-3">Prénoms</th>
                <th className="py-3.5 px-3 text-center">Classe</th>
                <th className="py-3.5 px-3 text-center font-mono text-slate-700 font-bold">Date de Naissance</th>
                <th className="py-3.5 px-3 text-center">Genre</th>
                <th className="py-3.5 px-3">Contact WhatsApp Parent</th>
                <th className="py-3.5 pr-6 px-3 text-center w-28">Dossier Scolaire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Aucun élève trouvé pour la sélection ({selectedClass}).
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu, idx) => {
                  const birthDate = getStudentBirthDate(stu);

                  return (
                    <tr key={stu.id} className="hover:bg-emerald-50/20 transition-colors">
                      {/* N° d'ordre */}
                      <td className="py-3.5 pl-6 pr-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>

                      {/* Matricule */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="block text-slate-950 font-bold">{stu.matricule}</span>
                        <span className="text-[10px] text-slate-400">{stu.studentNumber}</span>
                      </td>

                      {/* Nom */}
                      <td className="py-3.5 px-3 font-extrabold uppercase text-slate-950 font-heading whitespace-nowrap">
                        {stu.lastName}
                      </td>

                      {/* Prénoms */}
                      <td className="py-3.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {stu.firstName}
                      </td>

                      {/* Classe */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {stu.grade}
                        </span>
                      </td>

                      {/* Date de Naissance */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-700 whitespace-nowrap">
                        {formatDate(birthDate)}
                      </td>

                      {/* Genre */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <GenderBadge gender={stu.gender} />
                      </td>

                      {/* Contact WhatsApp */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="text-[11px] text-slate-500 block truncate max-w-[160px]">
                            {stu.guardianName}
                          </span>
                          <span className="font-mono font-bold text-emerald-800 text-[11px] flex items-center gap-1">
                            <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                            {stu.whatsappPhone || stu.guardianPhone}
                          </span>
                        </div>
                      </td>

                      {/* Action Voir Dossier Scolaire Direct */}
                      <td className="py-3.5 pr-6 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentDoc(stu)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-900 transition-all shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
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

      {/* 6. MODAL : DOSSIER SCOLAIRE SYNCHRONISÉ AVEC DOCUMENTS SCOLAIRES */}
      {selectedStudentDoc && (() => {
        const doc = docRecords[selectedStudentDoc.id] || {
          hasBirthCertificate: false,
          hasReportCard: false,
          hasRegistrationForm: false,
          otherDocs: [],
        };
        const otherDocsList = doc.otherDocs || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-lg uppercase">
                    {selectedStudentDoc.firstName[0]}{selectedStudentDoc.lastName[0]}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-950 font-heading uppercase">
                      {selectedStudentDoc.lastName} {selectedStudentDoc.firstName}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Dossier Scolaire Officiel • {selectedStudentDoc.studentNumber} ({selectedStudentDoc.matricule})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Renseignements Élève */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Classe Fréquentée</span>
                  <span className="font-extrabold text-purple-900">{selectedStudentDoc.grade}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Date de Naissance</span>
                  <span className="font-mono font-extrabold text-slate-900">
                    {formatDate(getStudentBirthDate(selectedStudentDoc))}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Genre de l&apos;Élève</span>
                  <span className="font-bold text-slate-900">
                    {selectedStudentDoc.gender === 'female' ? '♀ Féminin (Fille)' : '♂ Masculin (Garçon)'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Statut d&apos;Inscription</span>
                  <span className="font-bold text-emerald-800">
                    {selectedStudentDoc.enrollmentType === 'ancien' ? '🔄 Réinscrit (Ancien Élève)' : '🌟 Nouveau Recrutement'}
                  </span>
                </div>
                <div className="col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Parent / Tuteur & Contact</span>
                  <span className="font-bold text-slate-900 block">{selectedStudentDoc.guardianName}</span>
                  <span className="font-mono text-emerald-800 text-[11px] font-bold">
                    {selectedStudentDoc.whatsappPhone || selectedStudentDoc.guardianPhone}
                  </span>
                </div>

                {/* PIÈCES JUSTIFICATIVES DU DOSSIER SYNCHRONISÉES EN TEMPS RÉEL */}
                <div className="col-span-2 p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 space-y-2.5">
                  <span className="text-[10.5px] uppercase font-bold text-emerald-950 block">
                    Statut Réel des Pièces du Dossier (Synchronisé avec Documents Scolaires)
                  </span>

                  <div className="space-y-2">
                    {/* 1. Extrait */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                      <span className="font-semibold text-slate-800">1. Extrait d&apos;acte de naissance</span>
                      {doc.hasBirthCertificate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Numérisé ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> En attente
                        </span>
                      )}
                    </div>

                    {/* 2. Bulletin */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                      <span className="font-semibold text-slate-800">2. Bulletin scolaire</span>
                      {doc.hasReportCard ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Récupéré ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> En attente
                        </span>
                      )}
                    </div>

                    {/* 3. Fiche scolaire */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                      <span className="font-semibold text-slate-800">3. Fiche scolaire d&apos;admission</span>
                      {doc.hasRegistrationForm ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Complète ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Incomplète
                        </span>
                      )}
                    </div>

                    {/* 4. Autres documents */}
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">4. Autres documents divers rattachés</span>
                        <span className="text-[10.5px] font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                          {otherDocsList.length} document(s)
                        </span>
                      </div>

                      {otherDocsList.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">Aucun autre document divers téléversé.</p>
                      ) : (
                        <div className="space-y-1 pt-1">
                          {otherDocsList.map((d) => (
                            <div key={d.id} className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-purple-50/60 text-purple-950">
                              <span className="font-bold flex items-center gap-1">
                                <Paperclip className="w-3 h-3 text-purple-600" /> {d.title}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">{d.date}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedStudentDoc(null)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Fermer le Dossier Scolaire
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
