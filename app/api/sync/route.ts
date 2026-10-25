import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  getSchoolFromSupabase,
  getStudentsFromSupabase,
  getInvoicesFromSupabase,
  getStaffUsersFromSupabase,
  saveSchoolToSupabase,
  deleteStudentFromSupabase,
  deleteInvoiceFromSupabase,
  saveServicesDataToSupabase,
  getServicesDataFromSupabase,
  batchUpsertStudents,
  batchUpsertInvoices,
  saveDiverseNotesToSupabase,
  getDiverseNotesFromSupabase,
  saveParentMessagesToSupabase,
  getParentMessagesFromSupabase,
} from '@/lib/supabase/services';
import { mockStudents, mockInvoices } from '@/lib/data/mock-data';
import { isLegacyDemoStudent, isLegacyDemoInvoice } from '@/lib/data/legacy-ids';
import {
  requireSession,
  isAdmin,
  hasRole,
  jsonError,
  STUDENT_WRITE_ROLES,
  DELETE_ROLES,
  SERVICES_WRITE_ROLES,
} from '@/lib/server/auth';
import { SessionPayload } from '@/lib/server/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Stockage serveur persistant pour synchroniser les données entre appareils
const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'schoolflow-store.json');

// Mémoire tampon serveur
let memoryStore: Record<string, any> = {};

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      if (content) {
        memoryStore = JSON.parse(content);
      }
    } else {
      fs.writeFileSync(STORE_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
    }
  } catch (e) {
    // Si l'environnement restreint l'écriture fs (lecture seule sur Vercel serverless), on conserve la mémoire tampon
  }
}

// Initialiser au premier chargement
ensureDataFile();

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// Collections "services" rattachées à un élève (tableau d'objets portant studentId, ou objet
// indexé par l'identifiant de l'élève). canteenWeeklyMenu et boardingCapacity n'en font pas partie.
const STUDENT_SCOPED_SERVICE_KEYS = [
  'boardingSubscriptions',
  'boardingPayments',
  'canteenSubscriptions',
  'canteenPayments',
  'transportSubscriptions',
  'transportPayments',
  'installments',
];

const digitsOnly = (v: unknown) => String(v || '').replace(/\D/g, '');
const upperCode = (v: unknown) => String(v || '').trim().toUpperCase();

function filterByStudent(value: any, childIds: Set<string>): any {
  if (Array.isArray(value)) return value.filter((item) => item && childIds.has(item.studentId));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => childIds.has(key)));
  }
  return value;
}

/** Un message appartient au parent si son numéro correspond à l'un des numéros de ses enfants. */
function parentOwnsMessage(message: any, parentPhones: string[]): boolean {
  const msgDigits = digitsOnly(message?.parentPhone);
  if (msgDigits.length < 8) return false;
  return parentPhones.some((p) => p.slice(-8) === msgDigits.slice(-8));
}

/**
 * Restreint les données renvoyées au strict nécessaire du rôle connecté :
 * - Notes diverses : chacun ne reçoit que SES notes (elles sont personnelles par conception).
 * - Personnel : seuls Fondateur/Directeur reçoivent les codes d'accès ; les autres reçoivent la
 *   liste avec les codes masqués (sauf le leur).
 * - Messages parents : réservés à la Direction ; un parent ne reçoit que les siens.
 * - Parents : uniquement leurs enfants (fiches, encaissements, prestations).
 */
function filterForSession(data: Record<string, any>, session: SessionPayload): Record<string, any> {
  const out: Record<string, any> = { ...data };
  const ownCode = upperCode(session.code);

  if (Array.isArray(out.students)) {
    out.students = out.students.filter((s: any) => !isLegacyDemoStudent(s));
  }

  if (Array.isArray(out.diverseNotes)) {
    out.diverseNotes = out.diverseNotes.filter((n: any) => upperCode(n?.authorCode) === ownCode);
  }

  if (session.roleId === 'parent') {
    const childIds = new Set(session.childIds || []);
    const phones = session.parentPhones || [];
    out.students = (out.students || []).filter((s: any) => childIds.has(s.id));
    out.invoices = (out.invoices || []).filter((inv: any) => childIds.has(inv.studentId));
    out.staffUsers = [];
    out.parentMessages = (out.parentMessages || []).filter((m: any) => parentOwnsMessage(m, phones));
    for (const key of STUDENT_SCOPED_SERVICE_KEYS) {
      if (out[key] !== undefined) out[key] = filterByStudent(out[key], childIds);
    }
    delete out.deletedStudentIds;
    return out;
  }

  if (!isAdmin(session)) {
    out.staffUsers = (out.staffUsers || []).map((u: any) =>
      upperCode(u?.authCode) === ownCode ? u : { ...u, authCode: `MASQUE-${String(u?.id || '').slice(0, 8)}` }
    );
    out.parentMessages = [];
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await requireSession(request, searchParams.get('slug'));
    if ('error' in auth) return auth.error;
    const { session, slug } = auth;

    ensureDataFile();
    let schoolData = memoryStore[slug] ? { ...memoryStore[slug] } : null;

    // Supabase est la source de vérité : on la relit à chaque requête, quel que soit
    // l'état du cache local. Ce cache est propre à chaque instance serverless (Vercel en
    // crée plusieurs en parallèle) — s'y fier seul pouvait figer une instance sur des
    // données partielles ou obsolètes indéfiniment. Le cache local ne sert plus que de
    // filet de secours si l'appel Supabase échoue ou dépasse le délai ci-dessous.
    {
      try {
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve([null, null, null, null, null, null, null]), 9000)
        );
        const [sbSchool, sbStudents, sbInvoices, sbStaff, sbServices, sbDiverseNotes, sbParentMessages] = (await Promise.race([
          Promise.all([
            getSchoolFromSupabase(slug),
            getStudentsFromSupabase(slug),
            getInvoicesFromSupabase(slug),
            getStaffUsersFromSupabase(slug),
            getServicesDataFromSupabase(slug),
            getDiverseNotesFromSupabase(slug),
            getParentMessagesFromSupabase(slug),
          ]),
          timeoutPromise,
        ])) as any;

        if (!schoolData) schoolData = {};
        if (sbServices) {
          if (sbServices.boardingSubscriptions) schoolData.boardingSubscriptions = sbServices.boardingSubscriptions;
          if (sbServices.boardingPayments) schoolData.boardingPayments = sbServices.boardingPayments;
          if (sbServices.canteenSubscriptions) schoolData.canteenSubscriptions = sbServices.canteenSubscriptions;
          if (sbServices.canteenPayments) schoolData.canteenPayments = sbServices.canteenPayments;
          if (sbServices.transportSubscriptions) schoolData.transportSubscriptions = sbServices.transportSubscriptions;
          if (sbServices.transportPayments) schoolData.transportPayments = sbServices.transportPayments;
          if (sbServices.installments) schoolData.installments = sbServices.installments;
          if (sbServices.canteenWeeklyMenu) schoolData.canteenWeeklyMenu = sbServices.canteenWeeklyMenu;
          if (sbServices.boardingCapacity !== undefined) schoolData.boardingCapacity = sbServices.boardingCapacity;
        }
        if (sbSchool) {
          schoolData.schoolSettings = {
            ...sbSchool,
            logoUrl: sbSchool.logoUrl || schoolData.schoolSettings?.logoUrl || '',
            countryEmblemUrl: sbSchool.countryEmblemUrl || schoolData.schoolSettings?.countryEmblemUrl || '',
            stampUrl: sbSchool.stampUrl || schoolData.schoolSettings?.stampUrl || '',
          };
        }
        if (sbStudents !== null && Array.isArray(sbStudents) && sbStudents.length > 0) {
          schoolData.students = sbStudents;
        }
        if (sbInvoices !== null && Array.isArray(sbInvoices) && sbInvoices.length > 0) {
          schoolData.invoices = sbInvoices;
        }
        if (sbDiverseNotes !== null && Array.isArray(sbDiverseNotes)) {
          schoolData.diverseNotes = sbDiverseNotes;
        }
        if (sbParentMessages !== null && Array.isArray(sbParentMessages)) {
          schoolData.parentMessages = sbParentMessages;
        }
        if (sbStaff !== null && Array.isArray(sbStaff)) {
          // Remplacement strict par la liste Supabase (source de vérité), et non fusion : un
          // membre supprimé (deleteStaffUserFromSupabase) était bien retiré de Supabase mais
          // la précédente fusion par union ne faisait qu'AJOUTER/METTRE À JOUR à partir du
          // cache mémoire serveur (memoryStore, propre à chaque instance serverless) sans
          // jamais retirer les entrées absentes de la réponse Supabase fraîche. Un appareil
          // dont l'instance avait encore l'ancien membre en cache continuait donc à le voir
          // indéfiniment, même après sa suppression confirmée sur un autre appareil.
          const oldByCode = new Map<string, any>();
          (schoolData.staffUsers || []).forEach((u: any) => {
            if (u && u.authCode) oldByCode.set(u.authCode.toUpperCase(), u);
          });
          schoolData.staffUsers = sbStaff.map((u: any) => {
            const prev = u.authCode ? oldByCode.get(u.authCode.toUpperCase()) : undefined;
            return prev?.lastLogin ? { ...u, lastLogin: prev.lastLogin } : u;
          });
        }
        memoryStore[slug] = schoolData;
      } catch (sbErr) {
        console.warn('Erreur chargement Supabase dans /api/sync GET:', sbErr);
      }
    }

    if (!schoolData) schoolData = {};

    // Filtrer les élèves et factures contre les identifiants supprimés
    const rawDeletedIds: string[] = schoolData.deletedStudentIds || [];
    const delSet = new Set(rawDeletedIds);
    if (delSet.size > 0) {
      if (Array.isArray(schoolData.students)) {
        schoolData.students = schoolData.students.filter(
          (s: any) => !delSet.has(s.id) && !delSet.has(s.studentNumber) && !delSet.has(s.matricule)
        );
      }
      if (Array.isArray(schoolData.invoices)) {
        schoolData.invoices = schoolData.invoices.filter(
          (inv: any) => !delSet.has(inv.id) && !delSet.has(inv.studentId) && !delSet.has(inv.invoiceNumber)
        );
      }
    }

    // Initialisation EPC MANOI : si AUCUN élève n'existe en base de données, n'ajouter les élèves de démo que comme secours
    if (slug === 'epc-manoi' && (!schoolData.students || schoolData.students.length === 0)) {
      const studentMap = new Map<string, any>();
      (schoolData.students || []).forEach((s: any) => {
        const key = s.studentNumber || s.id;
        studentMap.set(key, s);
      });
      for (const offStu of mockStudents) {
        const key = offStu.studentNumber || offStu.id;
        if (!studentMap.has(key) && !delSet.has(offStu.id) && !delSet.has(offStu.studentNumber)) {
          studentMap.set(key, offStu);
        }
      }
      schoolData.students = Array.from(studentMap.values()).sort((a: any, b: any) => {
        const numA = parseInt((a.studentNumber || a.id).replace(/\D/g, ''), 10) || 0;
        const numB = parseInt((b.studentNumber || b.id).replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      const invoiceMap = new Map<string, any>();
      (schoolData.invoices || []).forEach((inv: any) => {
        const key = inv.invoiceNumber || inv.id;
        invoiceMap.set(key, inv);
      });
      for (const offInv of mockInvoices) {
        const key = offInv.invoiceNumber || offInv.id;
        if (!invoiceMap.has(key) && !delSet.has(offInv.id) && !delSet.has(offInv.studentId) && !delSet.has(offInv.invoiceNumber)) {
          invoiceMap.set(key, offInv);
        }
      }
      schoolData.invoices = Array.from(invoiceMap.values()).sort((a: any, b: any) => {
        const numA = parseInt((a.invoiceNumber || a.id).replace(/\D/g, ''), 10) || 0;
        const numB = parseInt((b.invoiceNumber || b.id).replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
    }

    const visibleData = filterForSession(schoolData, session);

    return NextResponse.json(
      {
        success: true,
        slug,
        data: Object.keys(visibleData).length > 0 ? visibleData : null,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Notes diverses : chaque auteur ne peut remplacer que SES propres notes ; celles des autres
 * auteurs sont relues en base et conservées telles quelles. Renvoie null si la base n'a pas pu
 * être relue (on n'écrit alors rien, pour ne jamais effacer les notes des autres).
 */
async function mergeOwnDiverseNotes(slug: string, session: SessionPayload, incoming: any[]): Promise<any[] | null> {
  const current = await getDiverseNotesFromSupabase(slug);
  if (current === null) return null;
  const ownCode = upperCode(session.code);
  const others = current.filter((n: any) => upperCode(n?.authorCode) !== ownCode);
  const own = incoming
    .filter((n) => n && typeof n === 'object')
    .map((n) => ({ ...n, authorCode: n.authorCode || session.code }))
    .filter((n) => upperCode(n.authorCode) === ownCode);
  return [...others, ...own];
}

/**
 * Messages d'un parent : il peut uniquement AJOUTER de nouveaux messages à son nom (jamais
 * modifier ou supprimer ceux des autres familles, ni les réponses de la Direction).
 */
async function mergeParentNewMessages(slug: string, session: SessionPayload, incoming: any[]): Promise<any[] | null> {
  const current = await getParentMessagesFromSupabase(slug);
  if (current === null) return null;
  const phones = session.parentPhones || [];
  const knownIds = new Set(current.map((m: any) => m?.id));
  const clip = (v: unknown, max: number) => String(v || '').slice(0, max);

  const additions = incoming
    .filter((m) => m && typeof m === 'object' && m.id && !knownIds.has(m.id) && parentOwnsMessage(m, phones))
    .slice(0, 20)
    .map((m) => ({
      id: clip(m.id, 64),
      parentName: clip(m.parentName, 120),
      studentName: clip(m.studentName, 120),
      studentGrade: clip(m.studentGrade, 40),
      parentPhone: clip(m.parentPhone, 40),
      subject: clip(m.subject, 200),
      message: clip(m.message, 5000),
      category: ['absence', 'finance', 'document', 'info'].includes(m.category) ? m.category : 'info',
      timestamp: clip(m.timestamp, 40) || new Date().toISOString(),
      status: 'new',
      unread: true,
    }));

  if (additions.length === 0) return current;
  return [...additions, ...current];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const auth = await requireSession(request, body?.slug || null);
    if ('error' in auth) return auth.error;
    const { session, slug } = auth;

    const admin = isAdmin(session);
    const canWriteStudents = hasRole(session, STUDENT_WRITE_ROLES);
    const canDelete = hasRole(session, DELETE_ROLES);
    const canWriteServices = hasRole(session, SERVICES_WRITE_ROLES);

    // Chaque collection n'est prise en compte que si le rôle connecté a le droit de l'écrire ;
    // les autres sont ignorées (jamais transmises à la base).
    // Les anciens élèves/factures de démonstration encore présents dans certains navigateurs ne
    // doivent jamais revenir en base (ils y avaient créé 15 doublons) : voir lib/data/legacy-ids.ts.
    const students =
      canWriteStudents && Array.isArray(body.students)
        ? body.students.filter((s: any) => !isLegacyDemoStudent(s))
        : undefined;
    const invoices =
      canWriteStudents && Array.isArray(body.invoices)
        ? body.invoices.filter((inv: any) => !isLegacyDemoInvoice(inv))
        : undefined;
    const deletedStudentIds = canDelete ? body.deletedStudentIds : undefined;
    const restoreStudentIds = canDelete ? body.restoreStudentIds : undefined;
    const schoolSettings = admin && body.schoolSettings ? { ...body.schoolSettings, slug } : undefined;
    const staffUsers = admin ? body.staffUsers : undefined;
    const transportSubscriptions = canWriteServices ? body.transportSubscriptions : undefined;
    const transportPayments = canWriteServices ? body.transportPayments : undefined;
    const canteenSubscriptions = canWriteServices ? body.canteenSubscriptions : undefined;
    const canteenPayments = canWriteServices ? body.canteenPayments : undefined;
    const canteenWeeklyMenu = canWriteServices ? body.canteenWeeklyMenu : undefined;
    const boardingSubscriptions = canWriteServices ? body.boardingSubscriptions : undefined;
    const boardingPayments = canWriteServices ? body.boardingPayments : undefined;
    const boardingCapacity = canWriteServices ? body.boardingCapacity : undefined;
    const installments = canWriteServices ? body.installments : undefined;

    let diverseNotes: any[] | undefined;
    if (Array.isArray(body.diverseNotes)) {
      diverseNotes = (await mergeOwnDiverseNotes(slug, session, body.diverseNotes)) ?? undefined;
    }

    let parentMessages: any[] | undefined;
    if (Array.isArray(body.parentMessages)) {
      if (admin) parentMessages = body.parentMessages;
      else if (session.roleId === 'parent') {
        parentMessages = (await mergeParentNewMessages(slug, session, body.parentMessages)) ?? undefined;
      }
    }

    const acceptedSomething = [
      students, invoices, deletedStudentIds, restoreStudentIds, schoolSettings, staffUsers,
      transportSubscriptions, transportPayments, canteenSubscriptions, canteenPayments, canteenWeeklyMenu,
      boardingSubscriptions, boardingPayments, boardingCapacity, installments, diverseNotes, parentMessages,
    ].some((v) => v !== undefined);
    if (!acceptedSomething) {
      return jsonError('Aucune donnée autorisée pour votre profil dans cette requête.', 403);
    }

    ensureDataFile();
    const currentSchool = memoryStore[slug] || {};

    const autoBannedIds = ['MAT-2026', 'ID-2026002', '25bcb95a-62d2-47b1-bfa6-6820cb30dd6e'];
    let existingDeleted: string[] = Array.from(
      new Set([...(currentSchool.deletedStudentIds || []), ...autoBannedIds])
    );

    // Soupape de secours explicite : un identifiant tombé une fois dans deletedStudentIds y
    // reste pour toujours (la liste ne fait qu'accumuler), y compris un simple numéro d'élève
    // séquentiel ("ID-016") qui n'est pourtant PAS un identifiant unique permanent — il est
    // réattribué au prochain élève inscrit une fois le précédent supprimé. Un ancien tombstone
    // de test ("stu-016"/"ID-016") est ainsi entré en collision avec un élève réel et légitime
    // inscrit plus tard sous ce même numéro, le faisant disparaître silencieusement de la
    // liste ET provoquant sa suppression réelle dans Supabase à chaque nouvelle synchronisation
    // (le bouton "Actualiser Cloud" renvoie la liste de suppressions locale au serveur).
    if (Array.isArray(restoreStudentIds) && restoreStudentIds.length > 0) {
      const restoreSet = new Set(restoreStudentIds.filter(Boolean));
      existingDeleted = existingDeleted.filter((id) => !restoreSet.has(id));
    }

    // Traitement des suppressions dans Supabase Cloud et mémoisation
    if (deletedStudentIds && Array.isArray(deletedStudentIds)) {
      const safeNewDeleted = deletedStudentIds.filter(Boolean);
      existingDeleted = Array.from(new Set([...existingDeleted, ...safeNewDeleted]));
      const deletePromises: Promise<any>[] = [];
      for (const delId of safeNewDeleted) {
        deletePromises.push(deleteStudentFromSupabase(delId, slug));
        deletePromises.push(deleteInvoiceFromSupabase(delId, slug));
      }
      const delResults = await Promise.allSettled(deletePromises);
      delResults.forEach((r) => {
        if (r.status === 'rejected') {
          console.warn('Erreur suppression Supabase dans /api/sync POST:', r.reason);
        }
      });
    }

    // Si des élèves sont envoyés pour enregistrement, s'assurer qu'aucun d'eux n'est bloqué par existingDeleted
    if (Array.isArray(students)) {
      const activeIds = new Set<string>();
      students.forEach((s: any) => {
        if (s.id) activeIds.add(s.id);
        if (s.studentNumber) activeIds.add(s.studentNumber);
        if (s.matricule) activeIds.add(s.matricule);
      });
      existingDeleted = existingDeleted.filter((id) => !activeIds.has(id));
    }

    const delSet = new Set(existingDeleted);
    let cleanStudents = Array.isArray(students)
      ? students.filter((s: any) => !delSet.has(s.id) && !delSet.has(s.studentNumber) && !delSet.has(s.matricule))
      : undefined;
    let cleanInvoices = Array.isArray(invoices)
      ? invoices.filter((inv: any) => !delSet.has(inv.id) && !delSet.has(inv.studentId) && !delSet.has(inv.invoiceNumber))
      : undefined;

    if (slug === 'epc-manoi') {
      if (cleanStudents !== undefined) {
        const studentMap = new Map<string, any>();
        cleanStudents.forEach((s: any) => studentMap.set(s.studentNumber || s.id, s));
        for (const offStu of mockStudents) {
          const key = offStu.studentNumber || offStu.id;
          if (!studentMap.has(key) && !delSet.has(offStu.id) && !delSet.has(offStu.studentNumber)) {
            studentMap.set(key, offStu);
          }
        }
        cleanStudents = Array.from(studentMap.values()).sort((a: any, b: any) => {
          const numA = parseInt((a.studentNumber || a.id).replace(/\D/g, ''), 10) || 0;
          const numB = parseInt((b.studentNumber || b.id).replace(/\D/g, ''), 10) || 0;
          return numA - numB;
        });
      }

      if (cleanInvoices !== undefined) {
        const invoiceMap = new Map<string, any>();
        cleanInvoices.forEach((inv: any) => invoiceMap.set(inv.invoiceNumber || inv.id, inv));
        for (const offInv of mockInvoices) {
          const key = offInv.invoiceNumber || offInv.id;
          if (!invoiceMap.has(key) && !delSet.has(offInv.id) && !delSet.has(offInv.studentId) && !delSet.has(offInv.invoiceNumber)) {
            invoiceMap.set(key, offInv);
          }
        }
        cleanInvoices = Array.from(invoiceMap.values()).sort((a: any, b: any) => {
          const numA = parseInt((a.invoiceNumber || a.id).replace(/\D/g, ''), 10) || 0;
          const numB = parseInt((b.invoiceNumber || b.id).replace(/\D/g, ''), 10) || 0;
          return numA - numB;
        });
      }
    }

    let mergedSettings = schoolSettings;
    if (schoolSettings) {
      const existingSettings = currentSchool.schoolSettings || {};
      mergedSettings = {
        ...existingSettings,
        ...schoolSettings,
        // Le slug est imposé par la session : un Directeur ne peut jamais écrire sur la fiche
        // d'un autre établissement.
        slug,
        logoUrl: schoolSettings.logoUrl || existingSettings.logoUrl || '',
        countryEmblemUrl: schoolSettings.countryEmblemUrl || existingSettings.countryEmblemUrl || '',
        stampUrl: schoolSettings.stampUrl || existingSettings.stampUrl || '',
      };
    }

    const updatedEntry = {
      ...currentSchool,
      slug,
      updatedAt: new Date().toISOString(),
      deletedStudentIds: existingDeleted,
      ...(cleanStudents !== undefined ? { students: cleanStudents } : {}),
      ...(cleanInvoices !== undefined ? { invoices: cleanInvoices } : {}),
      ...(mergedSettings !== undefined ? { schoolSettings: mergedSettings } : {}),
      ...(staffUsers !== undefined ? { staffUsers } : {}),
      ...(transportSubscriptions !== undefined ? { transportSubscriptions } : {}),
      ...(transportPayments !== undefined ? { transportPayments } : {}),
      ...(canteenSubscriptions !== undefined ? { canteenSubscriptions } : {}),
      ...(canteenPayments !== undefined ? { canteenPayments } : {}),
      ...(canteenWeeklyMenu !== undefined ? { canteenWeeklyMenu } : {}),
      ...(boardingSubscriptions !== undefined ? { boardingSubscriptions } : {}),
      ...(boardingPayments !== undefined ? { boardingPayments } : {}),
      ...(boardingCapacity !== undefined ? { boardingCapacity } : {}),
      ...(diverseNotes !== undefined ? { diverseNotes } : {}),
      ...(parentMessages !== undefined ? { parentMessages } : {}),
    };
    memoryStore[slug] = updatedEntry;

    // Sauvegarde Supabase Cloud — attendue avant de répondre pour garantir la persistance
    // réelle sur toutes les instances serverless (Vercel peut geler la fonction juste après
    // l'envoi de la réponse, ce qui tuait silencieusement les écritures en tâche de fond).
    try {
      const savePromises: Promise<any>[] = [];

      if (mergedSettings) {
        savePromises.push(saveSchoolToSupabase(mergedSettings));
      }
      // Élèves PUIS factures : la facture d'un nouvel élève ne peut être rattachée qu'une fois
      // l'élève enregistré.
      const hasStudents = Boolean(cleanStudents && Array.isArray(cleanStudents) && cleanStudents.length > 0);
      const hasInvoices = Boolean(cleanInvoices && Array.isArray(cleanInvoices) && cleanInvoices.length > 0);
      if (hasStudents || hasInvoices) {
        savePromises.push(
          (hasStudents ? batchUpsertStudents(cleanStudents!, slug) : Promise.resolve(true)).then(() =>
            hasInvoices ? batchUpsertInvoices(cleanInvoices!, slug) : true
          )
        );
      }
      // N'inclure une clé QUE si cette requête l'a réellement fournie — currentSchool vient d'un
      // cache mémoire par instance serverless (memoryStore), qui peut être vide sur une instance
      // qui vient de démarrer (cold start). S'en servir comme valeur de repli pour une clé
      // absente produisait une fausse valeur "confirmée" ([] ou {}) qui écrasait ensuite, côté
      // saveServicesDataToSupabase, la vraie donnée stockée dans Supabase. En omettant la clé,
      // c'est saveServicesDataToSupabase (qui lit l'état réel Supabase avant de fusionner) qui
      // décide correctement de préserver l'existant.
      const servicesPayload: Record<string, any> = {};
      if (boardingSubscriptions !== undefined) servicesPayload.boardingSubscriptions = boardingSubscriptions;
      if (boardingPayments !== undefined) servicesPayload.boardingPayments = boardingPayments;
      if (canteenSubscriptions !== undefined) servicesPayload.canteenSubscriptions = canteenSubscriptions;
      if (canteenPayments !== undefined) servicesPayload.canteenPayments = canteenPayments;
      if (transportSubscriptions !== undefined) servicesPayload.transportSubscriptions = transportSubscriptions;
      if (transportPayments !== undefined) servicesPayload.transportPayments = transportPayments;
      if (installments !== undefined) servicesPayload.installments = installments;
      if (canteenWeeklyMenu !== undefined) servicesPayload.canteenWeeklyMenu = canteenWeeklyMenu;
      if (boardingCapacity !== undefined) servicesPayload.boardingCapacity = boardingCapacity;
      if (Object.keys(servicesPayload).length > 0) {
        savePromises.push(saveServicesDataToSupabase(slug, servicesPayload));
      }

      if (diverseNotes !== undefined) {
        savePromises.push(saveDiverseNotesToSupabase(slug, diverseNotes));
      }
      if (parentMessages !== undefined) {
        savePromises.push(saveParentMessagesToSupabase(slug, parentMessages));
      }

      const results = await Promise.allSettled(savePromises);
      results.forEach((r) => {
        if (r.status === 'rejected') {
          console.warn('Erreur sauvegarde Supabase dans /api/sync POST:', r.reason);
        }
      });
    } catch (sbSaveErr) {
      console.warn('Erreur sauvegarde Supabase dans /api/sync POST:', sbSaveErr);
    }

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
    } catch (fsErr) {
      // Fallback mémoire si fs est en lecture seule
    }

    return NextResponse.json(
      {
        success: true,
        slug,
        message: 'Données synchronisées avec succès',
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
