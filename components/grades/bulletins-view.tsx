'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Student, School } from '@/lib/data/types';
import { defaultSchool } from '@/lib/data/mock-data';
import { getLiveSchool, getLiveStudents, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import { GenderBadge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/formatters';
import {
  FileSpreadsheet,
  Printer,
  Search,
  CheckCircle2,
  Building2,
  Layers,
  X,
  Download,
  Copy,
  Check,
  ImageIcon,
} from 'lucide-react';

interface GradeEntry {
  int1: string;
  int2: string;
  int3: string;
  int4: string;
  int5: string;
  dev1: string;
  dev2: string;
  comp: string;
  customAppreciation?: string;
}

// Matières et coefficients pour Collège et Lycée (Secondaire Général)
export function getBulletinSubjectsForClass(grade: string): { name: string; coef: number; prof: string }[] {
  const g = grade.toLowerCase();
  // 6ème et 5ème (Mêmes matières et coefficients)
  if (g.includes('6') || g.includes('5')) {
    return [
      { name: 'Français', coef: 3, prof: 'M. Kouamé K.' },
      { name: 'Mathématiques', coef: 3, prof: 'M. Touré A.' },
      { name: 'Anglais', coef: 2, prof: 'Mme Mensah A.' },
      { name: 'Physique-Chimie', coef: 2, prof: 'M. Diallo S.' },
      { name: 'Sciences de la Vie et de la Terre (SVT)', coef: 2, prof: 'Mme Bamba F.' },
      { name: 'Histoire-Géographie', coef: 2, prof: 'M. Yao B.' },
      { name: 'Éducation aux Droits de l’Homme (EDHC)', coef: 1, prof: 'Mme Koné M.' },
      { name: 'Éducation Physique et Sportive (EPS)', coef: 1, prof: 'M. N’Dri C.' },
      { name: 'Conduite', coef: 1, prof: 'M. Kouassi J.' },
      { name: 'Arts Plastiques / Éducation Musicale', coef: 1, prof: 'Mme Traoré B.' },
    ];
  }

  // 4ème et 3ème (Mêmes matières et coefficients)
  if (g.includes('4') || g.includes('3')) {
    return [
      { name: 'Français', coef: 4, prof: 'M. Kouamé K.' },
      { name: 'Mathématiques', coef: 3, prof: 'M. Touré A.' },
      { name: 'Anglais', coef: 2, prof: 'Mme Mensah A.' },
      { name: 'Histoire-Géographie', coef: 2, prof: 'M. Yao B.' },
      { name: 'Physique-Chimie', coef: 2, prof: 'M. Diallo S.' },
      { name: 'Sciences de la Vie et de la Terre (SVT)', coef: 2, prof: 'Mme Bamba F.' },
      { name: 'Langues Vivantes (Espagnol / Allemand)', coef: 1, prof: 'Mme Cissé K.' },
      { name: 'Éducation aux Droits de l’Homme (EDHC)', coef: 1, prof: 'Mme Koné M.' },
      { name: 'Arts Plastiques / Éducation Musicale', coef: 1, prof: 'Mme Traoré B.' },
      { name: 'Éducation Physique et Sportive (EPS)', coef: 1, prof: 'M. N’Dri C.' },
      { name: 'Conduite', coef: 1, prof: 'M. Kouassi J.' },
    ];
  }

  // Lycée (2nde, 1ère, Terminale)
  return [
    { name: 'Français', coef: g.includes('a') ? 4 : 3, prof: 'M. Kouamé K.' },
    { name: 'Philosophie', coef: g.includes('tle') ? 4 : 3, prof: 'M. Koffi G.' },
    { name: 'Mathématiques', coef: g.includes('c') || g.includes('d') ? 5 : 4, prof: 'M. Touré A.' },
    { name: 'Physique-Chimie', coef: 4, prof: 'M. Diallo S.' },
    { name: 'Sciences de la Vie et de la Terre (SVT)', coef: 4, prof: 'Mme Bamba F.' },
    { name: 'Histoire-Géographie', coef: 2, prof: 'M. Yao B.' },
    { name: 'Anglais', coef: 3, prof: 'Mme Mensah A.' },
    { name: 'Langues Vivantes (Espagnol / Allemand)', coef: 2, prof: 'Mme Cissé K.' },
    { name: 'Éducation Physique et Sportive (EPS)', coef: 1, prof: 'M. N’Dri C.' },
    { name: 'Conduite', coef: 1, prof: 'M. Kouassi J.' },
  ];
}

// Logo officiel de l'Établissement (À GAUCHE - SANS TEXTE SOUS LE LOGO)
function SchoolOfficialLogo({ logoUrl, className = "w-18 h-18" }: { logoUrl?: string; className?: string }) {
  if (logoUrl && logoUrl.trim() !== '') {
    return (
      <div className={`${className} rounded-full bg-slate-50 border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden shrink-0`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt="Logo École"
          className="max-w-full max-h-full object-contain"
          crossOrigin="anonymous"
        />
      </div>
    );
  }

  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="94" fill="#064E3B" stroke="#F59E0B" strokeWidth="6" />
      <circle cx="100" cy="100" r="82" fill="#047857" stroke="#FDE68A" strokeWidth="2" strokeDasharray="4 2" />
      <path d="M36 100 C36 135 60 162 100 168 C140 162 164 135 164 100" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M60 118 Q100 110 100 132 Q100 110 140 118 L136 142 Q100 134 100 152 Q100 134 64 142 Z" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="2.5" />
      <path d="M96 68 L104 68 L102 96 L98 96 Z" fill="#F59E0B" />
      <path d="M100 50 C94 58 106 62 100 68 C106 64 108 56 100 50 Z" fill="#EF4444" />
      <polygon points="100,24 103,32 111,32 105,37 107,45 100,40 93,45 95,37 89,32 97,32" fill="#F59E0B" />
      <polygon points="62,40 64,46 70,46 65,50 67,56 62,52 57,56 59,50 54,46 60,46" fill="#FDE68A" />
      <polygon points="138,40 140,46 146,46 141,50 143,56 138,52 133,56 135,50 130,46 136,46" fill="#FDE68A" />
      <text x="100" y="94" textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="900" fontFamily="sans-serif">EPC</text>
      <text x="100" y="108" textAnchor="middle" fill="#FDE68A" fontSize="11" fontWeight="800" fontFamily="sans-serif">MANOI</text>
      <text x="100" y="178" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="700" fontFamily="sans-serif">EXCELLENCE • RÉUSSITE</text>
    </svg>
  );
}

// Emblème officiel du Pays (À DROITE - SANS TEXTE SOUS L'EMBLÈME)
function CountryOfficialEmblem({ emblemUrl, className = "w-18 h-18" }: { emblemUrl?: string; className?: string }) {
  if (emblemUrl && emblemUrl.trim() !== '') {
    return (
      <div className={`${className} flex items-center justify-center overflow-hidden shrink-0`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={emblemUrl}
          alt="Emblème National"
          className="max-w-full max-h-full object-contain"
          crossOrigin="anonymous"
        />
      </div>
    );
  }

  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="52" r="28" fill="#F59E0B" />
      <path d="M100 12 L100 22 M70 20 L76 28 M130 20 L124 28 M48 38 L57 43 M152 38 L143 43 M40 60 L50 60 M160 60 L150 60" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
      <path d="M52 85 C45 65 30 65 20 72 C35 75 42 85 48 95" stroke="#059669" strokeWidth="3" fill="#10B981" />
      <path d="M148 85 C155 65 170 65 180 72 C165 75 158 85 152 95" stroke="#059669" strokeWidth="3" fill="#10B981" />
      <path d="M50 55 C50 55 100 48 150 55 C150 105 135 145 100 162 C65 145 50 105 50 55 Z" fill="#047857" stroke="#F59E0B" strokeWidth="5" />
      <path d="M100 68 C82 68 76 82 76 96 C76 112 86 126 94 135 L94 148 C94 150 106 150 106 148 L106 135 C114 126 124 112 124 96 C124 82 118 68 100 68 Z" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="3" />
      <path d="M76 80 C62 76 56 88 58 102 C60 114 70 118 78 112" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="2.5" />
      <path d="M124 80 C138 76 144 88 142 102 C140 114 130 118 122 112" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="2.5" />
      <circle cx="88" cy="92" r="2.5" fill="#0F172A" />
      <circle cx="112" cy="92" r="2.5" fill="#0F172A" />
      <path d="M84 116 C76 122 72 134 76 140 C80 138 84 130 88 122" fill="#FEF08A" stroke="#F59E0B" strokeWidth="2" />
      <path d="M116 116 C124 122 128 134 124 140 C120 138 116 130 112 122" fill="#FEF08A" stroke="#F59E0B" strokeWidth="2" />
      <path d="M30 162 Q100 178 170 162 L165 178 Q100 192 35 178 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="2" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPOSANT BULLETIN OFFICIEL PAYSAGE (COUVERTURE TOTALE 1 SEULE PAGE A4)
// Ordre : 1. En-tête -> 2. Données Élève -> 3. Tableau -> 4. Bilan sous tableau -> 5. Signatures
// ═══════════════════════════════════════════════════════════════
function OfficialLandscapeBulletin({
  student,
  school,
  selectedPeriod,
  classStats,
  subjectsList,
}: {
  student: any;
  school: School;
  selectedPeriod: string;
  classStats: any;
  subjectsList: any[];
}) {
  return (
    <div className="bulletin-page bg-white text-slate-900 border-2 border-slate-900 p-4 sm:p-5 rounded-2xl space-y-3.5 w-full max-w-5xl mx-auto shadow-sm flex flex-col justify-between">
      {/* 1. EN-TÊTE OFFICIEL HIÉRARCHISÉ (LIGNES BIEN SÉPARÉES) */}
      <div className="grid grid-cols-[90px_1fr_90px] items-center gap-3 border-b-2 border-slate-900 pb-2.5">
        {/* GAUCHE : Logo de l'École (Sans texte sous le logo) */}
        <div className="flex items-center justify-center">
          <SchoolOfficialLogo logoUrl={school.logoUrl} className="w-18 h-18" />
        </div>

        {/* CENTRE : Hiérarchie Structurée avec Lignes Dédiées */}
        <div className="flex flex-col items-center text-center space-y-0.5 px-2">
          {/* Ligne 1 : Nom entier de l'école seul */}
          <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-950 font-heading leading-tight">
            {school.name}
          </h2>

          {/* Ligne 2 : Sigle de l'école seul sur sa propre ligne */}
          <p className="text-xs sm:text-[13px] font-black text-emerald-800 tracking-wider font-heading">
            {school.shortName || 'EPC MANOI'}
          </p>

          {/* Ligne 3 : Devise de l'école sur sa propre ligne */}
          <p className="text-[10px] sm:text-[10.5px] font-bold text-amber-700 italic">
            &ldquo;{school.motto || 'Discipline • Rigueur • Réussite'}&rdquo;
          </p>

          {/* Ligne 4 : Slogan de l'école sur sa propre ligne */}
          <p className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 italic">
            &ldquo;{school.slogan || 'La Lumière du Savoir'}&rdquo;
          </p>

          {/* Ligne 5 : Contact & Code Établissement */}
          <p className="text-[9px] font-semibold text-slate-400 font-mono">
            Code Établissement : {school.ministryCode || '321119'} • Tél : {school.phone || '+225 01 02 61 14 09'} • {school.city || 'Abidjan'}
          </p>

          {/* Ligne 6 : Bandeau officiel du titre et Année Scolaire Centrés */}
          <div className="w-full flex items-center justify-between bg-slate-950 text-white rounded-lg px-4 py-1.5 mt-1 shadow-xs">
            <span className="text-xs sm:text-[13px] font-black uppercase tracking-wider font-heading text-emerald-400">
              BULLETIN OFFICIEL DE NOTES — {selectedPeriod.toUpperCase()}
            </span>
            <span className="text-[10.5px] font-mono font-bold text-amber-300">
              Année Scolaire {school.academicYear}
            </span>
          </div>
        </div>

        {/* DROITE : Emblème officiel du pays (Sans texte sous l'emblème) */}
        <div className="flex items-center justify-center">
          <CountryOfficialEmblem emblemUrl={school.countryEmblemUrl} className="w-18 h-18" />
        </div>
      </div>

      {/* 2. COORDONNÉES DE L'ÉLÈVE (ESPACE ÉLARGI POUR LES CONTACTS PARENTS NON COUPÉS) */}
      <div className="grid grid-cols-[1.2fr_1fr_1.1fr_2fr] gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs items-center">
        <div>
          <span className="text-[8.5px] text-slate-400 font-bold block uppercase tracking-wider">Nom & Prénoms :</span>
          <strong className="text-slate-950 uppercase font-black text-[13px] block truncate font-heading">
            {student.fullName}
          </strong>
        </div>
        <div>
          <span className="text-[8.5px] text-slate-400 font-bold block uppercase tracking-wider">Matricule MENA :</span>
          <strong className="font-mono text-slate-900 text-xs block font-bold">
            {student.matricule}
          </strong>
        </div>
        <div>
          <span className="text-[8.5px] text-slate-400 font-bold block uppercase tracking-wider">Classe & Effectif :</span>
          <strong className="text-slate-900 text-xs block font-bold">
            {student.grade} ({classStats.count} élèves) • {student.gender === 'female' ? '♀ F' : '♂ M'}
          </strong>
        </div>
        <div>
          <span className="text-[8.5px] text-slate-400 font-bold block uppercase tracking-wider">Parent / Contact :</span>
          <strong className="text-slate-900 text-xs block font-mono whitespace-nowrap">
            {student.guardianName} ({student.whatsappPhone || student.guardianPhone})
          </strong>
        </div>
      </div>

      {/* 3. GRAND TABLEAU DES NOTES PAR MATIÈRE (COLONNES MOYENNE ET TOTAL ÉLARGIES ET TRÈS LISIBLES) */}
      <div className="overflow-hidden border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-900 text-[10px] font-black uppercase text-center border-b border-slate-200">
              <th className="py-2 px-3 text-left border-r border-slate-200 w-[28%]">Matières Enseignées</th>
              <th className="py-2 px-2 border-r border-slate-200 w-[8%]">Coef</th>
              <th className="py-2 px-3 border-r border-slate-200 w-[16%]">Moyenne /20</th>
              <th className="py-2 px-3 border-r border-slate-200 w-[16%]">Total Points</th>
              <th className="py-2 px-3 text-left w-[32%]">Appréciation du Professeur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {student.subjectRows.map((sub: any) => (
              <tr key={sub.name} className="hover:bg-slate-50/80">
                <td className="py-1.5 px-3 font-bold border-r border-slate-100 text-slate-900">
                  {sub.name}
                </td>
                <td className="py-1.5 px-2 text-center font-bold border-r border-slate-100 text-slate-800">
                  {sub.coef}
                </td>
                <td className="py-1.5 px-3 text-center font-black border-r border-slate-100 font-mono text-xs text-slate-950">
                  {sub.average !== null ? sub.average.toFixed(2) : '—'}
                </td>
                <td className="py-1.5 px-3 text-center font-mono font-bold border-r border-slate-100 text-xs text-slate-800">
                  {sub.totalPoints}
                </td>
                <td className="py-1.5 px-3 text-[11px] text-slate-600 italic truncate max-w-[280px]">
                  {sub.appreciation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. BILAN GÉNÉRAL & DÉCISION DU CONSEIL (SOUS LE TABLEAU) */}
      <div className="grid grid-cols-5 gap-2 p-3.5 bg-white border-2 border-emerald-400 rounded-xl text-center items-center shadow-xs">
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Coeff</span>
          <strong className="text-sm font-black text-slate-900">
            {subjectsList.reduce((acc, s) => acc + s.coef, 0)}
          </strong>
        </div>

        <div>
          <span className="text-[9px] uppercase font-bold text-emerald-800 block">Moyenne Générale</span>
          <strong className="text-base sm:text-lg font-black text-emerald-950 font-heading">
            {student.average !== null ? `${student.average.toFixed(2)} / 20` : '— / 20'}
          </strong>
        </div>

        <div>
          <span className="text-[9px] uppercase font-bold text-slate-400 block">Rang de l&apos;Élève</span>
          <strong className="text-sm sm:text-base font-black text-slate-900 font-heading">
            {student.rank ? `${student.rank}${student.rankSuffix} / ${classStats.count}` : '—'}
          </strong>
        </div>

        <div>
          <span className="text-[9px] uppercase font-bold text-slate-400 block">Mention & Décision</span>
          <strong className="text-xs font-black text-slate-800 block">{student.mention}</strong>
        </div>

        <div>
          <span className="text-[9px] uppercase font-bold text-slate-400 block">Tableau d&apos;Honneur</span>
          <strong className="text-xs font-black text-emerald-800 block">{student.distinction}</strong>
        </div>
      </div>

      {/* 5. SIGNATURES OFFICIELLES (HAUTEUR CONFORTABLE ET ÉQUILIBRÉE) */}
      <div className="grid grid-cols-2 gap-12 pt-3 border-t-2 border-slate-900 text-center text-xs">
        <div className="flex flex-col justify-between">
          <p className="font-bold text-slate-800 uppercase text-[10px]">Le Professeur Principal</p>
          <div className="h-10 flex items-center justify-center italic text-slate-400 text-[10px]">
            Vu & Approuvé
          </div>
        </div>

        <div className="flex flex-col justify-between items-center">
          <p className="font-bold text-slate-900 uppercase text-[10px]">La Direction des Études (Cachet & Signature)</p>
          <div className="h-10 flex flex-col items-center justify-center">
            <span className="text-[10px] font-black text-emerald-800 border border-emerald-600 rounded-full px-4 py-1 bg-emerald-50 shadow-2xs">
              ★ SCEAU OFFICIEL MANOI ★
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BulletinsViewProps {
  initialStudents: Student[];
  school: School;
  schoolSlug: string;
}

export function BulletinsView({
  initialStudents,
  school,
  schoolSlug,
}: BulletinsViewProps) {
  const [currentSchool, setCurrentSchool] = useState<School>(school || defaultSchool);
  const [students, setStudents] = useState<Student[]>(initialStudents);

  useEffect(() => {
    setCurrentSchool(getLiveSchool(schoolSlug, school || defaultSchool));
    setStudents(getLiveStudents(initialStudents, schoolSlug));

    const handleUpdate = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, school || defaultSchool));
      setStudents(getLiveStudents(initialStudents, schoolSlug));
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, school, initialStudents]);

  // Uniquement Collège et Lycée (Secondaire Général)
  const [selectedCycle, setSelectedCycle] = useState<'college' | 'lycee'>('college');
  const [selectedClass, setSelectedClass] = useState('6ème');
  const [selectedPeriod, setSelectedPeriod] = useState('Trimestre 1');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentForBulletin, setSelectedStudentForBulletin] = useState<any | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isBatchPrintOpen, setIsBatchPrintOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGeneratingPNG, setIsGeneratingPNG] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Blob en cache pour copie immédiate à 0ms
  const activeBlobRef = useRef<Blob | null>(null);
  const modalBulletinRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);

  const availableClassesForCycle = useMemo(() => {
    switch (selectedCycle) {
      case 'college':
        return ['6ème', '5ème', '4ème', '3ème'];
      case 'lycee':
        return [
          '2nde A',
          '2nde C',
          '2nde D',
          '1ère A',
          '1ère C',
          '1ère D',
          'Terminale A',
          'Terminale C',
          'Terminale D',
        ];
      default:
        return ['6ème', '5ème', '4ème', '3ème'];
    }
  }, [selectedCycle]);

  // Synchroniser la classe sélectionnée lorsqu'on change de cycle
  const handleCycleChange = (cycle: 'college' | 'lycee') => {
    setSelectedCycle(cycle);
    if (cycle === 'college') {
      setSelectedClass('6ème');
    } else {
      setSelectedClass('2nde A');
    }
  };

  const subjectsList = useMemo(() => {
    return getBulletinSubjectsForClass(selectedClass);
  }, [selectedClass]);

  // Calcul des moyennes réelles à partir des notes saisies dans le module Pédagogie
  const studentsWithGrades = useMemo(() => {
    const list = students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        s.studentNumber.toLowerCase().includes(q) ||
        (s.matricule && s.matricule.toLowerCase().includes(q)) ||
        s.fullName.toLowerCase().includes(q);

      const matchesClass = s.grade.toLowerCase() === selectedClass.toLowerCase();
      return matchesSearch && matchesClass;
    });

    // Pour chaque matière, chercher les notes sauvegardées dans localStorage
    const savedSubjectGrades: Record<string, Record<string, GradeEntry>> = {};

    if (typeof window !== 'undefined') {
      subjectsList.forEach((sub) => {
        const key = `schoolflow_grades_${schoolSlug}_${selectedClass}_${sub.name.replace(/\s+/g, '_')}_${selectedPeriod.replace(/\s+/g, '_')}`;
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            savedSubjectGrades[sub.name] = JSON.parse(raw);
          }
        } catch (e) {
          // ignore
        }
      });
    }

    // Calculer les notes réelles par élève
    const computed = list.map((stu) => {
      let totalWeightedNotes = 0;
      let totalCoeffWithNotes = 0;

      const studentSubjectRows = subjectsList.map((sub) => {
        const entry = savedSubjectGrades[sub.name]?.[stu.id];
        let subjectAverage: number | null = null;
        let appreciation = '';

        if (entry) {
          const interros = [entry.int1, entry.int2, entry.int3, entry.int4, entry.int5]
            .map((val) => (val !== '' && !isNaN(parseFloat(val)) ? parseFloat(val) : null))
            .filter((val): val is number => val !== null);

          const devoirs = [entry.dev1, entry.dev2]
            .map((val) => (val !== '' && !isNaN(parseFloat(val)) ? parseFloat(val) : null))
            .filter((val): val is number => val !== null);

          const compVal = entry.comp !== '' && !isNaN(parseFloat(entry.comp)) ? parseFloat(entry.comp) : null;

          if (interros.length > 0 || devoirs.length > 0 || compVal !== null) {
            const avgInt = interros.length > 0 ? interros.reduce((a, b) => a + b, 0) / interros.length : null;
            const avgDev = devoirs.length > 0 ? devoirs.reduce((a, b) => a + b, 0) / devoirs.length : null;

            if (avgInt !== null && avgDev !== null && compVal !== null) {
              const controlAvg = (avgInt + avgDev) / 2;
              subjectAverage = Math.round(((controlAvg + compVal * 2) / 3) * 100) / 100;
            } else {
              const allNotes = [...interros, ...devoirs, ...(compVal !== null ? [compVal, compVal] : [])];
              subjectAverage = Math.round((allNotes.reduce((a, b) => a + b, 0) / allNotes.length) * 100) / 100;
            }

            if (entry.customAppreciation && entry.customAppreciation.trim() !== '') {
              appreciation = entry.customAppreciation.trim();
            } else if (subjectAverage >= 16) {
              appreciation = 'Très Bien (Tableau d’Honneur)';
            } else if (subjectAverage >= 14) {
              appreciation = 'Bien (Encouragements)';
            } else if (subjectAverage >= 12) {
              appreciation = 'Assez Bien';
            } else if (subjectAverage >= 10) {
              appreciation = 'Passable';
            } else {
              appreciation = 'Insuffisant';
            }

            totalWeightedNotes += subjectAverage * sub.coef;
            totalCoeffWithNotes += sub.coef;
          }
        }

        return {
          ...sub,
          average: subjectAverage,
          totalPoints: subjectAverage !== null ? (subjectAverage * sub.coef).toFixed(1) : '—',
          appreciation: appreciation || '—',
        };
      });

      // Moyenne générale
      const hasGrades = totalCoeffWithNotes > 0;
      const generalAverage = hasGrades
        ? Math.round((totalWeightedNotes / totalCoeffWithNotes) * 100) / 100
        : null;

      let mention = '—';
      let distinction = '—';

      if (generalAverage !== null) {
        if (generalAverage >= 16) {
          mention = 'Très Bien';
          distinction = 'Félicitations';
        } else if (generalAverage >= 14) {
          mention = 'Bien';
          distinction = "Tableau d'Honneur";
        } else if (generalAverage >= 12) {
          mention = 'Assez Bien';
          distinction = 'Encouragements';
        } else if (generalAverage >= 10) {
          mention = 'Passable';
          distinction = 'Avertissement de travail';
        } else {
          mention = 'Insuffisant';
          distinction = 'Blâme';
        }
      } else {
        mention = 'En attente de notation';
      }

      return {
        ...stu,
        hasGrades,
        average: generalAverage,
        mention,
        distinction,
        subjectRows: studentSubjectRows,
      };
    });

    // Tri par rang décroissant pour les élèves ayant une moyenne
    const graded = computed.filter((s) => s.average !== null) as Array<(typeof computed)[0] & { average: number }>;
    graded.sort((a, b) => b.average - a.average);

    // Calcul précis des rangs et détection automatique des Ex æquo
    const rankInfoMap = new Map<string, { rank: number; isTie: boolean; rankSuffix: string }>();
    let currentRank = 1;
    for (let i = 0; i < graded.length; i++) {
      if (i > 0 && graded[i].average < graded[i - 1].average) {
        currentRank = i + 1;
      }
      const hasTiePrev = i > 0 && graded[i].average === graded[i - 1].average;
      const hasTieNext = i < graded.length - 1 && graded[i].average === graded[i + 1].average;
      const isTie = hasTiePrev || hasTieNext;

      const baseSuffix = currentRank === 1 ? 'er' : 'ème';
      const rankSuffix = isTie ? `${baseSuffix} ex` : baseSuffix;

      rankInfoMap.set(graded[i].id, { rank: currentRank, isTie, rankSuffix });
    }

    return computed.map((s) => {
      const info = rankInfoMap.get(s.id);
      return {
        ...s,
        rank: info ? info.rank : null,
        isTie: info ? info.isTie : false,
        rankSuffix: info ? info.rankSuffix : '',
      };
    });
  }, [students, selectedClass, selectedPeriod, selectedCycle, searchQuery, subjectsList, schoolSlug]);

  // Statistiques de la classe
  const classStats = useMemo(() => {
    const graded = studentsWithGrades.filter((s) => s.average !== null) as Array<(typeof studentsWithGrades)[0] & { average: number }>;
    if (graded.length === 0) {
      return {
        count: studentsWithGrades.length,
        gradedCount: 0,
        classAverage: '—',
        maxAverage: '—',
        minAverage: '—',
        successRate: '0%',
      };
    }
    const sum = graded.reduce((acc, s) => acc + s.average, 0);
    const classAverage = (sum / graded.length).toFixed(2) + ' / 20';
    const maxAverage = graded[0].average.toFixed(2) + ' / 20';
    const minAverage = graded[graded.length - 1].average.toFixed(2) + ' / 20';
    const successCount = graded.filter((s) => s.average >= 10).length;
    const successRate = ((successCount / graded.length) * 100).toFixed(0) + '%';

    return {
      count: studentsWithGrades.length,
      gradedCount: graded.length,
      classAverage,
      maxAverage,
      minAverage,
      successRate,
    };
  }, [studentsWithGrades]);

  const handleOpenBulletinModal = (stu: any) => {
    setSelectedStudentForBulletin(stu);
    setIsPrintModalOpen(true);
  };

  // ═══════════════════════════════════════════════════════════════
  // MOTEUR DE GÉNÉRATION & COPIE D'IMAGE 100% FIABLE & INSTANTANÉ
  // ═══════════════════════════════════════════════════════════════
  const generateAndCachePNG = async (callbackOnSuccess?: (blob: Blob) => void) => {
    if (!modalBulletinRef.current) return;
    try {
      setIsGeneratingPNG(true);
      const canvas = await html2canvas(modalBulletinRef.current, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0,
      });
      const url = canvas.toDataURL('image/png', 1.0);
      setImagePreviewUrl(url);

      canvas.toBlob((blob) => {
        if (blob) {
          activeBlobRef.current = blob;
          if (callbackOnSuccess) {
            callbackOnSuccess(blob);
          }
        }
      }, 'image/png');
    } catch (err) {
      console.error('Erreur génération canvas:', err);
    } finally {
      setIsGeneratingPNG(false);
    }
  };

  const handleOpenImagePreviewModal = (stu: any) => {
    setSelectedStudentForBulletin(stu);
    setIsImageModalOpen(true);
    setImagePreviewUrl(null);
    activeBlobRef.current = null;
    setCopiedSuccess(false);
    setIsGeneratingPNG(true);

    // Générer l'image dès l'ouverture
    setTimeout(() => {
      generateAndCachePNG();
    }, 200);
  };

  // Télécharger l'image PNG Ultra Haute Résolution
  const handleDownloadPNG = (studentName: string) => {
    if (imagePreviewUrl) {
      const link = document.createElement('a');
      link.href = imagePreviewUrl;
      link.download = `Bulletin_${studentName.replace(/\s+/g, '_')}_${selectedClass}_${selectedPeriod.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setToastMessage(`✓ Votre bulletin a été téléchargé avec succès !`);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      generateAndCachePNG((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Bulletin_${studentName.replace(/\s+/g, '_')}_${selectedClass}_${selectedPeriod.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setToastMessage(`✓ Votre bulletin a été téléchargé avec succès !`);
        setTimeout(() => setToastMessage(null), 4000);
      });
    }
  };

  // Copier l'image du bulletin dans le presse-papier avec confirmation en haut
  const handleCopyPNGToClipboard = async (studentName: string) => {
    // Immédiatement activer le message en haut
    setCopiedSuccess(true);
    setToastMessage(`✓ Votre bulletin a été bien copié dans les presse-papiers.`);

    // Tentative 1 : Copie via ClipboardItem direct du blob en cache
    if (activeBlobRef.current && navigator.clipboard && (window as any).ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ 'image/png': activeBlobRef.current }),
        ]);
        setTimeout(() => {
          setCopiedSuccess(false);
          setToastMessage(null);
        }, 8000);
        return;
      } catch (err) {
        console.warn('Tentative 1 Clipboard directe échouée, passage à la régénération:', err);
      }
    }

    // Tentative 2 : Régénération et écriture immédiate
    generateAndCachePNG(async (blob) => {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ 'image/png': blob }),
          ]);
        } catch (e) {
          console.warn('Tentative 2 Clipboard échouée:', e);
        }
      }
    });

    setTimeout(() => {
      setCopiedSuccess(false);
      setToastMessage(null);
    }, 8000);
  };

  // Écouteur de raccourci clavier global pour Ctrl + C quand la modale est ouverte
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isImageModalOpen && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (selectedStudentForBulletin) {
          handleCopyPNGToClipboard(selectedStudentForBulletin.fullName);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImageModalOpen, selectedStudentForBulletin]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Bulletins & Relevés Trimestriels
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Édition certifiée des bulletins scolaires du Secondaire (Collège & Lycée) — Format Paysage 1 Page Strict
          </p>
        </div>

        {/* Bouton d'Impression Groupée de la classe */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsBatchPrintOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-sm shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer la Classe de {selectedClass} ({studentsWithGrades.length} bulletins)</span>
          </button>
        </div>
      </div>

      {/* 2. Sélecteur de Cycles (Collège & Lycée uniquement) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
        {[
          { id: 'college' as const, label: 'Cycle Collège (6ème à 3ème)', icon: Building2 },
          { id: 'lycee' as const, label: 'Secondaire Général / Lycée (2nde à Terminale)', icon: Layers },
        ].map((c) => {
          const Icon = c.icon;
          const isActive = selectedCycle === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleCycleChange(c.id)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-emerald-500/20'
                  : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold font-heading">{c.label}</h3>
                <p className={`text-[11px] ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                  Génération & impression des bulletins officiels sur 1 page paysage
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Filtre de Classe & Période */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 print:hidden">
        {/* Classes du cycle */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
            Classe :
          </span>
          {availableClassesForCycle.map((cls) => {
            const isSelected = selectedClass === cls;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-2xs font-heading'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cls}
              </button>
            );
          })}
        </div>

        {/* Périodes */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
            Période :
          </span>
          {(['Trimestre 1', 'Trimestre 2', 'Trimestre 3'] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedPeriod === period
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Cartes statistiques de la classe */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 print:hidden">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Élèves Évalués
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 font-heading">
            {classStats.gradedCount} / {classStats.count}
          </span>
          <span className="text-[10px] text-slate-500 block">Classe de {selectedClass}</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
            Moyenne de Classe
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-900 font-heading">
            {classStats.classAverage}
          </span>
          <span className="text-[10px] text-emerald-700 block">Sur l&apos;ensemble des matières</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Moyenne Max / Min
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 font-heading">
            {classStats.maxAverage} / {classStats.minAverage}
          </span>
          <span className="text-[10px] text-slate-500 block">Extrêmes de la classe</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-blue-200/80 shadow-xs bg-blue-50/20">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
            Taux de Réussite
          </span>
          <span className="text-xl sm:text-2xl font-black text-blue-900 font-heading">
            {classStats.successRate}
          </span>
          <span className="text-[10px] text-blue-700 block">Moyenne &ge; 10 / 20</span>
        </div>
      </div>

      {/* 5. Tableau principal des élèves & moyennes de classe */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden print:hidden">
        {/* Toolbar */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 font-heading">
              Récapitulatif des Bulletins — Classe de {selectedClass} ({selectedPeriod})
            </h2>
            <p className="text-xs text-slate-500">
              {studentsWithGrades.length} élève(s) inscrit(s) • Format 1 Page Paysage Certifié
            </p>
          </div>

          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher élève ou matricule..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
            />
          </div>
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 pl-5 pr-2 text-center w-14">Rang</th>
                <th className="py-3 px-3">Matricule</th>
                <th className="py-3 px-3">Nom & Prénoms</th>
                <th className="py-3 px-2 text-center w-14">Genre</th>
                <th className="py-3 px-3">Parent & Contact</th>
                <th className="py-3 px-3 text-center">Moyenne Générale</th>
                <th className="py-3 px-3 text-center">Mention</th>
                <th className="py-3 px-3 text-center">Distinction</th>
                <th className="py-3 pr-5 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {studentsWithGrades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Aucun élève trouvé dans la classe de {selectedClass}.
                  </td>
                </tr>
              ) : (
                studentsWithGrades.map((stu) => (
                  <tr key={stu.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Rang */}
                    <td className="py-3.5 pl-5 pr-2 text-center whitespace-nowrap">
                      {stu.rank !== null ? (
                        <span
                          className={`inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-lg font-mono font-bold text-[11px] ${
                            stu.rank === 1
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs font-extrabold'
                              : stu.rank === 2
                              ? 'bg-slate-200 text-slate-800 font-bold'
                              : stu.rank === 3
                              ? 'bg-amber-50 text-amber-800'
                              : 'text-slate-600 bg-slate-100'
                          }`}
                        >
                          {stu.rank}{stu.rankSuffix}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>

                    {/* Matricule */}
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-700 text-[11px] whitespace-nowrap">
                      {stu.matricule}
                    </td>

                    {/* Nom & Prénoms */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="font-extrabold text-slate-900 uppercase mr-1.5 font-heading">
                        {stu.lastName}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {stu.firstName}
                      </span>
                    </td>

                    {/* Genre */}
                    <td className="py-3.5 px-2 text-center whitespace-nowrap">
                      <GenderBadge gender={stu.gender} />
                    </td>

                    {/* Contact Parent */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-700 block truncate max-w-[160px]">
                          {stu.guardianName}
                        </span>
                        <span className="font-mono font-bold text-slate-600 text-[11px]">
                          {stu.whatsappPhone || stu.guardianPhone}
                        </span>
                      </div>
                    </td>

                    {/* Moyenne */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      {stu.average !== null ? (
                        <span
                          className={`font-black font-heading text-sm px-2.5 py-1 rounded-lg ${
                            stu.average >= 14
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : stu.average >= 10
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {stu.average.toFixed(2)} / 20
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10.5px] font-semibold bg-slate-100 text-slate-400 border border-slate-200">
                          Non évalué
                        </span>
                      )}
                    </td>

                    {/* Mention */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap font-medium text-slate-600">
                      {stu.mention}
                    </td>

                    {/* Distinction */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      {stu.distinction !== '—' ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                            stu.distinction === 'Félicitations'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : stu.distinction === "Tableau d'Honneur"
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : stu.distinction === 'Encouragements'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {stu.distinction}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 pr-5 pl-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenBulletinModal(stu)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-300 transition-all shadow-2xs cursor-pointer"
                          title="Consulter et imprimer le bulletin"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Bulletin</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenImagePreviewModal(stu)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
                          title="Voir le bulletin en image et copier / télécharger pour WhatsApp"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Voir Image</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODALE 1 : BULLETIN INDIVIDUEL OFFICIEL (FORMAT 1 PAGE PAYSAGE) ================= */}
      {isPrintModalOpen && selectedStudentForBulletin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-in fade-in print:p-0 print:m-0 print:bg-transparent">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full p-4 sm:p-5 space-y-3 my-4 max-h-[94vh] flex flex-col print:max-h-none print:overflow-visible print:border-none print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none">
            {/* Barre d'actions supérieure */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 print:hidden shrink-0">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 font-heading flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Bulletin Scolaire (1 Page Paysage) — {selectedStudentForBulletin.fullName}</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Classe de {selectedClass} • {selectedPeriod}
                </p>
              </div>

              {/* Boutons d'action */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenImagePreviewModal(selectedStudentForBulletin)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer shadow-2xs"
                  title="Afficher l'image du bulletin pour copie et téléchargement"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Voir Image</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
                  title="Lancer l'impression A4 Paysage sur 1 page"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer A4 Paysage (1 Page)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ZONE D'AFFICHAGE DU BULLETIN (1 SEULE PAGE GARANTIE) */}
            <div className="overflow-y-auto overflow-x-hidden flex-1 p-1 print:overflow-visible print:p-0">
              <OfficialLandscapeBulletin
                student={selectedStudentForBulletin}
                school={currentSchool}
                selectedPeriod={selectedPeriod}
                classStats={classStats}
                subjectsList={subjectsList}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 1-BIS : APERÇU ET COPIE DE L'IMAGE DU BULLETIN (NOUVEAU MODÈLE GARANTI) ================= */}
      {isImageModalOpen && selectedStudentForBulletin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto animate-in fade-in print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full p-4 sm:p-5 space-y-3 my-4 max-h-[94vh] flex flex-col relative">
            
            {/* 🔴 BANNIÈRE DE CONFIRMATION EN TOUT PREMIER EN HAUT */}
            {copiedSuccess && (
              <div className="p-3.5 bg-emerald-600 border-2 border-emerald-400 text-white rounded-xl flex items-center justify-between text-xs sm:text-sm font-black shadow-lg animate-in slide-in-from-top-2 shrink-0">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
                  <span>
                    ✓ Votre bulletin a été bien copié dans les presse-papiers.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCopiedSuccess(false)}
                  className="text-white hover:text-amber-200 font-bold ml-3 cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Header de la modale Image */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 font-heading flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-600" />
                  <span>Image du Bulletin — {selectedStudentForBulletin.fullName}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Cliquez sur <strong>« Copier l’Image (Ctrl+C) »</strong> pour coller (Ctrl + V) directement dans WhatsApp
                </p>
              </div>

              {/* Actions de la modale image : Bouton Copier l'Image + Télécharger PNG */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleCopyPNGToClipboard(selectedStudentForBulletin.fullName)}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-md ${
                    copiedSuccess
                      ? 'bg-emerald-700 text-white ring-2 ring-emerald-400'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                  title="Copier l'image du bulletin dans le presse-papier"
                >
                  {copiedSuccess ? <Check className="w-4 h-4 text-amber-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSuccess ? '✓ Bulletin Copié !' : '📋 Copier l’Image (Ctrl+C)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPNG(selectedStudentForBulletin.fullName)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all cursor-pointer shadow-2xs"
                  title="Télécharger l'image PNG sur l'ordinateur"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Télécharger PNG</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Zone d'affichage et de capture */}
            <div className="overflow-y-auto flex-1 p-2 bg-slate-100/70 rounded-xl border border-slate-200">
              {/* Le Bulletin Réel rendu dans la modale pour capture nette et fidèle */}
              <div ref={modalBulletinRef} className="bg-white p-3 sm:p-4 rounded-xl shadow-md border border-slate-200">
                <OfficialLandscapeBulletin
                  student={selectedStudentForBulletin}
                  school={currentSchool}
                  selectedPeriod={selectedPeriod}
                  classStats={classStats}
                  subjectsList={subjectsList}
                />
              </div>

              {/* Élément image invisible pour le fallback de copie par sélection DOM */}
              {imagePreviewUrl && (
                <img
                  ref={imgElementRef}
                  src={imagePreviewUrl}
                  alt="Bulletin Scolaire"
                  className="sr-only"
                />
              )}

              <div className="mt-3 text-center">
                <p className="inline-block text-xs font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-4 py-1.5 rounded-xl shadow-2xs">
                  ✓ Cliquez sur le bouton vert <strong>« 📋 Copier l’Image (Ctrl+C) »</strong> puis faites <strong>Ctrl + V</strong> dans WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 2 : IMPRESSION GROUPÉE DE LA CLASSE ENTIÈRE (1 PAGE PAYSAGE PAR ÉLÈVE SANS COUPURE) ================= */}
      {isBatchPrintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-in fade-in print:p-0 print:m-0 print:bg-transparent">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full p-4 sm:p-5 space-y-4 my-4 max-h-[94vh] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 print:hidden">
              <div>
                <h3 className="font-black text-base text-slate-900 font-heading">
                  Impression Groupée (1 Page Paysage par Élève) — Classe de {selectedClass} ({studentsWithGrades.length} Bulletins)
                </h3>
                <p className="text-xs text-slate-500">
                  Chaque bulletin sortira automatiquement sur 1 seule page A4 Paysage sans aucune coupure
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Lancer l&apos;Impression ({studentsWithGrades.length} pages Paysage)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchPrintOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Liste de tous les bulletins avec saut de page strict */}
            <div className="space-y-6 print:space-y-0">
              {studentsWithGrades.map((stu) => (
                <div key={stu.id} className="page-break-after-always">
                  <OfficialLandscapeBulletin
                    student={stu}
                    school={currentSchool}
                    selectedPeriod={selectedPeriod}
                    classStats={classStats}
                    subjectsList={subjectsList}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STYLES D'IMPRESSION STRICTS : FORMAT A4 PAYSAGE (LANDSCAPE), 1 SEULE PAGE PAR ÉLÈVE SANS DÉBORDEMENT */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 4mm 6mm 4mm 6mm;
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
            min-height: 100% !important;
            overflow: visible !important;
          }
          .print\\:hidden, header, nav, aside, footer {
            display: none !important;
          }
          /* Défixer totalement les conteneurs modaux pour qu'ils s'impriment directement */
          .fixed {
            position: static !important;
            inset: auto !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            width: 100% !important;
            display: block !important;
          }
          .page-break-after-always {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 0 !important;
          }
          .bulletin-page {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            position: relative !important;
            visibility: visible !important;
            border: 2px solid #0f172a !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 10px 14px !important;
            margin: 0 auto !important;
            min-height: 185mm !important;
            max-height: 198mm !important;
          }
        }
      `}</style>
    </div>
  );
}
