'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student, School } from '@/lib/data/types';
import { defaultSchool, mockStudents } from '@/lib/data/mock-data';
import { getLiveSchool, getLiveStudents, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import { GenderBadge } from '@/components/ui/badge';
import { formatDate, formatFCFA } from '@/lib/utils/formatters';
import {
  FileSpreadsheet,
  Printer,
  Award,
  Sparkles,
  CheckCircle2,
  CalendarCheck,
  Building2,
  User,
  Users,
  MessageCircle,
  TrendingUp,
  ReceiptText,
  ChevronDown,
  Lock,
  Search,
  Phone,
  Share2,
  AlertTriangle,
  GraduationCap,
} from 'lucide-react';

interface ParentBulletinsViewProps {
  schoolSlug?: string;
  initialSchool?: School;
  initialStudents?: Student[];
}

interface SubjectEvaluation {
  name: string;
  coef: number;
  prof: string;
  int1: number;
  int2: number;
  dev1: number;
  dev2: number;
  comp: number;
  appreciation: string;
}

// Fonction de vérification : Cycle Collège (6ème) jusqu'au Lycée (Terminale)
const isSecondaryOrLyceeGrade = (grade: string = '') => {
  const g = grade.toLowerCase().trim();
  return (
    g.includes('6') ||
    g.includes('5') ||
    g.includes('4') ||
    g.includes('3') ||
    g.includes('2nd') ||
    g.includes('sec') ||
    g.includes('1èr') ||
    g.includes('prem') ||
    g.includes('tle') ||
    g.includes('term') ||
    g.includes('collège') ||
    g.includes('lycée')
  );
};

export function ParentBulletinsView({
  schoolSlug = 'epc-manoi',
  initialSchool = defaultSchool,
  initialStudents = mockStudents,
}: ParentBulletinsViewProps) {
  const [currentSchool, setCurrentSchool] = useState<School>(() =>
    getLiveSchool(schoolSlug, initialSchool)
  );
  const [allStudents, setAllStudents] = useState<Student[]>(() => {
    const live = getLiveStudents(initialStudents || mockStudents);
    return live && live.length > 0 ? live : mockStudents;
  });

  const [activeSession, setActiveSession] = useState<any>(null);
  const [selectedParentKey, setSelectedParentKey] = useState<string>('');
  const [parentSearchQuery, setParentSearchQuery] = useState<string>('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3'>('Trimestre 1');

  useEffect(() => {
    const updateSchool = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, initialSchool));
      const live = getLiveStudents(initialStudents || mockStudents);
      if (live && live.length > 0) setAllStudents(live);
    };

    updateSchool();
    window.addEventListener(DATA_UPDATED_EVENT, updateSchool);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, updateSchool);
  }, [schoolSlug, initialSchool, initialStudents]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('schoolflow_active_session_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        setActiveSession(parsed);
      }
    } catch (e) {}
  }, []);

  const isParentRole = activeSession?.roleId === 'parent';

  // Élèves du Secondaire & Lycée uniquement (de la 6ème à la Terminale)
  const secondaryStudents = useMemo(() => {
    return allStudents.filter((stu) => isSecondaryOrLyceeGrade(stu.grade));
  }, [allStudents]);

  // Répertoire complet des familles ayant des enfants du Collège au Lycée (6ème à Terminale)
  const allParentFamilies = useMemo(() => {
    const map = new Map<string, { key: string; guardianName: string; phone: string; whatsapp: string; children: Student[] }>();

    secondaryStudents.forEach((stu) => {
      const gName = (stu.guardianName || `${stu.lastName} Famille`).trim();
      const key = gName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          guardianName: gName,
          phone: stu.guardianPhone || stu.whatsappPhone || '+225 07 08 09 10 11',
          whatsapp: stu.whatsappPhone || stu.guardianPhone || '+225 07 08 09 10 11',
          children: [],
        });
      }
      map.get(key)!.children.push(stu);
    });

    return Array.from(map.values());
  }, [secondaryStudents]);

  // Filtrage des familles pour l'admin / direction
  const filteredFamilies = useMemo(() => {
    if (!parentSearchQuery.trim()) return allParentFamilies;
    const q = parentSearchQuery.toLowerCase().trim();
    return allParentFamilies.filter(
      (f) =>
        f.guardianName.toLowerCase().includes(q) ||
        f.phone.includes(q) ||
        f.whatsapp.includes(q) ||
        f.children.some(
          (c) =>
            c.firstName.toLowerCase().includes(q) ||
            c.lastName.toLowerCase().includes(q) ||
            c.grade.toLowerCase().includes(q) ||
            c.matricule.toLowerCase().includes(q)
        )
    );
  }, [allParentFamilies, parentSearchQuery]);

  // Famille active
  const activeFamily = useMemo(() => {
    if (isParentRole) {
      if (activeSession?.matchedChildrenIds && activeSession.matchedChildrenIds.length > 0) {
        // Filtrer les enfants de la session pour ne garder que ceux de la 6ème à la Terminale
        const matched = secondaryStudents.filter((s) => activeSession.matchedChildrenIds.includes(s.id));
        if (matched.length > 0) {
          return {
            key: 'parent_session',
            guardianName: activeSession.fullName || matched[0].guardianName || 'Parent d\'élève',
            phone: matched[0].guardianPhone || '+225 07 08 09 10 11',
            whatsapp: matched[0].whatsappPhone || '+225 07 08 09 10 11',
            children: matched,
          };
        }
      }
      if (activeSession?.fullName) {
        const found = allParentFamilies.find((f) =>
          f.guardianName.toLowerCase().includes(activeSession.fullName.toLowerCase())
        );
        if (found) return found;
      }
      return null;
    }

    if (selectedParentKey) {
      const found = allParentFamilies.find((f) => f.key === selectedParentKey);
      if (found) return found;
    }

    return allParentFamilies[0] || null;
  }, [isParentRole, activeSession, secondaryStudents, selectedParentKey, allParentFamilies]);

  const familyChildren = useMemo(() => {
    if (!activeFamily) return [];
    return activeFamily.children;
  }, [activeFamily]);

  useEffect(() => {
    if (familyChildren.length > 0) {
      if (!selectedChildId || !familyChildren.some((c) => c.id === selectedChildId)) {
        setSelectedChildId(familyChildren[0].id);
      }
    }
  }, [familyChildren, selectedChildId]);

  useEffect(() => {
    if (!selectedParentKey && allParentFamilies.length > 0) {
      setSelectedParentKey(allParentFamilies[0].key);
    }
  }, [allParentFamilies, selectedParentKey]);

  const activeChild = useMemo(() => {
    return (
      familyChildren.find((c) => c.id === selectedChildId) ||
      familyChildren[0] ||
      secondaryStudents[0] ||
      allStudents[0]
    );
  }, [familyChildren, selectedChildId, secondaryStudents, allStudents]);

  const subjectsData: SubjectEvaluation[] = useMemo(() => {
    if (!activeChild) return [];
    return [
      {
        name: 'Français (Orthographe & Expression)',
        coef: 3,
        prof: 'M. Kouamé Koffi',
        int1: 15.5,
        int2: 16.0,
        dev1: 15.0,
        dev2: 16.5,
        comp: 16.0,
        appreciation: 'Excellent travail, expression soignée et bonne régularité.',
      },
      {
        name: 'Mathématiques',
        coef: 3,
        prof: 'M. Touré Amadou',
        int1: 14.5,
        int2: 17.0,
        dev1: 15.5,
        dev2: 16.0,
        comp: 17.0,
        appreciation: 'Très bon esprit logique et rigueur dans les démonstrations.',
      },
      {
        name: 'Physique-Chimie',
        coef: 2,
        prof: 'M. Diallo Souleymane',
        int1: 14.0,
        int2: 15.0,
        dev1: 14.5,
        dev2: 15.5,
        comp: 15.0,
        appreciation: 'Bons résultats, démarche scientifique bien assimilée.',
      },
      {
        name: 'Sciences de la Vie et de la Terre (SVT)',
        coef: 2,
        prof: 'Mme Bamba Fatou',
        int1: 16.0,
        int2: 16.5,
        dev1: 15.0,
        dev2: 16.0,
        comp: 16.5,
        appreciation: 'Travail sérieux, schémas très soignés.',
      },
      {
        name: 'Anglais (LV1)',
        coef: 2,
        prof: 'Mme Mensah Aïcha',
        int1: 16.5,
        int2: 17.0,
        dev1: 16.0,
        dev2: 16.5,
        comp: 17.0,
        appreciation: 'Très bonne aisance à l’oral et bon vocabulaire.',
      },
      {
        name: 'Histoire-Géographie',
        coef: 2,
        prof: 'M. Yao Bernard',
        int1: 15.0,
        int2: 15.5,
        dev1: 14.5,
        dev2: 16.0,
        comp: 15.5,
        appreciation: 'Bonne culture générale et leçons bien maîtrisées.',
      },
      {
        name: 'Éducation aux Droits de l’Homme (EDHC)',
        coef: 1,
        prof: 'Mme Kouadio Christine',
        int1: 17.0,
        int2: 17.5,
        dev1: 16.5,
        dev2: 17.0,
        comp: 17.0,
        appreciation: 'Élève modèle, sens civique et moral exemplaire.',
      },
      {
        name: 'Éducation Physique et Sportive (EPS)',
        coef: 1,
        prof: 'M. Diomandé Moussa',
        int1: 16.0,
        int2: 16.0,
        dev1: 15.5,
        dev2: 16.5,
        comp: 16.0,
        appreciation: 'Excellente condition physique et bel esprit d’équipe.',
      },
      {
        name: 'Arts Plastiques & Musique',
        coef: 1,
        prof: 'M. Soro Patrice',
        int1: 15.5,
        int2: 16.0,
        dev1: 15.0,
        dev2: 15.5,
        comp: 16.0,
        appreciation: 'Grande créativité et application soignée.',
      },
      {
        name: 'Conduite & Discipline',
        coef: 1,
        prof: 'M. Le Censeur',
        int1: 18.0,
        int2: 18.0,
        dev1: 18.0,
        dev2: 18.0,
        comp: 18.0,
        appreciation: 'Comportement irréprochable et respectueux.',
      },
    ];
  }, [activeChild]);

  const stats = useMemo(() => {
    let totalCoef = 0;
    let totalPoints = 0;

    const computedSubjects = subjectsData.map((sub) => {
      const moyInt = (sub.int1 + sub.int2) / 2;
      const moyDev = (sub.dev1 + sub.dev2) / 2;
      const moyMat = (moyInt + moyDev + sub.comp * 2) / 4;
      const points = moyMat * sub.coef;

      totalCoef += sub.coef;
      totalPoints += points;

      return {
        ...sub,
        moyInt: moyInt.toFixed(1),
        moyDev: moyDev.toFixed(1),
        moyMat,
        points,
      };
    });

    const generalAverage = totalCoef > 0 ? (totalPoints / totalCoef).toFixed(2) : '0.00';
    const numAvg = parseFloat(generalAverage);

    let rank = '2ème / 42';
    let mention = 'Tableau d’Honneur & Félicitations';
    let mentionBadge = 'bg-emerald-50 text-emerald-800 border-emerald-300';

    if (numAvg >= 16) {
      rank = '1er / 42';
      mention = 'Tableau d’Honneur & Félicitations du Conseil';
      mentionBadge = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold';
    } else if (numAvg >= 14) {
      rank = '3ème / 42';
      mention = 'Tableau d’Honneur & Encouragements';
      mentionBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (numAvg >= 12) {
      rank = '7ème / 42';
      mention = 'Tableau d’Honneur';
      mentionBadge = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (numAvg >= 10) {
      rank = '15ème / 42';
      mention = 'Passable';
      mentionBadge = 'bg-slate-100 text-slate-700 border-slate-200';
    } else {
      rank = '32ème / 42';
      mention = 'Avertissement Travail';
      mentionBadge = 'bg-rose-50 text-rose-700 border-rose-200';
    }

    return {
      computedSubjects,
      totalCoef,
      totalPoints: totalPoints.toFixed(2),
      generalAverage,
      rank,
      mention,
      mentionBadge,
      classAverage: '12.45',
      maxAverage: '17.20',
      minAverage: '07.80',
      attendanceRate: '100',
      absenceHours: '0 heure',
    };
  }, [subjectsData]);

  // Impression STRICTEMENT en Format Paysage A4 (1 Seule Page Pleine Hauteur)
  const handlePrintLandscape = () => {
    const el = document.getElementById('official-bulletin-print');
    if (!el) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1150,height=800');
    if (!printWindow) {
      window.print();
      return;
    }

    const htmlContent = el.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Bulletin_${activeChild?.lastName || 'Eleve'}_${activeChild?.firstName || ''}_${selectedTerm.replace(/\s+/g, '_')}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800;900&display=swap" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: A4 landscape;
            margin: 3mm 5mm !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          html, body {
            background: white !important;
            color: #0f172a !important;
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            height: 100%;
          }
          .font-heading {
            font-family: 'Outfit', sans-serif !important;
          }
          .bulletin-landscape-wrapper {
            width: 100%;
            max-width: 100%;
            min-height: 198mm;
            max-height: 202mm;
            margin: 0 auto;
            border: 2px solid #0f172a;
            border-radius: 12px;
            padding: 8px 12px;
            background: white;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div class="bulletin-landscape-wrapper">
          ${htmlContent}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Sécurité d'accès pour les parents
  if (isParentRole && !activeFamily) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border-2 border-rose-200 shadow-xl text-center space-y-4 my-12">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 font-heading">
          Accès Sécurisé : Aucun Élève du Secondaire / Lycée Rattaché
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
          Les bulletins scolaires numériques en ligne sont réservés aux élèves scolarisés de la <strong>6ème jusqu&apos;en Terminale</strong>. Pour les classes de Maternelle et Primaire, les livrets de notes sont remis physiquement en main propre par la Direction.
        </p>
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 text-left">
          <strong>Directives :</strong> Si votre enfant est bien au Collège ou Lycée, veuillez contacter le secrétariat de{' '}
          <strong>{currentSchool.name}</strong> avec vos reçus officiels pour synchroniser votre dossier.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* STYLE CSS GLOBAL IMPRESSION PAYSAGE A4 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 4mm 6mm !important;
          }
          body {
            background: white !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, aside, nav, .print\\:hidden {
            display: none !important;
          }
          .bulletin-a4-sheet {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 6px 10px !important;
            border: 1.5px solid #0f172a !important;
            border-radius: 12px !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            background: white !important;
          }
          .bulletin-a4-sheet * {
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* ═══════════════ EN-TÊTE DE LA PAGE (ÉCRAN SEULEMENT) ═══════════════ */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 print:hidden">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Portail Secondaire & Lycée (6ème à Terminale) • Année {currentSchool.academicYear || '2026-2027'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-heading tracking-tight">
            {isParentRole ? 'Suivi des Notes & Bulletins de vos Enfants' : 'Notes & Bulletins Parents — Direction & Admin'}
          </h1>
          <p className="text-xs text-emerald-100 max-w-2xl leading-relaxed">
            {isParentRole
              ? 'Consultez les moyennes trimestrielles certifiées et imprimez le bulletin officiel au format Paysage A4 (1 page nette).'
              : 'Visualisez les bulletins des élèves du Collège au Lycée, certifiés avec le cachet officiel de l’établissement.'}
          </p>
        </div>

        {/* Bouton Unique d'Impression Format Paysage A4 */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrintLandscape}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-extrabold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 shadow-lg shadow-amber-500/30 hover:scale-[1.02] transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>🖨️ Imprimer le Bulletin (Format Paysage A4)</span>
          </button>
        </div>
      </div>

      {/* ═══════════════ SÉLECTION DU PARENT POUR L'ADMIN / DIRECTION (6ème à Terminale) ═══════════════ */}
      {!isParentRole && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xs">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 font-heading">
                  Familles & Tuteurs du Secondaire / Lycée (6ème à Terminale)
                </h3>
                <p className="text-[11px] text-slate-400">
                  {allParentFamilies.length} familles répertoriées avec élèves au Collège ou Lycée
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher parent, élève, matricule, classe..."
                value={parentSearchQuery}
                onChange={(e) => setParentSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-44 overflow-y-auto pr-1">
            {filteredFamilies.map((fam) => {
              const isSelected = fam.key === activeFamily?.key;
              return (
                <button
                  key={fam.key}
                  type="button"
                  onClick={() => setSelectedParentKey(fam.key)}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200/80'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs truncate">
                      {fam.guardianName}
                    </div>
                    <div className={`text-[10px] font-mono truncate ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {fam.phone}
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {fam.children.length} {fam.children.length > 1 ? 'enf.' : 'enf.'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════ SÉLECTION DE L'ENFANT & DU TRIMESTRE ═══════════════ */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
            Enfant(s) de <strong className="text-slate-900">{activeFamily?.guardianName}</strong> :
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {familyChildren.map((child) => {
              const isSelected = child.id === activeChild?.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setSelectedChildId(child.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-600/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>
                    {child.firstName} {child.lastName}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {child.grade}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
            Période :
          </span>
          {(['Trimestre 1', 'Trimestre 2', 'Trimestre 3'] as const).map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => setSelectedTerm(term)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTerm === term
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ BULLETIN SCOLAIRE OFFICIEL (CALIBRÉ STRICTEMENT EN FORMAT PAYSAGE A4 - 1 PAGE) ═══════════════ */}
      <div
        id="official-bulletin-print"
        className="bulletin-a4-sheet bg-white rounded-3xl border-2 border-slate-900 shadow-xl overflow-hidden p-3.5 sm:p-5 space-y-2.5"
      >
        {/* 1. EN-TÊTE OFFICIEL CALQUÉ SUR LE REÇU */}
        <div className="relative z-10 border-2 border-slate-900 rounded-xl bg-white shadow-2xs p-2 sm:p-2.5">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Logo de l'École */}
            <div className="shrink-0 text-center flex items-center justify-center">
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-lg bg-white border border-slate-200 shadow-2xs p-0.5 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    currentSchool.logoUrl ||
                    'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&auto=format&fit=crop&q=80'
                  }
                  alt={currentSchool.name}
                  className="max-w-full max-h-full object-contain rounded"
                />
              </div>
            </div>

            {/* Centre : Nom complet + Sigle EPC MANOI + Devise + Contacts + Code MENA */}
            <div className="flex-1 min-w-0 px-1 text-center space-y-0.2">
              <h2
                className="font-black uppercase tracking-tight text-slate-950 font-heading text-xs sm:text-sm block w-full leading-tight truncate"
                title={currentSchool.name}
              >
                {currentSchool.name || 'EPC MARKAZ AHLI SOUNNAH'}
              </h2>
              <p className="font-extrabold text-emerald-800 text-[10.5px] sm:text-[11.5px] tracking-wide leading-none">
                ({currentSchool.shortName || 'EPC MANOI'})
              </p>
              <p className="font-semibold text-emerald-900 italic text-[8.5px] sm:text-[9.5px] truncate">
                « {currentSchool.motto || 'Excellence Académique • Rigueur • Éducation de Référence'} »
              </p>
              <p className="text-slate-700 font-medium leading-tight text-[8px] sm:text-[9px] truncate">
                {currentSchool.district || `${currentSchool.city} — ${currentSchool.country}`} • Tél : {currentSchool.phone || '+225 27 22 44 11 00'}
              </p>
              <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-slate-900 text-[8px] sm:text-[8.5px]">
                <span>Code MENA : {currentSchool.ministryCode || 'MENA-04829-CI'}</span>
              </div>
            </div>

            {/* Emblème National */}
            <div className="shrink-0 text-center flex items-center justify-center">
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-lg bg-white border border-slate-200 shadow-2xs p-0.5 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    currentSchool.countryEmblemUrl ||
                    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Coat_of_arms_of_Ivory_Coast.svg/300px-Coat_of_arms_of_Ivory_Coast.svg.png'
                  }
                  alt="Emblème National"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. TITRE OFFICIEL DU BULLETIN */}
        <div className="text-center space-y-0.2 py-0.5 bg-slate-900 text-white rounded-lg">
          <p className="text-[8px] font-bold tracking-widest uppercase text-slate-300">
            RÉPUBLIQUE DE CÔTE D&apos;IVOIRE • MINISTÈRE DE L&apos;ÉDUCATION NATIONALE
          </p>
          <h3 className="text-xs sm:text-xs font-black font-heading tracking-wide uppercase text-amber-400">
            BULLETIN TRIMESTRIEL DE NOTES — {selectedTerm.toUpperCase()} • {currentSchool.academicYear || '2026-2027'}
          </h3>
        </div>

        {/* 3. FICHE D'IDENTITÉ DE L'ÉLÈVE (1 Ligne Horizontale Dense) */}
        <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 grid grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-slate-400 font-bold uppercase text-[8.5px] block">Nom & Prénoms :</span>
            <span className="text-xs font-extrabold text-slate-900 font-heading truncate block">
              {activeChild?.lastName} {activeChild?.firstName}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase text-[8.5px] block">Matricule & Sexe :</span>
            <div className="flex items-center gap-1.5 mt-0.2">
              <span className="font-mono font-bold text-slate-900 text-xs">{activeChild?.matricule}</span>
              <GenderBadge gender={activeChild?.gender || 'M'} />
            </div>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase text-[8.5px] block">Classe & Effectif :</span>
            <span className="font-bold text-slate-900 text-xs">
              {activeChild?.grade} <span className="text-slate-500 font-normal">(42 Élèves)</span>
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase text-[8.5px] block">Parent / Tuteur Légal :</span>
            <span className="font-semibold text-slate-800 text-xs truncate block">{activeChild?.guardianName || activeFamily?.guardianName || 'Parent d\'élève'}</span>
          </div>
        </div>

        {/* 4. TABLEAU DES NOTES DU SECONDAIRE / LYCÉE */}
        <div className="overflow-x-auto rounded-lg border-2 border-slate-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-heading font-extrabold uppercase text-[9px] tracking-wider">
                <th className="py-1.5 px-2">Matières Enseignées & Professeur</th>
                <th className="py-1.5 px-1 text-center">Coef.</th>
                <th className="py-1.5 px-1 text-center">Interro.</th>
                <th className="py-1.5 px-1 text-center">Devoir</th>
                <th className="py-1.5 px-1 text-center">Comp.</th>
                <th className="py-1.5 px-1.5 text-center bg-slate-800">Moy. / 20</th>
                <th className="py-1.5 px-1.5 text-center bg-slate-800">Points</th>
                <th className="py-1.5 px-1.5 text-center">Rang</th>
                <th className="py-1.5 px-2.5">Appréciations des Enseignants</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stats.computedSubjects.map((sub, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-slate-50 transition-colors ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="py-1 px-2 font-bold text-slate-900">
                    <span className="text-[11px] leading-none">{sub.name}</span>
                    <span className="text-[8.5px] text-slate-400 font-normal ml-1">({sub.prof})</span>
                  </td>
                  <td className="py-1 px-1 text-center font-mono font-bold text-slate-800 text-[11px]">{sub.coef}</td>
                  <td className="py-1 px-1 text-center font-mono text-slate-600 text-[11px]">{sub.moyInt}</td>
                  <td className="py-1 px-1 text-center font-mono text-slate-600 text-[11px]">{sub.moyDev}</td>
                  <td className="py-1 px-1 text-center font-mono font-semibold text-slate-800 text-[11px]">{sub.comp.toFixed(1)}</td>
                  <td className="py-1 px-1.5 text-center font-mono font-extrabold text-slate-950 bg-emerald-50/40 text-[11px]">
                    {sub.moyMat.toFixed(2)}
                  </td>
                  <td className="py-1 px-1.5 text-center font-mono font-bold text-slate-900 bg-emerald-50/40 text-[11px]">
                    {sub.points.toFixed(2)}
                  </td>
                  <td className="py-1 px-1.5 text-center font-mono font-bold text-slate-700 text-[9.5px]">
                    {idx === 0 ? '1er' : idx === 1 ? '2ème' : `${idx + 1}e`}
                  </td>
                  <td className="py-1 px-2.5 text-slate-600 text-[9.5px] italic leading-tight truncate max-w-sm">
                    {sub.appreciation}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totaux & Moyenne générale */}
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-900 text-xs">
                <td className="py-1.5 px-2 uppercase font-heading text-[10.5px]">Totaux & Moyenne Générale</td>
                <td className="py-1.5 px-1 text-center font-mono font-black text-slate-900 text-[11px]">{stats.totalCoef}</td>
                <td colSpan={3} className="py-1.5 px-1 text-center text-slate-600 italic text-[10.5px]">
                  Rang de classe : <strong className="text-emerald-800 font-extrabold">{stats.rank}</strong>
                </td>
                <td className="py-1.5 px-1.5 text-center font-mono font-black text-emerald-900 bg-emerald-100 text-xs">
                  {stats.generalAverage}
                </td>
                <td className="py-1.5 px-1.5 text-center font-mono font-black text-slate-950 bg-slate-200 text-xs">
                  {stats.totalPoints}
                </td>
                <td colSpan={2} className="py-1 px-2.5 font-extrabold text-emerald-900 text-[10.5px]">
                  {stats.mention}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 5. BILAN DU CONSEIL, VISA PARENTS ET SIGNATURE DU DIRECTEUR (CONFORME PARAMÈTRES) */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t-2 border-slate-900 text-xs">
          {/* Assiduité & Conduite */}
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5 flex flex-col justify-between">
            <div>
              <h4 className="font-extrabold uppercase text-[9px] text-slate-900 font-heading">
                1. Assiduité & Conduite
              </h4>
              <p className="text-slate-600 text-[9.5px]">
                Absences : <strong className="text-slate-900">{stats.absenceHours}</strong> • Conduite : <strong className="text-emerald-700 font-bold">Exemplaire</strong>
              </p>
            </div>
            <div className="pt-0.5 border-t border-slate-200">
              <p className="text-[8.5px] font-bold text-slate-700 uppercase">Le Professeur Principal : <span className="font-serif italic text-slate-800 font-normal">Signé M. Kouamé</span></p>
            </div>
          </div>

          {/* Avis du Conseil de Classe */}
          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-300 space-y-0.5 flex flex-col justify-between">
            <div>
              <h4 className="font-extrabold uppercase text-[9px] text-emerald-950 font-heading">
                2. Avis du Conseil de Classe
              </h4>
              <p className="text-emerald-950 font-medium italic text-[9px] leading-tight">
                « Trimestre très satisfaisant. Félicitations du conseil pour la rigueur et le travail exemplaire. »
              </p>
            </div>
            <div className="pt-0.5 border-t border-emerald-200 flex justify-between items-center text-[8.5px]">
              <span className="font-bold text-slate-700 uppercase">Visa des Parents :</span>
              <span className="font-mono text-slate-600">Vu le {formatDate(new Date())}</span>
            </div>
          </div>

          {/* Cachet & Signature du Directeur (issu des Paramètres de l'école) */}
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-0.5 flex flex-col justify-between relative">
            <div>
              <p className="font-bold text-slate-900 uppercase text-[8.5px]">
                3. Le Chef d’Établissement / Le Directeur
              </p>
              <p className="text-[8px] text-slate-500 font-mono">
                Fait à {currentSchool.city || 'Abidjan'}, le {formatDate(new Date())}
              </p>
            </div>

            {/* Cachet officiel scanné */}
            <div className="h-9 flex items-center justify-center relative">
              {currentSchool.stampUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentSchool.stampUrl}
                  alt="Cachet officiel de l'école"
                  className="max-h-9 max-w-24 object-contain transform rotate-[-3deg] opacity-90"
                />
              ) : (
                <div className="px-2 py-0.2 rounded border border-dashed border-emerald-700 bg-emerald-50 text-emerald-900 font-mono text-[8px] font-bold uppercase">
                  [ Cachet Direction ]
                </div>
              )}
            </div>

            {/* NOM DU DIRECTEUR DÉFINI DANS LES PARAMÈTRES */}
            <p className="text-[8.5px] font-extrabold text-slate-900 uppercase leading-none">
              {currentSchool.directorName || currentSchool.studiesDirectorName || 'M. Jean-Marc Kouassi'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
