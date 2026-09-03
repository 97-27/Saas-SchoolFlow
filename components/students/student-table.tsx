'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Student, School } from '@/lib/data/types';
import { GenderBadge } from '@/components/ui/badge';
import { formatDate, formatFCFA } from '@/lib/utils/formatters';
import { availableClasses, mockSchools } from '@/lib/data/mock-data';
import { getStudentDocumentRecord } from '@/lib/data/live-store';
import { NewStudentModal } from './new-student-modal';
import {
  Search,
  Filter,
  Download,
  Plus,
  MoreHorizontal,
  ChevronDown,
  RotateCcw,
  MapPin,
  MessageCircle,
  Eye,
  Edit,
  Check,
  X,
  Save,
  Printer,
  Calendar,
  User,
  CheckCircle2,
  ArrowUpDown,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { getLiveStudents, getLiveSchool, updateRegisteredStudent, deleteLiveStudents, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import { FrenchDateInput } from '@/components/ui/french-date-input';

import { useRouter } from 'next/navigation';

interface StudentTableProps {
  initialStudents: Student[];
  schoolSlug: string;
  academicYear?: string;
  schoolName?: string;
  school?: School;
}

export function StudentTable({
  initialStudents,
  schoolSlug,
  academicYear: propAcademicYear,
  schoolName: propSchoolName,
  school = mockSchools['college-excellence'],
}: StudentTableProps) {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [currentSchool, setCurrentSchool] = useState<School>(
    school || mockSchools[schoolSlug] || mockSchools['college-excellence']
  );

  useEffect(() => {
    setStudents(getLiveStudents(initialStudents, schoolSlug));
    setCurrentSchool(
      getLiveSchool(schoolSlug, school || mockSchools[schoolSlug] || mockSchools['college-excellence'])
    );

    const handleUpdate = () => {
      setStudents(getLiveStudents(initialStudents, schoolSlug));
      setCurrentSchool(
        getLiveSchool(schoolSlug, school || mockSchools[schoolSlug] || mockSchools['college-excellence'])
      );
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [initialStudents, schoolSlug, school]);

  const effectiveAcademicYear = currentSchool.academicYear || propAcademicYear || '2026-2027';
  const effectiveSchoolName = currentSchool.name || propSchoolName || "Groupe Scolaire";

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('Toutes les classes');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedEnrollmentType, setSelectedEnrollmentType] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Custom Modals states (No Chrome alert)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student[] | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // Par défaut les plus récents (ID-051, etc.) en haut

  // Edit form state
  const [editLastName, setEditLastName] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editGender, setEditGender] = useState<'female' | 'male'>('female');
  const [editPaymentDate, setEditPaymentDate] = useState('2026-08-27');
  const [editEnrollmentType, setEditEnrollmentType] = useState<'nouveau' | 'ancien'>('nouveau');
  const [editStatus, setEditStatus] = useState<'active' | 'on_leave' | 'transferred'>('active');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editGuardianName, setEditGuardianName] = useState('');

  // Top scrollbar references
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  // Open edit modal
  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setEditLastName(student.lastName);
    setEditFirstName(student.firstName);
    setEditGrade(student.grade);
    setEditGender(student.gender);
    setEditPaymentDate(student.paymentDate || '2026-08-27');
    setEditEnrollmentType(student.enrollmentType || 'nouveau');
    setEditStatus(student.status || 'active');
    setEditWhatsapp(student.whatsappPhone);
    setEditAddress(student.address);
    setEditGuardianName(student.guardianName);
    setOpenActionId(null);
  };

  // Save student modifications
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    const updated: Student = {
      ...editingStudent,
      lastName: editLastName.trim().toUpperCase(),
      firstName: editFirstName.trim(),
      fullName: `${editFirstName.trim()} ${editLastName.trim().toUpperCase()}`,
      grade: editGrade,
      gender: editGender,
      paymentDate: editPaymentDate,
      enrollmentType: editEnrollmentType,
      status: editStatus,
      whatsappPhone: editWhatsapp.trim(),
      guardianPhone: editWhatsapp.trim(),
      address: editAddress.trim(),
      guardianName: editGuardianName.trim(),
    };

    setStudents((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );

    // Save to local storage and sync invoice across dashboard and caisse
    updateRegisteredStudent(updated);

    setSuccessMessage(`Coordonnées et statut de l'élève ${updated.fullName} mis à jour avec succès !`);
    setTimeout(() => setSuccessMessage(null), 5000);
    setEditingStudent(null);
  };

  // Fonction pour récupérer l'état réel et synchronisé des pièces du dossier de l'élève (Strictement en attente tant qu'aucun document n'a été importé)
  const getLiveDocsForStudent = (studentId: string) => {
    return getStudentDocumentRecord(studentId);
  };

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((stu) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        searchQuery === '' ||
        stu.studentNumber.toLowerCase().includes(q) ||
        (stu.matricule && stu.matricule.toLowerCase().includes(q)) ||
        stu.lastName.toLowerCase().includes(q) ||
        stu.firstName.toLowerCase().includes(q) ||
        stu.fullName.toLowerCase().includes(q) ||
        stu.address.toLowerCase().includes(q) ||
        stu.whatsappPhone.toLowerCase().includes(q) ||
        stu.grade.toLowerCase().includes(q);

      const matchesClass =
        selectedClass === 'Toutes les classes' ||
        stu.grade.toLowerCase() === selectedClass.toLowerCase();

      const matchesGender =
        selectedGender === 'all' || stu.gender === selectedGender;

      const matchesEnrollment =
        selectedEnrollmentType === 'all' ||
        (selectedEnrollmentType === 'nouveau' && (stu.enrollmentType === 'nouveau' || !stu.enrollmentType)) ||
        (selectedEnrollmentType === 'ancien' && stu.enrollmentType === 'ancien');

      return matchesSearch && matchesClass && matchesGender && matchesEnrollment;
    });
  }, [students, searchQuery, selectedClass, selectedGender, selectedEnrollmentType]);

  // Sorted students (Par défaut 'desc' pour voir ID-051 tout en haut)
  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      const numA = parseInt(a.studentNumber.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.studentNumber.replace(/\D/g, ''), 10) || 0;
      return sortOrder === 'desc' ? numB - numA : numA - numB;
    });
  }, [filteredStudents, sortOrder]);

  // Compute next student number e.g. ID-051 / ID-052
  const nextStudentNumber = useMemo(() => {
    let maxNum = 0;
    students.forEach((s) => {
      const match = s.studentNumber.match(/ID-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const next = maxNum + 1;
    return `ID-${next.toString().padStart(3, '0')}`;
  }, [students]);

  // Handle new student enrollment
  const handleStudentCreated = (newStudent: Student) => {
    setStudents((prev) => [newStudent, ...prev]);
    setSuccessMessage(
      `Élève ${newStudent.lastName} ${newStudent.firstName} inscrit avec succès sous l'identifiant ${newStudent.studentNumber} !`
    );
    setTimeout(() => {
      setSuccessMessage(null);
    }, 6000);
  };

  // Selection toggle
  const isAllSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((stu) => selectedIds.includes(stu.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map((stu) => stu.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedClass('Toutes les classes');
    setSelectedGender('all');
    setSelectedEnrollmentType('all');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedClass !== 'Toutes les classes' ||
    selectedGender !== 'all' ||
    selectedEnrollmentType !== 'all';

  return (
    <div className="space-y-6 pb-12">
      {/* 1 SEUL EN-TÊTE PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Vue d&apos;ensemble des Élèves
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {effectiveAcademicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Répertoire nominatif officiel, matricules, classes et contacts WhatsApp — {effectiveSchoolName}
          </p>
        </div>

        {/* Boutons d'action en haut */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Bouton de tri asc/desc */}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
            title="Changer l'ordre d'affichage (Plus récents / Plus anciens)"
          >
            {sortOrder === 'desc' ? (
              <>
                <ArrowDownNarrowWide className="w-3.5 h-3.5 text-emerald-600" />
                <span>Plus récents d&apos;abord</span>
              </>
            ) : (
              <>
                <ArrowUpNarrowWide className="w-3.5 h-3.5 text-emerald-600" />
                <span>Par numéro ID (001...)</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            onClick={() => window.print()}
            title="Exporter et Imprimer le répertoire nominatif officiel au format PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Exporter en PDF</span>
          </button>
        </div>
      </div>

      {/* Message de succès */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between text-xs font-medium shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
        {/* Toolbar de filtrage */}
        <div className="p-3.5 sm:p-4 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Recherche */}
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par ID, matricule, nom, prénom..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Filtre Classe */}
          <div className="relative flex-1 sm:flex-none min-w-[140px]">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filtre Statut Élève (Nouveau vs Ancien) */}
          <div className="relative flex-1 sm:flex-none min-w-[130px]">
            <select
              value={selectedEnrollmentType}
              onChange={(e) => setSelectedEnrollmentType(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Tous types</option>
              <option value="nouveau">🌟 Nouveaux</option>
              <option value="ancien">🔄 Anciens</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filtre Genre */}
          <div className="relative flex-1 sm:flex-none min-w-[120px]">
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Tous les genres</option>
              <option value="female">♀ Filles</option>
              <option value="male">♂ Garçons</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Réinitialiser */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="p-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              title="Réinitialiser les filtres"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Effacer</span>
            </button>
          )}

          {/* Indicateur d'élèves sélectionnés + Bloc de suppression */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs shadow-2xs ml-auto animate-in fade-in flex-wrap">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {selectedIds.length} {selectedIds.length > 1 ? 'élèves sélectionnés' : 'élève sélectionné'}
              </span>

              <button
                type="button"
                onClick={() => {
                  const list = students.filter((s) => selectedIds.includes(s.id));
                  setStudentToDelete(list);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all cursor-pointer ml-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer {selectedIds.length > 1 ? `les ${selectedIds.length} élèves` : "l'élève"}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-emerald-700 hover:text-emerald-950 underline text-[11px] ml-1 cursor-pointer font-semibold"
              >
                Désélectionner
              </button>
            </div>
          )}
        </div>

        {/* BARRE DE DÉFILEMENT HORIZONTAL SITUÉE EN HAUT DU TABLEAU */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto bg-slate-100 border-b border-slate-200 scrollbar-thin"
          style={{ overflowX: 'scroll' }}
        >
          <div style={{ width: '1200px', height: '14px' }} className="flex items-center px-3 text-[10px] font-semibold text-slate-500">
            <span className="shrink-0 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Barre de défilement supérieure (glissez ici vers la gauche ou la droite pour voir toutes les colonnes) →
            </span>
          </div>
        </div>

        {/* Tableau des élèves (Strictement sans colonnes financières selon consigne - Scrollbar du bas supprimée) */}
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="max-h-[680px] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ overflowX: 'hidden' }}
        >
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead className="sticky top-0 z-10 shadow-2xs">
              <tr className="bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 pl-5 pr-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                    aria-label="Sélectionner tous les élèves"
                  />
                </th>
                <th className="py-3.5 px-3 whitespace-nowrap">ID Élève</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Matricule</th>
                <th className="py-3.5 px-3 whitespace-nowrap min-w-[200px]">Nom & Prénom(s)</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Classe</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Statut Élève</th>
                <th className="py-3.5 px-3 whitespace-nowrap min-w-[170px]">Contact WhatsApp Parent</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Date d&apos;Inscription</th>
                <th className="py-3.5 pr-5 pl-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    Aucun élève trouvé avec les critères sélectionnés.
                  </td>
                </tr>
              ) : (
                sortedStudents.map((student) => {
                  const isSelected = selectedIds.includes(student.id);

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-emerald-50/30 transition-colors ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-5 pr-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(student.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                        />
                      </td>

                      {/* Numéro ID (ID-001, ID-051...) */}
                      <td className="py-3.5 px-3 font-bold text-slate-900 font-mono text-[11px] whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {student.studentNumber}
                        </span>
                      </td>

                      {/* Matricule (8 chiffres + lettre) */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-700 text-[11px] whitespace-nowrap">
                        {student.matricule || '26014801A'}
                      </td>

                      {/* Nom & Prénom + Badge Genre */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 uppercase">
                            {student.lastName}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {student.firstName}
                          </span>
                          <GenderBadge gender={student.gender} />
                        </div>
                      </td>

                      {/* Classe (centrée) */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap shadow-2xs">
                          {student.grade}
                        </span>
                      </td>

                      {/* Statut Élève (Nouveau / Ancien) */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 font-extrabold text-[11px] px-2 py-0.5 rounded-md border ${
                          student.enrollmentType === 'ancien'
                            ? 'bg-blue-50 text-blue-800 border-blue-200/80 shadow-2xs'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-2xs'
                        }`}>
                          {student.enrollmentType === 'ancien' ? '🔄 Ancien' : '🌟 Nouveau'}
                        </span>
                      </td>

                      {/* Contact WhatsApp Parent (10 chiffres) */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <a
                          href={`https://wa.me/${student.whatsappPhone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200/80 font-mono text-[11px] font-semibold transition-colors"
                          title="Contacter le parent sur WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{student.whatsappPhone}</span>
                        </a>
                      </td>

                      {/* Date d'inscription */}
                      <td className="py-3.5 px-3 text-center text-slate-700 font-medium whitespace-nowrap font-sans">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(student.paymentDate || '2026-08-27')}</span>
                        </span>
                      </td>

                      {/* Actions avec modale personnalisée */}
                      <td className="py-3.5 pr-5 pl-3 text-right relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenActionId(
                              openActionId === student.id ? null : student.id
                            )
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                          aria-label="Options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {openActionId === student.id && (
                          <div className="absolute right-5 top-10 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 text-left animate-in fade-in zoom-in-95 duration-150">
                            {/* En-tête de menu avec bouton Croix pour fermer */}
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Actions Élève
                              </span>
                              <button
                                type="button"
                                onClick={() => setOpenActionId(null)}
                                className="w-5 h-5 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                title="Fermer le menu"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionId(null);
                                setViewingStudent(student);
                              }}
                              className="w-full px-3.5 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2.5 cursor-pointer font-medium whitespace-nowrap transition-colors"
                            >
                              <Eye className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="whitespace-nowrap">Consulter le dossier scolaire</span>
                            </button>

                            <a
                              href={`https://wa.me/${student.whatsappPhone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full px-3.5 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2.5 cursor-pointer font-medium whitespace-nowrap transition-colors"
                              onClick={() => setOpenActionId(null)}
                            >
                              <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="whitespace-nowrap">Message WhatsApp</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(student)}
                              className="w-full px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-blue-700 flex items-center gap-2.5 border-t border-slate-100 cursor-pointer font-medium whitespace-nowrap transition-colors"
                            >
                              <Edit className="w-4 h-4 text-blue-600 shrink-0" />
                              <span className="whitespace-nowrap">Modifier les coordonnées</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionId(null);
                                setStudentToDelete([student]);
                              }}
                              className="w-full px-3.5 py-2.5 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 border-t border-slate-100 cursor-pointer font-bold whitespace-nowrap transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                              <span className="whitespace-nowrap">Supprimer du registre</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer récapitulatif */}
        <div className="p-4 px-4 sm:px-6 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Total affiché : <strong className="text-slate-900">{filteredStudents.length}</strong> élève{filteredStudents.length > 1 ? 's' : ''}
            </span>
            {selectedIds.length > 0 && (
              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            Données financières consultables dans l&apos;onglet « Comptabilité & Caisse »
          </span>
        </div>
      </div>

      {/* ================= MODALE PERSONNALISÉE : MODIFIER L'ÉLÈVE ================= */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header Modale */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                    Modifier les Coordonnées de l&apos;Élève
                  </h3>
                  <span className="font-mono text-xs text-emerald-700 font-bold">
                    {editingStudent.studentNumber} • {editingStudent.matricule}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nom de famille *</label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold uppercase transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Prénom(s) *</label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold transition-all"
                  />
                </div>
              </div>

              {/* Genre & Statut Élève */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Genre (Féminin / Masculin) */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Genre *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditGender('female')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        editGender === 'female'
                          ? 'bg-pink-50 text-pink-700 border-pink-300 ring-2 ring-pink-400/20 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>♀ Fille</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditGender('male')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        editGender === 'male'
                          ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-400/20 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>♂ Garçon</span>
                    </button>
                  </div>
                </div>

                {/* Date d'inscription */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Date d&apos;inscription *</span>
                  </label>
                  <FrenchDateInput
                    value={editPaymentDate}
                    onChange={setEditPaymentDate}
                  />
                </div>
              </div>

              {/* Type d'Élève : Nouveau ou Ancien */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Type d&apos;Élève (Statut d&apos;admission) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditEnrollmentType('nouveau')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      editEnrollmentType === 'nouveau'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>🌟 Nouvel Élève</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditEnrollmentType('ancien')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      editEnrollmentType === 'ancien'
                        ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>🔄 Ancien Élève</span>
                  </button>
                </div>
              </div>

              {/* Statut de présence */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Statut de l&apos;Élève (Présence) *</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold cursor-pointer"
                >
                  <option value="active">🟢 Inscrit Actif (Présent en classe)</option>
                  <option value="on_leave">🟡 En Congé / En Attente</option>
                  <option value="transferred">🔴 Transféré / Radié</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Classe *</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold cursor-pointer"
                  >
                    {availableClasses
                      .filter((c) => c !== 'Toutes les classes')
                      .map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Contact WhatsApp (10 chiffres) *</label>
                  <input
                    type="text"
                    required
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold text-emerald-800 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nom du Parent / Tuteur légal</label>
                <input
                  type="text"
                  value={editGuardianName}
                  onChange={(e) => setEditGuardianName(e.target.value)}
                  placeholder="Ex: M. Kouassi Jean"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Adresse de résidence où l&apos;enfant habite</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Ex: Cocody Angré 8ème Tranche, Rés. Bêttina"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-all text-center cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all text-center cursor-pointer"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODALE PERSONNALISÉE : DOSSIER COMPTABILITÉ & RÈGLEMENTS SCOLARITÉ ================= */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header Modale */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-extrabold text-base font-heading shadow-xs">
                  {viewingStudent.lastName.charAt(0)}{viewingStudent.firstName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-heading">
                      {viewingStudent.fullName}
                    </h3>
                    <GenderBadge gender={viewingStudent.gender} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {viewingStudent.studentNumber}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      Matricule : {viewingStudent.matricule} • Classe : {viewingStudent.grade}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Résumé Comptable & Reste à Payer */}
            {(() => {
              const netScolarite = viewingStudent.netAmount || viewingStudent.tuitionAmount || 250000;
              const paidTotal = viewingStudent.paidAmount || 0;
              const remaining = viewingStudent.balanceRemaining !== undefined
                ? viewingStudent.balanceRemaining
                : Math.max(0, netScolarite - paidTotal);
              const regFee = viewingStudent.registrationFee || 35000;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Scolarité Nette</span>
                    <span className="font-mono font-black text-slate-900 text-sm block mt-0.5">
                      {formatFCFA(netScolarite)}
                    </span>
                    <span className="text-[9.5px] text-slate-500">Montant annuel</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Droit d&apos;Inscription</span>
                    <span className="font-mono font-black text-slate-900 text-sm block mt-0.5">
                      {formatFCFA(regFee)}
                    </span>
                    <span className="text-[9.5px] text-emerald-700 font-bold">Acquitté à l&apos;entrée</span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Encaissé</span>
                    <span className="font-mono font-black text-emerald-950 text-sm block mt-0.5">
                      {formatFCFA(paidTotal)}
                    </span>
                    <span className="text-[9.5px] text-emerald-800 font-bold">
                      {((paidTotal / netScolarite) * 100).toFixed(0)}% réglé
                    </span>
                  </div>

                  <div className={`p-3 rounded-2xl border ${
                    remaining > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-emerald-50/70 border-emerald-200'
                  }`}>
                    <span className={`text-[10px] uppercase font-bold block ${
                      remaining > 0 ? 'text-rose-800' : 'text-emerald-800'
                    }`}>
                      Reste à Payer
                    </span>
                    <span className={`font-mono font-black text-sm block mt-0.5 ${
                      remaining > 0 ? 'text-rose-950' : 'text-emerald-950'
                    }`}>
                      {formatFCFA(remaining)}
                    </span>
                    <span className={`text-[9.5px] font-bold ${
                      remaining > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}>
                      {remaining > 0 ? 'Solde débiteur' : 'Scolarité 100% Soldée ✓'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* 2. Coordonnées de Facturation & Contact */}
            <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="text-slate-400 block text-[10px]">Date du Premier Versement :</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {formatDate(viewingStudent.paymentDate || '2026-08-27')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Mode de règlement principal :</span>
                <span className="font-semibold text-slate-900">
                  {viewingStudent.paymentMethod === 'mobile_money' ? '📱 Mobile Money (Wave / Orange)' : viewingStudent.paymentMethod === 'cash' ? '💵 Espèces (Caisse Centrale)' : '🏦 Virement / Chèque Bancaire'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Parent / Payeur :</span>
                <span className="font-semibold text-slate-900">
                  {viewingStudent.guardianName || 'Non spécifié'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Contact WhatsApp Payeur :</span>
                <span className="font-mono font-bold text-emerald-800">
                  {viewingStudent.whatsappPhone}
                </span>
              </div>
            </div>

            {/* 3. Détail Chronologique des 5 Versements (Dates, Jours et Règlements) */}
            {(() => {
              const paid = viewingStudent.paidAmount || 0;
              const net = viewingStudent.netAmount || viewingStudent.tuitionAmount || 250000;
              const inst = viewingStudent.installments;

              const v1 = inst?.versement1?.amount || Math.min(paid, 100000);
              const v2 = inst?.versement2?.amount || (paid > 100000 ? Math.min(paid - 100000, 50000) : 0);
              const v3 = inst?.versement3?.amount || (paid > 150000 ? Math.min(paid - 150000, 40000) : 0);
              const v4 = inst?.versement4?.amount || (paid > 190000 ? Math.min(paid - 190000, 35000) : 0);
              const v5 = inst?.versement5?.amount || (paid > 225000 ? Math.min(paid - 225000, 25000) : 0);

              const rows = [
                {
                  title: '1er Versement (Rentrée scolaire)',
                  amount: v1,
                  expected: 100000,
                  date: inst?.versement1?.date || viewingStudent.paymentDate || '2026-08-27',
                  method: inst?.versement1?.method || viewingStudent.paymentMethod || 'Espèces',
                  receipt: `REC-2026-${viewingStudent.studentNumber?.slice(-3) || '001'}-1`,
                  status: v1 >= 100000 ? 'paid' : v1 > 0 ? 'partial' : 'pending',
                },
                {
                  title: '2ème Versement (1ère Échéance Octobre)',
                  amount: v2,
                  expected: 50000,
                  date: inst?.versement2?.date || (v2 > 0 ? '2026-10-15' : 'Échéance : 15/10/2026'),
                  method: inst?.versement2?.method || 'Wave Money',
                  receipt: v2 > 0 ? `REC-2026-${viewingStudent.studentNumber?.slice(-3) || '001'}-2` : '—',
                  status: v2 >= 50000 ? 'paid' : v2 > 0 ? 'partial' : 'pending',
                },
                {
                  title: '3ème Versement (2ème Échéance Décembre)',
                  amount: v3,
                  expected: 40000,
                  date: inst?.versement3?.date || (v3 > 0 ? '2026-12-10' : 'Échéance : 10/12/2026'),
                  method: inst?.versement3?.method || 'Espèces',
                  receipt: v3 > 0 ? `REC-2026-${viewingStudent.studentNumber?.slice(-3) || '001'}-3` : '—',
                  status: v3 >= 40000 ? 'paid' : v3 > 0 ? 'partial' : 'pending',
                },
                {
                  title: '4ème Versement (3ème Échéance Février)',
                  amount: v4,
                  expected: 35000,
                  date: inst?.versement4?.date || (v4 > 0 ? '2027-02-15' : 'Échéance : 15/02/2027'),
                  method: inst?.versement4?.method || 'Orange Money',
                  receipt: v4 > 0 ? `REC-2026-${viewingStudent.studentNumber?.slice(-3) || '001'}-4` : '—',
                  status: v4 >= 35000 ? 'paid' : v4 > 0 ? 'partial' : 'pending',
                },
                {
                  title: '5ème Versement (Solde Final Avril)',
                  amount: v5,
                  expected: 25000,
                  date: inst?.versement5?.date || (v5 > 0 ? '2027-04-10' : 'Échéance : 10/04/2027'),
                  method: inst?.versement5?.method || 'Espèces',
                  receipt: v5 > 0 ? `REC-2026-${viewingStudent.studentNumber?.slice(-3) || '001'}-5` : '—',
                  status: v5 >= 25000 ? 'paid' : v5 > 0 ? 'partial' : 'pending',
                },
              ];

              return (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Historique des Versements & Règlements (5 Tranches)</span>
                    <span className="text-[10px] text-slate-400 font-mono">Année {effectiveAcademicYear}</span>
                  </h4>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
                    {rows.map((r, i) => (
                      <div key={i} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="font-bold text-slate-900 truncate">{r.title}</p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-slate-700">
                              📅 {r.date.includes('-') ? formatDate(r.date) : r.date}
                            </span>
                            <span>•</span>
                            <span>{r.method}</span>
                            {r.receipt !== '—' && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-emerald-800 font-bold">{r.receipt}</span>
                              </>
                            )}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-slate-950 text-xs block">
                            {formatFCFA(r.amount)}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 border ${
                            r.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : r.status === 'partial'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {r.status === 'paid' ? 'Réglé ✓' : r.status === 'partial' ? 'Partiel' : 'En attente'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Actions */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer l&apos;État Financier</span>
              </button>

              <a
                href={`https://wa.me/${viewingStudent.whatsappPhone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp Parent</span>
              </a>

              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
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
                  Êtes-vous certain de vouloir supprimer {studentToDelete.length === 1 ? "cet élève" : "ces élèves"} ? {studentToDelete.length === 1 ? "Il sera automatiquement retiré" : "Ils seront automatiquement retirés"} de toutes les vues : <strong>Vue d&apos;ensemble, Scolarité & Caisses, Documents, Classes, Notes & Bulletins, Présences et Rapports</strong>.
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
                  setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
                  setStudentToDelete(null);
                  setSuccessMessage(
                    ids.length === 1
                      ? "L'élève a été supprimé avec succès de l'ensemble des modules de l'école."
                      : `${ids.length} élèves ont été supprimés avec succès de l'ensemble des modules de l'école.`
                  );
                  setTimeout(() => setSuccessMessage(null), 5000);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
              >
                Confirmer la Suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'inscription rapide standard */}
      <NewStudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        nextStudentNumber={nextStudentNumber}
        onStudentCreated={handleStudentCreated}
        school={school}
      />
    </div>
  );
}
