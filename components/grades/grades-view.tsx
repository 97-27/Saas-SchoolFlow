'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student, School } from '@/lib/data/types';
import {
  getLiveStudents,
  getLiveSchool,
  getGradesPortalStatus,
  saveGradesPortalStatus,
  GradesPortalStatus,
  DATA_UPDATED_EVENT,
} from '@/lib/data/live-store';
import { GenderBadge } from '@/components/ui/badge';
import {
  BookOpen,
  Layers,
  Building2,
  Save,
  Printer,
  CheckCircle2,
  Search,
  FileText,
  X,
  RotateCcw,
  Download,
  ExternalLink,
  FolderOpen,
  GraduationCap,
  Sparkles,
  Check,
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
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

// Matières et coefficients normalisés pour chaque classe du Secondaire (Collège & Lycée)
export function getSubjectsForClass(grade: string): { name: string; coeff: number }[] {
  const g = grade.toLowerCase();
  // 6ème et 5ème (Mêmes matières et coefficients)
  if (g.includes('6') || g.includes('5')) {
    return [
      { name: 'Français', coeff: 3 },
      { name: 'Mathématiques', coeff: 3 },
      { name: 'Anglais', coeff: 2 },
      { name: 'Physique-Chimie', coeff: 2 },
      { name: 'Sciences de la Vie et de la Terre (SVT)', coeff: 2 },
      { name: 'Histoire-Géographie', coeff: 2 },
      { name: 'Éducation aux Droits de l’Homme (EDHC)', coeff: 1 },
      { name: 'Éducation Physique et Sportive (EPS)', coeff: 1 },
      { name: 'Conduite', coeff: 1 },
      { name: 'Arts Plastiques / Éducation Musicale', coeff: 1 },
    ];
  }

  // 4ème et 3ème (Mêmes matières et coefficients)
  if (g.includes('4') || g.includes('3')) {
    return [
      { name: 'Français', coeff: 4 },
      { name: 'Mathématiques', coeff: 3 },
      { name: 'Anglais', coeff: 2 },
      { name: 'Histoire-Géographie', coeff: 2 },
      { name: 'Physique-Chimie', coeff: 2 },
      { name: 'Sciences de la Vie et de la Terre (SVT)', coeff: 2 },
      { name: 'Langues Vivantes (Espagnol / Allemand)', coeff: 1 },
      { name: 'Éducation aux Droits de l’Homme (EDHC)', coeff: 1 },
      { name: 'Arts Plastiques / Éducation Musicale', coeff: 1 },
      { name: 'Éducation Physique et Sportive (EPS)', coeff: 1 },
      { name: 'Conduite', coeff: 1 },
    ];
  }

  // Lycée (2nde, 1ère, Terminale)
  return [
    { name: 'Français', coeff: g.includes('a') ? 4 : 3 },
    { name: 'Philosophie', coeff: g.includes('tle') ? 4 : 3 },
    { name: 'Mathématiques', coeff: g.includes('c') || g.includes('d') ? 5 : 4 },
    { name: 'Physique-Chimie', coeff: 4 },
    { name: 'Sciences de la Vie et de la Terre (SVT)', coeff: 4 },
    { name: 'Histoire-Géographie', coeff: 2 },
    { name: 'Anglais', coeff: 3 },
    { name: 'Langues Vivantes (Espagnol / Allemand)', coeff: 2 },
    { name: 'Éducation Physique et Sportive (EPS)', coeff: 1 },
    { name: 'Conduite', coeff: 1 },
  ];
}

// Base de fiches de cours pédagogiques conformes aux programmes officiels MENA
interface LessonSheet {
  id: string;
  grade: string;
  subject: string;
  term: string;
  chapterNumber: number;
  title: string;
  duration: string;
  prerequisites: string;
  objectives: string[];
  materials: string;
  summaryContent: string;
  activities: { step: string; teacherRole: string; studentRole: string; duration: string }[];
  evaluation: string;
}

const mockLessonSheets: LessonSheet[] = [
  // Mathématiques Collège
  {
    id: 'math-6e-01',
    grade: '6ème',
    subject: 'Mathématiques',
    term: 'Trimestre 1',
    chapterNumber: 1,
    title: 'Nombres entiers naturels et décimaux : Écriture et Comparaison',
    duration: '4 heures (2 séances de 2h)',
    prerequisites: 'Numération du primaire (CP1 à CM2), tables de multiplication.',
    objectives: [
      'Lire et écrire les nombres entiers et décimaux sous forme chiffrée et en lettres.',
      'Identifier la valeur de position de chaque chiffre (unités, dixièmes, centièmes).',
      'Comparer, ranger par ordre croissant/décroissant et encadrer des décimaux.',
    ],
    materials: 'Tableau, règle graduée, fiches d’exercices élèves, calculatrice basique.',
    summaryContent: 'Un nombre décimal est composé d’une partie entière et d’une partie décimale séparées par une virgule. La comparaison s’effectue d’abord sur la partie entière, puis rang par rang sur la partie décimale.',
    activities: [
      { step: '1. Phase d’accroche / Situation problème', teacherRole: 'Pose un problème de pesée de denrées au marché.', studentRole: 'Émettent des hypothèses et comparent les valeurs.', duration: '15 min' },
      { step: '2. Découverte & Structuration', teacherRole: 'Guide l’institutionnalisation de la règle de comparaison.', studentRole: 'Rédigent la trace écrite dans le cahier de cours.', duration: '40 min' },
      { step: '3. Application & Entraînement', teacherRole: 'Distribue les exercices d’application gradués.', studentRole: 'Résolvent individuellement puis en binômes.', duration: '45 min' },
      { step: '4. Évaluation formative', teacherRole: 'Contrôle rapide sur ardoise et correction immédiate.', studentRole: 'Auto-évaluation et remédiation.', duration: '20 min' },
    ],
    evaluation: 'Exercices d’encadrement au dixième près et problème d’achat avec monnaie.',
  },
  {
    id: 'fr-6e-01',
    grade: '6ème',
    subject: 'Français & Expression Écrite',
    term: 'Trimestre 1',
    chapterNumber: 1,
    title: 'Le schéma narratif du conte africain traditionnel',
    duration: '3 heures',
    prerequisites: 'Lecture courante, identification des personnages principaux.',
    objectives: [
      'Identifier les 5 étapes du schéma narratif (Situation initiale, Élément perturbateur, Péripéties, Dénouement, Situation finale).',
      'Repérer les formules d’ouverture et de clôture des contes traditionnels ivoiriens.',
      'Produire un court récit structuré respectant les étapes.',
    ],
    materials: 'Extrait de contes de Bernard Dadié ou Amadou Hampâté Bâ.',
    summaryContent: 'Le conte commence par une situation d’équilibre ("Il était une fois..."), rompue par un événement déclencheur. Le héros surmonte des épreuves grâce à des adjuvants avant de rétablir l’harmonie.',
    activities: [
      { step: '1. Lecture magistrale du conte', teacherRole: 'Lit expressivement le texte support.', studentRole: 'Écoute active et repérage des protagonistes.', duration: '20 min' },
      { step: '2. Analyse textuelle', teacherRole: 'Questionne sur l’évolution de l’intrigue.', studentRole: 'Découpent le texte en séquences narratives.', duration: '35 min' },
      { step: '3. Production écrite guidée', teacherRole: 'Donne une amorce et guide l’écriture de la péripétie.', studentRole: 'Rédigent un paragraphe narratif.', duration: '45 min' },
    ],
    evaluation: 'QCM de repérage des étapes et rédaction du dénouement.',
  },
  {
    id: 'pc-3e-01',
    grade: '3ème',
    subject: 'Physique-Chimie',
    term: 'Trimestre 1',
    chapterNumber: 1,
    title: 'Les solutions aqueuses acides, basiques et neutres : Mesure du pH',
    duration: '3 heures (TP inclus)',
    prerequisites: 'Notion de mélange, ions en solution.',
    objectives: [
      'Définir le pH d’une solution aqueuse (échelle de 0 à 14).',
      'Mesurer le pH à l’aide du papier pH et d’un pH-mètre.',
      'Classer les solutions du quotidien (jus de citron, eau savonneuse, eau pure).',
      'Appliquer les règles de sécurité en chimie.',
    ],
    materials: 'Tubes à essais, papier indicateur de pH, jus de citron, vinaigre, soude diluée, eau distillée.',
    summaryContent: 'Une solution est acide si pH < 7, neutre si pH = 7, basique si pH > 7. L’acidité est due à la présence d’ions H+ et la basicité aux ions OH-.',
    activities: [
      { step: '1. Expérience de laboratoire', teacherRole: 'Présente les échantillons et les consignes de sécurité.', studentRole: 'Réalisent les tests au papier pH en petits groupes.', duration: '40 min' },
      { step: '2. Interprétation des mesures', teacherRole: 'Centralise les résultats au tableau.', studentRole: 'Classent les solutions sur l’échelle de pH.', duration: '30 min' },
      { step: '3. Synthèse de cours', teacherRole: 'Formalise les définitions et équations ioniques.', studentRole: 'Notent le cours et les pictogrammes de sécurité.', duration: '30 min' },
    ],
    evaluation: 'Interprétation d’un test de pH inconnu et identification des ions majoritaires.',
  },
  {
    id: 'svt-3e-01',
    grade: '3ème',
    subject: 'Sciences de la Vie et de la Terre (SVT)',
    term: 'Trimestre 1',
    chapterNumber: 1,
    title: 'La transmission de l’information génétique : Chromosomes et Caryotype',
    duration: '4 heures',
    prerequisites: 'Structure de la cellule (noyau, cytoplasme, membrane).',
    objectives: [
      'Identifier les chromosomes comme support de l’information génétique.',
      'Analyser un caryotype humain (23 paires dont les chromosomes sexuels XX / XY).',
      'Expliquer l’origine des anomalies chromosomiques (ex: Trisomie 21).',
    ],
    materials: 'Microscope, photographies de caryotypes, schémas de mitose.',
    summaryContent: 'Chaque cellule humaine possède 46 chromosomes répartis en 23 paires. La 23ème paire détermine le sexe chromosomique (XX chez la femme, XY chez l’homme).',
    activities: [
      { step: '1. Observation microscopique', teacherRole: 'Guide la mise au point sur des cellules de racine d’oignon.', studentRole: 'Observent les filaments chromosomiques.', duration: '30 min' },
      { step: '2. Atelier Caryotype', teacherRole: 'Distribue les paires de chromosomes à apparier.', studentRole: 'Classent par ordre de taille et identifient la formule.', duration: '45 min' },
    ],
    evaluation: 'Détermination du sexe et dépistage d’anomalie sur un caryotype donné.',
  },
  {
    id: 'math-tle-01',
    grade: 'Terminale C',
    subject: 'Mathématiques',
    term: 'Trimestre 1',
    chapterNumber: 1,
    title: 'Continuité, Limites et Dérivabilité des fonctions numériques',
    duration: '6 heures',
    prerequisites: 'Dérivation en 1ère, calcul algébrique.',
    objectives: [
      'Calculer des limites indéterminées par factorisation, quantité conjuguée et taux d’accroissement.',
      'Appliquer le Théorème des Valeurs Intermédiaires (TVI) et son corollaire (Bijection).',
      'Étudier la dérivabilité d’une fonction et interpréter géométriquement.',
    ],
    materials: 'Calculatrice graphique, fiches d’annales BAC MENA.',
    summaryContent: 'Une fonction f est continue en x0 si lim f(x) = f(x0). Le TVI garantit l’existence de solutions pour l’équation f(x)=k sur un intervalle fermé borné.',
    activities: [
      { step: '1. Démonstration du TVI', teacherRole: 'Expose la démonstration rigoureuse.', studentRole: 'Analysent les hypothèses de continuité et de stricte monotonie.', duration: '45 min' },
      { step: '2. Résolution d’annales BAC', teacherRole: 'Sélectionne des sujets type BAC Côte d’Ivoire.', studentRole: 'Rédigent la preuve d’unicité de solution.', duration: '60 min' },
    ],
    evaluation: 'Problème de synthèse type BAC avec étude complète de fonction et TVI.',
  },
  {
    id: 'philo-tle-01',
    grade: 'Terminale A',
    subject: 'Philosophie',
    term: 'Trimestre 1',
    chapterNumber: 1,
    title: 'La Conscience, l’Inconscient et le Sujet : Liberté ou Déterminisme ?',
    duration: '4 heures',
    prerequisites: 'Méthodologie de la dissertation philosophique.',
    objectives: [
      'Définir la conscience (réflexive, morale, psychologique) selon Descartes et Kant.',
      'Analyser l’hypothèse freudienne de l’inconscient (Ça, Moi, Surmoi).',
      'Débattre de la portée de la liberté humaine face aux pulsions inconscientes.',
    ],
    materials: 'Textes de René Descartes (Méditations) et Sigmund Freud (Introduction à la psychanalyse).',
    summaryContent: 'Alors que Descartes pose le Cogito comme fondement de la certitude et de la liberté du sujet, Freud démontre que "le Moi n’est pas maître dans sa propre maison", introduisant la notion de déterminisme psychique.',
    activities: [
      { step: '1. Explication de texte guidée', teacherRole: 'Présente le problème philosophique.', studentRole: 'Dégagent la thèse, le thème et les enjeux du texte.', duration: '45 min' },
      { step: '2. Débat philosophique structuré', teacherRole: 'Anime la controverse Descartes vs Freud.', studentRole: 'Argumentent avec rigueur conceptuelle.', duration: '40 min' },
    ],
    evaluation: 'Plan détaillé de dissertation : "L’inconscient est-il un obstacle à la liberté ?"',
  },
];

interface GradesViewProps {
  initialStudents: Student[];
  school: School;
  schoolSlug: string;
}

export function GradesView({
  initialStudents,
  school,
  schoolSlug,
}: GradesViewProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [currentSchool, setCurrentSchool] = useState<School>(school);

  // 3 Blocs : 'college' | 'lycee' | 'pedagogie'
  const [activeTab, setActiveTab] = useState<'college' | 'lycee' | 'pedagogie'>('college');
  const [selectedClass, setSelectedClass] = useState<string>('6ème');
  const [selectedSubject, setSelectedSubject] = useState<string>('Français');
  const [selectedTerm, setSelectedTerm] = useState<'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3'>('Trimestre 1');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // État d'ouverture / fermeture des portails de saisie des notes (Contrôle Administrateur)
  const [portalStatus, setPortalStatus] = useState<GradesPortalStatus>(() => {
    return getGradesPortalStatus(schoolSlug);
  });

  useEffect(() => {
    const loadPortal = () => {
      setPortalStatus(getGradesPortalStatus(schoolSlug));
    };
    loadPortal();
    window.addEventListener(DATA_UPDATED_EVENT, loadPortal);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, loadPortal);
  }, [schoolSlug]);

  const handleTogglePortal = () => {
    const nextOpen = !portalStatus.isOpen;
    const updated: GradesPortalStatus = {
      isOpen: nextOpen,
      closedMessage: 'Les portails de saisie des notes sont actuellement fermés par la Direction des Études. Veuillez contacter l’administrateur pour ouvrir l’accès.',
      updatedBy: currentSchool.directorName || currentSchool.founderName || 'Direction des Études',
      updatedAt: new Date().toLocaleDateString('fr-FR'),
    };
    setPortalStatus(updated);
    saveGradesPortalStatus(schoolSlug, updated);
  };

  // Modale pour voir une fiche de cours détaillée
  const [selectedLessonModal, setSelectedLessonModal] = useState<LessonSheet | null>(null);

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

  // Config des cycles
  const cyclesConfig = useMemo(() => {
    return {
      college: {
        label: 'Cycle Collège (6ème à 3ème)',
        sub: 'Saisie & gestion des notes trimestrielles',
        icon: Building2,
        classes: ['6ème', '5ème', '4ème', '3ème'],
      },
      lycee: {
        label: 'Cycle Lycée (2nde à Terminale)',
        sub: 'Saisie & gestion des notes du Secondaire Général',
        icon: Layers,
        classes: [
          '2nde A',
          '2nde C',
          '2nde D',
          '1ère A',
          '1ère C',
          '1ère D',
          'Terminale A',
          'Terminale C',
          'Terminale D',
        ],
      },
      pedagogie: {
        label: 'Pédagogie & Fiches de Cours',
        sub: 'Fiches de préparation, leçons & ressources MENA',
        icon: BookOpen,
        classes: [
          '6ème',
          '5ème',
          '4ème',
          '3ème',
          '2nde A',
          '2nde C',
          '2nde D',
          '1ère A',
          '1ère C',
          '1ère D',
          'Terminale A',
          'Terminale C',
          'Terminale D',
        ],
      },
    };
  }, []);

  const currentSubjects = useMemo(() => {
    return getSubjectsForClass(selectedClass);
  }, [selectedClass]);

  // Si la matière sélectionnée n'est pas dans la liste de la classe, sélectionner la 1ère
  useEffect(() => {
    if (activeTab === 'pedagogie') return;
    const exists = currentSubjects.some((s) => s.name === selectedSubject);
    if (!exists && currentSubjects.length > 0) {
      setSelectedSubject(currentSubjects[0].name);
    }
  }, [selectedClass, currentSubjects, selectedSubject, activeTab]);

  const handleTabChange = (tab: 'college' | 'lycee' | 'pedagogie') => {
    setActiveTab(tab);
    if (tab === 'college') {
      setSelectedClass('6ème');
      setSelectedSubject(getSubjectsForClass('6ème')[0].name);
    } else if (tab === 'lycee') {
      setSelectedClass('2nde A');
      setSelectedSubject(getSubjectsForClass('2nde A')[0].name);
    } else {
      setSelectedClass('6ème');
      setSelectedSubject('Toutes les matières');
    }
  };

  // Liste des élèves de la classe sélectionnée (pour les notes)
  const classStudents = useMemo(() => {
    return students.filter((s) => s.grade === selectedClass);
  }, [students, selectedClass]);

  // Clé de stockage pour les notes
  const storageKey = `schoolflow_grades_${schoolSlug}_${selectedClass}_${selectedSubject.replace(/\s+/g, '_')}_${selectedTerm.replace(/\s+/g, '_')}`;

  // État local des notes (Initialisé à vide)
  const [gradesMap, setGradesMap] = useState<Record<string, GradeEntry>>({});

  // Charger les notes depuis localStorage ou laisser complètement vide
  useEffect(() => {
    if (activeTab === 'pedagogie') return;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setGradesMap(JSON.parse(saved));
          return;
        }
      } catch (e) {
        // ignore
      }
    }

    // Par défaut : champs de notes strictement vides
    const emptyMap: Record<string, GradeEntry> = {};
    classStudents.forEach((stu) => {
      emptyMap[stu.id] = {
        int1: '',
        int2: '',
        int3: '',
        int4: '',
        int5: '',
        dev1: '',
        dev2: '',
        comp: '',
        customAppreciation: '',
      };
    });
    setGradesMap(emptyMap);
  }, [selectedClass, selectedSubject, selectedTerm, classStudents.length, storageKey, activeTab]);

  // Modification d'une note
  const handleNoteChange = (studentId: string, field: keyof GradeEntry, val: string) => {
    setGradesMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {
          int1: '',
          int2: '',
          int3: '',
          int4: '',
          int5: '',
          dev1: '',
          dev2: '',
          comp: '',
          customAppreciation: '',
        }),
        [field]: val,
      },
    }));
  };

  // Vider toutes les notes de la classe
  const handleResetAllGrades = () => {
    if (confirm(`Voulez-vous réinitialiser et effacer toutes les notes de la classe de ${selectedClass} en ${selectedSubject} (${selectedTerm}) ?`)) {
      const emptyMap: Record<string, GradeEntry> = {};
      classStudents.forEach((stu) => {
        emptyMap[stu.id] = {
          int1: '',
          int2: '',
          int3: '',
          int4: '',
          int5: '',
          dev1: '',
          dev2: '',
          comp: '',
          customAppreciation: '',
        };
      });
      setGradesMap(emptyMap);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey);
      }
      setSavedSuccess(false);
    }
  };

  // Traitement et calcul des moyennes
  const processedGrades = useMemo(() => {
    const list = classStudents.map((stu) => {
      const g = gradesMap[stu.id] || {
        int1: '',
        int2: '',
        int3: '',
        int4: '',
        int5: '',
        dev1: '',
        dev2: '',
        comp: '',
        customAppreciation: '',
      };

      const interros = [g.int1, g.int2, g.int3, g.int4, g.int5]
        .map((val) => (val !== '' && !isNaN(parseFloat(val)) ? parseFloat(val) : null))
        .filter((val): val is number => val !== null);

      const devoirs = [g.dev1, g.dev2]
        .map((val) => (val !== '' && !isNaN(parseFloat(val)) ? parseFloat(val) : null))
        .filter((val): val is number => val !== null);

      const compVal = g.comp !== '' && !isNaN(parseFloat(g.comp)) ? parseFloat(g.comp) : null;

      const hasAnyNote = interros.length > 0 || devoirs.length > 0 || compVal !== null;

      let calculatedMoyenne: number | null = null;
      let appreciation = '';

      if (hasAnyNote) {
        const avgInt = interros.length > 0 ? interros.reduce((a, b) => a + b, 0) / interros.length : null;
        const avgDev = devoirs.length > 0 ? devoirs.reduce((a, b) => a + b, 0) / devoirs.length : null;

        if (avgInt !== null && avgDev !== null && compVal !== null) {
          const controlAvg = (avgInt + avgDev) / 2;
          calculatedMoyenne = Math.round(((controlAvg + compVal * 2) / 3) * 100) / 100;
        } else {
          const allNotes = [...interros, ...devoirs, ...(compVal !== null ? [compVal, compVal] : [])];
          calculatedMoyenne = Math.round((allNotes.reduce((a, b) => a + b, 0) / allNotes.length) * 100) / 100;
        }

        if (g.customAppreciation && g.customAppreciation.trim() !== '') {
          appreciation = g.customAppreciation.trim();
        } else if (calculatedMoyenne >= 16) {
          appreciation = 'Très Bien (Tableau d’Honneur)';
        } else if (calculatedMoyenne >= 14) {
          appreciation = 'Bien (Encouragements)';
        } else if (calculatedMoyenne >= 12) {
          appreciation = 'Assez Bien';
        } else if (calculatedMoyenne >= 10) {
          appreciation = 'Passable / Doit persévérer';
        } else {
          appreciation = 'Insuffisant / Effort soutenu requis';
        }
      }

      return {
        studentId: stu.id,
        studentNumber: stu.studentNumber,
        matricule: stu.matricule,
        fullName: stu.fullName,
        gender: stu.gender,
        grade: stu.grade,
        grades: g,
        hasNotes: hasAnyNote,
        moyenne: calculatedMoyenne,
        appreciation,
      };
    });

    const withMoy = list.filter((item) => item.moyenne !== null) as Array<(typeof list)[0] & { moyenne: number }>;
    withMoy.sort((a, b) => b.moyenne - a.moyenne);

    const rankMap = new Map<string, number>();
    withMoy.forEach((item, index) => {
      rankMap.set(item.studentId, index + 1);
    });

    return list.map((item) => ({
      ...item,
      rank: rankMap.get(item.studentId) || null,
    }));
  }, [classStudents, gradesMap]);

  // Filtrage par recherche
  const filteredGrades = useMemo(() => {
    return processedGrades.filter((g) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        q === '' ||
        g.fullName.toLowerCase().includes(q) ||
        g.matricule.toLowerCase().includes(q) ||
        g.studentNumber.toLowerCase().includes(q)
      );
    });
  }, [processedGrades, searchQuery]);

  // Statistiques calculées
  const classStats = useMemo(() => {
    const graded = processedGrades.filter((g) => g.moyenne !== null) as Array<(typeof processedGrades)[0] & { moyenne: number }>;
    if (graded.length === 0) {
      return {
        classAvg: '—',
        maxNote: '—',
        minNote: '—',
        successRate: '0',
        countGraded: 0,
      };
    }
    const sum = graded.reduce((acc, g) => acc + g.moyenne, 0);
    const avg = (sum / graded.length).toFixed(2);
    const max = Math.max(...graded.map((g) => g.moyenne)).toFixed(2);
    const min = Math.min(...graded.map((g) => g.moyenne)).toFixed(2);
    const successCount = graded.filter((g) => g.moyenne >= 10).length;
    const rate = ((successCount / graded.length) * 100).toFixed(0);

    return {
      classAvg: `${avg} / 20`,
      maxNote: `${max} / 20`,
      minNote: `${min} / 20`,
      successRate: rate,
      countGraded: graded.length,
    };
  }, [processedGrades]);

  // Enregistrer les notes dans localStorage
  // Enregistrer les notes dans localStorage
  const handleSaveGrades = () => {
    if (!portalStatus.isOpen) {
      alert('Action impossible : Les portails de saisie des notes sont actuellement fermés par la Direction des Études.');
      return;
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(gradesMap));
      } catch (e) {
        // ignore
      }
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 5000);
  };

  // Filtrage des fiches de cours pédagogiques
  const filteredLessonSheets = useMemo(() => {
    return mockLessonSheets.filter((sheet) => {
      const matchesClass = selectedClass === 'all' || sheet.grade.toLowerCase() === selectedClass.toLowerCase();
      const matchesSubject = selectedSubject === 'Toutes les matières' || sheet.subject.toLowerCase().includes(selectedSubject.toLowerCase());
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        sheet.title.toLowerCase().includes(q) ||
        sheet.subject.toLowerCase().includes(q) ||
        sheet.grade.toLowerCase().includes(q);

      return matchesClass && matchesSubject && matchesSearch;
    });
  }, [selectedClass, selectedSubject, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {activeTab === 'pedagogie'
                ? 'Espace Pédagogie & Fiches de Cours'
                : 'Pédagogie, Saisie des Notes & Évaluations'}
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            {activeTab === 'pedagogie'
              ? 'Fiches de préparation, plans de cours et ressources pédagogiques officielles MENA pour toutes les classes'
              : `Saisie des 5 interrogations, 2 devoirs et compositions du Secondaire (Collège & Lycée) — ${currentSchool.name}`}
          </p>
        </div>

        {/* Actions Rapides (si dans saisie des notes) */}
        {activeTab !== 'pedagogie' ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleResetAllGrades}
              disabled={!portalStatus.isOpen}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                portalStatus.isOpen
                  ? 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer'
                  : 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-60'
              }`}
              title={portalStatus.isOpen ? 'Vider toutes les colonnes' : 'Portail fermé'}
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Effacer / Réinitialiser</span>
            </button>

            <button
              type="button"
              onClick={handleSaveGrades}
              disabled={!portalStatus.isOpen}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all transform shadow-sm ${
                portalStatus.isOpen
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-emerald-600/30 hover:-translate-y-0.5 cursor-pointer'
                  : 'bg-slate-400 opacity-60 cursor-not-allowed'
              }`}
            >
              {portalStatus.isOpen ? (
                <>
                  <Save className="w-4 h-4" />
                  <span>Enregistrer les Notes</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Portail Fermé</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="https://pedagogie.men-drena.ci"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-sm shadow-purple-600/30 transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Portail Pédagogique MENA</span>
            </a>
          </div>
        )}
      </div>

      {/* BANDEAU DE GESTION DU PORTAIL DE SAISIE DES NOTES (CONTRÔLE ADMINISTRATEUR) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div className="flex items-start md:items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                portalStatus.isOpen
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}
            >
              {portalStatus.isOpen ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              ) : (
                <Lock className="w-5 h-5 text-rose-600" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 font-heading">
                  Portail Pédagogique de Saisie des Notes :
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${
                    portalStatus.isOpen
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      portalStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  {portalStatus.isOpen ? 'PORTAIL OUVERT (Saisie autorisée)' : 'PORTAIL FERMÉ (Saisie verrouillée)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {portalStatus.isOpen
                  ? 'Les enseignants et professeurs ont actuellement l’autorisation de renseigner et modifier les notes d’interrogations et devoirs.'
                  : `Accès verrouillé par la Direction (${portalStatus.updatedBy}). Les enseignants ne peuvent plus modifier les notes.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTogglePortal}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                portalStatus.isOpen
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
            >
              {portalStatus.isOpen ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Fermer les Portails</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Ouvrir l’Accès aux Notes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Alerte si le portail est fermé */}
      {!portalStatus.isOpen && activeTab !== 'pedagogie' && (
        <div className="bg-rose-50 border-2 border-rose-300 text-rose-950 p-4 rounded-2xl flex items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <h4 className="font-extrabold text-xs sm:text-sm text-rose-950 font-heading">
                Saisie des Notes Temporairement Verrouillée
              </h4>
              <p className="text-xs text-rose-800 mt-0.5 font-medium">
                {portalStatus.closedMessage} Vous pouvez consulter les notes existantes, mais aucune modification ne peut être enregistrée tant que l’administrateur n’a pas ouvert le portail.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Alerte succès de sauvegarde */}
      {savedSuccess && activeTab !== 'pedagogie' && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Toutes les notes, moyennes et appréciations de la classe de <strong>{selectedClass}</strong> en <strong>{selectedSubject}</strong> ({selectedTerm}) ont été enregistrées avec succès !
            </span>
          </div>
          <button type="button" onClick={() => setSavedSuccess(false)} className="text-emerald-700 font-bold hover:text-emerald-950">
            ✕
          </button>
        </div>
      )}

      {/* 2. LES 3 BLOCS DU HAUT (Collège, Lycée & Pédagogie Fiches de Cours) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {(Object.keys(cyclesConfig) as Array<keyof typeof cyclesConfig>).map((tabKey) => {
          const cfg = cyclesConfig[tabKey];
          const Icon = cfg.icon;
          const isActive = activeTab === tabKey;
          const isPedago = tabKey === 'pedagogie';

          return (
            <button
              key={tabKey}
              type="button"
              onClick={() => handleTabChange(tabKey)}
              className={`p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                isActive
                  ? isPedago
                    ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white border-purple-600 shadow-md shadow-purple-600/20'
                    : 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : isPedago
                    ? 'bg-purple-50 text-purple-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold block truncate font-heading">{cfg.label}</span>
                <span className={`text-[11px] block truncate ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                  {cfg.sub}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ================= CONDITIONNEL : ESPACE PÉDAGOGIE & FICHES DE COURS ================= */}
      {activeTab === 'pedagogie' ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Barre de filtrage par Classe & Matière pour les fiches */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-heading flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-purple-600" />
                  <span>Répertoire des Fiches Pédagogiques & Guides de Cours</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Sélectionnez une classe ou une discipline pour accéder aux leçons complètes prêtes à enseigner
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une leçon, chapitre..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium"
                />
              </div>
            </div>

            {/* Sélecteur de Classes */}
            <div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                1. Filtrer par Niveau / Classe :
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {['all', '6ème', '5ème', '4ème', '3ème', '2nde A', '2nde C', '1ère A', '1ère D', 'Terminale A', 'Terminale C'].map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setSelectedClass(cls)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedClass === cls
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cls === 'all' ? 'Toutes les Classes' : cls}
                  </button>
                ))}
              </div>
            </div>

            {/* Sélecteur de Matières */}
            <div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                2. Filtrer par Discipline :
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  'Toutes les matières',
                  'Mathématiques',
                  'Français',
                  'Physique-Chimie',
                  'SVT',
                  'Philosophie',
                  'Anglais',
                  'Histoire-Géographie',
                ].map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setSelectedSubject(subj)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedSubject === subj
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grille des Fiches de Cours Disponibles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredLessonSheets.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 p-8">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-700">Aucune fiche de cours ne correspond à ces critères.</p>
                <p className="text-xs text-slate-400 mt-1">Modifiez vos filtres de classe ou de matière ci-dessus.</p>
              </div>
            ) : (
              filteredLessonSheets.map((sheet) => (
                <div
                  key={sheet.id}
                  className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                        {sheet.grade} • {sheet.subject}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {sheet.term}
                      </span>
                    </div>

                    <h4 className="text-sm font-extrabold text-slate-950 font-heading group-hover:text-purple-700 transition-colors leading-snug">
                      Chapitre {sheet.chapterNumber} : {sheet.title}
                    </h4>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {sheet.summaryContent}
                    </p>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <strong className="font-semibold">Durée :</strong> {sheet.duration}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <strong className="font-semibold">Objectifs :</strong> {sheet.objectives.length} compétences visées
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLessonModal(sheet)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Consulter la Fiche</span>
                    </button>

                    <a
                      href="https://pedagogie.men-drena.ci"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-slate-600 hover:text-purple-700 bg-slate-100 hover:bg-purple-50 transition-all cursor-pointer"
                      title="Télécharger sur le portail officiel"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* ================= VUE SAISIE DES NOTES (COLLÈGE & LYCÉE) ================= */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 3. Sélecteur de Classes, Matières & Trimestre */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
            {/* Classes */}
            <div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                1. Classe ({cyclesConfig[activeTab].label}) :
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {cyclesConfig[activeTab].classes.map((cls) => {
                  const isSelected = selectedClass === cls;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setSelectedClass(cls)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Matières */}
            <div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                2. Matière / Discipline :
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {currentSubjects.map((sub) => {
                  const isSelected = selectedSubject === sub.name;
                  return (
                    <button
                      key={sub.name}
                      type="button"
                      onClick={() => setSelectedSubject(sub.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{sub.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-600'}`}>
                        Coeff {sub.coeff}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trimestre */}
            <div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                3. Période d&apos;Évaluation :
              </span>
              <div className="flex items-center gap-2">
                {(['Trimestre 1', 'Trimestre 2', 'Trimestre 3'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTerm(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedTerm === t
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. KPI Résumé de la Classe */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Élèves Notés</span>
              <span className="text-xl font-black text-slate-900 font-heading">
                {classStats.countGraded} / {processedGrades.length}
              </span>
              <span className="text-[10px] text-slate-500 block">{selectedClass} • {selectedSubject}</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs bg-emerald-50/20">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Moyenne de Classe</span>
              <span className="text-xl font-black text-emerald-900 font-heading">{classStats.classAvg}</span>
              <span className="text-[10px] text-emerald-700 block">Sur les notes saisies</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Note Max / Min</span>
              <span className="text-xl font-black text-slate-900 font-heading">
                {classStats.maxNote} / {classStats.minNote}
              </span>
              <span className="text-[10px] text-slate-500 block">Extrêmes calculés</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-blue-200/80 shadow-xs bg-blue-50/20">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">Taux de Réussite</span>
              <span className="text-xl font-black text-blue-900 font-heading">{classStats.successRate}%</span>
              <span className="text-[10px] text-blue-700 block">Moyenne &ge; 10 / 20</span>
            </div>
          </div>

          {/* 5. Grille de Saisie Complète des Notes */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 font-heading">
                  Saisie des Évaluations — Classe de {selectedClass} • {selectedSubject} ({selectedTerm})
                </h2>
                <p className="text-xs text-slate-500">
                  Saisissez les notes dictées (sur 20) dans les colonnes d&apos;interrogations et devoirs ci-dessous
                </p>
              </div>

              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un élève..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                />
              </div>
            </div>

            {/* Tableau */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1050px]">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 pl-4 pr-2 text-center w-12">Rang</th>
                    <th className="py-3 px-3 min-w-[180px]">Matricule & Élève</th>
                    <th className="py-3 px-2 text-center w-12">Genre</th>
                    <th className="py-3 px-1.5 text-center bg-blue-50/40 text-blue-900 w-16">Int. 1</th>
                    <th className="py-3 px-1.5 text-center bg-blue-50/40 text-blue-900 w-16">Int. 2</th>
                    <th className="py-3 px-1.5 text-center bg-blue-50/40 text-blue-900 w-16">Int. 3</th>
                    <th className="py-3 px-1.5 text-center bg-blue-50/40 text-blue-900 w-16">Int. 4</th>
                    <th className="py-3 px-1.5 text-center bg-blue-50/40 text-blue-900 w-16">Int. 5</th>
                    <th className="py-3 px-2 text-center bg-amber-50/50 text-amber-900 whitespace-nowrap min-w-[75px]">Devoir 1</th>
                    <th className="py-3 px-2 text-center bg-amber-50/50 text-amber-900 whitespace-nowrap min-w-[75px]">Devoir 2</th>
                    <th className="py-3 px-1.5 text-center bg-emerald-50/60 text-emerald-950 w-20">Composition</th>
                    <th className="py-3 px-2 text-center bg-emerald-100/80 text-emerald-950 font-black w-24">Moyenne Finale</th>
                    <th className="py-3 pr-4 px-3 min-w-[220px]">Appréciation du Professeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredGrades.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-400">
                        Aucun élève trouvé dans la classe {selectedClass}.
                      </td>
                    </tr>
                  ) : (
                    filteredGrades.map((g, idx) => {
                      const entry = g.grades;

                      return (
                        <tr key={g.studentId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 pl-4 pr-2 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-mono font-bold text-[11px] ${
                                g.rank === 1
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                                  : g.rank === 2
                                  ? 'bg-slate-200 text-slate-800'
                                  : g.rank === 3
                                  ? 'bg-amber-50 text-amber-800'
                                  : g.rank !== null
                                  ? 'text-slate-600 bg-slate-100'
                                  : 'text-slate-300'
                              }`}
                            >
                              {g.rank ? `${g.rank}${g.rank === 1 ? 'er' : 'e'}` : (idx + 1).toString().padStart(2, '0')}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="font-extrabold text-slate-900 block font-heading uppercase text-xs truncate max-w-[180px]">
                              {g.fullName}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 font-medium">
                              {g.matricule}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-center">
                            <GenderBadge gender={g.gender} />
                          </td>

                          <td className="py-2 px-1 text-center bg-blue-50/20">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max="20"
                              value={entry.int1}
                              placeholder="—"
                              disabled={!portalStatus.isOpen}
                              onChange={(e) => handleNoteChange(g.studentId, 'int1', e.target.value)}
                              className="w-14 px-1.5 py-1 text-xs text-center font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </td>

                          <td className="py-2 px-1 text-center bg-blue-50/20">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max="20"
                              value={entry.int2}
                              placeholder="—"
                              disabled={!portalStatus.isOpen}
                              onChange={(e) => handleNoteChange(g.studentId, 'int2', e.target.value)}
                              className="w-14 px-1.5 py-1 text-xs text-center font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </td>

                          <td className="py-2 px-1 text-center bg-blue-50/20">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max="20"
                              value={entry.int3}
                              placeholder="—"
                              disabled={!portalStatus.isOpen}
                              onChange={(e) => handleNoteChange(g.studentId, 'int3', e.target.value)}
                              className="w-14 px-1.5 py-1 text-xs text-center font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </td>

                          <td className="py-2 px-1 text-center bg-blue-50/20">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max="20"
                              value={entry.int4}
                              placeholder="—"
                              disabled={!portalStatus.isOpen}
                              onChange={(e) => handleNoteChange(g.studentId, 'int4', e.target.value)}
                              className="w-14 px-1.5 py-1 text-xs text-center font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </td>

                          <td className="py-2 px-1 text-center bg-blue-50/20">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max="20"
                              value={entry.int5}
                              placeholder="—"
                              disabled={!portalStatus.isOpen}
                              onChange={(e) => handleNoteChange(g.studentId, 'int5', e.target.value)}
                              className="w-14 px-1.5 py-1 text-xs text-center font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </td>

                          <td className="py-2 px-1 text-center bg-amber-50/30">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max="20"
                              value={entry.dev1}
                              placeholder="—"
                              disabled={!portalStatus.isOpen}
                              onChange={(e) => handleNoteChange(g.studentId, 'dev1', e.target.value)}
                              className="w-14 px-1.5 py-1 text-xs text-center font-mono font-bold text-slate-900 bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </td>

                          <td className="py-2 px-1 text-center bg-amber-50/30">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max="20"
                              value={entry.dev2}
                              placeholder="—"
                              disabled={!portalStatus.isOpen}
                              onChange={(e) => handleNoteChange(g.studentId, 'dev2', e.target.value)}
                              className="w-14 px-1.5 py-1 text-xs text-center font-mono font-bold text-slate-900 bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </td>

                          <td className="py-2 px-1.5 text-center bg-emerald-50/40">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max="20"
                              value={entry.comp}
                              placeholder="—"
                              disabled={!portalStatus.isOpen}
                              onChange={(e) => handleNoteChange(g.studentId, 'comp', e.target.value)}
                              className="w-16 px-1.5 py-1 text-xs text-center font-mono font-black text-emerald-950 bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </td>

                          <td className="py-2.5 px-2 text-center bg-emerald-50/50 font-mono font-black text-xs">
                            {g.moyenne !== null ? (
                              <span
                                className={`px-2 py-0.5 rounded-md inline-block font-mono ${
                                  g.moyenne >= 14
                                    ? 'bg-emerald-100 text-emerald-950 border border-emerald-200'
                                    : g.moyenne >= 10
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {g.moyenne.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono font-normal">—</span>
                            )}
                          </td>

                          <td className="py-2 pr-4 px-3">
                            <input
                              type="text"
                              value={entry.customAppreciation || g.appreciation}
                              placeholder="Appréciation du professeur..."
                              disabled={!portalStatus.isOpen}
                              onChange={(e) => handleNoteChange(g.studentId, 'customAppreciation', e.target.value)}
                              className="w-full px-2.5 py-1 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE VISUALISATION DE LA FICHE DE COURS PÉDAGOGIQUE ================= */}
      {selectedLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold shrink-0">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-purple-700 block">
                    Fiche Pédagogique MENA • {selectedLessonModal.grade} ({selectedLessonModal.subject})
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 font-heading">
                    Chapitre {selectedLessonModal.chapterNumber} : {selectedLessonModal.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLessonModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Détails de la Fiche */}
            <div className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-purple-50/60 border border-purple-200/80">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Durée prévue</span>
                  <strong className="text-slate-900 font-bold">{selectedLessonModal.duration}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Période</span>
                  <strong className="text-slate-900 font-bold">{selectedLessonModal.term}</strong>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Matériel</span>
                  <strong className="text-slate-900 font-bold">{selectedLessonModal.materials}</strong>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1.5">1. Prérequis des Élèves</h4>
                <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed">
                  {selectedLessonModal.prerequisites}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1.5">2. Objectifs Pédagogiques & Compétences</h4>
                <ul className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                  {selectedLessonModal.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1.5">3. Déroulement de la Séance</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2">Étape</th>
                        <th className="p-2">Activité Enseignant</th>
                        <th className="p-2">Activité Élève</th>
                        <th className="p-2 text-right">Durée</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedLessonModal.activities.map((act, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-purple-900">{act.step}</td>
                          <td className="p-2 text-slate-700">{act.teacherRole}</td>
                          <td className="p-2 text-slate-700">{act.studentRole}</td>
                          <td className="p-2 text-right font-mono text-slate-500">{act.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1.5">4. Évaluation Formative & Devoirs</h4>
                <p className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 text-emerald-900">
                  {selectedLessonModal.evaluation}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <a
                href="https://pedagogie.men-drena.ci"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-purple-900 bg-purple-100 hover:bg-purple-200 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger Fiche Officielle (PDF / Word)</span>
              </a>

              <button
                type="button"
                onClick={() => setSelectedLessonModal(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer"
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
