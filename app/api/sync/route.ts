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
    const slug = searchParams.get('slug') || 'epc-manoi';
    const forceSupabase = searchParams.get('forceSupabase') === 'true';

    ensureDataFile();
    let schoolData = memoryStore[slug] ? { ...memoryStore[slug] } : null;

    const isPilot = slug === 'epc-manoi' || slug === 'college-excellence';
    if (isPilot && (!schoolData?.students || schoolData.students.length === 0)) {
      const partnerSlug = slug === 'epc-manoi' ? 'college-excellence' : 'epc-manoi';
      if (memoryStore[partnerSlug]?.students?.length > 0) {
        schoolData = { ...memoryStore[partnerSlug] };
      }
    }

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
        if (sbStaff !== null && Array.isArray(sbStaff)) {
          schoolData.staffUsers = sbStaff;
        }
        memoryStore[slug] = schoolData;
        if (isPilot) {
          memoryStore['epc-manoi'] = schoolData;
          memoryStore['college-excellence'] = schoolData;
        }
      } catch (sbErr) {
        console.warn('Erreur chargement Supabase dans /api/sync GET:', sbErr);
      }
    }

    if (!schoolData) schoolData = {};

    // Filtrer les élèves et factures contre les identifiants supprimés
    const deletedIds: string[] = schoolData.deletedStudentIds || [];
    const delSet = new Set(deletedIds);
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

    return NextResponse.json({
      success: true,
      slug,
      data: Object.keys(schoolData).length > 0 ? schoolData : null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, students, invoices, schoolSettings, staffUsers, deletedStudentIds } = body;

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug manquant' }, { status: 400 });
    }

    ensureDataFile();
    const currentSchool = memoryStore[slug] || {};

    const autoBannedIds = ['MAT-2026', 'ID-2026002', '25bcb95a-62d2-47b1-bfa6-6820cb30dd6e'];
    let existingDeleted: string[] = Array.from(
      new Set([...(currentSchool.deletedStudentIds || []), ...autoBannedIds])
    );

    // Traitement des suppressions dans Supabase Cloud et mémoisation
    if (deletedStudentIds && Array.isArray(deletedStudentIds)) {
      existingDeleted = Array.from(new Set([...existingDeleted, ...deletedStudentIds]));
      for (const delId of deletedStudentIds) {
        deleteStudentFromSupabase(delId, slug).catch(() => {});
        deleteInvoiceFromSupabase(delId, slug).catch(() => {});
      }
    }
    for (const banId of autoBannedIds) {
      deleteStudentFromSupabase(banId, slug).catch(() => {});
      deleteInvoiceFromSupabase(banId, slug).catch(() => {});
    }

    const delSet = new Set(existingDeleted);
    const cleanStudents = Array.isArray(students)
      ? students.filter((s: any) => !delSet.has(s.id) && !delSet.has(s.studentNumber) && !delSet.has(s.matricule))
      : undefined;
    const cleanInvoices = Array.isArray(invoices)
      ? invoices.filter((inv: any) => !delSet.has(inv.id) && !delSet.has(inv.studentId) && !delSet.has(inv.invoiceNumber))
      : undefined;

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
    };
    memoryStore[slug] = updatedEntry;

    const isPilot = slug === 'epc-manoi' || slug === 'college-excellence';
    if (isPilot) {
      memoryStore['epc-manoi'] = { ...updatedEntry, slug: 'epc-manoi' };
      memoryStore['college-excellence'] = { ...updatedEntry, slug: 'college-excellence' };
    }

    // Sauvegarde asynchrone dans Supabase Cloud pour la persistance multi-appareils
    try {
      if (mergedSettings) {
        saveSchoolToSupabase(mergedSettings).catch(() => {});
      }
      if (cleanStudents && Array.isArray(cleanStudents)) {
        for (const st of cleanStudents) {
          saveStudentToSupabase(st, slug).catch(() => {});
        }
      }
      if (cleanInvoices && Array.isArray(cleanInvoices)) {
        for (const inv of cleanInvoices) {
          saveInvoiceToSupabase(inv, slug).catch(() => {});
        }
      }
      if (staffUsers && Array.isArray(staffUsers)) {
        for (const staff of staffUsers) {
          saveStaffUserToSupabase(staff, slug).catch(() => {});
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

    return NextResponse.json({
      success: true,
      slug,
      message: 'Données synchronisées avec succès',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
