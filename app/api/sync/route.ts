import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    // Si l'environnement restreint l'écriture fs (lecture seule), on conserve la mémoire tampon
  }
}

// Initialiser au premier chargement
ensureDataFile();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug') || 'college-excellence';

    ensureDataFile();
    const schoolData = memoryStore[slug] || null;

    return NextResponse.json({
      success: true,
      slug,
      data: schoolData,
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
