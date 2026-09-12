import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  getSchoolFromSupabase,
  getStudentsFromSupabase,
  getInvoicesFromSupabase,
  getStaffUsersFromSupabase,
  saveSchoolToSupabase,
  saveStudentToSupabase,
  saveInvoiceToSupabase,
  saveStaffUserToSupabase,
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

const PROTECTED_STUDENT_NUMBERS = new Set<string>();

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSlug = searchParams.get('slug') || 'epc-manoi';
    const slug = rawSlug === 'college-excellence' ? 'epc-manoi' : rawSlug;

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

    return NextResponse.json(
      {
        success: true,
        slug,
        data: Object.keys(schoolData).length > 0 ? schoolData : null,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      slug: rawSlug,
      students,
      invoices,
      schoolSettings,
      staffUsers,
      deletedStudentIds,
      transportSubscriptions,
      transportPayments,
      canteenSubscriptions,
      canteenPayments,
      canteenWeeklyMenu,
      boardingSubscriptions,
      boardingPayments,
      boardingCapacity,
      diverseNotes,
      parentMessages,
      restoreStudentIds,
    } = body;
    const slug = (rawSlug === 'college-excellence' ? 'epc-manoi' : rawSlug) || 'epc-manoi';

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
        // Le slug doit toujours être présent : sans lui, saveSchoolToSupabase()
        // ignore silencieusement l'écriture (no-op) alors que l'API répond "succès".
        slug: schoolSettings.slug || existingSettings.slug || slug,
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
      if (cleanStudents && Array.isArray(cleanStudents) && cleanStudents.length > 0) {
        savePromises.push(batchUpsertStudents(cleanStudents, slug));
      }
      if (cleanInvoices && Array.isArray(cleanInvoices) && cleanInvoices.length > 0) {
        savePromises.push(batchUpsertInvoices(cleanInvoices, slug));
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
      if (body.installments !== undefined) servicesPayload.installments = body.installments;
      if (Object.keys(servicesPayload).length > 0) {
        savePromises.push(saveServicesDataToSupabase(slug, servicesPayload));
      }

      if (diverseNotes !== undefined && Array.isArray(diverseNotes)) {
        savePromises.push(saveDiverseNotesToSupabase(slug, diverseNotes));
      }
      if (parentMessages !== undefined && Array.isArray(parentMessages)) {
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
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
