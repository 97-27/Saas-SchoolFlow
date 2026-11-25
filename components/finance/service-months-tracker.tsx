'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, MessageCircle, Printer, Search } from 'lucide-react';
import { formatFCFA } from '@/lib/utils/formatters';
import { availableClasses } from '@/lib/data/mock-data';
import { getLiveStudents, DATA_UPDATED_EVENT } from '@/lib/data/live-store';
import { loadServiceSubscribers, SERVICE_MONTHS, type ServiceId, type ServiceSubscriber } from '@/lib/data/service-subscribers';
import { serviceStartId, setServiceStarts } from '@/lib/data/service-start';
import { Figure } from '@/components/ui/masked-figure';

/**
 * Suivi mois par mois d'un service (Internat, Cantine, Transport), sur le modèle du suivi des
 * versements de scolarité : on choisit un ou plusieurs mois, la liste montre qui ne les a pas payés,
 * avec rappel WhatsApp/SMS au parent, impression et export Excel.
 */

const LABEL: Record<ServiceId, string> = { internat: 'Internat', cantine: 'Cantine', transport: 'Transport' };

const normalize = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function waLink(phone: string, text: string): string | null {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length < 8) return null;
  if ((d.length === 10 && d.startsWith('0')) || d.length === 8) d = `225${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

const joinMonths = (ms: string[]) => (ms.length <= 1 ? ms.join('') : `${ms.slice(0, -1).join(', ')} et ${ms[ms.length - 1]}`);

/** Mois scolaire en cours (Septembre → Mai) ; Septembre par défaut hors période. */
function currentSchoolMonth(): string {
  const names = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const m = names[new Date().getMonth()];
  return SERVICE_MONTHS.includes(m) ? m : SERVICE_MONTHS[0];
}

export function ServiceMonthsTracker({ service, schoolSlug, schoolName }: { service: ServiceId; schoolSlug: string; schoolName: string }) {
  const label = LABEL[service];
  const [subs, setSubs] = useState<ServiceSubscriber[]>([]);
  const [selected, setSelected] = useState<string[]>([currentSchoolMonth()]);
  const [grade, setGrade] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = () => setSubs(loadServiceSubscribers(service, getLiveStudents([], schoolSlug), schoolSlug));
    load();
    window.addEventListener(DATA_UPDATED_EVENT, load);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, load);
  }, [service, schoolSlug]);

  const grades = useMemo(() => {
    const used = Array.from(new Set(subs.map((r) => r.grade).filter(Boolean)));
    const known = availableClasses.filter((c) => c !== 'Toutes les classes');
    const extra = used.filter((g) => !known.includes(g)).sort((a, b) => a.localeCompare(b, 'fr'));
    return [...known.filter((g) => used.includes(g)), ...extra];
  }, [subs]);

  const q = normalize(search);
  const visible = useMemo(
    () =>
      subs.filter((r) => {
        if (grade !== 'all' && r.grade !== grade) return false;
        if (!q) return true;
        const hay = normalize(`${r.name} ${r.number} ${r.guardian} ${r.phone}`);
        return q.split(/\s+/).every((w) => hay.includes(w));
      }),
    [subs, grade, q]
  );

  // Un mois dû = mois choisi, pas payé, et PAS avant le début du service pour cet élève.
  const isDue = (r: ServiceSubscriber, m: string) =>
    !r.months[m] && SERVICE_MONTHS.indexOf(m) >= SERVICE_MONTHS.indexOf(r.startMonth);

  const counts = useMemo(() => {
    const base = subs.filter((r) => grade === 'all' || r.grade === grade);
    return Object.fromEntries(SERVICE_MONTHS.map((m) => [m, base.filter((r) => isDue(r, m)).length])) as Record<string, number>;
  }, [subs, grade]);

  /** L'école décide de compter aussi les mois écoulés avant l'abonnement : début ramené à Septembre. */
  const countFromSeptember = (r: ServiceSubscriber) => {
    setServiceStarts(schoolSlug, { [serviceStartId(service, r.id)]: SERVICE_MONTHS[0] });
    setSubs(loadServiceSubscribers(service, getLiveStudents([], schoolSlug), schoolSlug));
  };

  const list = useMemo(() => {
    const out = visible
      .map((r) => ({ ...r, missing: SERVICE_MONTHS.filter((m) => selected.includes(m) && isDue(r, m)) }))
      .filter((r) => r.missing.length > 0);
    return out.sort((a, b) => grades.indexOf(a.grade) - grades.indexOf(b.grade) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  }, [visible, selected, grades]);

  const total = list.reduce((s, r) => s + r.missing.length * r.monthlyRate, 0);
  const toggle = (m: string) => setSelected((p) => (p.includes(m) ? p.filter((x) => x !== m) : SERVICE_MONTHS.filter((x) => x === m || p.includes(x))));
  const printId = `service-print-${service}`;

  const exportCsv = () => {
    const head = ['N°', 'Élève', 'Classe', 'Parent', 'Téléphone', 'Mois non payés', 'Tarif / mois', 'Montant dû'];
    const lines = list.map((r) =>
      [r.number, r.name, r.grade, r.guardian, r.phone, r.missing.join(', '), r.monthlyRate, r.missing.length * r.monthlyRate]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';')
    );
    const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${service}-non-payes-${schoolSlug}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #${printId}, #${printId} * { visibility: visible !important; }
          #${printId} { position: absolute; left: 0; top: 0; width: 100%; padding: 0 8mm; border: 0 !important; }
          .no-print { display: none !important; }
          #${printId} table { font-size: 11px; }
          #${printId} tr { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label} — cochez un ou plusieurs mois</p>
          <div className="flex gap-2">
            <button type="button" onClick={exportCsv} disabled={list.length === 0} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50">
              <Download className="w-4 h-4" /> Excel
            </button>
            <button type="button" onClick={() => window.print()} disabled={list.length === 0} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
              <Printer className="w-4 h-4" /> Imprimer la liste
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {SERVICE_MONTHS.map((m) => {
            const on = selected.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggle(m)}
                className={`flex flex-col items-start rounded-2xl border px-3 py-2 text-left transition-colors ${on ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <span className="text-[11px] font-bold">{m}</span>
                <span className="text-lg font-extrabold leading-tight">{counts[m] ?? 0}</span>
                <span className="text-[9.5px] text-slate-400">non payé(s)</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelected([...SERVICE_MONTHS])} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">Tout cocher</button>
          <button type="button" onClick={() => setSelected([])} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">Tout décocher</button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève, un parent, un numéro…" autoComplete="off" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
          </div>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} className="sm:w-56 px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white">
            <option value="all">Toutes les classes</option>
            {grades.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      <div id={printId} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold text-slate-900">{schoolName}</p>
            <p className="text-xs text-slate-500">
              {label} — {selected.length === 0 ? 'aucun mois choisi' : `mois non payés : ${joinMonths(selected)}`}
              {grade !== 'all' ? ` • ${grade}` : ''} • {list.length} élève(s)
            </p>
          </div>
          <p className="text-sm font-bold text-rose-600">Total dû : <Figure>{formatFCFA(total)}</Figure></p>
        </div>
        {list.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {subs.length === 0 ? `Aucun abonné ${label.toLowerCase()} enregistré.` : 'Aucun élève pour ce choix : tout est à jour.'}
          </p>
        ) : (
          <div className="overflow-x-auto scrollbar-top">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">N°</th>
                  <th className="text-left px-3 py-2">Élève</th>
                  <th className="text-left px-3 py-2">Classe</th>
                  <th className="text-left px-3 py-2">Parent / Téléphone</th>
                  <th className="text-left px-3 py-2">Mois non payés</th>
                  <th className="text-right px-3 py-2">Montant dû</th>
                  <th className="no-print px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => {
                  const amount = r.missing.length * r.monthlyRate;
                  const message = `Bonjour ${r.guardian || ''}, ${schoolName} vous rappelle que ${r.missing.length > 1 ? 'les mois de' : 'le mois de'} ${joinMonths(r.missing)} (${label}) de ${r.name} (${r.grade}) ${r.missing.length > 1 ? 'ne sont pas encore payés' : "n'est pas encore payé"} : ${formatFCFA(amount)} au total (${formatFCFA(r.monthlyRate)} par mois). Merci.`;
                  const link = waLink(r.phone, message);
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.number}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{r.name}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.grade}</td>
                      <td className="px-3 py-2 text-slate-600">
                        <div>{r.guardian}</div>
                        <div className="text-xs text-slate-400">{r.phone}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {r.missing.map((m) => (
                            <span key={m} className="inline-block rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-bold text-rose-700">{m}</span>
                          ))}
                        </div>
                        {SERVICE_MONTHS.indexOf(r.startMonth) > 0 && (
                          <div className="no-print mt-1 text-[10.5px] text-slate-400">
                            Service commencé en {r.startMonth} : les mois d’avant ne comptent pas.{' '}
                            <button type="button" onClick={() => countFromSeptember(r)} className="font-bold text-slate-500 underline hover:text-slate-800">
                              Compter depuis Septembre
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-bold text-rose-600"><Figure>{formatFCFA(amount)}</Figure></td>
                      <td className="no-print px-3 py-2 text-right">
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer" title="Rappel WhatsApp au parent" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
                            <MessageCircle className="w-3.5 h-3.5" /> Rappel
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">N° manquant</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {subs.some((r) => SERVICE_MONTHS.indexOf(r.startMonth) > 0) && (
        <details className="no-print bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
          <summary className="cursor-pointer text-xs font-bold text-slate-600">
            Abonnés arrivés après septembre ({subs.filter((r) => SERVICE_MONTHS.indexOf(r.startMonth) > 0).length}) — les mois d’avant ne leur sont pas dus
          </summary>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {subs
              .filter((r) => SERVICE_MONTHS.indexOf(r.startMonth) > 0)
              .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
              .map((r) => (
                <li key={r.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    {r.name} <span className="text-xs font-normal text-slate-400">{r.grade} • début : {r.startMonth}</span>
                  </span>
                  <button type="button" onClick={() => countFromSeptember(r)} className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200">
                    Compter depuis Septembre
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}
