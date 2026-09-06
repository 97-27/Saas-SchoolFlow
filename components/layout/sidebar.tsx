'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { School } from '@/lib/data/types';
import { defaultSchool, mockSchools } from '@/lib/data/mock-data';
import { getLiveSchool, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import {
  LayoutDashboard,
  Users,
  School as SchoolIcon,
  CalendarCheck,
  BookOpen,
  UserCheck,
  Wallet,
  UtensilsCrossed,
  Bus,
  BedDouble,
  BarChart3,
  Settings,
  ChevronDown,
  GraduationCap,
  Sparkles,
  X,
  Building2,
  BadgePercent,
  Award,
  MessageSquare,
  FileSpreadsheet,
  KeyRound,
  NotebookPen,
  Receipt,
} from 'lucide-react';

import { SchoolFlowLogo } from '@/components/ui/schoolflow-logo';

interface SidebarProps {
  schoolSlug?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  schoolSlug = 'epc-manoi',
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const [studentsOpen, setStudentsOpen] = useState(
    pathname.includes('/eleves') || pathname.includes('/inscriptions') || pathname.includes('/documents')
  );
  const [pedagogyOpen, setPedagogyOpen] = useState(
    pathname.includes('/classes') ||
      pathname.includes('/presences') ||
      pathname.includes('/notes') ||
      pathname.includes('/bulletins') ||
      pathname.includes('/bulletins-parents') ||
      pathname.includes('/distinctions')
  );
  const [servicesOpen, setServicesOpen] = useState(
    pathname.includes('/cantine') || pathname.includes('/transport') || pathname.includes('/internat')
  );
  const [financeOpen, setFinanceOpen] = useState(
    pathname.includes('/scolarite') || pathname.includes('/depenses') || pathname.includes('/rapports')
  );
  const [communicationOpen, setCommunicationOpen] = useState(
    pathname.includes('/communication') || pathname.includes('/bulletins-parents')
  );
  const [currentSchool, setCurrentSchool] = useState<School>(() =>
    getLiveSchool(schoolSlug, mockSchools[schoolSlug] || defaultSchool)
  );
  const [currentSearch, setCurrentSearch] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentSearch(window.location.search);
    }
  }, [pathname]);
  const [activeSession, setActiveSession] = useState<{
    roleId?: string;
    roleBadge?: string;
    fullName?: string;
    role?: string;
  }>({
    roleId: 'directeur',
    roleBadge: '👑 Admin Administratif',
    fullName: 'M. Jean-Marc Kouassi',
  });

  useEffect(() => {
    setCurrentSchool(getLiveSchool(schoolSlug, mockSchools[schoolSlug] || defaultSchool));

    const loadSession = () => {
      try {
        const stored = localStorage.getItem('schoolflow_active_session_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          setActiveSession(parsed);
        }
      } catch (e) {}
    };

    loadSession();

    const handleUpdate = () => {
      setCurrentSchool(getLiveSchool(schoolSlug, mockSchools[schoolSlug] || defaultSchool));
      loadSession();
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [schoolSlug]);

  const baseUrl = `/${schoolSlug}/admin`;
  const roleId = activeSession.roleId || 'directeur';

  // Services disponibles sous le groupe "Services & Prestations"
  const availableServices = [
    ...(currentSchool.hasCanteen !== false
      ? [
          {
            title: 'Cantine scolaire',
            href: `${baseUrl}/cantine`,
            active: pathname.includes('/cantine'),
          },
        ]
      : []),
    ...(currentSchool.hasTransport !== false
      ? [
          {
            title: 'Transport scolaire',
            href: `${baseUrl}/transport`,
            active: pathname.includes('/transport'),
          },
        ]
      : []),
    ...(currentSchool.hasBoarding !== false
      ? [
          {
            title: 'Internat & Hébergement',
            href: `${baseUrl}/internat`,
            active: pathname.includes('/internat'),
          },
        ]
      : []),
  ];

  // Tous les items de navigation avec leur clé d'autorisation
  const allNavItems = [
    {
      key: 'dashboard',
      title: 'Tableau de bord',
      href: `${baseUrl}/dashboard`,
      icon: LayoutDashboard,
      active: pathname.includes('/dashboard'),
    },
    ...((roleId === 'directeur' || roleId === 'fondateur')
      ? [
          {
            key: 'administration',
            title: 'Administration & Codes',
            href: `${baseUrl}/administration`,
            icon: KeyRound,
            active: pathname.includes('/administration'),
          },
        ]
      : []),
    {
      key: 'eleves',
      title: 'Élèves',
      icon: Users,
      isGroup: true,
      isOpen: studentsOpen,
      onToggle: () => setStudentsOpen(!studentsOpen),
      active:
        pathname.includes('/eleves') ||
        pathname.includes('/inscriptions') ||
        pathname.includes('/documents'),
      subItems: [
        {
          title: 'Inscriptions',
          href: `${baseUrl}/inscriptions`,
          active: pathname.includes('/inscriptions'),
        },
        ...(roleId !== 'comptable'
          ? [
              {
                title: "Vue d'ensemble",
                href: `${baseUrl}/eleves`,
                active: pathname.endsWith('/eleves'),
              },
              {
                title: 'Documents scolaires',
                href: `${baseUrl}/documents`,
                active: pathname.includes('/documents'),
              },
            ]
          : []),
      ],
    },
    ...(availableServices.length > 0
      ? [
          {
            key: 'services',
            title: 'Services & Prestations',
            icon: UtensilsCrossed,
            isGroup: true,
            isOpen: servicesOpen,
            onToggle: () => setServicesOpen(!servicesOpen),
            active:
              pathname.includes('/cantine') ||
              pathname.includes('/transport') ||
              pathname.includes('/internat'),
            subItems: availableServices,
          },
        ]
      : []),
      {
        key: 'finances',
        title: 'Comptabilité & Finances',
        icon: Wallet,
        isGroup: true,
        isOpen: financeOpen,
        onToggle: () => setFinanceOpen(!financeOpen),
        active:
          pathname.includes('/scolarite') ||
          pathname.includes('/depenses') ||
          pathname.includes('/rapports'),
        subItems: [
          {
            title: 'Scolarité & Caisse',
            href: `${baseUrl}/scolarite`,
            active: pathname.includes('/scolarite'),
          },
          {
            title: "Dépenses de l'École",
            href: `${baseUrl}/depenses`,
            active: pathname.includes('/depenses'),
          },
          {
            title: 'Rapports & Statistiques',
            href: `${baseUrl}/rapports`,
            active: pathname.includes('/rapports'),
          },
        ],
      },
      {
        key: 'reductions',
        title: 'Réductions spéciales',
        href: `${baseUrl}/reductions`,
        icon: BadgePercent,
        active: pathname.includes('/reductions'),
      },
      {
        key: 'salaires',
        title: 'Salaires du personnel',
        href: `${baseUrl}/salaires`,
        icon: Receipt,
        active: pathname.includes('/salaires'),
      },
      {
        key: 'pedagogie',
        title: 'Gestion Pédagogique',
        icon: BookOpen,
        isGroup: true,
        isOpen: pedagogyOpen,
        onToggle: () => setPedagogyOpen(!pedagogyOpen),
        active:
          pathname.includes('/classes') ||
          pathname.includes('/presences') ||
          pathname.includes('/notes') ||
          pathname.includes('/bulletins') ||
          pathname.includes('/distinctions'),
        subItems: [
          {
            title: 'Classes & Niveaux',
            href: `${baseUrl}/classes`,
            active: pathname.includes('/classes'),
          },
          {
            title: 'Présences & Absences',
            href: `${baseUrl}/presences`,
            active: pathname.includes('/presences'),
          },
          {
            title: 'Pédagogie & Notes',
            href: `${baseUrl}/notes`,
            active: pathname.includes('/notes'),
          },
          {
            title: 'Bulletins Scolaires',
            href: `${baseUrl}/bulletins`,
            active: pathname.includes('/bulletins'),
          },
          {
            title: "Tableaux d'Honneur",
            href: `${baseUrl}/distinctions`,
            active: pathname.includes('/distinctions'),
          },
        ],
      },
      {
        key: 'communication',
        title: 'Communication Parents',
        href: `${baseUrl}/communication`,
        icon: MessageSquare,
        active: pathname.includes('/communication'),
      },
      {
        key: 'personnel',
        title: 'Enseignants & Personnel',
        href: `${baseUrl}/personnel`,
        icon: UserCheck,
        active: pathname.includes('/personnel'),
      },
      {
        key: 'notes_diverses',
        title: 'Notes Diverses',
        href: `${baseUrl}/notes-diverses`,
        icon: NotebookPen,
        active: pathname.includes('/notes-diverses'),
      },
      {
        key: 'parametres',
        title: 'Paramètres',
        href: `${baseUrl}/parametres`,
        icon: Settings,
        active: pathname.includes('/parametres'),
      },
    ];

  // Construction stricte des éléments de navigation selon le rôle exact
  let navItems: any[] = [];

  const communicationGroupItem = {
    key: 'communication',
    title: 'Communication Parents',
    icon: MessageSquare,
    isGroup: true,
    isOpen: communicationOpen,
    onToggle: () => setCommunicationOpen(!communicationOpen),
    active: pathname.includes('/communication') || pathname.includes('/bulletins-parents'),
    subItems: [
      { title: 'Messagerie & Diffusions', href: `${baseUrl}/communication`, active: pathname.endsWith('/communication') },
      { title: 'Notes & Bulletins Parents', href: `${baseUrl}/bulletins-parents`, active: pathname.includes('/bulletins-parents') },
    ],
  };

  if (roleId === 'directeur') {
    // 👑 DIRECTEUR (ADMIN) : Contrôle total et accès à toutes les pages
    navItems = [
      { key: 'dashboard', title: 'Tableau de bord', href: `${baseUrl}/dashboard`, icon: LayoutDashboard, active: pathname.includes('/dashboard') },
      { key: 'administration', title: 'Administration & Codes', href: `${baseUrl}/administration`, icon: KeyRound, active: pathname.includes('/administration') },
      {
        key: 'eleves', title: 'Élèves', icon: Users, isGroup: true, isOpen: studentsOpen, onToggle: () => setStudentsOpen(!studentsOpen),
        active: pathname.includes('/eleves') || pathname.includes('/inscriptions') || pathname.includes('/documents'),
        subItems: [
          { title: 'Inscriptions', href: `${baseUrl}/inscriptions`, active: pathname.includes('/inscriptions') },
          { title: "Vue d'ensemble", href: `${baseUrl}/eleves`, active: pathname.endsWith('/eleves') },
          { title: 'Documents scolaires', href: `${baseUrl}/documents`, active: pathname.includes('/documents') },
        ],
      },
      ...(availableServices.length > 0 ? [{
        key: 'services', title: 'Services & Prestations', icon: UtensilsCrossed, isGroup: true, isOpen: servicesOpen, onToggle: () => setServicesOpen(!servicesOpen),
        active: pathname.includes('/cantine') || pathname.includes('/transport') || pathname.includes('/internat'),
        subItems: availableServices,
      }] : []),
      {
        key: 'finances', title: 'Comptabilité & Finances', icon: Wallet, isGroup: true, isOpen: financeOpen, onToggle: () => setFinanceOpen(!financeOpen),
        active: pathname.includes('/scolarite') || pathname.includes('/depenses') || pathname.includes('/rapports'),
        subItems: [
          { title: 'Scolarité & Caisse', href: `${baseUrl}/scolarite`, active: pathname.includes('/scolarite') },
          { title: "Dépenses de l'École", href: `${baseUrl}/depenses`, active: pathname.includes('/depenses') },
          { title: 'Rapports & Statistiques', href: `${baseUrl}/rapports`, active: pathname.includes('/rapports') },
        ],
      },
      { key: 'reductions', title: 'Réductions spéciales', href: `${baseUrl}/reductions`, icon: BadgePercent, active: pathname.includes('/reductions') },
      { key: 'salaires', title: 'Salaires du personnel', href: `${baseUrl}/salaires`, icon: Receipt, active: pathname.includes('/salaires') },
      {
        key: 'pedagogie', title: 'Gestion Pédagogique', icon: BookOpen, isGroup: true, isOpen: pedagogyOpen, onToggle: () => setPedagogyOpen(!pedagogyOpen),
        active: pathname.includes('/classes') || pathname.includes('/presences') || pathname.includes('/notes') || pathname.includes('/bulletins') || pathname.includes('/distinctions'),
        subItems: [
          { title: 'Classes & Niveaux', href: `${baseUrl}/classes`, active: pathname.includes('/classes') },
          { title: 'Présences & Absences', href: `${baseUrl}/presences`, active: pathname.includes('/presences') },
          { title: 'Pédagogie & Notes', href: `${baseUrl}/notes`, active: pathname.includes('/notes') },
          { title: 'Bulletins Scolaires', href: `${baseUrl}/bulletins`, active: pathname.includes('/bulletins') },
          { title: "Tableaux d'Honneur", href: `${baseUrl}/distinctions`, active: pathname.includes('/distinctions') },
        ],
      },
      communicationGroupItem,
      { key: 'personnel', title: 'Enseignants & Personnel', href: `${baseUrl}/personnel`, icon: UserCheck, active: pathname.includes('/personnel') },
      { key: 'notes_diverses', title: 'Notes Diverses', href: `${baseUrl}/notes-diverses`, icon: NotebookPen, active: pathname.includes('/notes-diverses') },
      { key: 'parametres', title: 'Paramètres', href: `${baseUrl}/parametres`, icon: Settings, active: pathname.includes('/parametres') },
    ];
  } else if (roleId === 'fondateur') {
    // 👑 FONDATEUR : Administrateur Suprême (Accès total à tous les modules et aux codes)
    navItems = [
      { key: 'dashboard', title: 'Tableau de bord', href: `${baseUrl}/dashboard`, icon: LayoutDashboard, active: pathname.includes('/dashboard') },
      { key: 'administration', title: 'Administration & Codes', href: `${baseUrl}/administration`, icon: KeyRound, active: pathname.includes('/administration') },
      {
        key: 'eleves', title: 'Élèves', icon: Users, isGroup: true, isOpen: studentsOpen, onToggle: () => setStudentsOpen(!studentsOpen),
        active: pathname.includes('/eleves') || pathname.includes('/inscriptions') || pathname.includes('/documents'),
        subItems: [
          { title: 'Inscriptions', href: `${baseUrl}/inscriptions`, active: pathname.includes('/inscriptions') },
          { title: "Vue d'ensemble", href: `${baseUrl}/eleves`, active: pathname.endsWith('/eleves') },
          { title: 'Documents scolaires', href: `${baseUrl}/documents`, active: pathname.includes('/documents') },
        ],
      },
      ...(availableServices.length > 0 ? [{
        key: 'services', title: 'Services & Prestations', icon: UtensilsCrossed, isGroup: true, isOpen: servicesOpen, onToggle: () => setServicesOpen(!servicesOpen),
        active: pathname.includes('/cantine') || pathname.includes('/transport') || pathname.includes('/internat'),
        subItems: availableServices,
      }] : []),
      {
        key: 'finances', title: 'Comptabilité & Finances', icon: Wallet, isGroup: true, isOpen: financeOpen, onToggle: () => setFinanceOpen(!financeOpen),
        active: pathname.includes('/scolarite') || pathname.includes('/depenses') || pathname.includes('/rapports'),
        subItems: [
          { title: 'Scolarité & Caisse', href: `${baseUrl}/scolarite`, active: pathname.includes('/scolarite') },
          { title: "Dépenses de l'École", href: `${baseUrl}/depenses`, active: pathname.includes('/depenses') },
          { title: 'Rapports & Statistiques', href: `${baseUrl}/rapports`, active: pathname.includes('/rapports') },
        ],
      },
      { key: 'reductions', title: 'Réductions spéciales', href: `${baseUrl}/reductions`, icon: BadgePercent, active: pathname.includes('/reductions') },
      { key: 'salaires', title: 'Salaires du personnel', href: `${baseUrl}/salaires`, icon: Receipt, active: pathname.includes('/salaires') },
      {
        key: 'pedagogie', title: 'Gestion Pédagogique', icon: BookOpen, isGroup: true, isOpen: pedagogyOpen, onToggle: () => setPedagogyOpen(!pedagogyOpen),
        active: pathname.includes('/classes') || pathname.includes('/presences') || pathname.includes('/notes') || pathname.includes('/bulletins') || pathname.includes('/distinctions'),
        subItems: [
          { title: 'Classes & Niveaux', href: `${baseUrl}/classes`, active: pathname.includes('/classes') },
          { title: 'Présences & Absences', href: `${baseUrl}/presences`, active: pathname.includes('/presences') },
          { title: 'Pédagogie & Notes', href: `${baseUrl}/notes`, active: pathname.includes('/notes') },
          { title: 'Bulletins Scolaires', href: `${baseUrl}/bulletins`, active: pathname.includes('/bulletins') },
          { title: "Tableaux d'Honneur", href: `${baseUrl}/distinctions`, active: pathname.includes('/distinctions') },
        ],
      },
      communicationGroupItem,
      { key: 'personnel', title: 'Enseignants & Personnel', href: `${baseUrl}/personnel`, icon: UserCheck, active: pathname.includes('/personnel') },
      { key: 'notes_diverses', title: 'Notes Diverses', href: `${baseUrl}/notes-diverses`, icon: NotebookPen, active: pathname.includes('/notes-diverses') },
    ];
  } else if (roleId === 'secretaire') {
    // 📝 SECRÉTAIRE : Vue d'ensemble, Documents scolaires, Dépenses de l'école, Rapports & statistiques, Scolarité & caisse, Classes & niveaux, Notes diverses, Enseignants & personnel
    navItems = [
      { key: 'dashboard', title: "Vue d'ensemble", href: `${baseUrl}/dashboard`, icon: LayoutDashboard, active: pathname.includes('/dashboard') },
      { key: 'documents', title: 'Documents Scolaires', href: `${baseUrl}/documents`, icon: FileSpreadsheet, active: pathname.includes('/documents') },
      { key: 'depenses', title: "Dépenses de l'École", href: `${baseUrl}/depenses`, icon: Wallet, active: pathname.includes('/depenses') },
      { key: 'rapports', title: 'Rapports & Statistiques', href: `${baseUrl}/rapports`, icon: BarChart3, active: pathname.includes('/rapports') },
      { key: 'scolarite', title: 'Scolarité & Caisse', href: `${baseUrl}/scolarite`, icon: Receipt, active: pathname.includes('/scolarite') },
      { key: 'classes', title: 'Classes & Niveaux', href: `${baseUrl}/classes`, icon: SchoolIcon, active: pathname.includes('/classes') },
      { key: 'notes_diverses', title: 'Notes Diverses', href: `${baseUrl}/notes-diverses`, icon: NotebookPen, active: pathname.includes('/notes-diverses') },
      { key: 'personnel', title: 'Enseignants & Personnel', href: `${baseUrl}/personnel`, icon: UserCheck, active: pathname.includes('/personnel') },
    ];
  } else if (roleId === 'comptable') {
    // 💼 COMPTABLE : Élèves (3 pages), Tableau de bord avec Services (3 pages), Comptabilité & Finances (3 pages), Réductions, Salaires, Notes Diverses
    navItems = [
      { key: 'dashboard', title: 'Tableau de bord', href: `${baseUrl}/dashboard`, icon: LayoutDashboard, active: pathname.includes('/dashboard') },
      {
        key: 'eleves', title: 'Élèves', icon: Users, isGroup: true, isOpen: studentsOpen, onToggle: () => setStudentsOpen(!studentsOpen),
        active: pathname.includes('/eleves') || pathname.includes('/inscriptions') || pathname.includes('/documents'),
        subItems: [
          { title: 'Inscriptions', href: `${baseUrl}/inscriptions`, active: pathname.includes('/inscriptions') },
          { title: "Vue d'ensemble", href: `${baseUrl}/eleves`, active: pathname.endsWith('/eleves') },
          { title: 'Documents scolaires', href: `${baseUrl}/documents`, active: pathname.includes('/documents') },
        ],
      },
      ...(availableServices.length > 0 ? [{
        key: 'services', title: 'Services & Prestations', icon: UtensilsCrossed, isGroup: true, isOpen: servicesOpen, onToggle: () => setServicesOpen(!servicesOpen),
        active: pathname.includes('/cantine') || pathname.includes('/transport') || pathname.includes('/internat'),
        subItems: availableServices,
      }] : []),
      {
        key: 'finances', title: 'Comptabilité & Finances', icon: Wallet, isGroup: true, isOpen: financeOpen, onToggle: () => setFinanceOpen(!financeOpen),
        active: pathname.includes('/scolarite') || pathname.includes('/depenses') || pathname.includes('/rapports'),
        subItems: [
          { title: 'Scolarité & Caisse', href: `${baseUrl}/scolarite`, active: pathname.includes('/scolarite') },
          { title: "Dépenses de l'École", href: `${baseUrl}/depenses`, active: pathname.includes('/depenses') },
          { title: 'Rapports & Statistiques', href: `${baseUrl}/rapports`, active: pathname.includes('/rapports') },
        ],
      },
      { key: 'reductions', title: 'Réductions spéciales', href: `${baseUrl}/reductions`, icon: BadgePercent, active: pathname.includes('/reductions') },
      { key: 'salaires', title: 'Salaires du personnel', href: `${baseUrl}/salaires`, icon: Receipt, active: pathname.includes('/salaires') },
      { key: 'notes_diverses', title: 'Notes Diverses', href: `${baseUrl}/notes-diverses`, icon: NotebookPen, active: pathname.includes('/notes-diverses') },
    ];
  } else if (roleId === 'enseignant') {
    // 👨‍🏫 ENSEIGNANT : Strictement la Gestion Pédagogique (les 5 pages) + Notes Diverses
    navItems = [
      {
        key: 'pedagogie',
        title: 'Gestion Pédagogique',
        icon: BookOpen,
        isGroup: true,
        isOpen: pedagogyOpen,
        onToggle: () => setPedagogyOpen(!pedagogyOpen),
        active:
          pathname.includes('/classes') ||
          pathname.includes('/presences') ||
          pathname.includes('/notes') ||
          pathname.includes('/bulletins') ||
          pathname.includes('/distinctions'),
        subItems: [
          { title: 'Classes & Niveaux', href: `${baseUrl}/classes`, active: pathname.includes('/classes') },
          { title: 'Présences & Absences', href: `${baseUrl}/presences`, active: pathname.includes('/presences') },
          { title: 'Pédagogie & Notes', href: `${baseUrl}/notes`, active: pathname.includes('/notes') },
          { title: 'Bulletins Scolaires', href: `${baseUrl}/bulletins`, active: pathname.includes('/bulletins') },
          { title: "Tableaux d'Honneur", href: `${baseUrl}/distinctions`, active: pathname.includes('/distinctions') },
        ],
      },
      { key: 'notes_diverses', title: 'Notes Diverses', href: `${baseUrl}/notes-diverses`, icon: NotebookPen, active: pathname.includes('/notes-diverses') },
    ];
  } else if (roleId === 'assistant_direction') {
    // 📋 ASSISTANTE : Vue d'ensemble, Classes et Niveaux, Documents, Enseignants et Personnel, Notes Diverses
    navItems = [
      { key: 'dashboard', title: "Vue d'ensemble", href: `${baseUrl}/dashboard`, icon: LayoutDashboard, active: pathname.includes('/dashboard') },
      { key: 'classes', title: 'Classes & Niveaux', href: `${baseUrl}/classes`, icon: SchoolIcon, active: pathname.includes('/classes') },
      { key: 'documents', title: 'Documents Scolaires', href: `${baseUrl}/documents`, icon: FileSpreadsheet, active: pathname.includes('/documents') },
      { key: 'personnel', title: 'Enseignants & Personnel', href: `${baseUrl}/personnel`, icon: UserCheck, active: pathname.includes('/personnel') },
      { key: 'notes_diverses', title: 'Notes Diverses', href: `${baseUrl}/notes-diverses`, icon: NotebookPen, active: pathname.includes('/notes-diverses') },
    ];
  } else if (roleId === 'parent') {
    // 👨‍👩‍👧 PARENT : Strictement Communication Parents (Messagerie & Diffusions, Notes & Bulletins Scolaires) + Notes Diverses
    navItems = [
      {
        key: 'communication',
        title: 'Communication Parents',
        icon: MessageSquare,
        isGroup: true,
        isOpen: communicationOpen,
        onToggle: () => setCommunicationOpen(!communicationOpen),
        active: pathname.includes('/communication') || pathname.includes('/bulletins-parents'),
        subItems: [
          { title: 'Messagerie & Diffusions', href: `${baseUrl}/communication`, active: pathname.endsWith('/communication') },
          { title: 'Notes & Bulletins Scolaires', href: `${baseUrl}/bulletins-parents`, active: pathname.includes('/bulletins-parents') },
        ],
      },
      { key: 'notes_diverses', title: 'Notes Diverses', href: `${baseUrl}/notes-diverses`, icon: NotebookPen, active: pathname.includes('/notes-diverses') },
    ];
  } else {
    // Fallback standard
    navItems = [
      { key: 'dashboard', title: "Vue d'ensemble", href: `${baseUrl}/dashboard`, icon: LayoutDashboard, active: pathname.includes('/dashboard') },
      { key: 'classes', title: 'Classes & Niveaux', href: `${baseUrl}/classes`, icon: SchoolIcon, active: pathname.includes('/classes') },
      { key: 'notes_diverses', title: 'Notes Diverses', href: `${baseUrl}/notes-diverses`, icon: NotebookPen, active: pathname.includes('/notes-diverses') },
    ];
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between h-screen transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Section: Logo + School Badge */}
        <div className="shrink-0">
          <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
            <Link
              href={`/${schoolSlug}/admin/dashboard`}
              className="flex items-center gap-2.5 group hover:opacity-90 transition-opacity"
            >
              <SchoolFlowLogo size="sm" showTagline={false} />
            </Link>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={onMobileClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
              {/* Active School Badge */}
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
            <Link
              href={`/${schoolSlug}/admin/parametres`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/70 shadow-2xs hover:border-emerald-300 transition-colors group cursor-pointer"
              title="Configurer l'établissement dans les Paramètres"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
              <div className="truncate flex-1">
                {currentSchool.shortName ? (
                  <>
                    <p suppressHydrationWarning className="text-xs font-black text-slate-900 truncate group-hover:text-emerald-700 transition-colors uppercase tracking-wide">
                      {currentSchool.shortName}
                    </p>
                    <p suppressHydrationWarning className="text-[10px] text-slate-500 font-medium">
                      {currentSchool.city || 'Ville à renseigner'} • {currentSchool.academicYear || '2026-2027'}
                    </p>
                  </>
                ) : (
                  <>
                    <p suppressHydrationWarning className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors uppercase">
                      {currentSchool.name || 'Établissement'}
                    </p>
                    <span suppressHydrationWarning className="inline-block text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      ⚙️ Sigle en attente
                    </span>
                  </>
                )}
              </div>
            </Link>
          </div>
        </div>

        {/* Scrollable Navigation Menu Links */}
        <nav className="flex-1 overflow-y-auto min-h-0 p-3 space-y-1 scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;

            if (item.isGroup) {
              return (
                <div key={item.title} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={item.onToggle}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      item.active
                        ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200/70 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${
                          item.active ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      />
                      <span>{item.title}</span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        item.isOpen ? 'rotate-180 text-emerald-600' : 'text-slate-400'
                      }`}
                    />
                  </button>

                  {item.isOpen && item.subItems && (
                    <div className="pl-6 pr-1 py-1 space-y-0.5 border-l-2 border-emerald-100 ml-4 my-1">
                      {item.subItems.map((sub: any) => (
                        <Link
                          key={sub.title}
                          href={sub.href}
                          prefetch={true}
                          onClick={onMobileClose}
                          className={`block px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            sub.active
                              ? 'text-emerald-800 bg-white font-bold shadow-2xs border border-emerald-200/70'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-white/80'
                          }`}
                        >
                          {sub.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.title}
                href={item.href || '#'}
                prefetch={true}
                onClick={onMobileClose}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  item.active
                    ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/30'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    item.active ? 'text-white' : 'text-slate-400'
                  }`}
                />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Profile: School Logo + Role Poster */}
        <div className="p-3 border-t border-slate-100 shrink-0 bg-white">
          <Link
            href={`/${schoolSlug}/admin/parametres`}
            className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 flex items-center gap-3 shadow-2xs transition-all group block"
            title="Modifier le profil et le logo dans les Paramètres"
          >
            {/* Logo officiel de l'école */}
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-0.5 shrink-0 flex items-center justify-center overflow-hidden shadow-xs">
              {currentSchool.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentSchool.logoUrl}
                  alt="Logo École"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full rounded-lg bg-slate-200 text-slate-600 font-extrabold flex items-center justify-center text-[10px] shadow-2xs font-heading group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  {currentSchool.shortName?.slice(0, 3) || 'LOGO'}
                </div>
              )}
            </div>

            {/* Affiche le Fondateur de l'établissement */}
            <div className="flex-1 min-w-0">
              <span className="text-[9px] uppercase font-extrabold text-amber-600 block tracking-wider">
                Fondateur
              </span>
              <p suppressHydrationWarning className="text-xs font-black text-slate-900 truncate font-heading group-hover:text-emerald-700 transition-colors">
                {currentSchool.founderName || 'LAWANI MOUSSA'}
              </p>
              <span suppressHydrationWarning className="text-[10px] font-bold text-slate-500 block truncate">
                {currentSchool.shortName || currentSchool.name || 'Établissement'}
              </span>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
