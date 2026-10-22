'use client';

import { School, Student, Invoice } from '@/lib/data/types';

/**
 * ══════════════════════════════════════════════════════════════════
 * ACCÈS AUX DONNÉES DEPUIS LE NAVIGATEUR
 * ══════════════════════════════════════════════════════════════════
 * Mêmes signatures que lib/supabase/services.ts, mais chaque appel passe par /api/data, qui
 * vérifie la session signée et le rôle avant d'exécuter l'opération côté serveur. Le navigateur
 * n'accède plus jamais directement aux tables Supabase.
 */

export interface SchoolSubscriptionInfo {
  isExpired: boolean;
  endDate: string; // ISO
  plan: string;
  daysRemaining: number;
}

async function callData<T>(op: string, args: any[], fallback: T): Promise<T> {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, args }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    return json && json.success ? (json.result as T) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function getSchoolFromSupabase(slug: string): Promise<School | null> {
  return callData('getSchool', [slug], null);
}

/** Liste publique réduite des établissements (aucune coordonnée privée). */
export function getAllSchoolsFromSupabase(): Promise<School[]> {
  return callData('getAllSchools', [], [] as School[]);
}

export function saveSchoolToSupabase(school: School): Promise<boolean> {
  return callData('saveSchool', [school], false);
}

export function getSchoolSubscriptionInfo(slug: string): Promise<SchoolSubscriptionInfo | null> {
  return callData('getSubscriptionInfo', [slug], null);
}

export function getStudentsFromSupabase(schoolSlug: string): Promise<Student[]> {
  return callData('getStudents', [schoolSlug], [] as Student[]);
}

export function saveStudentToSupabase(student: Student, schoolSlug: string): Promise<boolean> {
  return callData('saveStudent', [student, schoolSlug], false);
}

export function deleteStudentFromSupabase(identifier: string, schoolSlug: string): Promise<boolean> {
  return callData('deleteStudent', [identifier, schoolSlug], false);
}

export function getInvoicesFromSupabase(schoolSlug: string): Promise<Invoice[]> {
  return callData('getInvoices', [schoolSlug], [] as Invoice[]);
}

export function saveInvoiceToSupabase(invoice: Invoice, schoolSlug: string): Promise<boolean> {
  return callData('saveInvoice', [invoice, schoolSlug], false);
}

export function deleteInvoiceFromSupabase(identifier: string, schoolSlug: string): Promise<boolean> {
  return callData('deleteInvoice', [identifier, schoolSlug], false);
}

export function saveStaffUserToSupabase(
  staff: {
    fullName: string;
    email: string;
    phone: string;
    roleId: string;
    role: string;
    authCode: string;
    status: string;
    avatarUrl?: string;
    matricule?: string;
  },
  schoolSlug: string
): Promise<boolean> {
  return callData('saveStaffUser', [staff, schoolSlug], false);
}

export function deleteStaffUserFromSupabase(authCode: string, schoolSlug: string): Promise<boolean> {
  return callData('deleteStaffUser', [authCode, schoolSlug], false);
}

export function getServicesDataFromSupabase(schoolSlug: string): Promise<any | null> {
  return callData('getServicesData', [schoolSlug], null);
}

export function saveServicesDataToSupabase(schoolSlug: string, servicesData: any): Promise<boolean> {
  return callData('saveServicesData', [schoolSlug, servicesData], false);
}

/**
 * Téléverse une photo de profil via /api/upload (le navigateur n'a plus le droit d'écrire
 * directement dans le stockage Supabase) et renvoie l'URL publique permanente HTTPS.
 */
export async function uploadAvatarToSupabase(fileOrBlob: Blob | File, fileName: string): Promise<string | null> {
  try {
    const form = new FormData();
    form.append('file', fileOrBlob, fileName);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.url || null;
  } catch (e) {
    return null;
  }
}
