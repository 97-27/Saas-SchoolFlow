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
      if (sbStudents && Array.isArray(sbStudents) && sbStudents.length > 0) {
        schoolData.students = sbStudents;
      }
      if (sbInvoices && Array.isArray(sbInvoices) && sbInvoices.length > 0) {
        schoolData.invoices = sbInvoices;
      }
      if (sbStaff && Array.isArray(sbStaff) && sbStaff.length > 0) {
        schoolData.staffUsers = sbStaff;
      }
    } catch (sbErr) {
      console.warn('Erreur chargement Supabase dans /api/sync GET:', sbErr);
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
    const { slug, students, invoices, schoolSettings, staffUsers } = body;

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug manquant' }, { status: 400 });
    }

    ensureDataFile();

    const currentSchool = memoryStore[slug] || {};
    memoryStore[slug] = {
      ...currentSchool,
      slug,
      updatedAt: new Date().toISOString(),
      ...(students ? { students } : {}),
      ...(invoices ? { invoices } : {}),
      ...(schoolSettings ? { schoolSettings } : {}),
      ...(staffUsers ? { staffUsers } : {}),
    };

    // Sauvegarde asynchrone dans Supabase Cloud pour la persistance multi-appareils
    try {
      if (schoolSettings) {
        saveSchoolToSupabase(schoolSettings).catch(() => {});
      }
      if (students && Array.isArray(students)) {
        for (const st of students) {
          saveStudentToSupabase(st, slug).catch(() => {});
        }
      }
      if (invoices && Array.isArray(invoices)) {
        for (const inv of invoices) {
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
