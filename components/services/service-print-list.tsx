'use client';

import React, { useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';

/**
 * LISTE IMPRIMABLE D'UN SERVICE (cantine, transport) — pour la personne qui sert les repas ou
 * qui fait le ramassage. Aucune somme d'argent : seulement l'élève, sa classe, son régime ou son
 * arrêt, et où il en est dans ses mois (mois choisi payé ou non, dernier mois payé).
 */

export const SCHOOL_MONTHS = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai'];

/** Mois scolaire en cours (Juin–Août → Septembre, rentrée suivante). */
export function currentSchoolMonth(d = new Date()): string {
  const byJsMonth = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', '', '', '', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return byJsMonth[d.getMonth()] || 'Septembre';
}

export type PrintSubscriber = {
  id: string;
  fullName: string;
  studentNumber?: string;
  grade: string;
  /** Régime (cantine) ou arrêt (transport). */
  detail?: string;
  monthsState: Record<string, boolean>;
};

type Filter = 'all' | 'paid' | 'unpaid';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function lastPaidMonth(state: Record<string, boolean>): string {
  let last = '';
  SCHOOL_MONTHS.forEach((m) => {
    if (state[m]) last = m;
  });
  return last;
}

export function ServicePrintListButton({
  serviceName,
  detailLabel,
  schoolName,
  subscribers,
  grades,
  signatureLabel,
}: {
  serviceName: string;
  detailLabel: string;
  schoolName: string;
  subscribers: PrintSubscriber[];
  grades: string[];
  signatureLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(currentSchoolMonth());
  const [grade, setGrade] = useState('all');
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    return subscribers
      .filter((s) => grade === 'all' || s.grade === grade)
      .filter((s) => (filter === 'all' ? true : filter === 'paid' ? !!s.monthsState[month] : !s.monthsState[month]))
      .sort((a, b) => {
        const ga = grades.indexOf(a.grade);
        const gb = grades.indexOf(b.grade);
        return (ga === -1 ? 999 : ga) - (gb === -1 ? 999 : gb) || a.fullName.localeCompare(b.fullName, 'fr');
      });
  }, [subscribers, grade, filter, month, grades]);

  const paidCount = rows.filter((r) => r.monthsState[month]).length;

  const print = () => {
    const title = `${serviceName} — liste du mois de ${month}`;
    const sub = [
      grade !== 'all' ? `Classe : ${grade}` : 'Toutes les classes',
      filter === 'paid' ? `seulement les élèves à jour pour ${month}` : filter === 'unpaid' ? `seulement les élèves pas encore à jour pour ${month}` : '',
      `${rows.length} élève(s)`,
      `imprimée le ${new Date().toLocaleDateString('fr-FR')}`,
    ]
      .filter(Boolean)
      .join(' • ');
    const body = rows
      .map((r, i) => {
        const ok = !!r.monthsState[month];
        const last = lastPaidMonth(r.monthsState);
        return `<tr>
          <td>${i + 1}</td>
          <td><b>${esc(r.fullName)}</b>${r.studentNumber ? `<br><small>${esc(r.studentNumber)}</small>` : ''}</td>
          <td>${esc(r.grade)}</td>
          <td>${esc(r.detail || '')}</td>
          <td class="${ok ? 'ok' : 'ko'}">${ok ? '✓ Oui' : '✗ Non'}</td>
          <td>${last ? esc(last) : 'Aucun mois'}</td>
          <td class="sign"></td>
        </tr>`;
      })
      .join('');
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${esc(title)}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 16px; }
        h1 { font-size: 18px; margin: 0; } h2 { font-size: 15px; margin: 4px 0 2px; }
        p.sub { font-size: 12px; color: #475569; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; } tr { break-inside: avoid; }
        td.ok { color: #047857; font-weight: bold; } td.ko { color: #b91c1c; font-weight: bold; }
        td.sign { width: 90px; } small { color: #64748b; }
        @page { margin: 10mm; }
      </style></head><body>
      <h1>${esc(schoolName)}</h1>
      <h2>${esc(title)}</h2>
      <p class="sub">${esc(sub)}</p>
      <table><thead><tr>
        <th>N°</th><th>Élève</th><th>Classe</th><th>${esc(detailLabel)}</th>
        <th>${esc(month)} réglé</th><th>Dernier mois réglé</th><th>${esc(signatureLabel)}</th>
      </tr></thead><tbody>${body || '<tr><td colspan="7">Aucun élève.</td></tr>'}</tbody></table>
      <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      alert('Le navigateur a bloqué la fenêtre d’impression. Autorisez les fenêtres (pop-up) pour ce site puis réessayez.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
      >
        <Printer className="w-4 h-4 text-emerald-600" />
        <span>Imprimer la liste</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-extrabold text-slate-900">Liste {serviceName.toLowerCase()} à imprimer</p>
                <p className="text-xs text-slate-500">Sans aucune somme : élève, classe, {detailLabel.toLowerCase()} et mois réglés.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-slate-100" aria-label="Fermer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-slate-100">
              <label className="text-xs font-bold text-slate-600">
                Mois
                <select value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                  {SCHOOL_MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">
                Classe
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                  <option value="all">Toutes les classes</option>
                  {grades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">
                Élèves
                <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                  <option value="all">Tous les abonnés</option>
                  <option value="paid">Seulement ceux à jour pour {month}</option>
                  <option value="unpaid">Seulement ceux pas à jour pour {month}</option>
                </select>
              </label>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Élève</th>
                    <th className="text-left px-3 py-2">Classe</th>
                    <th className="text-left px-3 py-2">{detailLabel}</th>
                    <th className="text-left px-3 py-2">{month}</th>
                    <th className="text-left px-3 py-2">Dernier mois réglé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                        Aucun élève pour ce choix.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const ok = !!r.monthsState[month];
                      return (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-semibold text-slate-900">{r.fullName}</td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.grade}</td>
                          <td className="px-3 py-2 text-slate-600">{r.detail}</td>
                          <td className={`px-3 py-2 font-bold whitespace-nowrap ${ok ? 'text-emerald-700' : 'text-red-600'}`}>{ok ? '✓ Oui' : '✗ Non'}</td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{lastPaidMonth(r.monthsState) || 'Aucun mois'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs text-slate-500">
                {rows.length} élève(s) • {paidCount} à jour pour {month}
              </p>
              <button
                type="button"
                onClick={print}
                disabled={rows.length === 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
