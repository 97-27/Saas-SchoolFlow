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
    const slug = searchParams.get('slug') || 'college-excellence';

    ensureDataFile();
    let schoolData = memoryStore[slug] ? { ...memoryStore[slug] } : {};

    // 1. Tenter d'hydrater directement depuis Supabase Cloud
    try {
      const [sbSchool, sbStudents, sbInvoices, sbStaff] = await Promise.all([
        getSchoolFromSupabase(slug),
        getStudentsFromSupabase(slug),
        getInvoicesFromSupabase(slug),
        getStaffUsersFromSupabase(slug),
      ]);

      if (sbSchool) {
        schoolData.schoolSettings = sbSchool;
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
    } catch (sbErr) {
      console.warn('Erreur chargement Supabase dans /api/sync GET:', sbErr);
    }

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
    let existingDeleted: string[] = currentSchool.deletedStudentIds || [];

    // Traitement des suppressions dans Supabase Cloud et mémoisation
    if (deletedStudentIds && Array.isArray(deletedStudentIds)) {
      existingDeleted = Array.from(new Set([...existingDeleted, ...deletedStudentIds]));
      for (const delId of deletedStudentIds) {
        deleteStudentFromSupabase(delId, slug).catch(() => {});
        deleteInvoiceFromSupabase(delId, slug).catch(() => {});
      }
    }

    const delSet = new Set(existingDeleted);
    const cleanStudents = Array.isArray(students)
      ? students.filter((s: any) => !delSet.has(s.id) && !delSet.has(s.studentNumber) && !delSet.has(s.matricule))
      : undefined;
    const cleanInvoices = Array.isArray(invoices)
      ? invoices.filter((inv: any) => !delSet.has(inv.id) && !delSet.has(inv.studentId) && !delSet.has(inv.invoiceNumber))
      : undefined;

    memoryStore[slug] = {
      ...currentSchool,
      slug,
      updatedAt: new Date().toISOString(),
      deletedStudentIds: existingDeleted,
      ...(cleanStudents !== undefined ? { students: cleanStudents } : {}),
      ...(cleanInvoices !== undefined ? { invoices: cleanInvoices } : {}),
      ...(schoolSettings !== undefined ? { schoolSettings } : {}),
      ...(staffUsers !== undefined ? { staffUsers } : {}),
    };

    // Sauvegarde asynchrone dans Supabase Cloud pour la persistance multi-appareils
    try {
      if (schoolSettings) {
        saveSchoolToSupabase(schoolSettings).catch(() => {});
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
