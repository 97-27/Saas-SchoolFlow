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
    const forceSupabase = searchParams.get('forceSupabase') === 'true';

    ensureDataFile();
    let schoolData = memoryStore[slug] ? { ...memoryStore[slug] } : null;

    // Si la mémoire est vide ou sans élèves ou si un rechargement forcé depuis Supabase est demandé
    if (!schoolData || !schoolData.students || schoolData.students.length === 0 || forceSupabase) {
      try {
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve([null, null, null, null]), 1800)
        );
        const [sbSchool, sbStudents, sbInvoices, sbStaff] = (await Promise.race([
          Promise.all([
            getSchoolFromSupabase(slug),
            getStudentsFromSupabase(slug),
            getInvoicesFromSupabase(slug),
            getStaffUsersFromSupabase(slug),
          ]),
          timeoutPromise,
        ])) as any;

        if (!schoolData) schoolData = {};
        if (sbSchool) {
          schoolData.schoolSettings = {
            ...sbSchool,
            logoUrl: sbSchool.logoUrl || schoolData.schoolSettings?.logoUrl || '',
            countryEmblemUrl: sbSchool.countryEmblemUrl || schoolData.schoolSettings?.countryEmblemUrl || '',
            stampUrl: sbSchool.stampUrl || schoolData.schoolSettings?.stampUrl || '',
          };
        }
        if (sbStudents !== null && Array.isArray(sbStudents)) {
          schoolData.students = sbStudents;
        }
        if (sbInvoices !== null && Array.isArray(sbInvoices)) {
          schoolData.invoices = sbInvoices;
        }
        if (sbStaff !== null && Array.isArray(sbStaff) && sbStaff.length > 0) {
          const staffMap = new Map<string, any>();
          (schoolData.staffUsers || []).forEach((u: any) => {
            if (u && u.authCode) staffMap.set(u.authCode.toUpperCase(), u);
          });
          sbStaff.forEach((u: any) => {
            if (u && u.authCode) staffMap.set(u.authCode.toUpperCase(), { ...staffMap.get(u.authCode.toUpperCase()), ...u });
          });
          schoolData.staffUsers = Array.from(staffMap.values());
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

    // Initialisation EPC MANOI : n'ajouter les élèves officiels initiaux que s'ils n'ont JAMAIS été supprimés
    if (slug === 'epc-manoi') {
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
    } = body;
    const slug = (rawSlug === 'college-excellence' ? 'epc-manoi' : rawSlug) || 'epc-manoi';

    ensureDataFile();
    const currentSchool = memoryStore[slug] || {};

    const autoBannedIds = ['MAT-2026', 'ID-2026002', '25bcb95a-62d2-47b1-bfa6-6820cb30dd6e'];
    let existingDeleted: string[] = Array.from(
      new Set([...(currentSchool.deletedStudentIds || []), ...autoBannedIds])
    );

    // Traitement des suppressions dans Supabase Cloud et mémoisation
    if (deletedStudentIds && Array.isArray(deletedStudentIds)) {
      const safeNewDeleted = deletedStudentIds.filter(Boolean);
      existingDeleted = Array.from(new Set([...existingDeleted, ...safeNewDeleted]));
      for (const delId of safeNewDeleted) {
        deleteStudentFromSupabase(delId, slug).catch(() => {});
        deleteInvoiceFromSupabase(delId, slug).catch(() => {});
      }
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
    };
    memoryStore[slug] = updatedEntry;

    // Sauvegarde Supabase Cloud
    try {
      if (mergedSettings) {
        saveSchoolToSupabase(mergedSettings).catch(() => {});
      }
      if (cleanStudents && Array.isArray(cleanStudents) && cleanStudents.length > 0) {
        const sorted = [...cleanStudents].sort((a: any, b: any) => {
          const da = new Date(a.updatedAt || a.enrollmentDate || 0).getTime();
          const db = new Date(b.updatedAt || b.enrollmentDate || 0).getTime();
          return db - da;
        });
        const recentStudents = sorted.slice(0, 3);
        for (const st of recentStudents) {
          saveStudentToSupabase(st, slug).catch(() => {});
        }
      }
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
