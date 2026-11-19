'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, Lock, RotateCcw } from 'lucide-react';
import { ALL_PAGES, ASSIGNABLE_ROLES, FOUNDER_ONLY_PAGES, ROLE_LABELS, allowedPages, effectivePages, isFounderRole, type PageOverrides } from '@/lib/auth/roles';
import { readPageOverrides, savePageOverrides } from '@/lib/data/page-access';
import { DATA_UPDATED_EVENT } from '@/lib/data/live-store';

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  administration: 'Administration & Codes',
  inscriptions: 'Inscriptions',
  eleves: 'Élèves (vue d’ensemble)',
  documents: 'Documents scolaires',
  cantine: 'Cantine',
  transport: 'Transport',
  internat: 'Internat',
  versements: 'Suivi des versements',
  depenses: 'Dépenses',
  rapports: 'Rapports & Statistiques',
  reductions: 'Réductions spéciales',
  salaires: 'Salaires du personnel',
  classes: 'Classes & Niveaux',
  presences: 'Présences & Absences',
  notes: 'Pédagogie & Notes',
  bulletins: 'Bulletins scolaires',
  distinctions: 'Tableaux d’honneur',
  communication: 'Messagerie & Diffusions',
  'bulletins-parents': 'Notes & Bulletins Parents',
  personnel: 'Enseignants & Personnel',
  pointage: 'Pointage du personnel',
  cartes: 'Cartes scolaires & Scan',
  sante: 'Santé & Suivi médical',
  'notes-diverses': 'Notes diverses',
  corbeille: 'Corbeille & Journal',
  archives: 'Archives des années',
  parametres: 'Paramètres',
  acces: 'Accès par poste (cette page)',
};

export function PageAccessView({ schoolSlug }: { schoolSlug: string }) {
  const slug = schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug;
  const [overrides, setOverrides] = useState<PageOverrides>({});
  const [roleId, setRoleId] = useState('');
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const load = () => {
      setOverrides(readPageOverrides(slug));
      try {
        setRoleId(JSON.parse(localStorage.getItem('schoolflow_active_session_v2') || '{}').roleId || '');
      } catch {}
      setReady(true);
    };
    load();
    window.addEventListener(DATA_UPDATED_EVENT, load);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, load);
  }, [slug]);

  const canEdit = isFounderRole(roleId);
  const pages = ALL_PAGES;

  const toggle = (role: string, page: string, checked: boolean) => {
    if (!canEdit || FOUNDER_ONLY_PAGES.includes(page)) return;
    const base = allowedPages(role);
    const cur = overrides[role] || {};
    const add = new Set(cur.add || []);
    const remove = new Set(cur.remove || []);
    if (checked) {
      remove.delete(page);
      if (!base.includes(page)) add.add(page);
    } else {
      add.delete(page);
      if (base.includes(page)) remove.add(page);
    }
    const next: PageOverrides = { ...overrides };
    if (add.size === 0 && remove.size === 0) delete next[role];
    else next[role] = { add: Array.from(add), remove: Array.from(remove) };
    setOverrides(next);
    savePageOverrides(slug, next);
    setSaved('Enregistré — le poste voit le changement dans la minute.');
    window.setTimeout(() => setSaved(''), 3500);
  };

  const reset = (role: string) => {
    if (!canEdit) return;
    const next = { ...overrides };
    delete next[role];
    setOverrides(next);
    savePageOverrides(slug, next);
    setSaved(`Droits par défaut rétablis pour « ${ROLE_LABELS[role]} ».`);
    window.setTimeout(() => setSaved(''), 3500);
  };

  if (!ready) return null;

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 font-heading">Accès par poste</h1>
          <p className="text-xs text-slate-500">
            Cochez les pages que chaque poste peut ouvrir. Un clic suffit : la page apparaît (ou disparaît) du menu du poste concerné.
          </p>
        </div>
      </div>

      {!canEdit && <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold">Seuls le Fondateur et le DGA peuvent modifier ces accès.</p>}
      {saved && <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold">{saved}</p>}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left py-3 px-4 font-extrabold text-slate-700 sticky left-0 bg-slate-50 z-10">Page</th>
              {ASSIGNABLE_ROLES.map((r) => (
                <th key={r} className="py-3 px-2 text-center font-bold text-slate-700 align-bottom">
                  <span className="block leading-tight">{(ROLE_LABELS[r] || r).replace(/ \(.*\)/, '')}</span>
                  {overrides[r] && (
                    <button type="button" disabled={!canEdit} onClick={() => reset(r)} className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
                      <RotateCcw className="w-3 h-3" /> par défaut
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pages.map((p) => {
              const locked = FOUNDER_ONLY_PAGES.includes(p);
              return (
                <tr key={p} className="hover:bg-slate-50/60">
                  <td className="py-2 px-4 font-semibold text-slate-800 sticky left-0 bg-white z-10 whitespace-nowrap">
                    {PAGE_LABELS[p] || p}
                    {locked && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                        <Lock className="w-3 h-3" /> Fondateur / DGA
                      </span>
                    )}
                  </td>
                  {ASSIGNABLE_ROLES.map((r) => {
                    const on = effectivePages(r, overrides).includes(p);
                    const changed = on !== allowedPages(r).includes(p);
                    return (
                      <td key={r} className={`py-2 px-2 text-center ${changed ? 'bg-amber-50' : ''}`}>
                        {locked ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={!canEdit}
                            onChange={(e) => toggle(r, p, e.target.checked)}
                            className="w-4 h-4 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed"
                            aria-label={`${PAGE_LABELS[p] || p} — ${ROLE_LABELS[r]}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-slate-500 space-y-1">
        <p>Les cases sur fond jaune sont celles que vous avez modifiées par rapport aux droits par défaut. « Par défaut » rétablit les droits d’origine du poste.</p>
        <p>Ouvrir une page donne accès à l’écran. Les données financières restent protégées : un poste sans droit sur les finances voit la page mais pas les chiffres.</p>
      </div>
    </div>
  );
}
