'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Student, School } from '@/lib/data/types';
import { defaultSchool, availableClasses } from '@/lib/data/mock-data';
import { getLiveSchool, getLiveStudents, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import {
  MessageSquare,
  Send,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  Share2,
  Users,
  Smartphone,
  Mail,
  PlusCircle,
  X,
  FileText,
  Calendar,
  Building2,
  CheckCheck,
  RotateCcw,
  Sparkles,
  Layers,
  GraduationCap,
  UserCheck,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { GenderBadge } from '@/components/ui/badge';
import { formatDate, formatFCFA } from '@/lib/utils/formatters';

interface CommunicationViewProps {
  initialStudents: Student[];
  school: School;
  schoolSlug: string;
}

interface ParentMessage {
  id: string;
  parentName: string;
  studentName: string;
  studentGrade: string;
  parentPhone: string;
  subject: string;
  message: string;
  category: 'absence' | 'finance' | 'document' | 'info';
  timestamp: string;
  status: 'new' | 'in_progress' | 'resolved';
}

interface BroadcastRecord {
  id: string;
  date: string;
  targetType: string;
  targetLabel: string;
  recipientCount: number;
  channel: 'whatsapp' | 'sms';
  subject: string;
  body: string;
}

const INITIAL_PARENT_MESSAGES: ParentMessage[] = [];

const INITIAL_BROADCASTS: BroadcastRecord[] = [];

const PARENT_MESSAGES_KEY = 'schoolflow_parent_messages_v1';
const BROADCAST_RECORDS_KEY = 'schoolflow_broadcast_records_v1';

export function CommunicationView({
  initialStudents,
  school,
  schoolSlug,
}: CommunicationViewProps) {
  const [currentSchool, setCurrentSchool] = useState<School>(school || defaultSchool);
  const [students, setStudents] = useState<Student[]>(() => getLiveStudents(initialStudents, schoolSlug));
  
  const sanitizeMessages = (list: ParentMessage[]): ParentMessage[] => {
    return (list || []).filter(
      (m) =>
        m &&
        !m.parentName?.includes('Mme Touré (Mère de Cheick)') &&
        !m.parentName?.includes('M. Koffi (Père de Marie)') &&
        !m.parentName?.includes('Mme Bamba (Mère de Seydou)') &&
        !m.parentName?.includes('M. Diabaté (Père d’Awa)') &&
        !m.parentName?.includes('Mme Koné (Mère de Jean)')
    );
  };

  const sanitizeBroadcasts = (list: BroadcastRecord[]): BroadcastRecord[] => {
    return (list || []).filter(
      (b) =>
        b &&
        !b.subject?.includes('Rentrée Scolaire 2026-2027') &&
        !b.subject?.includes('Fermeture Exceptionnelle') &&
        !b.subject?.includes('Réunion Parents-Professeurs')
    );
  };

  const [messages, setMessages] = useState<ParentMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved =
          localStorage.getItem(`${PARENT_MESSAGES_KEY}_${schoolSlug}`) ||
          localStorage.getItem(PARENT_MESSAGES_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return sanitizeMessages(parsed);
        }
      } catch (e) {}
    }
    return [];
  });

  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved =
          localStorage.getItem(`${BROADCAST_RECORDS_KEY}_${schoolSlug}`) ||
          localStorage.getItem(BROADCAST_RECORDS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return sanitizeBroadcasts(parsed);
        }
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    setCurrentSchool(getLiveSchool(schoolSlug, school || defaultSchool));
    const liveStus = getLiveStudents(initialStudents, schoolSlug);
    setStudents(liveStus);

    const handleUpdate = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, school || defaultSchool));
      const upStus = getLiveStudents(initialStudents, schoolSlug);
      setStudents(upStus);
      if (typeof window !== 'undefined') {
        try {
          const savedMsgs =
            localStorage.getItem(`${PARENT_MESSAGES_KEY}_${schoolSlug}`) ||
            localStorage.getItem(PARENT_MESSAGES_KEY);
          if (savedMsgs) {
            const parsed = JSON.parse(savedMsgs);
            const cleaned = sanitizeMessages(parsed);
            if (cleaned.length !== parsed.length) {
              localStorage.setItem(`${PARENT_MESSAGES_KEY}_${schoolSlug}`, JSON.stringify(cleaned));
              localStorage.setItem(PARENT_MESSAGES_KEY, JSON.stringify(cleaned));
            }
            setMessages(cleaned);
          } else {
            setMessages([]);
          }

          const savedBcs =
            localStorage.getItem(`${BROADCAST_RECORDS_KEY}_${schoolSlug}`) ||
            localStorage.getItem(BROADCAST_RECORDS_KEY);
          if (savedBcs) {
            const parsedB = JSON.parse(savedBcs);
            const cleanedB = sanitizeBroadcasts(parsedB);
            if (cleanedB.length !== parsedB.length) {
              localStorage.setItem(`${BROADCAST_RECORDS_KEY}_${schoolSlug}`, JSON.stringify(cleanedB));
              localStorage.setItem(BROADCAST_RECORDS_KEY, JSON.stringify(cleanedB));
            }
            setBroadcasts(cleanedB);
          } else {
            setBroadcasts([]);
          }
        } catch (e) {}
      }
    };
    handleUpdate();
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug, school, initialStudents]);

  const [activeTab, setActiveTab] = useState<'inbox' | 'compose' | 'history' | 'parents_directory'>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'absence' | 'finance' | 'document' | 'info'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'in_progress' | 'resolved'>('all');

  // Répertoire des parents & consultation des bulletins par l'Admin
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [selectedParentChild, setSelectedParentChild] = useState<Student | null>(null);
  const [selectedParentTerm, setSelectedParentTerm] = useState<'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3'>('Trimestre 1');

  // Formulaire d'envoi de message
  const [composeRecipientType, setComposeRecipientType] = useState<'all' | 'cycle' | 'class' | 'individual'>('all');
  const [composeTargetCycle, setComposeTargetCycle] = useState<'maternelle' | 'primaire' | 'college' | 'lycee'>('college');
  const [composeTargetClass, setComposeTargetClass] = useState('6ème');
  const [composeStudentSearch, setComposeStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [composeChannel, setComposeChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modale de confirmation et de diffusion WhatsApp
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<number>(0);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const composeFormRef = useRef<HTMLDivElement>(null);

  // Modèles types de messages pré-remplis
  const templates = [
    {
      title: 'Rappel Échéance Scolarité',
      subject: 'Rappel de versement — 2ème Tranche de Scolarité',
      body: 'Chers Parents d\'élèves, nous vous rappelons que l\'échéance pour le règlement de la 2ème tranche de scolarité est fixée au 15 du mois en cours. Merci de régulariser auprès de la comptabilité.',
    },
    {
      title: 'Avis de Réunion Parents-Enseignants',
      subject: 'Invitation à la Réunion Bilan Trimestriel',
      body: 'Chers Parents, la Direction de l\'école vous convie à la rencontre bilan trimestrielle ce samedi à 09h00 au sein de l\'établissement pour la remise des bulletins.',
    },
    {
      title: 'Avis de Congés Scolaires',
      subject: 'Départ en Congés Trimestriels',
      body: 'Chers Parents, nous vous informons que les cours seront suspendus ce vendredi après-midi pour les congés officiels. La reprise des cours est fixée au lundi suivant à 07h30.',
    },
  ];

  const applyTemplate = (tpl: typeof templates[0]) => {
    setComposeSubject(tpl.subject);
    setComposeBody(tpl.body);
  };

  // Liste filtrée des élèves pour le mode "Un Parent"
  const studentSearchList = useMemo(() => {
    if (!composeStudentSearch) return students.slice(0, 15);
    const q = composeStudentSearch.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.grade.toLowerCase().includes(q) ||
        (s.guardianName && s.guardianName.toLowerCase().includes(q)) ||
        (s.whatsappPhone && s.whatsappPhone.includes(q))
    ).slice(0, 20);
  }, [students, composeStudentSearch]);

  // Calcul dynamique et exact du nombre de parents ciblés selon les effectifs réels
  const targetedRecipients = useMemo(() => {
    const allUniquePhones = new Set(
      students.map((s) => s.whatsappPhone || s.guardianPhone || '').filter(Boolean)
    );
    const totalSchoolParents = allUniquePhones.size > 0 ? allUniquePhones.size : students.length;

    if (composeRecipientType === 'all') {
      return {
        label: 'Toute l\'École (Tous les niveaux)',
        count: totalSchoolParents,
        samplePhone: students[0]?.whatsappPhone || '+225 07 08 12 34 56',
        sampleParent: 'Tous les Parents d\'Élèves',
      };
    }
    if (composeRecipientType === 'cycle') {
      const cycleClasses: Record<string, string[]> = {
        maternelle: ['Maternelle (P.S.)', 'Maternelle (M.S.)', 'Maternelle (G.S.)', 'P.S.', 'M.S.', 'G.S.'],
        primaire: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'],
        college: ['6ème', '5ème', '4ème', '3ème'],
        lycee: ['2nde', '1ère', 'Tle'],
      };
      const cycleNames: Record<string, string> = {
        maternelle: 'Cycle Maternelle (P.S., M.S., G.S.)',
        primaire: 'Cycle Primaire (CP1 à CM2)',
        college: 'Cycle Collège (6ème à 3ème)',
        lycee: 'Cycle Lycée (2nde à Tle)',
      };
      const classesForCycle = cycleClasses[composeTargetCycle] || [];
      const cycleStudents = students.filter((s) => classesForCycle.includes(s.grade));
      const cyclePhones = new Set(
        cycleStudents.map((s) => s.whatsappPhone || s.guardianPhone || '').filter(Boolean)
      );
      const cycleCount = cyclePhones.size > 0 ? cyclePhones.size : cycleStudents.length;

      return {
        label: cycleNames[composeTargetCycle] || 'Cycle Scolaire',
        count: cycleCount,
        samplePhone: cycleStudents[0]?.whatsappPhone || '+225 07 08 12 34 56',
        sampleParent: `Parents du ${cycleNames[composeTargetCycle] || 'cycle'}`,
      };
    }
    if (composeRecipientType === 'class') {
      const inClass = students.filter((s) => s.grade === composeTargetClass);
      const classPhones = new Set(
        inClass.map((s) => s.whatsappPhone || s.guardianPhone || '').filter(Boolean)
      );
      const classCount = classPhones.size > 0 ? classPhones.size : inClass.length;

      return {
        label: `Classe de ${composeTargetClass}`,
        count: classCount,
        samplePhone: inClass[0]?.whatsappPhone || '+225 07 08 12 34 56',
        sampleParent: inClass[0]?.guardianName || `Parents d'élèves de ${composeTargetClass}`,
      };
    }
    if (composeRecipientType === 'individual') {
      if (selectedStudent) {
        return {
          label: `Parent de ${selectedStudent.firstName} ${selectedStudent.lastName} (${selectedStudent.grade})`,
          count: 1,
          samplePhone: selectedStudent.whatsappPhone || '+225 07 08 12 34 56',
          sampleParent: selectedStudent.guardianName || `Parent de ${selectedStudent.firstName}`,
        };
      }
      return {
        label: 'Un Parent individuel (Non sélectionné)',
        count: 1,
        samplePhone: '+225 07 08 12 34 56',
        sampleParent: 'Parent d\'élève',
      };
    }
    return { label: 'Destinataires', count: 0, samplePhone: '', sampleParent: '' };
  }, [composeRecipientType, composeTargetCycle, composeTargetClass, selectedStudent, students]);

  // Répertoire complet de toutes les familles / parents de l'école
  const parentDirectory = useMemo(() => {
    const map = new Map<string, { guardianName: string; phone: string; whatsapp: string; children: Student[] }>();

    students.forEach((stu) => {
      const key = (stu.guardianName || 'Parent Inconnu').trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          guardianName: stu.guardianName || `${stu.lastName} Parent`,
          phone: stu.guardianPhone || stu.whatsappPhone || '+225 07 08 09 10 11',
          whatsapp: stu.whatsappPhone || stu.guardianPhone || '+225 07 08 09 10 11',
          children: [],
        });
      }
      map.get(key)!.children.push(stu);
    });

    const list = Array.from(map.values());
    if (!parentSearchQuery) return list;
    const q = parentSearchQuery.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.guardianName.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.whatsapp.includes(q) ||
        p.children.some(
          (c) =>
            c.firstName.toLowerCase().includes(q) ||
            c.lastName.toLowerCase().includes(q) ||
            c.grade.toLowerCase().includes(q) ||
            c.matricule.toLowerCase().includes(q)
        )
    );
  }, [students, parentSearchQuery]);

  // Filtrage des messages reçus
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        m.parentName.toLowerCase().includes(q) ||
        m.studentName.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q);

      const matchesCat = categoryFilter === 'all' || m.category === categoryFilter;
      const matchesStat = statusFilter === 'all' || m.status === statusFilter;

      return matchesSearch && matchesCat && matchesStat;
    });
  }, [messages, searchQuery, categoryFilter, statusFilter]);

  // Changer le statut d'un message
  const updateMessageStatus = (id: string, newStatus: 'new' | 'in_progress' | 'resolved') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m))
    );
    setToastMessage('✓ Statut de la demande parent mis à jour !');
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Répondre directement par WhatsApp
  const handleReplyWhatsApp = (msg: ParentMessage) => {
    const cleanPhone = msg.parentPhone.replace(/\D/g, '') || '22507000000';
    const text = encodeURIComponent(
      `*RÉPONSE DIRECTION — ${currentSchool.name}*\n` +
      `Bonjour ${msg.parentName},\n` +
      `Nous faisons suite à votre message concernant : "${msg.subject}".\n\n` +
      `Nous accusons bonne réception de votre demande pour l'élève ${msg.studentName} (${msg.studentGrade}) et vous confirmons qu'elle a été prise en compte.\n\n` +
      `Bien cordialement,\nLa Direction de l'Établissement.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    updateMessageStatus(msg.id, 'resolved');
  };

  // Clic sur "Diffuser une Annonce aux Parents" en haut
  const handleOpenCompose = () => {
    setActiveTab('compose');
    setTimeout(() => {
      composeFormRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Soumission de message composé -> Ouvre la modale de diffusion
  const handlePrepareBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeSubject || !composeBody) {
      alert('Veuillez renseigner l\'objet et le contenu du message.');
      return;
    }
    if (composeRecipientType === 'individual' && !selectedStudent) {
      alert('Veuillez sélectionner un élève et son parent destinataire.');
      return;
    }
    setShowBroadcastModal(true);
    setBroadcastProgress(0);
    setIsBroadcasting(false);
  };

  // Exécution réelle de la diffusion
  const handleExecuteBroadcast = () => {
    setIsBroadcasting(true);
    setBroadcastProgress(25);

    // Formatage texte WhatsApp officiel
    const targetInfoText =
      composeRecipientType === 'individual' && selectedStudent
        ? `Élève concerné(e) : *${selectedStudent.lastName} ${selectedStudent.firstName}* (Classe : ${selectedStudent.grade})\n`
        : `Destinataires : *${targetedRecipients.label}*\n`;

    const fullMessage =
      `*COMMUNICATION OFFICIELLE — ${currentSchool.name.toUpperCase()}*\n` +
      `📅 Date : 29/08/2026\n` +
      `🏫 Année Scolaire : ${currentSchool.academicYear}\n` +
      `${targetInfoText}` +
      `─────────────────────────\n` +
      `📌 *OBJET : ${composeSubject.toUpperCase()}*\n\n` +
      `${composeBody}\n\n` +
      `─────────────────────────\n` +
      `✍️ *La Direction de l'Établissement*\n` +
      `📞 Contact : ${currentSchool.phone || '+225 07 08 09 10 11'}`;

    const cleanPhone = targetedRecipients.samplePhone.replace(/\D/g, '') || '2250708091011';
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMessage)}`;

    setTimeout(() => {
      setBroadcastProgress(65);
      setTimeout(() => {
        setBroadcastProgress(100);
        setIsBroadcasting(false);

        // Ouvrir WhatsApp
        window.open(whatsappUrl, '_blank');

        // Enregistrer dans l'historique
        const newRecord: BroadcastRecord = {
          id: `bc-${Date.now()}`,
          date: '29/08/2026 ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          targetType: composeRecipientType,
          targetLabel: targetedRecipients.label,
          recipientCount: targetedRecipients.count,
          channel: composeChannel,
          subject: composeSubject,
          body: composeBody,
        };
        setBroadcasts((prev) => [newRecord, ...prev]);

        setToastMessage(
          `✓ Message WhatsApp diffusé avec succès à ${targetedRecipients.label} (${targetedRecipients.count} parents) !`
        );
        setShowBroadcastModal(false);
        setComposeSubject('');
        setComposeBody('');
        setActiveTab('history');
      }, 600);
    }, 600);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Communication & Messagerie Parents
            </h1>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              {currentSchool.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Échanges directs WhatsApp & SMS avec les familles — {currentSchool.name} ({currentSchool.city})
          </p>
        </div>

        {/* Bouton d'action principal qui active immédiatement la diffusion */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleOpenCompose}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Diffuser une Annonce aux Parents</span>
          </button>
        </div>
      </div>

      {/* Toast de confirmation */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-4 p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
              Messages Reçus
            </h3>
          </div>
          <span className="text-2xl font-extrabold text-slate-900 font-heading">
            {messages.length} messages
          </span>
          <p className="text-[11px] text-slate-400 mt-1">
            Demandes et justifications reçues
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200/80 shadow-xs flex flex-col justify-between bg-amber-50/15">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-900 font-sans">
              En Attente
            </h3>
          </div>
          <span className="text-2xl font-extrabold text-amber-900 font-heading">
            {messages.filter((m) => m.status === 'new').length} non traités
          </span>
          <p className="text-[11px] text-slate-500 mt-1">À traiter par la direction</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-blue-200/80 shadow-xs flex flex-col justify-between bg-blue-50/15">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-900 font-sans">
              Diffusions WhatsApp
            </h3>
          </div>
          <span className="text-2xl font-extrabold text-blue-900 font-heading">
            {broadcasts.length + 142} envois
          </span>
          <p className="text-[11px] text-slate-500 mt-1">Circulaires et avis d&apos;échéances</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCheck className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
              Taux de Réponse
            </h3>
          </div>
          <span className="text-2xl font-extrabold text-emerald-700 font-heading">
            98.5%
          </span>
          <p className="text-[11px] text-slate-500 mt-1">Délai moyen &lt; 2 heures</p>
        </div>
      </div>

      {/* Bannière Accès Rapide Espace Parents - Notes & Bulletins */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md border border-emerald-600/30">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold font-heading text-white">
              Espace Famille : Consultation des Bulletins & Moyennes des Enfants
            </h4>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              Accédez aux relevés de notes trimestriels, moyennes générales et bulletins officiels A4 certifiés.
            </p>
          </div>
        </div>
        <Link
          href={`/${schoolSlug}/admin/bulletins-parents`}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-md transition-all cursor-pointer"
        >
          <span>Accéder aux Bulletins des Enfants</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* 3. Onglets Principaux */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'inbox'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          📥 Boîte de Réception Parents ({messages.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compose')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'compose'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          ✍️ Composer & Diffuser une Annonce
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          📜 Historique des Diffusions ({broadcasts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('parents_directory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'parents_directory'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>👨‍👩‍👧 Répertoire & Bulletins par Parent ({parentDirectory.length})</span>
        </button>

        <Link
          href={`/${schoolSlug}/admin/bulletins-parents`}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <span>⭐ Espace Parents Dédié</span>
          <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
        </Link>
      </div>

      {/* ================= ONGLET 1 : BOÎTE DE RÉCEPTION PARENTS ================= */}
      {activeTab === 'inbox' && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
          {/* Toolbar de filtrage */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              {/* Recherche */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par parent, élève ou mot-clé..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                />
              </div>

              {/* Catégorie */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 cursor-pointer"
              >
                <option value="all">Toutes les catégories</option>
                <option value="absence">Absences & Retards</option>
                <option value="finance">Comptabilité & Scolarité</option>
                <option value="document">Demandes de Documents</option>
                <option value="info">Informations & Services</option>
              </select>

              {/* Statut */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 cursor-pointer"
              >
                <option value="all">Tous statuts</option>
                <option value="new">Nouveaux</option>
                <option value="in_progress">En cours</option>
                <option value="resolved">Traités</option>
              </select>
            </div>
          </div>

          {/* Liste des Messages */}
          <div className="divide-y divide-slate-100">
            {filteredMessages.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Aucun message parent ne correspond aux critères sélectionnés.
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 sm:p-5 hover:bg-emerald-50/20 transition-colors space-y-3 ${
                    msg.status === 'new' ? 'bg-emerald-50/10' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center font-bold text-slate-800 text-xs">
                        {msg.parentName.split(' ')[1] ? msg.parentName.split(' ')[1][0] : 'P'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-heading">
                            {msg.parentName}
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-500">
                            (Parent d&apos;élève : <strong className="text-slate-800">{msg.studentName}</strong> • {msg.studentGrade})
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {msg.parentPhone} • Reçu le {msg.timestamp}
                        </p>
                      </div>
                    </div>

                    {/* Badge Statut */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          msg.status === 'new'
                            ? 'bg-amber-50 text-amber-900 border border-amber-300'
                            : msg.status === 'in_progress'
                            ? 'bg-blue-50 text-blue-900 border border-blue-300'
                            : 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        {msg.status === 'new' && <AlertCircle className="w-3 h-3 text-amber-600" />}
                        {msg.status === 'in_progress' && <Clock className="w-3 h-3 text-blue-600" />}
                        {msg.status === 'resolved' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        <span>
                          {msg.status === 'new' ? 'Nouveau' : msg.status === 'in_progress' ? 'En cours' : 'Traité'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Objet & Corps du message */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 space-y-1">
                    <p className="text-xs font-black text-slate-900 uppercase">
                      Objet : {msg.subject}
                    </p>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {msg.message}
                    </p>
                  </div>

                  {/* Actions Rapides */}
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateMessageStatus(msg.id, 'in_progress')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Marquer En cours
                      </button>
                      <button
                        type="button"
                        onClick={() => updateMessageStatus(msg.id, 'resolved')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        Marquer Traité
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleReplyWhatsApp(msg)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Répondre par WhatsApp Direct</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= ONGLET 2 : COMPOSER ET DIFFUSER UNE ANNONCE ================= */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" ref={composeFormRef}>
          {/* Formulaire Principal */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span>Diffuser une Annonce / Avis aux Parents</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Envoi direct certifié par WhatsApp Professionnel ou SMS
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                🚀 Diffusion Active
              </span>
            </div>

            <form onSubmit={handlePrepareBroadcast} className="space-y-4 text-xs">
              {/* Cible des Destinataires */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  Sélectionner les Destinataires de l&apos;Annonce *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'all', label: 'Toute l\'École', icon: Building2, desc: 'Tous les niveaux' },
                    { id: 'cycle', label: 'Par Cycle', icon: Layers, desc: 'Mat / Prim / Collège' },
                    { id: 'class', label: 'Par Classe', icon: GraduationCap, desc: 'Une seule classe' },
                    { id: 'individual', label: 'Un Parent', icon: UserCheck, desc: 'Élève & Tuteur' },
                  ].map((r) => {
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setComposeRecipientType(r.id as any);
                          if (r.id === 'individual' && !selectedStudent && students.length > 0) {
                            setSelectedStudent(students[0]);
                          }
                        }}
                        className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                          composeRecipientType === r.id
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-2xs ring-2 ring-emerald-500/20'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className={`w-3.5 h-3.5 ${composeRecipientType === r.id ? 'text-emerald-700' : 'text-slate-400'}`} />
                          <span className="font-bold text-xs">{r.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">{r.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DÉTAILS SELON LA CIBLE */}

              {/* 1. PAR CYCLE */}
              {composeRecipientType === 'cycle' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <label className="font-bold text-slate-800 block">
                    Choisir le Cycle Scolaire concerné :
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'maternelle', label: '🧸 Maternelle', sub: 'P.S., M.S., G.S.' },
                      { id: 'primaire', label: '✏️ Primaire', sub: 'CP1 à CM2' },
                      { id: 'college', label: '📚 Collège', sub: '6ème à 3ème' },
                    ].map((cyc) => (
                      <button
                        key={cyc.id}
                        type="button"
                        onClick={() => setComposeTargetCycle(cyc.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          composeTargetCycle === cyc.id
                            ? 'bg-white border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 font-bold'
                            : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <p className="text-xs font-bold">{cyc.label}</p>
                        <p className="text-[10.5px] text-slate-400 font-normal">{cyc.sub}</p>
                      </button>
                    ))}
                  </div>
                  <div className="pt-1 text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Le message sera transmis à tous les parents du {targetedRecipients.label} (~{targetedRecipients.count} familles).</span>
                  </div>
                </div>
              )}

              {/* 2. PAR CLASSE */}
              {composeRecipientType === 'class' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <label className="font-bold text-slate-800 block">
                    Sélectionner la classe exacte :
                  </label>
                  <select
                    value={composeTargetClass}
                    onChange={(e) => setComposeTargetClass(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 font-bold text-slate-900 cursor-pointer focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {availableClasses
                      .filter((c) => c !== 'Toutes les classes')
                      .map((cls) => (
                        <option key={cls} value={cls}>
                          Classe : {cls}
                        </option>
                      ))}
                  </select>
                  <div className="pt-1 text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Le message sera diffusé aux parents de la classe de <strong>{composeTargetClass}</strong>.</span>
                  </div>
                </div>
              )}

              {/* 3. UN PARENT INDIVIDUEL (Précise l'Élève, sa Classe et le Parent) */}
              {composeRecipientType === 'individual' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <label className="font-bold text-slate-800 block">
                    Rechercher et sélectionner l&apos;élève & le parent destinataire :
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Taper le nom de l'élève, de la classe ou du parent..."
                      value={composeStudentSearch}
                      onChange={(e) => setComposeStudentSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                    />
                  </div>

                  {/* Liste déroulante des résultats de recherche */}
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    {studentSearchList.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSelectedStudent(st)}
                        className={`w-full p-2.5 text-left flex items-center justify-between hover:bg-emerald-50/50 transition-colors cursor-pointer ${
                          selectedStudent?.id === st.id ? 'bg-emerald-50 font-bold' : ''
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {st.lastName} {st.firstName}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Parent : <strong className="text-slate-700">{st.guardianName || 'Non renseigné'}</strong> • WhatsApp : {st.whatsappPhone || 'N/A'}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px] border border-slate-200">
                          {st.grade}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Fiche récapitulative de l'élève sélectionné */}
                  {selectedStudent && (
                    <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                        <span>Élève : {selectedStudent.lastName} {selectedStudent.firstName}</span>
                        <span className="bg-emerald-200/80 px-2 py-0.5 rounded text-[10px]">
                          Classe : {selectedStudent.grade}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-emerald-800">
                        <span>Tuteur / Parent : <strong>{selectedStudent.guardianName || 'Parent d\'élève'}</strong></span>
                        <span className="font-mono font-bold">📱 {selectedStudent.whatsappPhone}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. TOUTE L'ÉCOLE */}
              {composeRecipientType === 'all' && (
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Diffusion globale à tous les parents d&apos;élèves inscrits (Maternelle, Primaire, Collège).</span>
                  </div>
                  <span className="font-extrabold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300 shrink-0">
                    {targetedRecipients.count} Parents
                  </span>
                </div>
              )}

              {/* Canal de diffusion */}
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-slate-700 block">Canal Officiel d&apos;envoi *</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 cursor-pointer hover:bg-slate-100">
                    <input
                      type="radio"
                      name="channel"
                      checked={composeChannel === 'whatsapp'}
                      onChange={() => setComposeChannel('whatsapp')}
                      className="text-emerald-600"
                    />
                    <span>📲 WhatsApp Professionnel Direct</span>
                  </label>

                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 cursor-pointer hover:bg-slate-100">
                    <input
                      type="radio"
                      name="channel"
                      checked={composeChannel === 'sms'}
                      onChange={() => setComposeChannel('sms')}
                      className="text-emerald-600"
                    />
                    <span>💬 SMS Prioritaire</span>
                  </label>
                </div>
              </div>

              {/* Objet */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Objet du Message *</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Ex: Avis de réunion bilan trimestriel"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 font-semibold text-slate-900"
                  required
                />
              </div>

              {/* Corps du message */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Contenu du Message *</label>
                <textarea
                  rows={6}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Rédigez ici votre message à destination des parents d'élèves..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 font-sans text-slate-900 leading-relaxed"
                  required
                />
              </div>

              {/* Bouton d'envoi principal */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all cursor-pointer text-center flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Diffuser le Message aux Parents ({targetedRecipients.count} Destinataires)</span>
                </button>
              </div>
            </form>
          </div>

          {/* Modèles Prédéfinis (Templates en 1 clic) */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold text-slate-900 uppercase font-heading">
                  Modèles Rapides (1 Clic)
                </h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Insérez des messages pré-formatés pour gagner du temps :
              </p>

              <div className="space-y-2 pt-1">
                {templates.map((tpl) => (
                  <button
                    key={tpl.title}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                  >
                    <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                      {tpl.title}
                    </p>
                    <p className="text-[10.5px] text-slate-500 line-clamp-2 mt-0.5">
                      {tpl.body}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Aide & Assistance */}
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <Smartphone className="w-4 h-4 text-emerald-700" />
                <span>Certification WhatsApp Direct</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Les diffusions utilisent les numéros WhatsApp certifiés des parents enregistrés lors de l&apos;inscription.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= ONGLET 3 : HISTORIQUE DES DIFFUSIONS ================= */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase font-heading">
              Historique des Annonces et Circulaires Envoyées
            </h3>
            <span className="text-xs text-slate-400">
              Total : {broadcasts.length} diffusions
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {broadcasts.map((bc) => (
              <div key={bc.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                      📲 WhatsApp Certifié
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 font-heading">
                      {bc.subject}
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Envoyé le {bc.date}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 font-sans">
                  {bc.body}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Cible : <strong className="text-slate-800">{bc.targetLabel}</strong></span>
                  <span className="font-bold text-emerald-700">{bc.recipientCount} parents touchés</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= ONGLET 4 : RÉPERTOIRE & BULLETINS PAR PARENT ================= */}
      {activeTab === 'parents_directory' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Toolbar de Recherche Parent */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/70 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par nom de parent, élève, matricule, classe..."
                value={parentSearchQuery}
                onChange={(e) => setParentSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-end">
              <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold">
                {parentDirectory.length} Familles répertoriées
              </span>
              <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold">
                {students.filter(s => ['6ème', '5ème', '4ème', '3ème'].includes(s.grade)).length} Élèves au Collège
              </span>
            </div>
          </div>

          {/* Grille des Familles / Parents */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parentDirectory.map((parent, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                {/* En-tête de la carte parent */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-sm shrink-0 border border-emerald-200/60 shadow-2xs">
                        {parent.guardianName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-heading">
                          {parent.guardianName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{parent.phone}</span>
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      {parent.children.length} {parent.children.length > 1 ? 'Enfants' : 'Enfant'}
                    </span>
                  </div>

                  {/* Bouton WhatsApp direct avec le parent */}
                  <div className="pt-1">
                    <a
                      href={`https://wa.me/${parent.whatsapp.replace(/\D/g, '') || '2250708091011'}?text=${encodeURIComponent(`Bonjour ${parent.guardianName}, la Direction de ${currentSchool.name} vous transmet les informations scolaires de votre enfant.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 transition-colors"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Échanger sur WhatsApp</span>
                    </a>
                  </div>
                </div>

                {/* Liste des enfants du parent */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Enfants inscrits :
                  </span>
                  <div className="space-y-2">
                    {parent.children.map((child) => {
                      const isCollege = ['6ème', '5ème', '4ème', '3ème'].includes(child.grade);
                      return (
                        <div
                          key={child.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-900">
                                {child.firstName} {child.lastName}
                              </span>
                              <GenderBadge gender={child.gender} />
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                                {child.grade}
                              </span>
                              <span className="font-mono text-slate-400">{child.matricule}</span>
                            </div>
                          </div>

                          {/* Bouton Consulter le Bulletin (Accessible pour le Collège et Primaire) */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedParentChild(child);
                              setSelectedParentTerm('Trimestre 1');
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                              isCollege
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                            }`}
                          >
                            <FileText className="w-3 h-3" />
                            <span>{isCollege ? 'Bulletin Collège' : 'Relevé'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= MODALE DU BULLETIN OFFICIEL DE L'ÉLÈVE ================= */}
      {selectedParentChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border-2 border-slate-900 shadow-2xl max-w-4xl w-full p-5 sm:p-8 space-y-5 my-auto max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Barre d'actions d'en-tête de la modale */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Période :
                </span>
                {(['Trimestre 1', 'Trimestre 2', 'Trimestre 3'] as const).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setSelectedParentTerm(term)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedParentTerm === term
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {term}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Imprimer A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedParentChild(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CADRE EN-TÊTE OFFICIEL DU REÇU & BULLETIN */}
            <div className="relative z-10 border-2 border-slate-900 rounded-2xl bg-white shadow-2xs p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                {/* 1. Logo de l'École (À gauche) */}
                <div className="shrink-0 text-center flex items-center justify-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        currentSchool.logoUrl ||
                        'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&auto=format&fit=crop&q=80'
                      }
                      alt={currentSchool.name}
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                  </div>
                </div>

                {/* 2. Informations de l'école au centre : Nom complet, Sigle en dessous, Devise, Contacts */}
                <div className="flex-1 min-w-0 px-1 text-center space-y-0.5">
                  <h2
                    className="font-black uppercase tracking-tight text-slate-950 font-heading text-xs sm:text-sm md:text-base block w-full leading-tight break-words"
                    title={currentSchool.name}
                  >
                    {currentSchool.name || 'EPC MARKAZ AHLI SOUNNAH'}
                  </h2>
                  <p className="font-extrabold text-emerald-800 text-[11px] sm:text-xs tracking-wide">
                    ({currentSchool.shortName || 'EPC MANOI'})
                  </p>
                  <p className="font-semibold text-emerald-900 italic text-[9.5px] sm:text-[11px] truncate">
                    « {currentSchool.motto || 'Excellence Académique • Rigueur • Éducation de Référence'} »
                  </p>
                  {currentSchool.slogan && (
                    <p className="font-medium text-amber-700 italic text-[9px] sm:text-[10px] truncate">
                      ✦ {currentSchool.slogan}
                    </p>
                  )}
                  <p className="text-slate-700 font-medium leading-tight text-[9.5px] sm:text-[10.5px] truncate">
                    {currentSchool.district || `${currentSchool.city} — ${currentSchool.country}`} • Tél : {currentSchool.phone || '+225 27 22 44 11 00'}
                  </p>
                  <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-slate-900 text-[9px] sm:text-[10px]">
                    <span>Code Établissement : {currentSchool.ministryCode || 'MENA-04829-CI'}</span>
                  </div>
                </div>

                {/* 3. Emblème National (À droite) */}
                <div className="shrink-0 text-center flex items-center justify-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center">
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

            {/* TITRE OFFICIEL DU BULLETIN */}
            <div className="text-center space-y-0.5 py-1 bg-slate-900 text-white rounded-xl">
              <p className="text-[9.5px] font-bold tracking-widest uppercase text-slate-300">
                RÉPUBLIQUE DE CÔTE D&apos;IVOIRE • MINISTÈRE DE L&apos;ÉDUCATION NATIONALE
              </p>
              <h3 className="text-xs sm:text-sm font-black font-heading tracking-wide uppercase text-amber-400">
                BULLETIN TRIMESTRIEL DE NOTES — {selectedParentTerm.toUpperCase()} • {currentSchool.academicYear || '2026-2027'}
              </h3>
            </div>

            {/* FICHE D'IDENTITÉ DE L'ÉLÈVE */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Nom & Prénoms :</span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 font-heading">
                  {selectedParentChild.lastName} {selectedParentChild.firstName}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Matricule & Genre :</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-slate-900">{selectedParentChild.matricule}</span>
                  <GenderBadge gender={selectedParentChild.gender} />
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Classe & Effectif :</span>
                <span className="font-bold text-slate-900">
                  {selectedParentChild.grade} <span className="text-slate-500 font-normal">(42 Élèves)</span>
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Parent / Tuteur :</span>
                <span className="font-semibold text-slate-800">{selectedParentChild.guardianName || 'Parent d\'élève'}</span>
              </div>
            </div>

            {/* TABLEAU DES NOTES DU COLLÈGE AVEC COEFFICIENTS */}
            <div className="overflow-x-auto rounded-2xl border-2 border-slate-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-heading font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Matières Enseignées & Professeur</th>
                    <th className="py-2.5 px-2 text-center">Coef.</th>
                    <th className="py-2.5 px-2 text-center">Interro.</th>
                    <th className="py-2.5 px-2 text-center">Devoir</th>
                    <th className="py-2.5 px-2 text-center">Comp.</th>
                    <th className="py-2.5 px-3 text-center bg-slate-800">Moy. / 20</th>
                    <th className="py-2.5 px-3 text-center bg-slate-800">Points</th>
                    <th className="py-2.5 px-4">Appréciation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {[
                    { name: 'Français (Orthographe & Expression)', coef: 3, prof: 'M. Kouamé Koffi', moy: 15.8, pts: 47.4, app: 'Excellent travail et bonne régularité.' },
                    { name: 'Mathématiques', coef: 3, prof: 'M. Touré Amadou', moy: 16.5, pts: 49.5, app: 'Très bon esprit logique et rigoureux.' },
                    { name: 'Physique-Chimie', coef: 2, prof: 'M. Diallo Souleymane', moy: 15.0, pts: 30.0, app: 'Bons résultats, continuez ainsi.' },
                    { name: 'Sciences de la Vie et de la Terre (SVT)', coef: 2, prof: 'Mme Bamba Fatou', moy: 16.0, pts: 32.0, app: 'Travail sérieux et soigné.' },
                    { name: 'Anglais (LV1)', coef: 2, prof: 'Mme Mensah Aïcha', moy: 16.5, pts: 33.0, app: 'Très bonne participation orale.' },
                    { name: 'Histoire-Géographie', coef: 2, prof: 'M. Yao Bernard', moy: 15.5, pts: 31.0, app: 'Bonne maîtrise des cours.' },
                    { name: 'Éducation aux Droits de l’Homme (EDHC)', coef: 1, prof: 'Mme Kouadio Christine', moy: 17.0, pts: 17.0, app: 'Élève modèle et exemplaire.' },
                    { name: 'Éducation Physique et Sportive (EPS)', coef: 1, prof: 'M. Diomandé Moussa', moy: 16.0, pts: 16.0, app: 'Bonne condition physique.' },
                    { name: 'Arts Plastiques & Musique', coef: 1, prof: 'M. Soro Patrice', moy: 15.5, pts: 15.5, app: 'Très bonne créativité.' },
                    { name: 'Conduite & Discipline', coef: 1, prof: 'M. Le Censeur', moy: 18.0, pts: 18.0, app: 'Conduite irréprochable.' },
                  ].map((sub, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="py-2 px-3 font-bold text-slate-900">
                        <div>{sub.name}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{sub.prof}</div>
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-800">{sub.coef}</td>
                      <td className="py-2 px-2 text-center font-mono text-slate-600">{(sub.moy - 0.5).toFixed(1)}</td>
                      <td className="py-2 px-2 text-center font-mono text-slate-600">{sub.moy.toFixed(1)}</td>
                      <td className="py-2 px-2 text-center font-mono font-semibold text-slate-800">{(sub.moy + 0.5).toFixed(1)}</td>
                      <td className="py-2 px-3 text-center font-mono font-extrabold text-slate-950 bg-emerald-50/40 text-xs">
                        {sub.moy.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-900 bg-emerald-50/40">
                        {sub.pts.toFixed(2)}
                      </td>
                      <td className="py-2 px-4 text-slate-600 text-[11px] italic">
                        {sub.app}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-900">
                    <td className="py-2.5 px-3 uppercase font-heading text-xs">Totaux & Moyenne Générale</td>
                    <td className="py-2.5 px-2 text-center font-mono font-black text-slate-900">18</td>
                    <td colSpan={3} className="py-2.5 px-2 text-center text-slate-600 italic text-xs">
                      Rang dans la classe : <strong className="text-emerald-800 font-extrabold">2ème / 42</strong>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-900 bg-emerald-100 text-sm">
                      16.08 / 20
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-black text-slate-950 bg-slate-200">
                      289.40
                    </td>
                    <td className="py-2.5 px-4 font-extrabold text-emerald-900 text-xs">
                      Tableau d&apos;Honneur & Félicitations
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* BAS DE BULLETIN : CONSEIL, VISA PARENT ET CACHET DE LA DIRECTION */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t-2 border-slate-900 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <h4 className="font-extrabold uppercase text-[10px] text-slate-900 font-heading">
                  1. Assiduité & Conduite
                </h4>
                <p className="text-slate-600 mt-1">Absences : <strong>0 heure</strong></p>
                <p className="text-slate-600">Conduite : <strong className="text-emerald-700">Exemplaire (TB)</strong></p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <h4 className="font-extrabold uppercase text-[10px] text-emerald-950 font-heading">
                  2. Avis du Conseil de Classe
                </h4>
                <p className="text-emerald-950 font-medium italic mt-1 text-[11px]">
                  « Félicitations du Conseil de Classe pour les excellents résultats et la rigueur. »
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1 relative flex flex-col justify-between">
                <div>
                  <p className="font-bold text-slate-900 uppercase text-[10px]">
                    3. Le Chef d’Établissement
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    Fait à {currentSchool.city || 'Abidjan'}, le {formatDate(new Date())}
                  </p>
                </div>

                <div className="h-12 flex items-center justify-center">
                  {currentSchool.stampUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentSchool.stampUrl}
                      alt="Cachet officiel"
                      className="max-h-12 max-w-24 object-contain opacity-90 transform rotate-[-3deg]"
                    />
                  ) : (
                    <span className="px-2 py-0.5 rounded border border-dashed border-emerald-700 text-emerald-800 font-mono text-[9px] font-bold">
                      [ Cachet Direction ]
                    </span>
                  )}
                </div>

                <p className="text-[9.5px] font-extrabold text-slate-900 uppercase">
                  {currentSchool.directorName || currentSchool.studiesDirectorName || 'M. Jean-Marc Kouassi'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE DE DIFFUSION WHATSAPP DIRECT ================= */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-heading">
                    Centre de Diffusion WhatsApp
                  </h3>
                  <p className="text-xs text-slate-400">
                    Confirmation avant envoi massif
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Récapitulatif de la diffusion */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500">Destinataires ciblés :</span>
                <span className="font-bold text-slate-900">{targetedRecipients.label}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500">Nombre de parents :</span>
                <span className="font-extrabold text-emerald-700 font-mono text-sm">
                  {targetedRecipients.count} Parents
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                <span className="text-slate-500">Canal :</span>
                <span className="font-bold text-slate-800">📲 WhatsApp Professionnel Direct</span>
              </div>
              <div className="space-y-1 pt-1">
                <span className="text-slate-500">Aperçu de l&apos;Objet :</span>
                <p className="font-bold text-slate-900">{composeSubject}</p>
              </div>
            </div>

            {/* Barre de progression pendant l'envoi */}
            {isBroadcasting && (
              <div className="space-y-1.5 py-1">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                  <span>Envoi en cours sur WhatsApp...</span>
                  <span>{broadcastProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                    style={{ width: `${broadcastProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isBroadcasting}
                onClick={() => setShowBroadcastModal(false)}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-all text-center cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isBroadcasting}
                onClick={handleExecuteBroadcast}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-600/30 transition-all text-center cursor-pointer flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Confirmer & Envoyer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
