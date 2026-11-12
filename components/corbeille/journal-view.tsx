'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Trash2,
  History,
  RotateCcw,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  User,
  Receipt,
  BedDouble,
  CalendarCheck,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { getJournal, restoreJournalEntry, purgeJournalEntry, JournalEntry } from '@/lib/supabase/remote';
import { syncSchoolDataWithServer } from '@/lib/data/live-store';

/**
 * CORBEILLE & JOURNAL (Directeur / Fondateur)
 * Tout ce qui est supprimé ou modifié (élèves, reçus, internat / cantine / transport, mois payés)
 * est gardé par la base (migration 007). Ici, on le voit — qui, quand, quoi — et on le remet en
 * place en un clic.
 */

type Tab = 'trash' | 'changes';

interface Group {
  main: JournalEntry;
  related: JournalEntry[];
}

const WINDOW_MS = 15 * 60 * 1000;
const SERVICE_NAMES: Record<string, string> = { internat: 'Internat', cantine: 'Cantine', transport: 'Transport' };

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Nom complet',
  first_name: 'Prénom(s)',
  last_name: 'Nom',
  grade: 'Classe',
  gender: 'Sexe',
  matricule: 'Matricule',
  date_of_birth: 'Date de naissance',
  address: 'Adresse',
  guardian_name: 'Parent / tuteur',
  guardian_phone: 'Téléphone du parent',
  whatsapp_phone: 'WhatsApp',
  enrollment_type: "Type d'inscription",
  registration_fee: "Frais d'inscription",
  tuition_amount: 'Scolarité',
  discount_amount: 'Réduction',
  net_amount: 'Net à payer',
  paid_amount: 'Montant payé',
  balance_remaining: 'Reste à payer',
  tuition_status: 'Statut du paiement',
  status: 'Statut',
  fee_type: 'Nature du reçu',
  amount: 'Montant',
  payment_method: 'Mode de paiement',
  issue_date: 'Date du reçu',
  due_date: 'Échéance',
  monthly_rate: 'Tarif mensuel',
  discount: 'Remise',
  details: 'Détails',
  month: 'Mois',
  service: 'Service',
  avatar_url: 'Photo',
  attendance_rate: 'Assiduité',
};
const MONEY_FIELDS = new Set([
  'registration_fee',
  'tuition_amount',
  'discount_amount',
  'net_amount',
  'paid_amount',
  'balance_remaining',
  'amount',
  'monthly_rate',
  'discount',
]);
const IGNORED_FIELDS = new Set(['id', 'school_id', 'student_id', 'created_at', 'updated_at', 'student_number', 'invoice_number', 'paid_at']);

const money = (v: unknown) => `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(v) || 0))} F`;

function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (MONEY_FIELDS.has(field)) return money(v);
  if (typeof v === 'object') {
    const d = v as Record<string, unknown>;
    const parts = [d.pavilion, d.roomNumber, d.parentContact].filter(Boolean);
    return parts.length ? parts.join(' · ') : JSON.stringify(v);
  }
  return String(v);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function rowOf(e: JournalEntry): Record<string, any> {
  return (e.op === 'DELETE' ? e.oldRow : e.newRow || e.oldRow) || {};
}

function studentLabel(e: JournalEntry): string {
  const row = rowOf(e);
  const name = e.studentName || (e.table === 'students' ? row.full_name : '') || 'Élève inconnu';
  const num = e.studentNumber || (e.table === 'students' ? row.student_number : '');
  return num ? `${name} (${num})` : name;
}

/** Regroupe une suppression d'élève (ou un retrait de service) avec ce qui est parti avec. */
function groupTrash(entries: JournalEntry[]): Group[] {
  const used = new Set<number>();
  const groups: Group[] = [];
  const near = (a: JournalEntry, b: JournalEntry) => Math.abs(new Date(a.at).getTime() - new Date(b.at).getTime()) <= WINDOW_MS;
  const priority = (t: JournalEntry['table']) => (t === 'students' ? 0 : t === 'service_subscriptions' ? 1 : 2);
  const ordered = [...entries].sort((a, b) => priority(a.table) - priority(b.table));

  for (const e of ordered) {
    if (used.has(e.id)) continue;
    used.add(e.id);
    const related: JournalEntry[] = [];
    if (e.table === 'students' && e.studentId) {
      for (const o of entries) {
        if (!used.has(o.id) && o.studentId === e.studentId && near(o, e)) {
          used.add(o.id);
          related.push(o);
        }
      }
    } else if (e.table === 'service_subscriptions' && e.studentId) {
      const svc = String(e.oldRow?.service || '');
      for (const o of entries) {
        if (used.has(o.id) || o.studentId !== e.studentId || !near(o, e)) continue;
        const sameService =
          (o.table === 'service_month_payments' && o.oldRow?.service === svc) ||
          (o.table === 'invoices' && String(o.oldRow?.fee_type || '').toLowerCase().includes(svc));
        if (sameService) {
          used.add(o.id);
          related.push(o);
        }
      }
    }
    groups.push({ main: e, related });
  }
  return groups.sort((a, b) => new Date(b.main.at).getTime() - new Date(a.main.at).getTime());
}

function describeTrash(g: Group): { icon: React.ElementType; title: string; detail: string } {
  const e = g.main;
  const row = e.oldRow || {};
  const count = (t: JournalEntry['table']) => g.related.filter((r) => r.table === t).length;
  const extras = [
    count('invoices') ? `${count('invoices')} reçu(s)` : '',
    count('service_subscriptions') ? `${count('service_subscriptions')} abonnement(s)` : '',
    count('service_month_payments') ? `${count('service_month_payments')} mois payé(s)` : '',
  ].filter(Boolean);
  switch (e.table) {
    case 'students':
      return {
        icon: User,
        title: `Élève supprimé : ${row.full_name || 'sans nom'} (${row.student_number || '—'})`,
        detail: [row.grade, extras.length ? `avec ${extras.join(', ')}` : ''].filter(Boolean).join(' · '),
      };
    case 'service_subscriptions':
      return {
        icon: BedDouble,
        title: `Retiré du service ${SERVICE_NAMES[row.service] || row.service} : ${studentLabel(e)}`,
        detail: [`Tarif ${money(row.monthly_rate)} / mois`, extras.length ? `avec ${extras.join(', ')}` : ''].filter(Boolean).join(' · '),
      };
    case 'invoices':
      return {
        icon: Receipt,
        title: `Reçu supprimé ${row.invoice_number || ''} : ${studentLabel(e)}`,
        detail: `${row.fee_type || 'Reçu'} · payé ${money(row.paid_amount)}`,
      };
    default:
      return {
        icon: CalendarCheck,
        title: `Mois décoché (${SERVICE_NAMES[row.service] || row.service}) : ${studentLabel(e)}`,
        detail: String(row.month || ''),
      };
  }
}

// ── Lecture claire des modifications ──────────────────────────────────────
// Le champ « address » d'une fiche élève contient, en fin de texte, un bloc technique
// [SF_META:{...}] (versements, dates, notes…). On le sépare pour expliquer chaque changement
// en français au lieu d'afficher ce bloc tel quel.

type Change = { field: string; before: string; after: string; note?: string; tone?: 'up' | 'down' };

function splitAddress(raw: unknown): { address: string; meta: Record<string, any> } {
  const s = String(raw || '');
  const m = s.match(/\[SF_META:([\s\S]*)\]\s*$/);
  let meta: Record<string, any> = {};
  if (m) {
    try {
      meta = JSON.parse(m[1]) || {};
    } catch {
      meta = {};
    }
  }
  return { address: (m ? s.slice(0, m.index) : s).trim(), meta };
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  paid: 'Soldé',
  partial: 'Partiel',
  pending: 'En attente',
  unpaid: 'Non payé',
  overdue: 'En retard',
};

const frDay = (v: unknown) => {
  const s = String(v || '');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : s;
};

function moneyChange(field: string, before: number, after: number): Change {
  const diff = after - before;
  return {
    field,
    before: before ? money(before) : '—',
    after: after ? money(after) : '—',
    note: diff > 0 ? `+${money(diff)} ajoutés` : diff < 0 ? `${money(-diff)} retirés` : undefined,
    tone: diff > 0 ? 'up' : diff < 0 ? 'down' : undefined,
  };
}

const ORD = ['1er', '2e', '3e', '4e', '5e'];

function metaChanges(o: Record<string, any>, n: Record<string, any>): Change[] {
  const out: Change[] = [];
  const oi = o.installments || {};
  const ni = n.installments || {};
  for (let i = 1; i <= 5; i++) {
    const a = oi[`versement${i}`] || {};
    const b = ni[`versement${i}`] || {};
    const label = `${ORD[i - 1]} versement`;
    const before = Number(a.amount) || 0;
    const after = Number(b.amount) || 0;
    if (before !== after) {
      const c = moneyChange(label, before, after);
      if (!before) c.note = `versement ajouté : ${money(after)}`;
      else if (!after) c.note = `versement effacé (il était de ${money(before)})`;
      out.push(c);
    }
    const ma = a.paymentMethod || a.method || '';
    const mb = b.paymentMethod || b.method || '';
    if (after && ma !== mb && (ma || mb)) out.push({ field: `${label} — mode de paiement`, before: ma || '—', after: mb || '—' });
    if (after && (a.date || '') !== (b.date || '') && (a.date || b.date))
      out.push({ field: `${label} — date`, before: frDay(a.date) || '—', after: frDay(b.date) || '—' });
  }
  if ((o.enrollmentDate || '') !== (n.enrollmentDate || ''))
    out.push({ field: "Date d'inscription", before: frDay(o.enrollmentDate) || '—', after: frDay(n.enrollmentDate) || '—' });
  if ((o.paymentDate || '') !== (n.paymentDate || ''))
    out.push({ field: 'Date de paiement', before: frDay(o.paymentDate) || '—', after: frDay(n.paymentDate) || '—' });
  if ((o.notes || '') !== (n.notes || '')) out.push({ field: 'Notes', before: o.notes || '—', after: n.notes || '—' });
  const op = (o.secondaryPhones || []).join(', ');
  const np = (n.secondaryPhones || []).join(', ');
  if (op !== np) out.push({ field: 'Autres téléphones', before: op || '—', after: np || '—' });
  if (Boolean(o.isBoarding) !== Boolean(n.isBoarding))
    out.push({ field: 'Internat', before: o.isBoarding ? 'Oui' : 'Non', after: n.isBoarding ? 'Oui' : 'Non' });
  return out;
}

function fieldChange(k: string, ov: unknown, nv: unknown): Change {
  const field = FIELD_LABELS[k] || k;
  if (MONEY_FIELDS.has(k)) return moneyChange(field, Number(ov) || 0, Number(nv) || 0);
  if (k === 'status' || k === 'tuition_status')
    return { field, before: STATUS_LABELS[String(ov)] || formatValue(k, ov), after: STATUS_LABELS[String(nv)] || formatValue(k, nv) };
  if (k === 'date_of_birth' || k === 'issue_date' || k === 'due_date')
    return { field, before: frDay(ov) || '—', after: frDay(nv) || '—' };
  if (k === 'gender') {
    const g = (v: unknown) => (v === 'M' ? 'Garçon' : v === 'F' ? 'Fille' : formatValue(k, v));
    return { field, before: g(ov), after: g(nv) };
  }
  return { field, before: formatValue(k, ov), after: formatValue(k, nv) };
}

function rowChanges(o: Record<string, any>, n: Record<string, any>): Change[] {
  const keys = Object.keys({ ...o, ...n }).filter((k) => !IGNORED_FIELDS.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]));
  // Le nom complet suffit : on n'affiche pas en plus Nom et Prénom(s) quand il a changé.
  const skip = new Set(keys.includes('full_name') ? ['first_name', 'last_name'] : []);
  const out: Change[] = [];
  for (const k of keys) {
    if (skip.has(k)) continue;
    if (k === 'address') {
      const a = splitAddress(o[k]);
      const b = splitAddress(n[k]);
      if (a.address !== b.address) out.push({ field: 'Adresse', before: a.address || '—', after: b.address || '—' });
      out.push(...metaChanges(a.meta, b.meta));
      continue;
    }
    if (k === 'details' && typeof (o[k] ?? n[k]) === 'object') {
      const before = formatValue(k, o[k]);
      const after = formatValue(k, n[k]);
      if (before !== after) out.push({ field: 'Détails', before, after });
      continue;
    }
    out.push(fieldChange(k, o[k], n[k]));
  }
  return out;
}

function describeChange(e: JournalEntry): { title: string; changes: Change[] } {
  const what =
    e.table === 'students'
      ? 'Fiche élève'
      : e.table === 'invoices'
        ? `Reçu ${rowOf(e).invoice_number || ''}`
        : e.table === 'service_subscriptions'
          ? `Abonnement ${SERVICE_NAMES[rowOf(e).service] || ''}`
          : `Mois payé ${SERVICE_NAMES[rowOf(e).service] || ''}`;
  if (e.op === 'INSERT') {
    const row = e.newRow || {};
    const detail =
      e.table === 'invoices'
        ? `${row.fee_type || ''} · payé ${money(row.paid_amount)}`
        : e.table === 'service_month_payments'
          ? String(row.month || '')
          : e.table === 'service_subscriptions'
            ? `Tarif ${money(row.monthly_rate)} / mois`
            : String(row.grade || '');
    return { title: `${what} créé(e) : ${studentLabel(e)}`, changes: detail ? [{ field: '', before: '', after: detail }] : [] };
  }
  const changes = rowChanges(e.oldRow || {}, e.newRow || {});
  return { title: `${what} modifié(e) : ${studentLabel(e)}`, changes };
}

export function JournalView({ schoolSlug }: { schoolSlug: string }) {
  const [tab, setTab] = useState<Tab>('trash');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getJournal(tab, schoolSlug);
    if (!res) {
      setError("Impossible de lire le journal. Vérifiez la connexion, ou que vous êtes connecté en tant que Directeur ou Fondateur.");
      setEntries([]);
    } else {
      setAvailable(res.available);
      setEntries(res.entries || []);
    }
    setLoading(false);
  }, [tab, schoolSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 5000);
  };

  const [purgeId, setPurgeId] = useState<number | 'all' | null>(null);
  const [purgeText, setPurgeText] = useState('');

  const purge = async (id: number | 'all') => {
    setPurgeId(null);
    setPurgeText('');
    setBusyId(id === 'all' ? -1 : id);
    const res = await purgeJournalEntry(id, schoolSlug);
    setBusyId(null);
    showToast(res.ok, res.message || (res.ok ? 'Supprimé définitivement.' : 'La suppression a échoué.'));
    if (res.ok) load();
  };

  const restore = async (id: number) => {
    setConfirmId(null);
    setBusyId(id);
    const res = await restoreJournalEntry(id, schoolSlug);
    setBusyId(null);
    showToast(res.ok, res.message || (res.ok ? 'Restauré.' : 'La restauration a échoué.'));
    if (res.ok) {
      syncSchoolDataWithServer(schoolSlug, true);
      load();
    }
  };

  const q = query.trim().toLowerCase();
  const matches = (e: JournalEntry) =>
    !q ||
    [e.studentName, e.studentNumber, e.actor, rowOf(e).full_name, rowOf(e).invoice_number, rowOf(e).fee_type]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));

  const trashGroups = useMemo(() => (tab === 'trash' ? groupTrash(entries) : []), [tab, entries]);
  const visibleGroups = trashGroups.filter((g) => matches(g.main) || g.related.some(matches));
  // Les réenregistrements sans aucun changement visible (seule l'heure technique a bougé) sont masqués.
  const visibleChanges =
    tab === 'changes' ? entries.filter((e) => matches(e) && (e.op !== 'UPDATE' || describeChange(e).changes.length > 0)) : [];

  const RestoreButton = ({ entry, label }: { entry: JournalEntry; label: string }) => {
    if (entry.restoredAt) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Restauré le {formatWhen(entry.restoredAt)}
          {entry.restoredBy ? ` par ${entry.restoredBy}` : ''}
        </span>
      );
    }
    if (confirmId === entry.id) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Confirmer ?</span>
          <button
            onClick={() => restore(entry.id)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
          >
            Oui, {label.toLowerCase()}
          </button>
          <button
            onClick={() => setConfirmId(null)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Annuler
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => setConfirmId(entry.id)}
        disabled={busyId !== null}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-200 bg-white text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 cursor-pointer"
      >
        {busyId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-5 pb-12">
      {/* En-tête (même style que les autres pages) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight font-heading">Corbeille &amp; Journal</h1>
            <p className="text-xs text-slate-500">
              Tout ce qui est supprimé ou modifié est gardé ici : qui, quand et quoi. Un clic le remet en place.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-bold shrink-0">
          <ShieldCheck className="w-3.5 h-3.5" /> Fondateur &amp; DGA
        </span>
      </div>

      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-flex">
          {(
            [
              ['trash', 'Corbeille', Trash2],
              ['changes', 'Modifications', History],
            ] as Array<[Tab, string, React.ElementType]>
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setConfirmId(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="relative flex-1 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom, numéro, reçu…"
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
            />
          </label>
          <button
            onClick={load}
            aria-label="Actualiser"
            className="inline-flex items-center justify-center px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold ${
            toast.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {toast.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}

      {!available && !loading && !error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          La corbeille n&apos;est pas encore activée dans la base : lancez le script 007 dans Supabase &gt; SQL Editor.
        </div>
      )}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">{error}</div>}

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-center gap-2 py-14 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Chargement…
        </div>
      ) : tab === 'trash' ? (
        visibleGroups.length === 0 ? (
          available && !error && <EmptyState text={q ? 'Aucun résultat pour cette recherche.' : 'La corbeille est vide.'} />
        ) : (
          <>
          {!q && visibleGroups.some((g) => !g.main.restoredAt) && (
            <div className="rounded-2xl border border-rose-200 bg-white p-3">
              {purgeId === 'all' ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="text-xs font-semibold text-rose-700">
                    Tout effacer pour toujours ? Tapez <b>SUPPRIMER</b> pour confirmer :
                  </span>
                  <input
                    value={purgeText}
                    onChange={(e) => setPurgeText(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-rose-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    onClick={() => purge('all')}
                    disabled={purgeText.trim().toUpperCase() !== 'SUPPRIMER'}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                  >
                    Vider la corbeille
                  </button>
                  <button
                    onClick={() => {
                      setPurgeId(null);
                      setPurgeText('');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    « Supprimer définitivement » efface l’élément de la corbeille : il ne pourra plus jamais être restauré.
                  </span>
                  <button
                    onClick={() => setPurgeId('all')}
                    disabled={busyId !== null}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                  >
                    {busyId === -1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Vider toute la corbeille
                  </button>
                </div>
              )}
            </div>
          )}
          <ul className="space-y-2.5">
            {visibleGroups.map((g) => {
              const d = describeTrash(g);
              const Icon = d.icon;
              return (
                <li key={g.main.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-bold leading-snug text-slate-900">{d.title}</p>
                      {d.detail && <p className="mt-0.5 break-words text-xs text-slate-500">{d.detail}</p>}
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatWhen(g.main.at)} · par {g.main.actor}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
                    {!g.main.restoredAt &&
                      (purgeId === g.main.id ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-2">
                          <span className="text-xs font-semibold text-rose-700">Supprimer pour toujours ? Plus aucune restauration possible.</span>
                          <button
                            onClick={() => purge(g.main.id)}
                            className="px-3.5 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
                          >
                            Oui, supprimer
                          </button>
                          <button
                            onClick={() => setPurgeId(null)}
                            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setConfirmId(null);
                            setPurgeId(g.main.id);
                          }}
                          disabled={busyId !== null}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-white text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                        >
                          {busyId === g.main.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Supprimer définitivement
                        </button>
                      ))}
                    {purgeId !== g.main.id && <RestoreButton entry={g.main} label="Restaurer" />}
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )
      ) : visibleChanges.length === 0 ? (
        available && !error && <EmptyState text={q ? 'Aucun résultat pour cette recherche.' : 'Aucune modification enregistrée pour le moment.'} />
      ) : (
        <ul className="space-y-2.5">
          {visibleChanges.map((e) => {
            const d = describeChange(e);
            return (
              <li key={e.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                <p className="break-words text-sm font-bold leading-snug text-slate-900">{d.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {formatWhen(e.at)} · par {e.actor}
                </p>
                {d.changes.length > 0 && (
                  <dl className="mt-2.5 space-y-1.5 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
                    {d.changes.map((c, i) => (
                      <div key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                        {c.field && <dt className="shrink-0 font-bold text-slate-600 sm:w-48">{c.field}</dt>}
                        <dd className="min-w-0 break-words text-slate-800">
                          {c.before ? (
                            <>
                              au lieu de <span className="font-semibold text-slate-500">« {c.before} »</span>, remplacé par{' '}
                              <span className="font-semibold text-slate-900">« {c.after} »</span>
                            </>
                          ) : (
                            <span className="font-semibold">{c.after}</span>
                          )}
                          {c.note && (
                            <span
                              className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                                c.tone === 'down' ? 'bg-red-50 text-red-700' : c.tone === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {c.note}
                            </span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {e.op === 'UPDATE' && (
                  <div className="mt-2.5 flex justify-end">
                    <RestoreButton entry={e} label="Annuler la modification" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Ce journal est tenu par la base elle-même : aucune suppression ni modification ne peut lui échapper, quel que soit
        l&apos;appareil utilisé.
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white shadow-xs py-14 text-center text-slate-500">
      <CheckCircle2 className="mb-2 h-7 w-7 text-emerald-500" />
      <p className="text-xs font-semibold">{text}</p>
    </div>
  );
}
