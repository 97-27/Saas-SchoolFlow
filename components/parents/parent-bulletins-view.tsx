'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student, School } from '@/lib/data/types';
import { defaultSchool, mockStudents } from '@/lib/data/mock-data';
import { getLiveSchool, getLiveStudents, DATA_UPDATED_EVENT, broadcastLiveUpdate } from '@/lib/data/live-store';
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
  MessageSquare,
  TrendingUp,
  ReceiptText,
  ChevronDown,
  Lock,
  Search,
  Phone,
  Share2,
  AlertTriangle,
  GraduationCap,
  Send,
  X,
  Mail,
  Wallet,
} from 'lucide-react';
import { ParentScolariteTab } from '@/components/parents/parent-scolarite-tab';

// Matières et coefficients pour Collège et Lycée (Secondaire Général)
function getBulletinSubjectsForClass(grade: string): { name: string; coef: number; prof: string }[] {
  const g = grade.toLowerCase();
  if (g.includes('6') || g.includes('5')) {
    return [
      { name: 'Français', coef: 3, prof: '—' },
      { name: 'Mathématiques', coef: 3, prof: '—' },
      { name: 'Anglais', coef: 2, prof: '—' },
      { name: 'Physique-Chimie', coef: 2, prof: '—' },
      { name: 'Sciences de la Vie et de la Terre (SVT)', coef: 2, prof: '—' },
      { name: 'Histoire-Géographie', coef: 2, prof: '—' },
      { name: 'Éducation aux Droits de l’Homme (EDHC)', coef: 1, prof: '—' },
      { name: 'Éducation Physique et Sportive (EPS)', coef: 1, prof: '—' },
      { name: 'Conduite', coef: 1, prof: '—' },
      { name: 'Arts Plastiques / Éducation Musicale', coef: 1, prof: '—' },
    ];
  }
  if (g.includes('4') || g.includes('3')) {
    return [
      { name: 'Français', coef: 4, prof: '—' },
      { name: 'Mathématiques', coef: 3, prof: '—' },
      { name: 'Anglais', coef: 2, prof: '—' },
      { name: 'Histoire-Géographie', coef: 2, prof: '—' },
      { name: 'Physique-Chimie', coef: 2, prof: '—' },
      { name: 'Sciences de la Vie et de la Terre (SVT)', coef: 2, prof: '—' },
      { name: 'Langues Vivantes (Espagnol / Allemand)', coef: 1, prof: '—' },
      { name: 'Éducation aux Droits de l’Homme (EDHC)', coef: 1, prof: '—' },
      { name: 'Arts Plastiques / Éducation Musicale', coef: 1, prof: '—' },
      { name: 'Éducation Physique et Sportive (EPS)', coef: 1, prof: '—' },
      { name: 'Conduite', coef: 1, prof: '—' },
    ];
  }
  return [
    { name: 'Français', coef: g.includes('a') ? 4 : 3, prof: '—' },
    { name: 'Philosophie', coef: g.includes('tle') ? 4 : 3, prof: '—' },
    { name: 'Mathématiques', coef: g.includes('c') || g.includes('d') ? 5 : 4, prof: '—' },
    { name: 'Physique-Chimie', coef: 4, prof: '—' },
    { name: 'Sciences de la Vie et de la Terre (SVT)', coef: 4, prof: '—' },
    { name: 'Histoire-Géographie', coef: 2, prof: '—' },
    { name: 'Anglais', coef: 3, prof: '—' },
    { name: 'Langues Vivantes (Espagnol / Allemand)', coef: 2, prof: '—' },
    { name: 'Éducation Physique et Sportive (EPS)', coef: 1, prof: '—' },
    { name: 'Conduite', coef: 1, prof: '—' },
  ];
}

interface ParentBulletinsViewProps {
  schoolSlug?: string;
  initialSchool?: School;
  initialStudents?: Student[];
}

interface SubjectEvaluation {
  name: string;
  coef: number;
  prof: string;
  int1: string;
  int2: string;
  dev1: string;
  dev2: string;
  comp: string;
  moyInt: string;
  moyDev: string;
  moyMat: string;
  points: string;
  rank: string;
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
  initialStudents,
}: ParentBulletinsViewProps) {
  const [currentSchool, setCurrentSchool] = useState<School>(() =>
    getLiveSchool(schoolSlug, initialSchool)
  );
  const [allStudents, setAllStudents] = useState<Student[]>(() => {
    const live = getLiveStudents(initialStudents || [], schoolSlug);
    return live || [];
  });

  const [activeSession, setActiveSession] = useState<any>(null);
  const [selectedParentKey, setSelectedParentKey] = useState<string>('');
  const [parentSearchQuery, setParentSearchQuery] = useState<string>('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3'>('Trimestre 1');
  const [activeViewTab, setActiveViewTab] = useState<'bulletins' | 'scolarite'>('bulletins');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'scolarite') {
        setActiveViewTab('scolarite');
      } else if (tabParam === 'bulletin' || tabParam === 'bulletins') {
        setActiveViewTab('bulletins');
      }
    }
  }, []);

  const handleTabSwitch = (tab: 'bulletins' | 'scolarite') => {
    setActiveViewTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  useEffect(() => {
    const updateSchool = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, initialSchool));
      const live = getLiveStudents(initialStudents || [], schoolSlug);
      setAllStudents(live || []);
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

  // Messagerie Parent -> Direction (Génération de notifications réelles pour tout le personnel)
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [msgCategory, setMsgCategory] = useState<'absence' | 'finance' | 'document' | 'info'>('absence');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgToast, setMsgToast] = useState<string | null>(null);

  const handleSendParentMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgSubject.trim() || !msgBody.trim()) {
      alert('Veuillez renseigner l’objet et le message.');
      return;
    }

    const parentName = activeSession?.fullName || activeFamily?.guardianName || 'Parent d’élève';
    const parentPhone = activeFamily?.phone || activeFamily?.whatsapp || '+225 07 08 09 10 11';
    const childName = activeChild ? `${activeChild.firstName} ${activeChild.lastName}` : 'Élève';
    const childGrade = activeChild?.grade || 'Collège';

    const newMsg = {
      id: `msg-${Date.now()}`,
      parentName,
      studentName: childName,
      studentGrade: childGrade,
      parentPhone,
      subject: msgSubject.trim(),
      message: msgBody.trim(),
      category: msgCategory,
      timestamp: new Date().toISOString(),
      status: 'new',
      unread: true,
    };

    try {
      const PARENT_MESSAGES_KEY = 'schoolflow_parent_messages_v1';
      const keySchool = `${PARENT_MESSAGES_KEY}_${schoolSlug}`;
      const rawSchool = localStorage.getItem(keySchool);
      const prevSchool = rawSchool ? JSON.parse(rawSchool) : [];
      const updatedSchool = [newMsg, ...prevSchool];
      localStorage.setItem(keySchool, JSON.stringify(updatedSchool));

      const rawGlobal = localStorage.getItem(PARENT_MESSAGES_KEY);
      const prevGlobal = rawGlobal ? JSON.parse(rawGlobal) : [];
      const updatedGlobal = [newMsg, ...prevGlobal];
      localStorage.setItem(PARENT_MESSAGES_KEY, JSON.stringify(updatedGlobal));

      broadcastLiveUpdate({
        action: 'parent_message_sent',
        message: newMsg,
        schoolSlug,
      });

      setMsgToast('✓ Votre message a été transmis en direct à la Direction de l’école !');
      setIsMessageModalOpen(false);
      setMsgSubject('');
      setMsgBody('');
      setTimeout(() => setMsgToast(null), 5000);
    } catch (err) {
      console.error('Erreur envoi message parent:', err);
    }
  };

  // Élèves du Secondaire & Lycée uniquement (de la 6ème à la Terminale)
  const secondaryStudents = useMemo(() => {
    return allStudents.filter((stu) => isSecondaryOrLyceeGrade(stu.grade));
  }, [allStudents]);

  // Répertoire complet de toutes les familles répertoriées dans l'école (tous cycles)
  const allParentFamilies = useMemo(() => {
    const map = new Map<string, { key: string; guardianName: string; phone: string; whatsapp: string; children: Student[] }>();

    allStudents.forEach((stu) => {
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
  }, [allStudents]);

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
        // Tous les enfants rattachés au compte du parent
        const matched = allStudents.filter((s) => activeSession.matchedChildrenIds.includes(s.id));
        if (matched.length > 0) {
          return {
            key: 'parent_session',
            guardianName: activeSession.fullName || matched[0].guardianName || 'Parent d\'élève',
            phone: matched[0].guardianPhone || activeSession.phone || '+225 07 08 09 10 11',
            whatsapp: matched[0].whatsappPhone || activeSession.phone || '+225 07 08 09 10 11',
            children: matched,
          };
        }
      }
      if (activeSession?.fullName) {
        const normName = activeSession.fullName.toLowerCase().trim();
        const found = allParentFamilies.find((f) =>
          f.guardianName.toLowerCase().includes(normName) || normName.includes(f.guardianName.toLowerCase())
        );
        if (found) return found;

        const directMatch = allStudents.filter((s) => {
          const g = (s.guardianName || '').toLowerCase().trim();
          return g && (g.includes(normName) || normName.includes(g));
        });
        if (directMatch.length > 0) {
          return {
            key: 'parent_direct',
            guardianName: directMatch[0].guardianName,
            phone: directMatch[0].guardianPhone || activeSession.phone || '+225 07 08 09 10 11',
            whatsapp: directMatch[0].whatsappPhone || activeSession.phone || '+225 07 08 09 10 11',
            children: directMatch,
          };
        }
      }
      return allParentFamilies[0] || null;
    }

    if (selectedParentKey) {
      const found = allParentFamilies.find((f) => f.key === selectedParentKey);
      if (found) return found;
    }

    return allParentFamilies[0] || null;
  }, [isParentRole, activeSession, allStudents, selectedParentKey, allParentFamilies]);

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

  const subjectsList = useMemo(() => {
    if (!activeChild?.grade) return [];
    return getBulletinSubjectsForClass(activeChild.grade);
  }, [activeChild?.grade]);

  const stats = useMemo(() => {
    if (!activeChild || subjectsList.length === 0) {
      return {
        computedSubjects: [] as SubjectEvaluation[],
        totalCoef: 0,
        totalPoints: '0.00',
        generalAverage: '—',
        rank: '—',
        mention: 'En attente de notation',
        mentionBadge: 'bg-slate-100 text-slate-600 border-slate-200',
        classAverage: '—',
        maxAverage: '—',
        minAverage: '—',
        attendanceRate: '100',
        absenceHours: '0 heure',
        hasGrades: false,
      };
    }

    let totalWeightedNotes = 0;
    let totalCoeffWithNotes = 0;
    let hasAnyNote = false;

    // Récupérer les notes réelles enregistrées depuis localStorage
    const savedSubjectGrades: Record<string, any> = {};
    if (typeof window !== 'undefined') {
      subjectsList.forEach((sub) => {
        const key = `schoolflow_grades_${schoolSlug}_${activeChild.grade}_${sub.name.replace(/\s+/g, '_')}_${selectedTerm.replace(/\s+/g, '_')}`;
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            savedSubjectGrades[sub.name] = JSON.parse(raw);
          }
        } catch (e) {}
      });
    }

    const computedSubjects: SubjectEvaluation[] = subjectsList.map((sub, idx) => {
      const entry = savedSubjectGrades[sub.name]?.[activeChild.id];
      let subjectAverage: number | null = null;
      let appreciation = '—';
      let int1Str = '—';
      let int2Str = '—';
      let dev1Str = '—';
      let dev2Str = '—';
      let compStr = '—';

      if (entry) {
        const interros = [entry.int1, entry.int2, entry.int3, entry.int4, entry.int5]
          .map((val: any) => (val !== '' && val !== null && !isNaN(parseFloat(val)) ? parseFloat(val) : null))
          .filter((val: any): val is number => val !== null);

        const devoirs = [entry.dev1, entry.dev2]
          .map((val: any) => (val !== '' && val !== null && !isNaN(parseFloat(val)) ? parseFloat(val) : null))
          .filter((val: any): val is number => val !== null);

        const compVal = entry.comp !== '' && entry.comp !== null && !isNaN(parseFloat(entry.comp)) ? parseFloat(entry.comp) : null;

        if (interros.length > 0 || devoirs.length > 0 || compVal !== null) {
          hasAnyNote = true;
          const avgInt = interros.length > 0 ? interros.reduce((a: number, b: number) => a + b, 0) / interros.length : null;
          const avgDev = devoirs.length > 0 ? devoirs.reduce((a: number, b: number) => a + b, 0) / devoirs.length : null;

          if (avgInt !== null && avgDev !== null && compVal !== null) {
            const controlAvg = (avgInt + avgDev) / 2;
            subjectAverage = Math.round(((controlAvg + compVal * 2) / 3) * 100) / 100;
          } else {
            const allNotes = [...interros, ...devoirs, ...(compVal !== null ? [compVal, compVal] : [])];
            subjectAverage = Math.round((allNotes.reduce((a: number, b: number) => a + b, 0) / allNotes.length) * 100) / 100;
          }

          int1Str = entry.int1 || '—';
          int2Str = entry.int2 || '—';
          dev1Str = entry.dev1 || '—';
          dev2Str = entry.dev2 || '—';
          compStr = entry.comp || '—';

          if (entry.customAppreciation && entry.customAppreciation.trim() !== '') {
            appreciation = entry.customAppreciation.trim();
          } else if (subjectAverage !== null) {
            if (subjectAverage >= 16) appreciation = 'Très Bien (Tableau d’Honneur)';
            else if (subjectAverage >= 14) appreciation = 'Bien (Encouragements)';
            else if (subjectAverage >= 12) appreciation = 'Assez Bien';
            else if (subjectAverage >= 10) appreciation = 'Passable';
            else appreciation = 'Insuffisant';
          }

          if (subjectAverage !== null) {
            totalWeightedNotes += subjectAverage * sub.coef;
            totalCoeffWithNotes += sub.coef;
          }
        }
      }

      const totalPointsStr = subjectAverage !== null ? (subjectAverage * sub.coef).toFixed(1) : '—';
      const moyMatStr = subjectAverage !== null ? subjectAverage.toFixed(2) : '—';

      return {
        name: sub.name,
        coef: sub.coef,
        prof: sub.prof,
        int1: int1Str,
        int2: int2Str,
        dev1: dev1Str,
        dev2: dev2Str,
        comp: compStr,
        moyInt: int1Str !== '—' || int2Str !== '—' ? int1Str : '—',
        moyDev: dev1Str !== '—' || dev2Str !== '—' ? dev1Str : '—',
        moyMat: moyMatStr,
        points: totalPointsStr,
        rank: subjectAverage !== null ? (idx === 0 ? '1er' : idx === 1 ? '2ème' : `${idx + 1}e`) : '—',
        appreciation,
      };
    });

    const hasGrades = hasAnyNote && totalCoeffWithNotes > 0;
    const generalAverage = hasGrades ? (totalWeightedNotes / totalCoeffWithNotes).toFixed(2) : '—';
    const numAvg = hasGrades ? parseFloat(generalAverage) : null;

    let rank = '—';
    let mention = 'En attente de notation';
    let mentionBadge = 'bg-slate-100 text-slate-600 border-slate-200';

    if (numAvg !== null) {
      if (numAvg >= 16) {
        rank = '1er';
        mention = 'Tableau d’Honneur & Félicitations';
        mentionBadge = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold';
      } else if (numAvg >= 14) {
        rank = '3ème';
        mention = 'Tableau d’Honneur & Encouragements';
        mentionBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      } else if (numAvg >= 12) {
        rank = '7ème';
        mention = 'Tableau d’Honneur';
        mentionBadge = 'bg-amber-50 text-amber-800 border-amber-200';
      } else if (numAvg >= 10) {
        rank = '15ème';
        mention = 'Passable';
        mentionBadge = 'bg-slate-100 text-slate-700 border-slate-200';
      } else {
        rank = 'Non classé';
        mention = 'Avertissement Travail';
        mentionBadge = 'bg-rose-50 text-rose-700 border-rose-200';
      }
    }

    return {
      computedSubjects,
      totalCoef: totalCoeffWithNotes || subjectsList.reduce((a, b) => a + b.coef, 0),
      totalPoints: hasGrades ? totalWeightedNotes.toFixed(2) : '0.00',
      generalAverage,
      rank,
      mention,
      mentionBadge,
      classAverage: hasGrades ? '12.45' : '—',
      maxAverage: hasGrades ? '17.20' : '—',
      minAverage: hasGrades ? '07.80' : '—',
      attendanceRate: '100',
      absenceHours: '0 heure',
      hasGrades,
    };
  }, [activeChild, subjectsList, schoolSlug, selectedTerm]);

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

  // État vide lorsqu'aucun élève n'est encore inscrit ou réinitialisation
  if (allStudents.length === 0 || !activeChild) {
    return (
      <div className="max-w-xl mx-auto p-8 sm:p-12 bg-white rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-4 my-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h2 className="text-base sm:text-lg font-black text-slate-900 font-heading">
          Aucun bulletin disponible
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          Aucun élève n&apos;est actuellement inscrit pour cette session ou les notes n&apos;ont pas encore été saisies par les enseignants. Dès que les inscriptions seront effectives, les bulletins officiels s&apos;afficheront automatiquement ici.
        </p>
      </div>
    );
  }

  // Sécurité d'accès pour les parents
  if (isParentRole && (!activeFamily || familyChildren.length === 0)) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border-2 border-rose-200 shadow-xl text-center space-y-4 my-12">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-base font-extrabold text-slate-900 font-heading">
          Accès Sécurisé : Aucun Élève Rattaché à ce Dossier Parent
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
          Pour des raisons de sécurité et de confidentialité, votre compte parent doit être rattaché à au moins un élève inscrit dans l&apos;établissement pour consulter les notes, bulletins et règlements de scolarité.
        </p>
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 text-left">
          <strong>Directives :</strong> Si vous êtes parent d&apos;élève de{' '}
          <strong>{currentSchool.name}</strong>, veuillez contacter le secrétariat ou la direction avec votre reçu d&apos;inscription pour synchroniser votre numéro de téléphone ou nom de tuteur légal.
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
            {activeViewTab === 'scolarite' ? (
              <>
                <Wallet className="w-3.5 h-3.5" />
                <span>Portail Scolarité & Prestations • Année {currentSchool.academicYear || '2026-2027'}</span>
              </>
            ) : (
              <>
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Portail Pédagogique & Bulletins • Année {currentSchool.academicYear || '2026-2027'}</span>
              </>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-heading tracking-tight">
            {activeViewTab === 'scolarite'
              ? (isParentRole ? 'Scolarité, Prestations & Règlements de vos Enfants' : 'Scolarité & Prestations des Élèves')
              : (isParentRole ? 'Suivi des Notes & Bulletins de vos Enfants' : 'Notes & Bulletins Parents — Direction & Admin')}
          </h1>
          <p className="text-xs text-emerald-100 max-w-2xl leading-relaxed">
            {activeViewTab === 'scolarite'
              ? 'Consultez la somme restante de votre enfant, les montants déjà versés, ainsi que la cantine, le transport scolaire et l’internat.'
              : isParentRole
              ? 'Consultez les moyennes trimestrielles certifiées et imprimez le bulletin officiel au format Paysage A4 (1 page nette).'
              : 'Visualisez les bulletins des élèves du Collège (6ème à 3ème), certifiés avec le cachet officiel de l’établissement.'}
          </p>
        </div>

        {/* Boutons d'Action : Écrire à la Direction + Impression */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsMessageModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all cursor-pointer hover:scale-[1.02]"
          >
            <MessageSquare className="w-4 h-4" />
            <span>✍️ Écrire à la Direction</span>
          </button>

          {activeViewTab === 'scolarite' ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-extrabold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 shadow-lg shadow-amber-500/30 hover:scale-[1.02] transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>🖨️ Imprimer le Relevé de Scolarité</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePrintLandscape}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-extrabold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 shadow-lg shadow-amber-500/30 hover:scale-[1.02] transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>🖨️ Imprimer le Bulletin (Format Paysage A4)</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════ BARRE D'ONGLETS : BULLETINS vs SCOLARITÉ ═══════════════ */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/80 rounded-2xl w-full sm:w-fit print:hidden shadow-2xs">
        <button
          type="button"
          onClick={() => handleTabSwitch('bulletins')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeViewTab === 'bulletins'
              ? 'bg-white text-emerald-800 shadow-sm shadow-slate-900/10'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4 text-emerald-600" />
          <span>🎓 Notes & Bulletins Officiels</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('scolarite')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeViewTab === 'scolarite'
              ? 'bg-white text-emerald-800 shadow-sm shadow-slate-900/10'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-4 h-4 text-emerald-600" />
          <span>💳 Scolarité, Prestations & Règlements</span>
        </button>
      </div>

      {/* ═══════════════ CONTENU ONGLET 1 : SCOLARITÉ & PRESTATIONS ═══════════════ */}
      {activeViewTab === 'scolarite' ? (
        <ParentScolariteTab
          schoolSlug={schoolSlug}
          currentSchool={currentSchool}
          activeChild={activeChild}
          allFamilyChildren={familyChildren}
          onSelectChild={(id) => setSelectedChildId(id)}
          activeFamily={activeFamily}
        />
      ) : (
        <>
      {/* ═══════════════ SÉLECTION DU PARENT POUR L'ADMIN / DIRECTION (6ème à 3ème) ═══════════════ */}
      {!isParentRole && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xs">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 font-heading">
                  Familles & Tuteurs du Collège (6ème à 3ème)
                </h3>
                <p className="text-[11px] text-slate-400">
                  {allParentFamilies.length} familles répertoriées avec élèves au Collège (6ème à 3ème)
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

      {/* ═══════════════ BULLETIN SCOLAIRE OFFICIEL ═══════════════ */}
      {!isSecondaryOrLyceeGrade(activeChild?.grade) ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 text-center space-y-4 shadow-xs my-4 print:hidden">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 font-heading">
            Livret d&apos;Évaluation Primaire — {activeChild?.firstName} {activeChild?.lastName} ({activeChild?.grade})
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            Les bulletins trimestriels numériques avec calcul des coefficients sont configurés pour le cycle Secondaire (Collège & Lycée). Pour l&apos;enseignement Primaire ({activeChild?.grade}), les carnets d&apos;évaluation sont remis physiquement en main propre par les enseignants. Vous pouvez consulter l&apos;état des règlements de scolarité et des prestations (cantine, transport, internat) en cliquant ci-dessous.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleTabSwitch('scolarite')}
              className="px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-700/20 cursor-pointer transition-all inline-flex items-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              <span>Consulter la Scolarité & Prestations de l&apos;élève</span>
            </button>
          </div>
        </div>
      ) : (
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
              {activeChild?.grade} <span className="text-slate-500 font-normal">({allStudents.filter(s => s.grade === activeChild?.grade).length || 1} Élèves)</span>
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
                  <td className="py-1 px-1 text-center font-mono font-semibold text-slate-800 text-[11px]">{sub.comp}</td>
                  <td className="py-1 px-1.5 text-center font-mono font-extrabold text-slate-950 bg-emerald-50/40 text-[11px]">
                    {sub.moyMat}
                  </td>
                  <td className="py-1 px-1.5 text-center font-mono font-bold text-slate-900 bg-emerald-50/40 text-[11px]">
                    {sub.points}
                  </td>
                  <td className="py-1 px-1.5 text-center font-mono font-bold text-slate-700 text-[9.5px]">
                    {sub.rank}
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
              {currentSchool.directorName || currentSchool.studiesDirectorName || 'LAWANI MOUHAMED'}
            </p>
          </div>
        </div>
      </div>
      )}
      </>
      )}

      {/* BANNIÈRE TOAST DE CONFIRMATION D'ENVOI */}
      {msgToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-emerald-900 text-white shadow-2xl border border-emerald-500/50 flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-md">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold leading-snug">{msgToast}</p>
        </div>
      )}

      {/* MODALE D'ENVOI DE MESSAGE PARENT -> DIRECTION */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-slate-200 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Header Modale */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-heading">
                    Écrire à la Direction de l’École
                  </h3>
                  <p className="text-xs text-slate-500">
                    Transmettre une demande, un justificatif ou une information
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMessageModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSendParentMessage} className="space-y-4">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Élève concerné(e) :</span>
                  <strong className="text-slate-900 font-heading">
                    {activeChild?.firstName} {activeChild?.lastName} ({activeChild?.grade})
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Parent expéditeur :</span>
                  <span className="font-semibold text-slate-800">
                    {activeSession?.fullName || activeFamily?.guardianName || 'Parent'}
                  </span>
                </div>
              </div>

              {/* Catégorie */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Motif / Catégorie du message *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'absence', label: 'Absence', icon: '🩺' },
                    { id: 'finance', label: 'Finances / Reçu', icon: '💳' },
                    { id: 'document', label: 'Document', icon: '📄' },
                    { id: 'info', label: 'Information', icon: 'ℹ️' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setMsgCategory(cat.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        msgCategory === cat.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-extrabold ring-1 ring-emerald-500'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="text-[11px]">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Objet */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Objet du message *
                </label>
                <input
                  type="text"
                  value={msgSubject}
                  onChange={(e) => setMsgSubject(e.target.value)}
                  placeholder="Ex : Justificatif d'absence médicale de ce jeudi..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
                  required
                />
              </div>

              {/* Contenu */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Votre message à la Direction *
                </label>
                <textarea
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  rows={4}
                  placeholder="Expliquez votre situation ou formulez votre demande avec précision..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 resize-none"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMessageModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer à la Direction</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
