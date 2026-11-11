import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  getSchoolFromSupabase,
  getStudentsFromSupabase,
  getInvoicesFromSupabase,
  getStaffUsersFromSupabase,
  getServicesDataFromSupabase,
  getDiverseNotesFromSupabase,
  getParentMessagesFromSupabase,
} from '@/lib/supabase/services';
import { kvFamilyForKey } from '@/lib/data/cloud-kv-keys';

/**
 * ARCHIVES DES ANNÉES SCOLAIRES (table school_archives, migration 012)
 *
 * Un instantané = copie COMPLÈTE et FIGÉE de toutes les données de l'école à un instant :
 * élèves, paiements, personnel, salaires, dépenses, appel des élèves (et parents avertis),
 * pointage du personnel, notes, bulletins, réductions, santé, services, messages des parents…
 * Il est écrit une fois et n'est plus jamais modifié : même dans 10 ans, l'école peut rouvrir
 * « 2026-2027 » et revoir exactement ce qu'il y avait.
 *
 * Les photos (images base64) sont retirées pour garder des archives légères ; les codes d'accès
 * du personnel ne sont JAMAIS copiés.
 */

export type ArchiveSummary = {
  students: number;
  invoicesTotal: number;
  paidTotal: number;
  balanceTotal: number;
  staff: number;
  salariesCount: number;
  salariesTotal: number;
  expensesCount: number;
  expensesTotal: number;
  absences: number;
  lates: number;
  parentsNotified: number;
  pointageDays: number;
  parentMessages: number;
  validatedBulletins: number;
};

export type ArchiveSnapshot = {
  version: 1;
  slug: string;
  takenAt: string;
  school: any;
  students: any[];
  invoices: any[];
  staff: any[];
  services: any;
  diverseNotes: any[];
  parentMessages: any[];
  /** Données des familles synchronisées, par famille (base de clé) : [{ key, value }]. */
  kv: Record<string, { key: string; value: any }[]>;
  pointage: { config: any; records: { date: string; record: any }[] };
};

/** Retire les images (base64 « data:… ») pour que l'archive reste légère. */
function stripHeavy<T>(value: T): T {
  if (typeof value === 'string') {
    return (value.startsWith('data:') && value.length > 300 ? '' : value) as any;
  }
  if (Array.isArray(value)) return value.map((v) => stripHeavy(v)) as any;
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as any)) out[k] = stripHeavy(v);
    return out as any;
  }
  return value;
}

/** Toutes les lignes school_kv de l'école (par pages de 1 000 : aucune limite de volume). */
async function listAllKv(schoolId: string): Promise<{ key: string; value: string }[] | null> {
  const out: { key: string; value: string }[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data, error } = await supabase
      .from('school_kv')
      .select('key, value')
      .eq('school_id', schoolId)
      .order('key', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return null;
    out.push(...((data || []) as any[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function parseJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const POINTAGE_PREFIX = 'sf_private_pointage_';

export async function buildSchoolSnapshot(slug: string, schoolId: string): Promise<ArchiveSnapshot | null> {
  const [school, students, invoices, staff, services, diverseNotes, parentMessages, kvRows] = await Promise.all([
    getSchoolFromSupabase(slug, { stamp: false }),
    getStudentsFromSupabase(slug),
    getInvoicesFromSupabase(slug),
    getStaffUsersFromSupabase(slug),
    getServicesDataFromSupabase(slug),
    getDiverseNotesFromSupabase(slug),
    getParentMessagesFromSupabase(slug),
    listAllKv(schoolId),
  ]);
  // Lecture incomplète : on n'écrit PAS une archive à moitié vide en la croyant complète.
  if (!school || kvRows === null) return null;

  const kv: ArchiveSnapshot['kv'] = {};
  const pointage: ArchiveSnapshot['pointage'] = { config: null, records: [] };
  for (const row of kvRows) {
    if (row.key.startsWith(POINTAGE_PREFIX)) {
      if (row.key === `${POINTAGE_PREFIX}config`) {
        pointage.config = parseJson(row.value);
      } else {
        const m = row.key.slice(POINTAGE_PREFIX.length).match(/^(\d{4}-\d{2}-\d{2})_/);
        if (m) pointage.records.push({ date: m[1], record: parseJson(row.value) });
      }
      continue;
    }
    // Clés privées (codes, compteurs d'essais…) : jamais archivées.
    if (row.key.startsWith('sf_private_')) continue;
    const fam = kvFamilyForKey(row.key, slug);
    if (!fam) continue;
    (kv[fam.base] ||= []).push({ key: row.key, value: parseJson(row.value) });
  }

  return {
    version: 1,
    slug,
    takenAt: new Date().toISOString(),
    school: stripHeavy({ ...school, stampUrl: '', logoUrl: '', countryEmblemUrl: '' }),
    students: stripHeavy(students || []),
    invoices: stripHeavy(invoices || []),
    // Jamais les codes d'accès ni les photos du personnel.
    staff: stripHeavy((staff || []).map(({ authCode, avatarUrl, ...rest }: any) => rest)),
    services: stripHeavy(services || {}),
    diverseNotes: stripHeavy(diverseNotes || []),
    parentMessages: stripHeavy(parentMessages || []),
    kv: stripHeavy(kv),
    pointage,
  };
}

// ─── Lecture par rubrique ───────────────────────────────────────────────────────────────

/** Valeur(s) d'une famille dans l'archive, fusionnées en une seule liste / un seul objet. */
function familyList(snap: ArchiveSnapshot, base: string): any[] {
  const out: any[] = [];
  for (const { value } of snap.kv[base] || []) if (Array.isArray(value)) out.push(...value);
  // Même élément présent dans deux copies (clé pilote nue + clé suffixée) : une seule fois.
  const seen = new Set<string>();
  return out.filter((x) => {
    const id = x && typeof x === 'object' && x.id ? String(x.id) : '';
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function familyObject(snap: ArchiveSnapshot, base: string): Record<string, any> {
  const out: Record<string, any> = {};
  for (const { value } of snap.kv[base] || []) {
    if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(out, value);
  }
  return out;
}

const SLOT_LABELS: Record<string, string> = {
  'slot-1': '08h00 - 10h00',
  'slot-2': '10h00 - 12h00',
  'slot-3': '14h00 - 16h00',
  'slot-4': '16h00 - 17h30',
};

export function attendanceEntries(snap: ArchiveSnapshot) {
  const map = familyObject(snap, 'schoolflow_attendance_records_v1');
  const byId = new Map((snap.students || []).map((s: any) => [String(s.id), s]));
  const out: any[] = [];
  for (const [key, rec] of Object.entries(map)) {
    if (!rec || (rec.status !== 'absent' && rec.status !== 'late')) continue;
    const m = key.match(/^(\d{4}-\d{2}-\d{2})_(slot-\d)_(.+)$/);
    if (!m) continue;
    const stu: any = byId.get(m[3]);
    out.push({
      date: m[1],
      slot: SLOT_LABELS[m[2]] || m[2],
      studentId: m[3],
      studentName: stu?.fullName || 'Élève retiré',
      grade: stu?.grade || '—',
      status: rec.status,
      reason: rec.reason || '',
      notifiedAt: rec.notifiedAt || '',
      notifiedBy: rec.notifiedBy || '',
    });
  }
  return out.sort((a, b) => (a.date === b.date ? a.studentName.localeCompare(b.studentName) : b.date.localeCompare(a.date)));
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function computeSummary(snap: ArchiveSnapshot): ArchiveSummary {
  const salaries = familyList(snap, 'schoolflow_staff_salaries_v1');
  const expenses = familyList(snap, 'schoolflow_school_expenses_v1');
  const att = attendanceEntries(snap);
  const bulletins = familyObject(snap, 'schoolflow_validated_class_bulletins_v1');
  const invoicesTotal = snap.invoices.reduce((s, i) => s + num(i.netAmount ?? i.amount), 0);
  const paidTotal = snap.invoices.reduce((s, i) => s + num(i.paidAmount), 0);
  return {
    students: snap.students.length,
    invoicesTotal,
    paidTotal,
    balanceTotal: Math.max(0, invoicesTotal - paidTotal),
    staff: snap.staff.length,
    salariesCount: salaries.length,
    salariesTotal: salaries.reduce((s, x) => s + num(x.netSalary), 0),
    expensesCount: expenses.length,
    expensesTotal: expenses.reduce((s, x) => s + num(x.amount), 0),
    absences: att.filter((a) => a.status === 'absent').length,
    lates: att.filter((a) => a.status === 'late').length,
    parentsNotified: att.filter((a) => a.notifiedAt).length,
    pointageDays: new Set(snap.pointage.records.map((r) => r.date)).size,
    parentMessages: snap.parentMessages.length,
    validatedBulletins: Object.keys(bulletins).length,
  };
}

export const ARCHIVE_SECTIONS = ['resume', 'eleves', 'salaires', 'depenses', 'presences', 'pointage', 'messages'] as const;
export type ArchiveSection = (typeof ARCHIVE_SECTIONS)[number];

export function extractSection(snap: ArchiveSnapshot, section: ArchiveSection): any {
  switch (section) {
    case 'resume':
      return {
        school: {
          name: snap.school?.name,
          shortName: snap.school?.shortName,
          academicYear: snap.school?.academicYear,
          currentTerm: snap.school?.currentTerm,
        },
        summary: computeSummary(snap),
      };
    case 'eleves': {
      const byStudent = new Map<string, { total: number; paid: number }>();
      for (const inv of snap.invoices) {
        const cur = byStudent.get(inv.studentId) || { total: 0, paid: 0 };
        cur.total += num(inv.netAmount ?? inv.amount);
        cur.paid += num(inv.paidAmount);
        byStudent.set(inv.studentId, cur);
      }
      return snap.students
        .map((s: any) => {
          const f = byStudent.get(s.id);
          const total = f ? f.total : num(s.netAmount ?? s.tuitionAmount);
          const paid = f ? f.paid : num(s.paidAmount);
          return {
            id: s.id,
            fullName: s.fullName,
            matricule: s.matricule || s.studentNumber || '',
            grade: s.grade,
            guardianName: s.guardianName,
            guardianPhone: s.guardianPhone,
            total,
            paid,
            balance: Math.max(0, total - paid),
          };
        })
        .sort((a: any, b: any) => (a.grade === b.grade ? String(a.fullName).localeCompare(String(b.fullName)) : String(a.grade).localeCompare(String(b.grade))));
    }
    case 'salaires':
      return familyList(snap, 'schoolflow_staff_salaries_v1').map((s) => ({
        id: s.id,
        receiptNumber: s.receiptNumber,
        staffName: `${s.civility ? `${s.civility} ` : ''}${s.staffName || ''}`.trim(),
        role: s.role,
        payPeriod: s.payPeriod,
        paymentDate: s.paymentDate,
        baseSalary: num(s.baseSalary),
        bonuses: num(s.bonuses),
        deductions: num(s.deductions),
        netSalary: num(s.netSalary),
        paymentMethod: s.paymentMethod,
      }));
    case 'depenses':
      return familyList(snap, 'schoolflow_school_expenses_v1').map((e) => ({
        id: e.id,
        reference: e.reference,
        title: e.title,
        category: e.category,
        amount: num(e.amount),
        expenseDate: e.expenseDate,
        beneficiary: e.beneficiary,
        paymentMethod: e.paymentMethod,
      }));
    case 'presences':
      return attendanceEntries(snap);
    case 'pointage':
      return snap.pointage.records
        .map(({ date, record }) => ({
          date,
          fullName: record?.fullName || '—',
          roleId: record?.roleId || '',
          arrival: record?.arrival?.time || '',
          departure: record?.departure?.time || '',
          absenceReason: record?.absence?.reason || '',
        }))
        .sort((a, b) => (a.date === b.date ? String(a.fullName).localeCompare(String(b.fullName)) : b.date.localeCompare(a.date)));
    case 'messages':
      return (snap.parentMessages || [])
        .map((m: any) => ({
          id: m.id,
          date: m.timestamp || m.createdAt || '',
          parentName: m.parentName || '',
          studentName: `${m.studentName || ''}${m.studentGrade ? ` (${m.studentGrade})` : ''}`,
          category: m.category || 'info',
          subject: m.subject || '',
          body: m.message || '',
          reply: m.directorReply || '',
          replyAt: m.directorReplyAt || '',
        }))
        .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
  }
}
