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
  BookOpen,
  UserCheck,
  Wallet,
  UtensilsCrossed,
  BarChart3,
  Settings,
  ChevronDown,
  X,
  Building2,
  BadgePercent,
  MessageSquare,
  FileSpreadsheet,
  KeyRound,
  NotebookPen,
  Receipt,
  Mail,
  HeartPulse,
  Trash2,
  Clock,
} from 'lucide-react';

import { SchoolFlowLogo } from '@/components/ui/schoolflow-logo';
import { canAccessPage, homePage } from '@/lib/auth/roles';

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
    pathname.includes('/depenses') || pathname.includes('/rapports') || pathname.includes('/versements')
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
    roleBadge: '👑 Admin • Contrôle',
    fullName: 'LAWANI MOUHAMED',
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
            page: 'cantine',
            title: 'Cantine scolaire',
            href: `${baseUrl}/cantine`,
            active: pathname.includes('/cantine'),
          },
        ]
      : []),
    ...(currentSchool.hasTransport !== false
      ? [
          {
            page: 'transport',
            title: 'Transport scolaire',
            href: `${baseUrl}/transport`,
            active: pathname.includes('/transport'),
          },
        ]
      : []),
    ...(currentSchool.hasBoarding !== false
      ? [
          {
            page: 'internat',
            title: 'Internat & Hébergement',
            href: `${baseUrl}/internat`,
            active: pathname.includes('/internat'),
          },
        ]
      : []),
  ];

  // Menu construit à partir des pages autorisées du poste (lib/auth/roles.ts) : le menu et la
  // protection des pages (proxy.ts) lisent la même liste et ne peuvent plus se contredire.
  const can = (page: string) => canAccessPage(roleId, page);
  let navItems: any[] = [];
  const communicationGroupItem = {
    key: 'communication',
    title: 'Communication Parents',
    icon: MessageSquare,
    isGroup: true,
    isOpen: communicationOpen,
    onToggle: () => setCommunicationOpen(!communicationOpen),
    active: pathname.includes('/communication') || pathname.includes('/bulletins-parents'),
  };
  const keepSubs = (subs: any[]) => subs.filter((s) => can(s.page));

  const catalog: any[] = [
    { key: 'dashboard', page: 'dashboard', title: 'Tableau de bord', href: `${baseUrl}/dashboard`, icon: LayoutDashboard, active: pathname.includes('/dashboard') },
    { key: 'administration', page: 'administration', title: 'Administration & Codes', href: `${baseUrl}/administration`, icon: KeyRound, active: pathname.includes('/administration') },
    {
      key: 'eleves', title: 'Élèves', icon: Users, isGroup: true, isOpen: studentsOpen, onToggle: () => setStudentsOpen(!studentsOpen),
      active: pathname.includes('/eleves') || pathname.includes('/inscriptions') || pathname.includes('/documents'),
      subItems: keepSubs([
        { page: 'inscriptions', title: 'Inscriptions', href: `${baseUrl}/inscriptions`, active: pathname.includes('/inscriptions') },
        { page: 'eleves', title: "Vue d'ensemble", href: `${baseUrl}/eleves`, active: pathname.endsWith('/eleves') },
        { page: 'documents', title: 'Documents scolaires', href: `${baseUrl}/documents`, active: pathname.includes('/documents') },
      ]),
    },
    {
      key: 'services', title: 'Services & Prestations', icon: UtensilsCrossed, isGroup: true, isOpen: servicesOpen, onToggle: () => setServicesOpen(!servicesOpen),
      active: pathname.includes('/cantine') || pathname.includes('/transport') || pathname.includes('/internat'),
      subItems: keepSubs(availableServices),
    },
    {
      key: 'finances', title: 'Comptabilité & Finances', icon: Wallet, isGroup: true, isOpen: financeOpen, onToggle: () => setFinanceOpen(!financeOpen),
      active: pathname.includes('/depenses') || pathname.includes('/rapports') || pathname.includes('/versements'),
      subItems: keepSubs([
        { page: 'versements', title: 'Suivi des versements', href: `${baseUrl}/versements`, active: pathname.includes('/versements') },
        { page: 'depenses', title: "Dépenses de l'École", href: `${baseUrl}/depenses`, active: pathname.includes('/depenses') },
        { page: 'rapports', title: 'Rapports & Statistiques', href: `${baseUrl}/rapports`, active: pathname.includes('/rapports') },
      ]),
    },
    { key: 'reductions', page: 'reductions', title: 'Réductions spéciales', href: `${baseUrl}/reductions`, icon: BadgePercent, active: pathname.includes('/reductions') },
    { key: 'salaires', page: 'salaires', title: 'Salaires du personnel', href: `${baseUrl}/salaires`, icon: Receipt, active: pathname.includes('/salaires') },
    {
      key: 'pedagogie', title: 'Gestion Pédagogique', icon: BookOpen, isGroup: true, isOpen: pedagogyOpen, onToggle: () => setPedagogyOpen(!pedagogyOpen),
      active: pathname.includes('/classes') || pathname.includes('/presences') || pathname.includes('/notes') || pathname.includes('/bulletins') || pathname.includes('/distinctions'),
      subItems: keepSubs([
        { page: 'classes', title: 'Classes & Niveaux', href: `${baseUrl}/classes`, active: pathname.includes('/classes') },
        { page: 'presences', title: 'Présences & Absences', href: `${baseUrl}/presences`, active: pathname.includes('/presences') },
        { page: 'notes', title: 'Pédagogie & Notes', href: `${baseUrl}/notes`, active: pathname.endsWith('/notes') },
        { page: 'bulletins', title: 'Bulletins Scolaires', href: `${baseUrl}/bulletins`, active: pathname.endsWith('/bulletins') },
        { page: 'distinctions', title: "Tableaux d'Honneur", href: `${baseUrl}/distinctions`, active: pathname.includes('/distinctions') },
      ]),
    },
    {
      ...communicationGroupItem,
      subItems: keepSubs([
        { page: 'communication', title: 'Messagerie & Diffusions', href: `${baseUrl}/communication`, active: pathname.endsWith('/communication') },
        { page: 'bulletins-parents', title: 'Notes & Bulletins Parents', href: `${baseUrl}/bulletins-parents`, active: pathname.includes('/bulletins-parents') },
      ]),
    },
    { key: 'personnel', page: 'personnel', title: 'Enseignants & Personnel', href: `${baseUrl}/personnel`, icon: UserCheck, active: pathname.includes('/personnel') },
    { key: 'pointage', page: 'pointage', title: 'Pointage du personnel', href: `${baseUrl}/pointage`, icon: Clock, active: pathname.includes('/pointage') },
    { key: 'sante', page: 'sante', title: 'Santé & Suivi Médical', href: `${baseUrl}/sante`, icon: HeartPulse, active: pathname.includes('/sante') },
    { key: 'notes_diverses', page: 'notes-diverses', title: 'Notes Diverses', href: `${baseUrl}/notes-diverses`, icon: NotebookPen, active: pathname.includes('/notes-diverses') },
    { key: 'corbeille', page: 'corbeille', title: 'Corbeille & Journal', href: `${baseUrl}/corbeille`, icon: Trash2, active: pathname.includes('/corbeille') },
    { key: 'parametres', page: 'parametres', title: 'Paramètres', href: `${baseUrl}/parametres`, icon: Settings, active: pathname.includes('/parametres') },
  ];

  if (roleId === 'parent') {
    // 👨‍👩‍👧 PARENT : trois espaces dédiés — Notes & Bulletins, Écrire à la Direction, Notes Diverses.
    navItems = [
      { key: 'bulletins-parents', title: 'Notes & Bulletins Scolaires', href: `${baseUrl}/bulletins-parents`, icon: MessageSquare, active: pathname.includes('/bulletins-parents') },
      { key: 'messagerie-parent', title: 'Écrire à la Direction', href: `${baseUrl}/messagerie-parent`, icon: Mail, active: pathname.includes('/messagerie-parent') },
      { key: 'notes_diverses', title: 'Notes Diverses', href: `${baseUrl}/notes-diverses`, icon: NotebookPen, active: pathname.includes('/notes-diverses') },
    ];
  } else {
    navItems = catalog.filter((item) => (item.isGroup ? item.subItems.length > 0 : can(item.page)));
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
              href={`${baseUrl}/${homePage(roleId)}`}
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
              href={can('parametres') ? `${baseUrl}/parametres` : `${baseUrl}/${homePage(roleId)}`}
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
            href={can('parametres') ? `${baseUrl}/parametres` : `${baseUrl}/${homePage(roleId)}`}
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
