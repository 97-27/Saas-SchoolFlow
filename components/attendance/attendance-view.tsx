'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student, School } from '@/lib/data/types';
import { formatDate } from '@/lib/utils/formatters';
import { getLiveStudents, getLiveSchool, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import { GenderBadge } from '@/components/ui/badge';
import { FrenchDateInput } from '@/components/ui/french-date-input';
import {
  Clock,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageCircle,
  Save,
  Building2,
  Layers,
  CheckCheck,
  Lock,
  Unlock,
  ShieldAlert,
  X,
} from 'lucide-react';

interface AttendanceViewProps {
  initialStudents: Student[];
  school: School;
  schoolSlug: string;
}

type AttendanceStatus = 'present' | 'absent' | 'late';

const secondaryClasses = [
  '6ème',
  '5ème',
  '4ème',
  '3ème',
];

const timeSlots = [
  { id: 'slot-1', label: 'De 08h à 10h', period: 'Matin Session 1', time: '08h00 - 10h00' },
  { id: 'slot-2', label: 'De 10h à 12h (Midi)', period: 'Matin Session 2', time: '10h00 - 12h00' },
  { id: 'slot-3', label: 'De 14h à 16h', period: 'Après-midi Session 1', time: '14h00 - 16h00' },
  { id: 'slot-4', label: 'De 16h à 17h30', period: 'Après-midi Session 2', time: '16h00 - 17h30' },
];

export function AttendanceView({
  initialStudents,
  school,
  schoolSlug,
}: AttendanceViewProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<string>('slot-1');
  const [selectedCycleTab, setSelectedCycleTab] = useState<'all' | 'college' | 'lycee'>('college');
  const [selectedClass, setSelectedClass] = useState<string>('6ème');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late'>('all');

  // Sécurité : Verrouillage de la session d'appel
  const lockKey = `schoolflow_attendance_locked_${schoolSlug}_${selectedDate}_${selectedSlot}_${selectedClass}`;
  const [isSessionLocked, setIsSessionLocked] = useState<boolean>(false);
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [unlockReason, setUnlockReason] = useState<string>('');
  const [unlockTeacherName, setUnlockTeacherName] = useState<string>('');

  // Map des présences : [slotId_date_studentId] -> { status, reason }
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; reason: string }>>({});

  // Synchronisation des élèves et de l'école
  useEffect(() => {
    setStudents(getLiveStudents(initialStudents, schoolSlug));
    setCurrentSchool(getLiveSchool(schoolSlug, school));

    const handleUpdate = () => {
      setStudents(getLiveStudents(initialStudents, schoolSlug));
      setCurrentSchool(getLiveSchool(schoolSlug, school));
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [initialStudents, schoolSlug, school]);

  // Vérifier si la session courante est verrouillée
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const locked = localStorage.getItem(lockKey);
        setIsSessionLocked(locked === 'true');
      } catch (e) {
        setIsSessionLocked(false);
      }
    }
  }, [lockKey]);

  // Classes du Collège (6ème à 3ème)
  const displayedClasses = useMemo(() => {
    return secondaryClasses;
  }, []);

  // Élèves de la classe choisie
  const classStudents = useMemo(() => {
    return students.filter((s) => s.grade === selectedClass);
  }, [students, selectedClass]);

  // Initialisation par défaut de la feuille d'appel pour ce créneau et cette date
  useEffect(() => {
    setAttendanceMap((prev) => {
      const next = { ...prev };
      classStudents.forEach((stu, idx) => {
        const key = `${selectedDate}_${selectedSlot}_${stu.id}`;
        if (!next[key]) {
          const isAbsentDemo = (idx === 2 || idx === 7);
          next[key] = {
            status: isAbsentDemo ? 'absent' : 'present',
            reason: isAbsentDemo ? 'Non justifié' : '',
          };
        }
      });
      return next;
    });
  }, [classStudents, selectedDate, selectedSlot]);

  // Changer le statut d'un élève (si non verrouillé)
  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    if (isSessionLocked) {
      alert("Cette session d'appel est verrouillée pour des raisons de sécurité. Veuillez demander un déverrouillage pour modifier.");
      return;
    }
    const key = `${selectedDate}_${selectedSlot}_${studentId}`;
    setAttendanceMap((prev) => ({
      ...prev,
      [key]: {
        status,
        reason: status === 'present' ? '' : prev[key]?.reason || (status === 'absent' ? 'Non justifié' : 'Retard transport 10 min'),
      },
    }));
  };

  // Marquer toute la classe comme présente
  const markAllPresent = () => {
    if (isSessionLocked) return;
    setAttendanceMap((prev) => {
      const next = { ...prev };
      classStudents.forEach((stu) => {
        const key = `${selectedDate}_${selectedSlot}_${stu.id}`;
        next[key] = { status: 'present', reason: '' };
      });
      return next;
    });
  };

  // Enregistrer et verrouiller la session
  const handleSaveAndLock = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(lockKey, 'true');
      } catch (e) {
        // ignore
      }
    }
    setIsSessionLocked(true);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 5000);
  };

  // Confirmer le déverrouillage avec motif
  const handleConfirmUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockReason.trim()) return;

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(lockKey);
      } catch (e) {
        // ignore
      }
    }
    setIsSessionLocked(false);
    setShowUnlockModal(false);
    setUnlockReason('');
    setUnlockTeacherName('');
  };

  // Créneau actif
  const currentSlotObj = useMemo(() => {
    return timeSlots.find((s) => s.id === selectedSlot) || timeSlots[0];
  }, [selectedSlot]);

  // Filtrage des élèves
  const filteredStudents = useMemo(() => {
    return classStudents.filter((stu) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        stu.fullName.toLowerCase().includes(q) ||
        stu.matricule.toLowerCase().includes(q) ||
        stu.studentNumber.toLowerCase().includes(q);

      const key = `${selectedDate}_${selectedSlot}_${stu.id}`;
      const record = attendanceMap[key] || { status: 'present', reason: '' };
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [classStudents, searchQuery, selectedDate, selectedSlot, attendanceMap, statusFilter]);

  // Statistiques du créneau
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;

    classStudents.forEach((stu) => {
      const key = `${selectedDate}_${selectedSlot}_${stu.id}`;
      const rec = attendanceMap[key];
      if (rec?.status === 'absent') absent++;
      else if (rec?.status === 'late') late++;
      else present++;
    });

    const total = classStudents.length;
    const rate = total > 0 ? (((present + late) / total) * 100).toFixed(0) : '100';

    return { total, present, absent, late, rate };
  }, [classStudents, selectedDate, selectedSlot, attendanceMap]);

  // Générateur de message WhatsApp DISTINCT pour Retard vs Absence
  const generateParentWhatsAppUrl = (stu: Student, isLate: boolean, customReason: string) => {
    const parentPhone = (stu.whatsappPhone || stu.guardianPhone || '').replace(/\D/g, '');
    const cleanPhone = parentPhone.startsWith('225') ? parentPhone : `225${parentPhone}`;
    const dateFormatted = formatDate(selectedDate);

    let text = '';

    if (isLate) {
      text =
        `*⚠️ ${currentSchool.name.toUpperCase()} — NOTIFICATION DE RETARD SCOLAIRE*\n\n` +
        `Bonjour Cher Parent (${stu.guardianName}),\n\n` +
        `Nous vous informons par la présente que votre enfant *${stu.fullName}* (Classe de *${stu.grade}*) est arrivé(e) en *RETARD* le *${dateFormatted}* lors du cours de *${currentSlotObj.label}* (*${currentSlotObj.time}*)${
          customReason ? ` — Détail / Motif : ${customReason}` : ''
        }.\n\n` +
        `📞 Merci de sensibiliser votre enfant sur l'importance du respect des horaires et de la ponctualité aux cours.\n` +
        `Vie Scolaire : ${currentSchool.phone || '+225 27 22 44 11 00'}.\n\n` +
        `_Direction des Études — ${currentSchool.shortName || currentSchool.name}_`;
    } else {
      text =
        `*⚠️ ${currentSchool.name.toUpperCase()} — NOTIFICATION D'ABSENCE SCOLAIRE*\n\n` +
        `Bonjour Cher Parent (${stu.guardianName}),\n\n` +
        `Nous vous informons par la présente que votre enfant *${stu.fullName}* (Classe de *${stu.grade}*) a été marqué(e) *ABSENT(E)* le *${dateFormatted}* lors du cours de *${currentSlotObj.label}* (*${currentSlotObj.time}*)${
          customReason ? ` — Motif : ${customReason}` : ''
        }.\n\n` +
        `📞 Merci de contacter immédiatement la Vie Scolaire au ${
          currentSchool.phone || '+225 27 22 44 11 00'
        } afin de justifier cette absence.\n\n` +
        `_Direction des Études — ${currentSchool.shortName || currentSchool.name}_`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Présences & Absences (Collège & Lycée)
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Pointage horaire des cours, alertes WhatsApp ciblées (Retards & Absences) — {currentSchool.name}
          </p>
        </div>

        {/* Actions Rapides & Verrouillage */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isSessionLocked ? (
            <>
              <button
                type="button"
                onClick={markAllPresent}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tous Présents</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndLock}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Valider & Verrouiller l&apos;Appel</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Appel Validé & Verrouillé ({currentSlotObj.label})</span>
              </span>

              <button
                type="button"
                onClick={() => setShowUnlockModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-all cursor-pointer"
                title="Demander une autorisation pour modifier"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-700" />
                <span>Demander Déverrouillage</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Alerte de confirmation de sauvegarde */}
      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              La feuille d&apos;appel de la classe <strong>{selectedClass}</strong> pour le créneau <strong>{currentSlotObj.label}</strong> ({formatDate(selectedDate)}) a été validée, sauvegardée et sécurisée avec succès !
            </span>
          </div>
          <button type="button" onClick={() => setSavedSuccess(false)} className="text-emerald-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 2. Sélection du Créneau Horaire & Date Picker Élégant */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>1. Choisissez la date et le créneau horaire du cours :</span>
          </span>

          {/* SÉLECTEUR DE DATE FRANÇAIS HAUT DE GAMME */}
          <div className="w-full sm:w-60">
            <FrenchDateInput
              value={selectedDate}
              onChange={setSelectedDate}
              placeholder="Date de l'appel (JJ/MM/AAAA)"
            />
          </div>
        </div>

        {/* 4 Boutons de Créneaux */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {timeSlots.map((slot) => {
            const isSelected = selectedSlot === slot.id;
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSelectedSlot(slot.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div>
                  <span className="text-xs font-black block font-heading">{slot.label}</span>
                  <span className={`text-[10.5px] block ${isSelected ? 'text-emerald-300' : 'text-slate-500'}`}>
                    {slot.period} ({slot.time})
                  </span>
                </div>
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 border border-slate-200'
                  }`}
                >
                  ✓
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Sélection du Cycle & de la Classe */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Cycle Header */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          {[
            { id: 'college', label: 'Cycle Secondaire / Collège (6ème à 3ème)', icon: Building2 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <div
                key={tab.id}
                className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-emerald-600 text-white shadow-2xs"
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </div>
            );
          })}
        </div>

        {/* Classes Buttons */}
        <div>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
            2. Choisissez la Classe pour l&apos;Appel :
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {displayedClasses.map((cls) => {
              const countInClass = students.filter((s) => s.grade === cls).length;
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
      </div>

      {/* 4. Statistiques de l'Appel sur ce créneau */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Effectif Classe</span>
          <span className="text-2xl font-black text-slate-950 font-heading">{stats.total} élèves</span>
          <span className="text-[10px] text-slate-500 block">{selectedClass} • {currentSlotObj.label}</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Présents en classe</span>
          <span className="text-2xl font-black text-emerald-900 font-heading">{stats.present} élèves</span>
          <span className="text-[10px] text-emerald-700 block">{stats.rate}% Taux de présence</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-xs bg-rose-50/20">
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">Absents Signalés</span>
          <span className="text-2xl font-black text-rose-900 font-heading">{stats.absent} absents</span>
          <span className="text-[10px] text-rose-700 font-bold block">Alerte WhatsApp Absence</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs bg-amber-50/20">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Retards Constatés</span>
          <span className="text-2xl font-black text-amber-900 font-heading">{stats.late} retards</span>
          <span className="text-[10px] text-amber-700 font-bold block">Alerte WhatsApp Retard</span>
        </div>
      </div>

      {/* 5. Feuille d'Appel Interactive */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 font-heading">
                Feuille d&apos;Appel — {selectedClass} • {currentSlotObj.label} ({formatDate(selectedDate)})
              </h2>
              {isSessionLocked && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  🔒 Verrouillée
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {isSessionLocked
                ? 'Cette session a été validée. Pour modifier les présences, demandez une autorisation de réouverture.'
                : 'Pointez chaque élève en 1 clic. Des alertes WhatsApp distinctes sont générées pour les absences et les retards.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher élève..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="all">Tous statuts</option>
              <option value="present">Présents uniquement</option>
              <option value="absent">Absents uniquement</option>
              <option value="late">Retards uniquement</option>
            </select>
          </div>
        </div>

        {/* Tableau d'Appel */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 pl-6 pr-3 w-12 text-center">N°</th>
                <th className="py-3.5 px-3">Matricule & Élève</th>
                <th className="py-3.5 px-3 text-center">Genre</th>
                <th className="py-3.5 px-3 text-center min-w-[260px]">Statut d&apos;Appel du Cours</th>
                <th className="py-3.5 px-3">Observation / Motif</th>
                <th className="py-3.5 pr-6 px-3 text-center min-w-[200px]">Alerte Immédiate Parent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Aucun élève trouvé pour la classe {selectedClass}.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu, idx) => {
                  const key = `${selectedDate}_${selectedSlot}_${stu.id}`;
                  const record = attendanceMap[key] || { status: 'present', reason: '' };
                  const isAbsent = record.status === 'absent';
                  const isLate = record.status === 'late';
                  const isPresent = record.status === 'present';

                  return (
                    <tr
                      key={stu.id}
                      className={`transition-colors ${
                        isAbsent ? 'bg-rose-50/40' : isLate ? 'bg-amber-50/30' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* N° d'ordre */}
                      <td className="py-3.5 pl-6 pr-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>

                      {/* Élève */}
                      <td className="py-3.5 px-3">
                        <span className="font-extrabold text-slate-950 block font-heading uppercase text-xs">
                          {stu.fullName}
                        </span>
                        <span className="font-mono text-[10.5px] text-slate-400 font-medium">
                          {stu.studentNumber} • {stu.matricule}
                        </span>
                      </td>

                      {/* Genre */}
                      <td className="py-3.5 px-3 text-center">
                        <GenderBadge gender={stu.gender} />
                      </td>

                      {/* 3 Boutons de statut Présent / Absent / Retard */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 gap-1">
                          {/* Présent */}
                          <button
                            type="button"
                            disabled={isSessionLocked}
                            onClick={() => setStudentStatus(stu.id, 'present')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isSessionLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                            } flex items-center gap-1 ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Présent</span>
                          </button>

                          {/* Absent */}
                          <button
                            type="button"
                            disabled={isSessionLocked}
                            onClick={() => setStudentStatus(stu.id, 'absent')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isSessionLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                            } flex items-center gap-1 ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </button>

                          {/* Retard */}
                          <button
                            type="button"
                            disabled={isSessionLocked}
                            onClick={() => setStudentStatus(stu.id, 'late')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isSessionLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                            } flex items-center gap-1 ${
                              isLate
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Retard</span>
                          </button>
                        </div>
                      </td>

                      {/* Observation */}
                      <td className="py-3.5 px-3">
                        {isAbsent || isLate ? (
                          <input
                            type="text"
                            disabled={isSessionLocked}
                            value={record.reason}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAttendanceMap((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], reason: val },
                              }));
                            }}
                            placeholder={isAbsent ? 'Motif d’absence...' : 'Minutes de retard / motif...'}
                            className={`w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500/20 ${
                              isSessionLocked ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''
                            }`}
                          />
                        ) : (
                          <span className="text-slate-400 text-xs italic">Présent au cours</span>
                        )}
                      </td>

                      {/* Bouton d'Alerte WhatsApp DISTINCT pour Retard ou Absence */}
                      <td className="py-3.5 pr-6 px-3 text-center">
                        {isAbsent ? (
                          <a
                            href={generateParentWhatsAppUrl(stu, false, record.reason)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-600/30 transition-all cursor-pointer"
                            title="Alerter le parent de l'absence par WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Alerter Absence (WhatsApp)</span>
                          </a>
                        ) : isLate ? (
                          <a
                            href={generateParentWhatsAppUrl(stu, true, record.reason)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 border border-amber-400 shadow-sm shadow-amber-500/20 transition-all cursor-pointer"
                            title="Notifier le retard au parent par WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-amber-800" />
                            <span>Notifier Retard (WhatsApp)</span>
                          </a>
                        ) : (
                          <span className="text-emerald-700 text-xs font-medium flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Conforme</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODALE DE DEMANDE DE DÉVERROUILLAGE / SÉCURITÉ ================= */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 font-heading">
                    Déverrouillage Sécurisé de l&apos;Appel
                  </h3>
                  <p className="text-xs text-slate-500">
                    Session {currentSlotObj.label} • {selectedClass}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmUnlock} className="space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
                Par mesure de sécurité administrative et d&apos;intégrité des données, toute modification d&apos;une feuille d&apos;appel déjà clôturée doit être justifiée.
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  Nom de l&apos;Enseignant / Responsable :
                </label>
                <input
                  type="text"
                  required
                  value={unlockTeacherName}
                  onChange={(e) => setUnlockTeacherName(e.target.value)}
                  placeholder="Ex : M. KOUAMÉ Kouadio (Professeur de Mathématiques)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500/20 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  Motif de la rectification d&apos;appel :
                </label>
                <textarea
                  required
                  rows={3}
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="Ex : Arrivée tardive justifiée d'un élève avec billet de la Vie Scolaire..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500/20 font-medium resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/30 transition-all cursor-pointer"
                >
                  Valider la Réouverture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
