'use client';

import { School, Student, Invoice } from '@/lib/data/types';
import { reportClientError } from '@/lib/client/error-report';

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
    if (!res.ok) {
      // Refus du serveur : signalé dans les journaux Vercel (« [SchoolFlow][écran] ») pour qu'une
      // panne d'enregistrement ne passe plus jamais inaperçue.
      if (!op.startsWith('get')) {
        let detail = '';
        try {
          detail = (await res.clone().json())?.error || '';
        } catch (e) {}
        reportClientError(new Error(`Enregistrement refusé (${op}) : HTTP ${res.status} ${detail}`), 'Données');
      }
      return fallback;
    }
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

/** identityOnly : nom, classe, contact… seulement — jamais les montants ni les versements. */
export function saveStudentToSupabase(
  student: Student,
  schoolSlug: string,
  identityOnly: boolean = false,
  expectedVersements: number[] | null = null
): Promise<boolean | 'conflict'> {
  return callData<boolean | 'conflict'>('saveStudent', [student, schoolSlug, identityOnly, expectedVersements], false);
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

export interface ServiceChange {
  service: 'internat' | 'cantine' | 'transport';
  studentKey: string;
  action: 'subscribe' | 'unsubscribe' | 'setMonth';
  monthlyRate?: number;
  discount?: number;
  details?: Record<string, unknown>;
  month?: string;
  paid?: boolean;
}

export interface ServiceChangeResult {
  ok: boolean;
  legacy: boolean;
  applied: number;
  skipped: string[];
  refused?: boolean;
}

/** Enregistre des changements d'abonnements / de mois payés, ligne par ligne. */
export function applyServiceChanges(changes: ServiceChange[], schoolSlug: string): Promise<ServiceChangeResult> {
  return callData('applyServiceChanges', [changes, schoolSlug], { ok: false, legacy: false, applied: 0, skipped: [] });
}

/** Compteur de version des données de l'école (null si indisponible). */
export function getDataVersion(schoolSlug: string): Promise<number | null> {
  return callData('getDataVersion', [schoolSlug], null);
}

export interface JournalEntry {
  id: number;
  at: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  table: 'students' | 'invoices' | 'service_subscriptions' | 'service_month_payments';
  rowId: string | null;
  studentId: string | null;
  studentName: string;
  studentNumber: string;
  oldRow: Record<string, any> | null;
  newRow: Record<string, any> | null;
  actor: string;
  restoredAt: string | null;
  restoredBy: string | null;
}

/** Corbeille ('trash') ou historique des modifications ('changes'). Directeur / Fondateur. */
export function getJournal(kind: 'trash' | 'changes', schoolSlug: string): Promise<{ available: boolean; entries: JournalEntry[] } | null> {
  return callData('getJournal', [kind, 400, schoolSlug], null);
}

/** Restaure une suppression ou annule une modification. */
export function restoreJournalEntry(entryId: number, schoolSlug: string): Promise<{ ok: boolean; restored?: number; message: string }> {
  return callData('restoreJournal', [entryId, schoolSlug], { ok: false, message: 'Connexion impossible avec le serveur.' });
}

/** Supprime définitivement un élément de la corbeille (ou toute la corbeille avec 'all'). */
export function purgeJournalEntry(entryId: number | 'all', schoolSlug: string): Promise<{ ok: boolean; removed: number; message: string }> {
  return callData('purgeJournal', [entryId, schoolSlug], { ok: false, removed: 0, message: 'Connexion impossible avec le serveur.' });
}

/** Supprime les reçus d'un service (internat / cantine / transport) d'un élève. -1 = échec. */
export function deleteServiceInvoicesFromSupabase(
  studentId: string,
  kind: 'internat' | 'cantine' | 'transport',
  schoolSlug: string
): Promise<number> {
  return callData('deleteServiceInvoices', [studentId, kind, schoolSlug], -1);
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
  schoolSlug: string,
  /** true seulement quand le code a été volontairement modifié (fiche du membre). */
  allowCodeChange: boolean = false
): Promise<boolean> {
  return callData('saveStaffUser', [staff, schoolSlug, allowCodeChange], false);
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
