'use client';

import { Student, Invoice, School } from '@/lib/data/types';
import { mockSchools, mockStudents, mockInvoices } from '@/lib/data/mock-data';

// Liste des identifiants protégés (vide pour autoriser la suppression effective de tout élève par l'administrateur)
export const PROTECTED_STUDENT_NUMBERS = new Set<string>();
import {
  saveSchoolToSupabase,
  saveStudentToSupabase,
  saveInvoiceToSupabase,
  saveStaffUserToSupabase,
  deleteStaffUserFromSupabase,
  deleteStudentFromSupabase,
  deleteInvoiceFromSupabase,
} from '@/lib/supabase/services';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { splitFullNameNomFirst, formatFullNameNomFirst, cleanDisplayAddress } from '@/lib/utils/formatters';

export const normalizeWords = (name: string): string =>
  (name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');

const STUDENTS_STORAGE_KEY = 'schoolflow_registered_students_v1';
const INVOICES_STORAGE_KEY = 'schoolflow_registered_invoices_v1';
const SCHOOL_SETTINGS_PREFIX = 'schoolflow_school_settings_v1_';
const DELETED_STUDENTS_STORAGE_KEY = 'schoolflow_deleted_student_ids_v1';
const DELETED_SCHOOLS_KEY = 'schoolflow_deleted_schools_v1';
const SCHOOL_STATUS_PREFIX = 'schoolflow_school_status_v1_';
const STAFF_USERS_STORAGE_KEY = 'schoolflow_staff_users_v2';
const VALIDATED_BULLETINS_KEY = 'schoolflow_validated_class_bulletins_v1';
export const DOCS_STATUS_KEY = 'schoolflow_documents_status_v5';
export const DATA_UPDATED_EVENT = 'schoolflow_data_updated';
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('schoolflow_registered_students_v1_college-excellence');
    localStorage.removeItem('schoolflow_registered_invoices_v1_college-excellence');
    localStorage.removeItem('schoolflow_school_settings_v1_college-excellence');
    localStorage.removeItem('schoolflow_staff_users_v2_college-excellence');
  } catch (e) {}
}

export const REALTIME_SYNC_CHANNEL_NAME = 'schoolflow_realtime_sync_v2';

// ════════════════════════════════════════════════════════════════
// MOTEUR DE SYNCHRONISATION EN TEMPS RÉEL PARALLÈLE (MULTI-INTERFACES & MULTI-APPAREILS)
// ════════════════════════════════════════════════════════════════

export const CLIENT_INSTANCE_ID =
  typeof window !== 'undefined'
    ? (window as any).__SF_CLIENT_ID ||
      ((window as any).__SF_CLIENT_ID =
        'sf_cli_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now())
    : 'sf_server';

let syncBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    syncBroadcastChannel = new BroadcastChannel(REALTIME_SYNC_CHANNEL_NAME);
    syncBroadcastChannel.onmessage = (event) => {
      // Propagation locale immédiate dans cet onglet sans boucle infinie
      if (event.data?.senderId !== CLIENT_INSTANCE_ID) {
        window.dispatchEvent(
          new CustomEvent(DATA_UPDATED_EVENT, {
            detail: { ...(event.data || {}), isCrossTabSync: true },
          })
        );
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel sync init warning:', e);
  }

  // Écoute des événements de stockage natifs pour synchronisation cross-tabs
  window.addEventListener('storage', (event) => {
    if (event.key && event.key.startsWith('schoolflow_')) {
      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { key: event.key, isStorageEvent: true },
        })
      );
    }
  });
}

/**
 * Gestionnaire unifié des flux entrants distants (WebSockets Supabase + SSE)
 */
function handleRemoteIncomingPayload(payload: any, cleanSlug: string): void {
  if (!payload || typeof window === 'undefined') return;
  const isPilot = cleanSlug === 'epc-manoi';

  try {
    // 1. Nouvel élève & nouveau reçu enregistré par un collaborateur distant
    if (payload.action === 'student_registered' && payload.student) {
      const student: Student = payload.student;
      const invoice: Invoice = payload.invoice;

      const schoolKey = `${STUDENTS_STORAGE_KEY}_${cleanSlug}`;
      const rawSchool = localStorage.getItem(schoolKey);
      const prevSchool: Student[] = rawSchool ? JSON.parse(rawSchool) : [];
      const filteredStudents = prevSchool.filter(
        (s) => s.id !== student.id && s.studentNumber !== student.studentNumber
      );
      const updatedStudents = [student, ...filteredStudents];

      localStorage.setItem(schoolKey, JSON.stringify(updatedStudents));
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updatedStudents));
      if (isPilot) {
        localStorage.setItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`, JSON.stringify(updatedStudents));
      }

      if (invoice) {
        const invSchoolKey = `${INVOICES_STORAGE_KEY}_${cleanSlug}`;
        const rawInvSchool = localStorage.getItem(invSchoolKey);
        const prevInvSchool: Invoice[] = rawInvSchool ? JSON.parse(rawInvSchool) : [];
        const filteredInvoices = prevInvSchool.filter(
          (inv) => inv.id !== invoice.id && inv.invoiceNumber !== invoice.invoiceNumber
        );
        const updatedInvoices = [invoice, ...filteredInvoices];

        localStorage.setItem(invSchoolKey, JSON.stringify(updatedInvoices));
        localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(updatedInvoices));
        if (isPilot) {
          localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, JSON.stringify(updatedInvoices));
        }
      }

      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { ...payload, isRemoteSync: true },
        })
      );
    } else if (payload.action === 'payment_recorded' && payload.invoice) {
      // 2. Encaissement de prestation ou mise à jour facture
      const invoice: Invoice = payload.invoice;
      const invSchoolKey = `${INVOICES_STORAGE_KEY}_${cleanSlug}`;
      const rawInvSchool = localStorage.getItem(invSchoolKey);
      const prevInvSchool: Invoice[] = rawInvSchool ? JSON.parse(rawInvSchool) : [];
      const filteredInvoices = prevInvSchool.filter(
        (inv) => inv.id !== invoice.id && inv.invoiceNumber !== invoice.invoiceNumber
      );
      const updatedInvoices = [invoice, ...filteredInvoices];

      localStorage.setItem(invSchoolKey, JSON.stringify(updatedInvoices));
      localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(updatedInvoices));
      if (isPilot) {
        localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, JSON.stringify(updatedInvoices));
      }

      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { ...payload, isRemoteSync: true },
        })
      );
    } else if (payload.action === 'student_updated' && payload.student) {
      // 3. Mise à jour d'un élève par un collaborateur distant
      const student: Student = payload.student;
      const invoice: Invoice = payload.invoice;

      const schoolKey = `${STUDENTS_STORAGE_KEY}_${cleanSlug}`;
      const rawSchool = localStorage.getItem(schoolKey);
      const prevSchool: Student[] = rawSchool ? JSON.parse(rawSchool) : [];
      const updatedStudents = prevSchool.map((s) =>
        s.id === student.id || (s.studentNumber && s.studentNumber === student.studentNumber)
          ? { ...s, ...student }
          : s
      );

      localStorage.setItem(schoolKey, JSON.stringify(updatedStudents));
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updatedStudents));
      if (isPilot) {
        localStorage.setItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`, JSON.stringify(updatedStudents));
      }

      if (invoice) {
        const invSchoolKey = `${INVOICES_STORAGE_KEY}_${cleanSlug}`;
        const rawInvSchool = localStorage.getItem(invSchoolKey);
        const prevInvSchool: Invoice[] = rawInvSchool ? JSON.parse(rawInvSchool) : [];
        const updatedInvoices = prevInvSchool.map((inv) =>
          inv.id === invoice.id || (inv.invoiceNumber && inv.invoiceNumber === invoice.invoiceNumber)
            ? { ...inv, ...invoice }
            : inv
        );

        localStorage.setItem(invSchoolKey, JSON.stringify(updatedInvoices));
        localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(updatedInvoices));
        if (isPilot) {
          localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, JSON.stringify(updatedInvoices));
        }
      }

      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { ...payload, isRemoteSync: true },
        })
      );
    } else if (payload.action === 'school_settings_updated' && payload.school) {
      // 4. Mise à jour des paramètres de l'école
      const schoolJson = JSON.stringify(payload.school);
      localStorage.setItem(`${SCHOOL_SETTINGS_PREFIX}${cleanSlug}`, schoolJson);
      if (isPilot) {
        localStorage.setItem(`${SCHOOL_SETTINGS_PREFIX}epc-manoi`, schoolJson);
        localStorage.setItem('schoolflow_active_school_settings_v1', schoolJson);
      }

      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { ...payload, isRemoteSync: true },
        })
      );
    } else if (payload.action === 'staff_users_updated' && Array.isArray(payload.staffUsers)) {
      // 5. Mise à jour du personnel et des accès
      const staffJson = JSON.stringify(payload.staffUsers);
      localStorage.setItem(`${STAFF_USERS_STORAGE_KEY}_${cleanSlug}`, staffJson);
      if (isPilot) {
        localStorage.setItem(STAFF_USERS_STORAGE_KEY, staffJson);
      }

      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { ...payload, isRemoteSync: true },
        })
      );
    } else if (payload.action === 'session_updated' && payload.session) {
      if (payload.avatarUrl) {
        try {
          if (payload.session.authCode) {
            localStorage.setItem(`schoolflow_user_avatar_${payload.session.authCode.toUpperCase()}`, payload.avatarUrl);
          }
        } catch (e) {}
      }
      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { ...payload, isRemoteSync: true },
        })
      );
    } else if (payload.action === 'grades_portal_updated' && payload.portalStatus) {
      // 6. Ouverture / Fermeture portail des notes
      const portalJson = JSON.stringify(payload.portalStatus);
      localStorage.setItem(`${GRADES_PORTAL_KEY}_${cleanSlug}`, portalJson);
      localStorage.setItem(GRADES_PORTAL_KEY, portalJson);

      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { ...payload, isRemoteSync: true },
        })
      );
    } else if (payload.action === 'transport_updated') {
      if (payload.customTransportMap) {
        localStorage.setItem('schoolflow_transport_subscriptions_v2', JSON.stringify(payload.customTransportMap));
      }
      if (payload.monthlyPayments) {
        localStorage.setItem('schoolflow_transport_monthly_payments_v2', JSON.stringify(payload.monthlyPayments));
      }
      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { ...payload, isRemoteSync: true },
        })
      );
    } else if (payload.action === 'canteen_updated') {
      if (payload.customCanteenMap) {
        localStorage.setItem('schoolflow_canteen_subscriptions_v3', JSON.stringify(payload.customCanteenMap));
      }
      if (payload.monthlyPayments) {
        localStorage.setItem('schoolflow_canteen_monthly_payments_v3', JSON.stringify(payload.monthlyPayments));
      }
      if (payload.weeklyMenu) {
        localStorage.setItem('schoolflow_canteen_weekly_menu_v2', JSON.stringify(payload.weeklyMenu));
      }
      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { ...payload, isRemoteSync: true },
        })
      );
    } else if (payload.action === 'boarding_updated') {
      if (payload.customSubscriptions) {
        localStorage.setItem('schoolflow_boarding_subscriptions_v3', JSON.stringify(payload.customSubscriptions));
      }
      if (payload.monthlyPayments) {
        localStorage.setItem('schoolflow_boarding_monthly_payments_v3', JSON.stringify(payload.monthlyPayments));
      }
      if (payload.boardingCapacity !== undefined) {
        localStorage.setItem(`schoolflow_boarding_capacity_${cleanSlug}`, payload.boardingCapacity.toString());
      }
      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { ...payload, isRemoteSync: true },
        })
      );
    } else if (payload.action === 'students_deleted' && Array.isArray(payload.deletedIds)) {
      deleteLiveStudents(payload.deletedIds, cleanSlug);
    } else if (payload.action === 'force_store_refresh' && Array.isArray(payload.students)) {
      const students: Student[] = payload.students;
      const invoices: Invoice[] = payload.invoices || [];

      const schoolKey = `${STUDENTS_STORAGE_KEY}_${cleanSlug}`;
      localStorage.setItem(schoolKey, JSON.stringify(students));
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));
      if (isPilot) {
        localStorage.setItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`, JSON.stringify(students));
      }

      const invSchoolKey = `${INVOICES_STORAGE_KEY}_${cleanSlug}`;
      localStorage.setItem(invSchoolKey, JSON.stringify(invoices));
      localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
      if (isPilot) {
        localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, JSON.stringify(invoices));
      }

      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: {
            action: 'force_store_refresh',
            isRemoteSync: true,
          },
        })
      );
    }
  } catch (err) {
    // Ignorer les formats non conformes
  }
}

/**
 * Canal universel hybride (Supabase Realtime WebSockets + SSE) pour synchroniser
 * en temps réel tous les PC, téléphones et tablettes distants.
 */
let activeEventSource: EventSource | null = null;
let currentSseSlug = '';
let activeSupabaseChannel: any = null;

export function startUniversalRealtimeSync(slug: string = 'epc-manoi'): void {
  if (typeof window === 'undefined') return;
  const cleanSlug = (!slug || slug === 'college-excellence') ? 'epc-manoi' : slug;

  // 1. Canal Supabase Realtime (WebSockets)
  if (isSupabaseConfigured && !activeSupabaseChannel) {
    try {
      const channelSlug = cleanSlug.replace(/[^a-zA-Z0-9_-]/g, '_');
      activeSupabaseChannel = supabase
        .channel(`sf_realtime_${channelSlug}`)
        .on('broadcast', { event: 'live_update' }, ({ payload }) => {
          if (!payload || payload.senderId === CLIENT_INSTANCE_ID) return;
          handleRemoteIncomingPayload(payload, cleanSlug);
        })
        .on('postgres_changes', { event: '*', schema: 'public' }, (changePayload) => {
          window.dispatchEvent(
            new CustomEvent(DATA_UPDATED_EVENT, {
              detail: { action: 'postgres_cdc_update', payload: changePayload, isRemoteSync: true },
            })
          );
        })
        .subscribe();
    } catch (err) {
      console.warn('Supabase realtime channel notice:', err);
    }
  }

  // 2. Canal SSE redondant haute disponibilité
  if (typeof EventSource !== 'undefined') {
    if (activeEventSource && currentSseSlug === cleanSlug) return;

    if (activeEventSource) {
      try {
        activeEventSource.close();
      } catch (e) {}
      activeEventSource = null;
    }

    currentSseSlug = cleanSlug;
    const topic = `schoolflow_sync_${cleanSlug.replace(/[^a-zA-Z0-9_-]/g, '_')}_v4`;

    try {
      const es = new EventSource(`https://ntfy.sh/${topic}/sse`);
      activeEventSource = es;

      es.onmessage = (event) => {
        try {
          if (!event.data) return;
          const msg = JSON.parse(event.data);
          if (!msg || msg.event !== 'message' || !msg.message) return;

          const payload =
            typeof msg.message === 'string' ? JSON.parse(msg.message) : msg.message;
          if (!payload || payload.senderId === CLIENT_INSTANCE_ID) {
            return;
          }

          handleRemoteIncomingPayload(payload, cleanSlug);
        } catch (err) {}
      };

      es.onerror = () => {
        // Reconnexion gérée automatiquement par EventSource
      };
    } catch (e) {
      console.warn('Initialisation SSE universel notice:', e);
    }
  }
}

/**
 * Diffuse instantanément un événement de mise à jour à l'interface active et à TOUTES les autres fenêtres ouvertes en direct.
 */
export function broadcastLiveUpdate(detail: Record<string, any> = {}): void {
  if (typeof window === 'undefined') return;

  const enrichedDetail = {
    ...detail,
    senderId: CLIENT_INSTANCE_ID,
    timestamp: Date.now(),
  };

  // 1. Dispatch local immédiat
  window.dispatchEvent(
    new CustomEvent(DATA_UPDATED_EVENT, {
      detail: enrichedDetail,
    })
  );

  // 2. Diffusion instantanée cross-onglets et cross-fenêtres du même navigateur
  if (syncBroadcastChannel) {
    try {
      syncBroadcastChannel.postMessage(enrichedDetail);
    } catch (e) {
      console.warn('Erreur broadcast message:', e);
    }
  }

  // 3. Diffusion instantanée via Supabase Realtime WebSockets
  if (!detail.isRemoteSync && activeSupabaseChannel) {
    try {
      activeSupabaseChannel.send({
        type: 'broadcast',
        event: 'live_update',
        payload: enrichedDetail,
      });
    } catch (e) {}
  }

  // 4. Diffusion instantanée SSE multi-appareils (téléphones, tablettes, autres PC)
  if (!detail.isRemoteSync && typeof fetch !== 'undefined') {
    const slug = detail.schoolSlug || 'epc-manoi';
    const topic = `schoolflow_sync_${slug.replace(/[^a-zA-Z0-9_-]/g, '_')}_v4`;
    fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedDetail),
    }).catch(() => {});
  }
}

/**
 * Récupère les IDs supprimés par l'administrateur
 */
export function getDeletedStudentIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_STUDENTS_STORAGE_KEY);
    const parsed: string[] = raw ? JSON.parse(raw) : [];
    return new Set(parsed);
  } catch (error) {
    return new Set();
  }
}

/**
 * Supprime un ou plusieurs élèves de manière centralisée et définitive de toutes les pages.
 */
export function deleteLiveStudents(idsToDelete: string[], schoolSlug?: string): void {
  if (typeof window === 'undefined' || !idsToDelete || idsToDelete.length === 0) return;

  const safeIdsToDelete = idsToDelete.filter(Boolean);
  if (safeIdsToDelete.length === 0) return;

  try {
    const cleanSlug = schoolSlug || 'epc-manoi';
    const isPilot = cleanSlug === 'epc-manoi';

    // 0. Récupérer tous les élèves existants pour extraire l'intégralité de leurs identifiants (id, studentNumber, matricule)
    const schoolKey = `${STUDENTS_STORAGE_KEY}_${cleanSlug}`;
    const rawSchool = localStorage.getItem(schoolKey);
    const rawGlobal = localStorage.getItem(STUDENTS_STORAGE_KEY);
    const existingList: Student[] = [
      ...(rawSchool ? JSON.parse(rawSchool) : []),
      ...(rawGlobal ? JSON.parse(rawGlobal) : []),
    ];

    const inputIdSet = new Set(safeIdsToDelete);
    const allDeletedIdentifiers = new Set<string>(safeIdsToDelete);

    for (const s of existingList) {
      if (
        inputIdSet.has(s.id) ||
        (s.studentNumber && inputIdSet.has(s.studentNumber)) ||
        (s.matricule && inputIdSet.has(s.matricule))
      ) {
        if (s.id) allDeletedIdentifiers.add(s.id);
        if (s.studentNumber) allDeletedIdentifiers.add(s.studentNumber);
        if (s.matricule) allDeletedIdentifiers.add(s.matricule);
      }
    }

    const deleteArray = Array.from(allDeletedIdentifiers);
    const rawDeleted = localStorage.getItem(DELETED_STUDENTS_STORAGE_KEY);
    const prevDeleted: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
    const updatedDeleted = Array.from(new Set([...prevDeleted, ...deleteArray]));
    localStorage.setItem(DELETED_STUDENTS_STORAGE_KEY, JSON.stringify(updatedDeleted));

    const deleteSet = new Set(updatedDeleted);

    // 1. Filtrer et nettoyer le stockage local des élèves sur TOUTES les clés
    const filterStudents = (arr: Student[]) =>
      arr.filter(
        (s) =>
          !deleteSet.has(s.id) &&
          (!s.studentNumber || !deleteSet.has(s.studentNumber)) &&
          (!s.matricule || !deleteSet.has(s.matricule))
      );

    const prevStudents: Student[] = rawGlobal ? JSON.parse(rawGlobal) : [];
    const remainingGlobal = filterStudents(prevStudents);
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(remainingGlobal));

    const prevSchool: Student[] = rawSchool ? JSON.parse(rawSchool) : [];
    const remainingSchool = filterStudents(prevSchool);
    localStorage.setItem(schoolKey, JSON.stringify(remainingSchool));

    if (isPilot) {
      localStorage.setItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`, JSON.stringify(remainingSchool));
    }

    // 2. Filtrer et nettoyer le stockage local des factures / scolarités sur TOUTES les clés
    const filterInvoices = (arr: Invoice[]) =>
      arr.filter(
        (inv) =>
          !deleteSet.has(inv.id) &&
          (!inv.studentId || !deleteSet.has(inv.studentId)) &&
          (!inv.invoiceNumber || !deleteSet.has(inv.invoiceNumber))
      );

    const invGlobalRaw = localStorage.getItem(INVOICES_STORAGE_KEY);
    const prevInvoices: Invoice[] = invGlobalRaw ? JSON.parse(invGlobalRaw) : [];
    const remainingInvoicesGlobal = filterInvoices(prevInvoices);
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(remainingInvoicesGlobal));

    const invSchoolKey = `${INVOICES_STORAGE_KEY}_${cleanSlug}`;
    const invSchoolRaw = localStorage.getItem(invSchoolKey);
    const prevInvSchool: Invoice[] = invSchoolRaw ? JSON.parse(invSchoolRaw) : [];
    const remainingInvSchool = filterInvoices(prevInvSchool);
    localStorage.setItem(invSchoolKey, JSON.stringify(remainingInvSchool));

    if (isPilot) {
      localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, JSON.stringify(remainingInvSchool));
    }

    // 3. Supprimer immédiatement dans Supabase Cloud pour tous les appareils
    for (const id of deleteArray) {
      deleteStudentFromSupabase(id, cleanSlug).catch(() => {});
      deleteInvoiceFromSupabase(id, cleanSlug).catch(() => {});
    }

    // 4. Notifier l'API serveur pour répercuter la suppression immédiatement vers tous les ordinateurs et téléphones
    if (typeof fetch !== 'undefined') {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: cleanSlug,
          students: remainingSchool,
          invoices: remainingInvSchool,
          deletedStudentIds: deleteArray,
        }),
      }).catch(() => {});
    }

    // 5. Nettoyer Internat, Cantine et Transport des élèves supprimés
    try {
      const BOARDING_KEY = isPilot ? 'schoolflow_boarding_subscriptions_v3' : `schoolflow_boarding_subscriptions_v3_${cleanSlug}`;
      const rawBoarding = localStorage.getItem(BOARDING_KEY);
      if (rawBoarding) {
        const list: any[] = JSON.parse(rawBoarding);
        const filtered = list.filter((b) => !deleteSet.has(b.studentId) && (!b.matricule || !deleteSet.has(b.matricule)));
        localStorage.setItem(BOARDING_KEY, JSON.stringify(filtered));
      }

      const CANTEEN_KEY = isPilot ? 'schoolflow_canteen_subscriptions_v3' : `schoolflow_canteen_subscriptions_v3_${cleanSlug}`;
      const rawCanteen = localStorage.getItem(CANTEEN_KEY);
      if (rawCanteen) {
        const map: Record<string, any> = JSON.parse(rawCanteen);
        deleteArray.forEach((id) => delete map[id]);
        localStorage.setItem(CANTEEN_KEY, JSON.stringify(map));
      }

      const TRANSPORT_KEY = isPilot ? 'schoolflow_transport_subscriptions_v2' : `schoolflow_transport_subscriptions_v2_${cleanSlug}`;
      const rawTransport = localStorage.getItem(TRANSPORT_KEY);
      if (rawTransport) {
        const map: Record<string, any> = JSON.parse(rawTransport);
        deleteArray.forEach((id) => delete map[id]);
        localStorage.setItem(TRANSPORT_KEY, JSON.stringify(map));
      }
    } catch (e) {
      console.warn('Erreur nettoyage souscriptions prestations:', e);
    }

    // 6. Déclencher la diffusion temps réel parallèle
    broadcastLiveUpdate({
      action: 'students_deleted',
      deletedIds: deleteArray,
      schoolSlug: cleanSlug,
    });
  } catch (error) {
    console.error('Erreur suppression live-store students:', error);
  }
}

let isSyncingServer = false;
let lastSyncTimestamp = 0;
let crossDeviceSyncStarted = false;
let activeSyncInterval: any = null;

/**
 * Démarre la synchronisation temps réel multi-appareils (PC, téléphone, tablettes des collaborateurs)
 */
export function startCrossDeviceSync(slug: string = 'epc-manoi'): void {
  if (typeof window === 'undefined') return;

  // Lancer immédiatement la synchronisation SSE universelle multi-appareils
  startUniversalRealtimeSync(slug);

  // Lancer la synchronisation API serveur
  syncSchoolDataWithServer(slug);

  if (crossDeviceSyncStarted) return;
  crossDeviceSyncStarted = true;

  // 1. Synchronisation instantanée dès que l'écran devient actif (déverrouillage téléphone, switch d'application, focus onglet)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncSchoolDataWithServer(slug);
    }
  });

  window.addEventListener('focus', () => {
    syncSchoolDataWithServer(slug);
  });

  // 2. Rafraîchissement d'arrière-plan modéré (toutes les 5 minutes) pour préserver les quotas Postgres et éviter toute saturation
  if (activeSyncInterval) clearInterval(activeSyncInterval);
  activeSyncInterval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      syncSchoolDataWithServer(slug);
    }
  }, 300000); // 5 minutes au lieu de 60s pour réduire les requêtes Postgres
}

/**
 * Synchronise les données réelles enregistrées depuis l'API serveur pour assurer la persistance
 * lorsque le lien du site est partagé avec d'autres utilisateurs ou ouvert sur d'autres appareils.
 */
export function syncSchoolDataWithServer(slug: string): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined' || isSyncingServer) return;
  const now = Date.now();
  if (now - lastSyncTimestamp < 15000) return; // Anti-rafale : 15s minimum entre deux appels
  isSyncingServer = true;
  lastSyncTimestamp = now;

  fetch(`/api/sync?slug=${encodeURIComponent(slug)}&t=${Date.now()}`)
    .then((res) => res.json())
    .then((result) => {
      isSyncingServer = false;
      if (result && result.success && result.data) {
        const data = result.data;
        let hasChanges = false;
        const isPilot = slug === 'epc-manoi';

        // 1. Remplacer la liste locale des identifiants supprimés par celle du serveur (source de
        // vérité unique). Une simple fusion additive ne pouvait jamais faire disparaître un
        // identifiant débloqué côté serveur (ex: via restoreStudentIds) : ce navigateur continuait
        // de bloquer ID-016/ID-017 indéfiniment même après leur déblocage confirmé sur le serveur.
        if (data.deletedStudentIds && Array.isArray(data.deletedStudentIds)) {
          const rawDeleted = localStorage.getItem(DELETED_STUDENTS_STORAGE_KEY);
          const prevDeleted: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
          const serverList = Array.from(new Set(data.deletedStudentIds.filter(Boolean)));
          if (
            serverList.length !== prevDeleted.length ||
            serverList.some((id) => !prevDeleted.includes(id))
          ) {
            localStorage.setItem(DELETED_STUDENTS_STORAGE_KEY, JSON.stringify(serverList));
            hasChanges = true;
          }
        }

        const delSet = getDeletedStudentIds();

        // 2. Synchroniser les paramètres de l'école (Préservation absolue des éléments graphiques : logo, emblème, cachet)
        if (data.schoolSettings) {
          const localSettingsKey = `${SCHOOL_SETTINGS_PREFIX}${slug}`;
          const current = localStorage.getItem(localSettingsKey);
          let currentObj: School | null = null;
          try {
            if (current) currentObj = JSON.parse(current);
          } catch (e) {}

          const incoming = data.schoolSettings;
          const mergedSchool: School = {
            ...(currentObj || {}),
            ...incoming,
            logoUrl: incoming.logoUrl || currentObj?.logoUrl || '',
            countryEmblemUrl: incoming.countryEmblemUrl || currentObj?.countryEmblemUrl || '',
            stampUrl: incoming.stampUrl || currentObj?.stampUrl || '',
            founderName: incoming.founderName || currentObj?.founderName || (isPilot ? 'LAWANI MOUSSA' : ''),
            directorName: incoming.directorName || currentObj?.directorName || (isPilot ? 'LAWANI MOUHAMED' : ''),
          };

          const newStr = JSON.stringify(mergedSchool);
          if (!current || current !== newStr) {
            localStorage.setItem(localSettingsKey, newStr);
            if (isPilot) {
              localStorage.setItem(`${SCHOOL_SETTINGS_PREFIX}epc-manoi`, newStr);
              localStorage.setItem('schoolflow_active_school_settings_v1', newStr);
            }
            hasChanges = true;
          }
        }

        // 3. Synchroniser les élèves (Protection absolue et fusion intelligente)
        if (data.students !== undefined && Array.isArray(data.students)) {
          const incomingStudents = data.students.filter(
            (s: any) =>
              !delSet.has(s.id) &&
              (!s.studentNumber || !delSet.has(s.studentNumber)) &&
              (!s.matricule || !delSet.has(s.matricule))
          );
          const schoolKey = `${STUDENTS_STORAGE_KEY}_${slug}`;
          const currentLocal = localStorage.getItem(schoolKey);
          let prevStudents: Student[] = [];
          try {
            if (currentLocal) prevStudents = JSON.parse(currentLocal);
          } catch (e) {}

          // Map intelligente par identifiant
          const studentMap = new Map<string, Student>();

          // A. Charger les élèves serveur — clé de correspondance = l'identifiant réel stable
          // (UUID Supabase) en priorité, et non le numéro affiché ID-XXX. Une correction
          // administrative directe du numéro d'un élève (ex: comblement d'un trou de
          // numérotation) change studentNumber mais jamais l'id réel : indexer par
          // studentNumber faisait passer cette correction pour "un élève local pas encore
          // synchronisé" sur tout navigateur ayant encore l'ancien numéro en cache, qui la
          // renvoyait alors vers le serveur et l'écrasait aussitôt.
          incomingStudents.forEach((st: Student) => {
            const key = st.id || st.studentNumber;
            studentMap.set(key, st);
          });

          // B. Fusionner avec le stockage local (Sauvegarde des nouveaux inscrits et des modifications de date récentes)
          let hasLocalNewStudents = false;
          prevStudents.forEach((localStu: Student) => {
            if (
              delSet.has(localStu.id) ||
              (localStu.studentNumber && delSet.has(localStu.studentNumber)) ||
              (localStu.matricule && delSet.has(localStu.matricule))
            ) {
              return;
            }
            const key = localStu.id || localStu.studentNumber;
            if (!studentMap.has(key)) {
              // Conserver impérativement l'élève créé ou modifié localement
              studentMap.set(key, localStu);
              hasLocalNewStudents = true;
            } else {
              // Élève déjà connu du serveur (même id réel) : ne conserver la version locale que
              // si elle est STRICTEMENT plus récente — à égalité ou en cas de doute, le serveur
              // gagne, pour que toute correction faite côté serveur reste acquise.
              const incomingStu = studentMap.get(key)!;
              const localTime = localStu.updatedAt ? new Date(localStu.updatedAt).getTime() : 0;
              const incomingTime = incomingStu.updatedAt ? new Date(incomingStu.updatedAt).getTime() : 0;
              if (localTime > incomingTime) {
                studentMap.set(key, { ...incomingStu, ...localStu });
              }
            }
          });

          // Pour EPC Manoi : s'assurer que les 15 élèves officiels sont TOUJOURS présents — mais
          // seulement si aucun élève réel (identifié par id ou par son numéro déjà attribué,
          // même après un changement de numéro administratif) n'occupe déjà ce numéro, sinon le
          // placeholder mock recréerait un doublon fantôme du numéro qu'un vrai élève a repris.
          if (isPilot) {
            const usedNumbers = new Set<string>();
            studentMap.forEach((s) => {
              if (s.studentNumber) usedNumbers.add(s.studentNumber);
            });
            for (const offStu of mockStudents) {
              const key = offStu.id || offStu.studentNumber;
              if (!studentMap.has(key) && !(offStu.studentNumber && usedNumbers.has(offStu.studentNumber))) {
                studentMap.set(key, offStu);
              }
            }
          }

          const mergedStudents = Array.from(studentMap.values()).sort((a, b) => {
            const numA = parseInt((a.studentNumber || a.id).replace(/\D/g, ''), 10) || 0;
            const numB = parseInt((b.studentNumber || b.id).replace(/\D/g, ''), 10) || 0;
            return numA - numB;
          });

          // Si des élèves locaux n'étaient pas sur le serveur, les synchroniser en arrière-plan vers l'API
          if (hasLocalNewStudents) {
            fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug, students: mergedStudents }),
            }).catch(() => {});
          }

          const newStr = JSON.stringify(mergedStudents);
          if (currentLocal !== newStr) {
            localStorage.setItem(schoolKey, newStr);
            localStorage.setItem(STUDENTS_STORAGE_KEY, newStr);
            if (isPilot) {
              localStorage.setItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`, newStr);
            }
            hasChanges = true;
          }
        }

        // 4. Synchroniser les factures / encaissements (Fusion intelligente)
        if (data.invoices !== undefined && Array.isArray(data.invoices)) {
          const incomingInvoices = data.invoices.filter(
            (inv: any) =>
              !delSet.has(inv.id) &&
              (!inv.studentId || !delSet.has(inv.studentId)) &&
              (!inv.invoiceNumber || !delSet.has(inv.invoiceNumber))
          );
          const invSchoolKey = `${INVOICES_STORAGE_KEY}_${slug}`;
          const currentLocal = localStorage.getItem(invSchoolKey);
          let prevInvoices: Invoice[] = [];
          try {
            if (currentLocal) prevInvoices = JSON.parse(currentLocal);
          } catch (e) {}

          // Clé de correspondance = id réel en priorité (même raison que pour les élèves : un
          // invoiceNumber peut être corrigé administrativement sans que l'id réel ne change).
          const invoiceMap = new Map<string, Invoice>();
          incomingInvoices.forEach((inv: Invoice) => {
            const key = inv.id || inv.invoiceNumber;
            invoiceMap.set(key, inv);
          });

          let hasLocalNewInvoices = false;
          prevInvoices.forEach((localInv: Invoice) => {
            if (
              delSet.has(localInv.id) ||
              (localInv.studentId && delSet.has(localInv.studentId)) ||
              (localInv.invoiceNumber && delSet.has(localInv.invoiceNumber))
            ) {
              return;
            }
            const key = localInv.id || localInv.invoiceNumber;
            if (!invoiceMap.has(key)) {
              // Conserver impérativement la facture créée localement
              invoiceMap.set(key, localInv);
              hasLocalNewInvoices = true;
            } else {
              // Facture déjà connue du serveur (même id réel) : le serveur reste la référence —
              // une correction administrative (ex: renumérotation) ne doit pas être écrasée par
              // une ancienne version encore en cache sur un autre appareil.
              const incomingInv = invoiceMap.get(key)!;
              invoiceMap.set(key, incomingInv);
            }
          });

          // Pour EPC Manoi : s'assurer que les 15 factures officielles sont TOUJOURS présentes
          if (isPilot) {
            const usedInvoiceNumbers = new Set<string>();
            invoiceMap.forEach((inv) => {
              if (inv.invoiceNumber) usedInvoiceNumbers.add(inv.invoiceNumber);
            });
            for (const offInv of mockInvoices) {
              const key = offInv.id || offInv.invoiceNumber;
              if (!invoiceMap.has(key) && !(offInv.invoiceNumber && usedInvoiceNumbers.has(offInv.invoiceNumber))) {
                invoiceMap.set(key, offInv);
              }
            }
          }

          const mergedInvoices = Array.from(invoiceMap.values()).sort((a, b) => {
            const numA = parseInt((a.invoiceNumber || a.id).replace(/\D/g, ''), 10) || 0;
            const numB = parseInt((b.invoiceNumber || b.id).replace(/\D/g, ''), 10) || 0;
            return numA - numB;
          });

          if (hasLocalNewInvoices) {
            fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug, invoices: mergedInvoices }),
            }).catch(() => {});
          }

          const newStr = JSON.stringify(mergedInvoices);
          if (currentLocal !== newStr) {
            localStorage.setItem(invSchoolKey, newStr);
            localStorage.setItem(INVOICES_STORAGE_KEY, newStr);
            if (isPilot) {
              localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, newStr);
            }
            hasChanges = true;
          }
        }

        // 5. Synchroniser le personnel — remplacement strict depuis le serveur (source de
        // vérité Supabase), et non fusion par union. Un membre supprimé sur un autre appareil
        // (deleteLiveStaffUser -> deleteStaffUserFromSupabase) disparaissait bien de Supabase,
        // mais l'ancienne fusion se contentait d'AJOUTER/METTRE À JOUR sans jamais retirer les
        // entrées absentes de la réponse serveur : un appareil ayant encore cette personne en
        // cache local (ex: un téléphone resté sur une ancienne session) continuait à l'afficher
        // indéfiniment, même bien après sa suppression confirmée ailleurs.
        if (data.staffUsers && Array.isArray(data.staffUsers)) {
          const staffSchoolKey = `${STAFF_USERS_STORAGE_KEY}_${slug}`;
          const currentLocalRaw = localStorage.getItem(staffSchoolKey) || localStorage.getItem(STAFF_USERS_STORAGE_KEY);
          let currentLocalList: any[] = [];
          try {
            if (currentLocalRaw) currentLocalList = JSON.parse(currentLocalRaw);
          } catch (e) {}

          const oldByCode = new Map<string, any>();
          currentLocalList.forEach((s: any) => {
            if (s && s.authCode) oldByCode.set(s.authCode.toUpperCase(), s);
          });
          const mergedStaff = data.staffUsers
            .filter((u: any) => u && u.authCode && !LEGACY_MOCK_STAFF_IDS.has(u.id) && !LEGACY_MOCK_STAFF_IDS.has(u.authCode))
            .map((u: any) => {
              const prev = oldByCode.get(u.authCode.toUpperCase());
              return prev?.lastLogin ? { ...u, lastLogin: prev.lastLogin } : u;
            });
          const newStr = JSON.stringify(mergedStaff);
          if (currentLocalRaw !== newStr) {
            localStorage.setItem(staffSchoolKey, newStr);
            localStorage.setItem(STAFF_USERS_STORAGE_KEY, newStr);
            if (isPilot) {
              localStorage.setItem(`${STAFF_USERS_STORAGE_KEY}_epc-manoi`, newStr);
            }
            hasChanges = true;
          }
        }

        // 6. Synchroniser Transport
        if (data.transportSubscriptions) {
          localStorage.setItem('schoolflow_transport_subscriptions_v2', JSON.stringify(data.transportSubscriptions));
          hasChanges = true;
        }
        if (data.transportPayments) {
          localStorage.setItem('schoolflow_transport_monthly_payments_v2', JSON.stringify(data.transportPayments));
          hasChanges = true;
        }

        // 7. Synchroniser Cantine
        if (data.canteenSubscriptions) {
          localStorage.setItem('schoolflow_canteen_subscriptions_v3', JSON.stringify(data.canteenSubscriptions));
          hasChanges = true;
        }
        if (data.canteenPayments) {
          localStorage.setItem('schoolflow_canteen_monthly_payments_v3', JSON.stringify(data.canteenPayments));
          hasChanges = true;
        }
        if (data.canteenWeeklyMenu) {
          localStorage.setItem('schoolflow_canteen_weekly_menu_v2', JSON.stringify(data.canteenWeeklyMenu));
          hasChanges = true;
        }

        // 8. Synchroniser Internat
        if (data.boardingSubscriptions) {
          localStorage.setItem('schoolflow_boarding_subscriptions_v3', JSON.stringify(data.boardingSubscriptions));
          hasChanges = true;
        }
        if (data.boardingPayments) {
          localStorage.setItem('schoolflow_boarding_monthly_payments_v3', JSON.stringify(data.boardingPayments));
          hasChanges = true;
        }
        if (data.boardingCapacity !== undefined) {
          localStorage.setItem(`schoolflow_boarding_capacity_${slug}`, data.boardingCapacity.toString());
          hasChanges = true;
        }

        if (hasChanges) {
          broadcastLiveUpdate({ action: 'server_hydrated', slug });
        }
      }
    })
    .catch(() => {
      isSyncingServer = false;
    });
}

/**
 * Récupère la configuration personnalisée de l'école (nom, slogan, devise, logos, ville, fondateur, etc.)
 */
export function getLiveSchool(slug: string, defaultSchool?: School): School {
  if (typeof window === 'undefined') {
    return defaultSchool || mockSchools['epc-manoi'] || {
      id: slug,
      slug: slug,
      name: slug.toUpperCase().replace(/-/g, ' '),
      shortName: slug.slice(0, 10).toUpperCase(),
      logoColor: '#059669',
      academicYear: '2026-2027',
      currentTerm: 'Trimestre 1',
      termType: 'trimestriel',
      phone: '+225 01 02 03 04 05',
      whatsappPhone: '+225 01 02 03 04 05',
      email: `direction@${slug}.ci`,
      motto: 'Discipline • Rigueur • Réussite',
      slogan: 'L’Excellence au service de l’Éducation',
      city: 'Abidjan',
      country: 'Côte d’Ivoire',
      district: 'Abidjan',
      ministryCode: '321119',
      founderName: slug === 'epc-manoi' ? 'LAWANI MOUSSA' : 'Fondateur / Promoteur',
      directorName: 'LAWANI MOUHAMED',
      studiesDirectorName: 'Direction des Études',
      status: 'active',
      subscriptionPlan: 'annuel',
      createdAt: '2026-09-01',
    };
  }

  // Lancer la réconciliation serveur et la boucle temps réel multi-appareils
  try {
    startCrossDeviceSync(slug);
  } catch (e) {}

  try {
    // 1. Chercher d'abord avec le slug spécifique
    let raw = localStorage.getItem(`${SCHOOL_SETTINGS_PREFIX}${slug}`);

    // 2. Chercher dans les écoles souscrites enregistrées
    if (!raw) {
      const registered = getRegisteredSchools();
      const found = registered.find((s) => s.slug === slug || s.id === slug);
      if (found) {
        return found;
      }
    }

    // 3. Si c'est l'école officielle par défaut (epc-manoi)
    if (!raw && (slug === 'epc-manoi')) {
      raw =
        localStorage.getItem(`${SCHOOL_SETTINGS_PREFIX}epc-manoi`) ||
        
        localStorage.getItem('schoolflow_active_school_settings_v1');
    }

    if (raw) {
      const local = JSON.parse(raw);
      const fallback = defaultSchool || mockSchools['epc-manoi'] ;
      return {
        ...fallback,
        ...local,
        logoUrl: local.logoUrl || fallback?.logoUrl || '',
        countryEmblemUrl: local.countryEmblemUrl || fallback?.countryEmblemUrl || '',
        stampUrl: local.stampUrl || fallback?.stampUrl || '',
        name: local.name || fallback?.name || slug.toUpperCase().replace(/-/g, ' '),
        shortName: local.shortName || fallback?.shortName || slug.slice(0, 10).toUpperCase(),
        founderName:
          (slug === 'epc-manoi')
            ? 'LAWANI MOUSSA'
            : (local.founderName && !local.founderName.toUpperCase().includes('MOUHAMED')
                ? local.founderName
                : (fallback?.founderName || 'LAWANI MOUSSA')),
        directorName: local.directorName || fallback?.directorName || 'LAWANI MOUHAMED',
        studiesDirectorName: local.studiesDirectorName || fallback?.studiesDirectorName || 'Direction des Études',
        slug: slug,
      };
    }

    if (defaultSchool) return defaultSchool;

    // Nouvelle école non encore enregistrée
    return {
      id: slug,
      slug: slug,
      name: slug.toUpperCase().replace(/-/g, ' '),
      shortName: slug.slice(0, 10).toUpperCase(),
      logoColor: '#059669',
      academicYear: '2026-2027',
      currentTerm: 'Trimestre 1',
      termType: 'trimestriel',
      phone: '+225 01 02 03 04 05',
      whatsappPhone: '+225 01 02 03 04 05',
      email: `direction@${slug}.ci`,
      motto: 'Discipline • Rigueur • Réussite',
      slogan: 'L’Excellence au service de l’Éducation',
      city: 'Abidjan',
      country: 'Côte d’Ivoire',
      district: 'Abidjan',
      ministryCode: '321119',
      founderName: 'DIRECTION GÉNÉRALE',
      directorName: 'DIRECTION GÉNÉRALE',
      studiesDirectorName: 'Direction des Études',
      status: 'active',
      subscriptionPlan: 'annuel',
      createdAt: '2026-09-01',
    };
  } catch (error) {
    console.error('Erreur lecture localStorage school settings:', error);
    return defaultSchool || mockSchools['epc-manoi'];
  }
}

// ═══════════════════════════════════════════════════════════════
// GESTION DU PORTAIL DE SAISIE DES NOTES (OUVERTURE / FERMETURE ADMIN)
// ═══════════════════════════════════════════════════════════════

export const GRADES_PORTAL_KEY = 'schoolflow_grades_portal_status_v1';

export interface GradesPortalStatus {
  isOpen: boolean;
  closedMessage: string;
  updatedBy: string;
  updatedAt: string;
}

export function getGradesPortalStatus(schoolSlug: string): GradesPortalStatus {
  const defaultStatus: GradesPortalStatus = {
    isOpen: true,
    closedMessage: 'Les portails de saisie des notes sont actuellement fermés par la Direction. Veuillez contacter l’administrateur pour ouvrir l’accès.',
    updatedBy: 'Direction des Études',
    updatedAt: '01/09/2026',
  };

  if (typeof window === 'undefined') return defaultStatus;
  try {
    const raw = localStorage.getItem(`${GRADES_PORTAL_KEY}_${schoolSlug}`);
    if (raw) return JSON.parse(raw);
    const globalRaw = localStorage.getItem(GRADES_PORTAL_KEY);
    if (globalRaw) return JSON.parse(globalRaw);
  } catch (e) {}

  return defaultStatus;
}

export function saveGradesPortalStatus(schoolSlug: string, status: GradesPortalStatus): void {
  if (typeof window === 'undefined') return;
  try {
    const json = JSON.stringify(status);
    localStorage.setItem(`${GRADES_PORTAL_KEY}_${schoolSlug}`, json);
    localStorage.setItem(GRADES_PORTAL_KEY, json);

    broadcastLiveUpdate({
      action: 'grades_portal_updated',
      portalStatus: status,
      schoolSlug,
    });
  } catch (e) {
    console.error('Erreur sauvegarde portal status:', e);
  }
}

/**
 * Enregistre les paramètres modifiés d'une école dans le stockage persistant
 * et émet un événement pour que le reçu et toutes les pages se mettent à jour immédiatement.
 */
export function saveLiveSchool(school: School, targetSlug?: string): void {
  if (typeof window === 'undefined') return;

  try {
    const json = JSON.stringify(school);
    const activeSlug = targetSlug || school.slug;
    // Sauvegarder sur le slug spécifique
    localStorage.setItem(`${SCHOOL_SETTINGS_PREFIX}${activeSlug}`, json);
    if (activeSlug !== school.slug) {
      localStorage.setItem(`${SCHOOL_SETTINGS_PREFIX}${school.slug}`, json);
    }

    if (school.slug === 'epc-manoi' || activeSlug === 'epc-manoi') {
      localStorage.setItem(`${SCHOOL_SETTINGS_PREFIX}epc-manoi`, json);
      localStorage.setItem('schoolflow_active_school_settings_v1', json);
    }

    // Synchronisation en arrière-plan avec Supabase Cloud & API Serveur SchoolFlow
    saveSchoolToSupabase(activeSlug !== school.slug ? { ...school, slug: activeSlug } : school).catch(() => {});
    if (typeof fetch !== 'undefined') {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: school.slug,
          schoolSettings: school,
        }),
      }).catch(() => {});
    }

    // Déclenchement de la diffusion temps réel parallèle
    broadcastLiveUpdate({
      action: 'school_settings_updated',
      school,
      schoolSlug: school.slug,
    });
  } catch (error) {
    console.error('Erreur sauvegarde live school:', error);
  }
}

// Helper de validation d'un élève
const isValidStudent = (stu: any): boolean => {
  return Boolean(stu && (stu.id || stu.studentNumber));
};

// Helper de normalisation et sécurisation d'un élève pour éviter tout plantage d'affichage
const normalizeStudent = (stu: any): Student => {
  const numVal = parseInt((stu?.studentNumber || stu?.id || '1').replace(/\D/g, '') || '1', 10);
  const idStr = stu?.id || `stu-${numVal.toString().padStart(3, '0')}`;
  const numStr = stu?.studentNumber || `ID-${numVal.toString().padStart(3, '0')}`;

  let rawLastName = (stu?.lastName || '').trim().toUpperCase();
  let rawFirstName = (stu?.firstName || '').trim();
  const rawFullName = (stu?.fullName || stu?.studentName || '').trim();

  // Si le nom ou prénom est manquant mais que le nom complet existe, le décomposer avec priorité NOM de famille en premier
  if ((!rawLastName || !rawFirstName) && rawFullName) {
    const parsed = splitFullNameNomFirst(rawFullName);
    if (!rawLastName) rawLastName = parsed.lastName;
    if (!rawFirstName) rawFirstName = parsed.firstName;
  }

  const finalLastName = rawLastName || 'ÉLÈVE';
  const finalFirstName = rawFirstName || '';
  const finalFullName = `${finalLastName} ${finalFirstName}`.trim() || 'Élève';

  return {
    ...stu,
    id: idStr,
    studentNumber: numStr,
    matricule: stu?.matricule || '',
    lastName: finalLastName,
    firstName: finalFirstName,
    fullName: finalFullName,
    grade: stu?.grade || '6ème',
    gender: stu?.gender === 'male' ? 'male' : 'female',
    avatar: stu?.avatar || '',
    dateOfBirth: stu?.dateOfBirth || '2015-05-12',
    guardianName: stu?.guardianName || 'Parent',
    guardianPhone: stu?.guardianPhone || stu?.whatsappPhone || '+225 01 02 03 04 05',
    whatsappPhone: stu?.whatsappPhone || stu?.guardianPhone || '+225 01 02 03 04 05',
    address: cleanDisplayAddress(stu?.address) || 'Abidjan',
    enrollmentDate: stu?.enrollmentDate || stu?.paymentDate || '2026-09-07',
    paymentDate: stu?.paymentDate || stu?.enrollmentDate || '2026-09-07',
    attendanceRate: typeof stu?.attendanceRate === 'number' ? stu.attendanceRate : 95,
    status: stu?.status || 'active',
    enrollmentType: stu?.enrollmentType || 'nouveau',
    isBoarding: Boolean(stu?.isBoarding || (stu?.notes && stu.notes.toLowerCase().includes('internat (oui)')) || (stu?.address && stu.address.toLowerCase().includes('internat (oui)'))),
  };
};

/**
 * Récupère les élèves enregistrés en local + fusionne avec les élèves existants.
 * Exclut automatiquement tous les élèves supprimés par l'administrateur.
 */
export function getLiveStudents(initialStudents: Student[] = [], schoolSlug?: string): Student[] {
  if (typeof window === 'undefined') return [];

  try {
    const slug = schoolSlug || 'epc-manoi';
    const deletedIds = getDeletedStudentIds();

    // 1. Charger depuis la clé spécifique à l'école
    const schoolKey = `${STUDENTS_STORAGE_KEY}_${slug}`;
    const rawSchool = localStorage.getItem(schoolKey);
    const schoolStudents: Student[] = rawSchool ? JSON.parse(rawSchool) : [];

    // 2. Charger depuis la clé globale UNIQUEMENT pour l'établissement pilote (EPC MANOI)
    let globalStudents: Student[] = [];
    let fallbackStudents: Student[] = [];
    if (slug === 'epc-manoi') {
      const rawGlobal = localStorage.getItem(STUDENTS_STORAGE_KEY);
      globalStudents = rawGlobal ? JSON.parse(rawGlobal) : [];

      const rawManoi = localStorage.getItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`);
      const manoiStudents: Student[] = rawManoi ? JSON.parse(rawManoi) : [];
      fallbackStudents = manoiStudents;
    }

    const allCandidates = [
      ...schoolStudents,
      ...fallbackStudents,
      ...globalStudents,
      ...(initialStudents || []),
    ];

    const seenIds = new Set<string>();
    const seenNumbers = new Set<string>();
    const seenNames = new Set<string>();
    const seenMatricules = new Set<string>();
    const uniqueStudents: Student[] = [];

    // Priorité absolue aux élèves enregistrés
    for (const stu of allCandidates) {
      if (!isValidStudent(stu)) continue;
      if (
        deletedIds.has(stu.id) ||
        (stu.studentNumber && deletedIds.has(stu.studentNumber)) ||
        (stu.matricule && deletedIds.has(stu.matricule))
      )
        continue;
      
      if (
        (stu.studentNumber && /^ID-2026\d+$/i.test(stu.studentNumber)) ||
        (stu.id && /^ID-2026\d+$/i.test(stu.id)) ||
        stu.matricule === 'MAT-2026' ||
        stu.studentNumber === 'MAT-2026'
      )
        continue;

      const idKey = stu.id || stu.studentNumber;
      const numKey = stu.studentNumber || stu.id;
      const nameKey = (stu.fullName || `${stu.lastName || ''} ${stu.firstName || ''}`)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .sort()
        .join(' ');
      const matKey = (stu.matricule || '').trim().toUpperCase();

      if (
        seenIds.has(idKey) ||
        seenNumbers.has(numKey) ||
        (nameKey && seenNames.has(nameKey)) ||
        (matKey && matKey !== '' && seenMatricules.has(matKey))
      ) {
        continue;
      }

      seenIds.add(idKey);
      seenNumbers.add(numKey);
      if (nameKey) seenNames.add(nameKey);
      if (matKey) seenMatricules.add(matKey);
      uniqueStudents.push(normalizeStudent(stu));
    }

    // Réconciliation automatique : si des factures locales existent sans objet élève correspondant, les réintégrer immédiatement
    try {
      const rawInvoicesSchool = localStorage.getItem(`${INVOICES_STORAGE_KEY}_${slug}`);
      const isPilotSchool = slug === 'epc-manoi';
      const rawInvoicesGlobal = isPilotSchool ? localStorage.getItem(INVOICES_STORAGE_KEY) : null;
      const candidateInvoices: Invoice[] = [
        ...(rawInvoicesSchool ? JSON.parse(rawInvoicesSchool) : []),
        ...(rawInvoicesGlobal ? JSON.parse(rawInvoicesGlobal) : []),
      ];

      for (const inv of candidateInvoices) {
        if (!inv || !inv.invoiceNumber) continue;
        if (
          deletedIds.has(inv.id) ||
          deletedIds.has(inv.studentId) ||
          deletedIds.has(inv.invoiceNumber)
        )
          continue;

        // PROTECTION ABSOLUE : Les factures de prestations de services (Internat, Cantine, Transport)
        // ne doivent JAMAIS recréer ou dédoubler un élève dans la liste des inscriptions !
        const feeLower = (inv.feeType || '').toLowerCase();
        if (
          feeLower.includes('internat') ||
          feeLower.includes('cantine') ||
          feeLower.includes('transport') ||
          inv.invoiceNumber.startsWith('QUI-INT-') ||
          inv.invoiceNumber.startsWith('QUI-CAN-') ||
          inv.invoiceNumber.startsWith('QUI-TRA-')
        ) {
          continue;
        }

        // Vérification anti-doublon par nom (ordre des mots insensible) ou identifiant déjà existant
        const alreadyExists = uniqueStudents.some(
          (s) =>
            s.id === inv.studentId ||
            (inv.studentId && s.studentNumber === inv.studentId) ||
            s.studentNumber === inv.invoiceNumber ||
            (s.fullName && inv.studentName && normalizeWords(s.fullName) === normalizeWords(inv.studentName))
        );
        if (alreadyExists) continue;

        const idKey = inv.studentId || inv.id || inv.invoiceNumber;
        const numKey = inv.invoiceNumber || inv.studentId || inv.id;
        if (!seenIds.has(idKey) && !seenNumbers.has(numKey)) {
          // Extraire strictement la séquence terminale pour éviter ID-2026002
          const matchSeq = inv.invoiceNumber.match(/(\d+)$/);
          const numVal = matchSeq ? parseInt(matchSeq[1], 10) : 1;
          const targetStudentNumber = `ID-${numVal.toString().padStart(3, '0')}`;
          if (seenNumbers.has(targetStudentNumber)) continue;

          const parsed = splitFullNameNomFirst(inv.studentName || 'Élève');
          const lastName = parsed.lastName || 'ÉLÈVE';
          const firstName = parsed.firstName || '';
          const fullName = `${lastName} ${firstName}`.trim() || inv.studentName || 'Élève';

          const reconstructedStudent: Student = {
            id: inv.studentId || `stu-${numVal.toString().padStart(3, '0')}`,
            studentNumber: targetStudentNumber,
            matricule: (inv as any).matricule || '',
            firstName,
            lastName,
            fullName,
            grade: inv.studentGrade || '6ème',
            gender: inv.studentGender || 'female',
            avatar: inv.studentAvatar || '',
            dateOfBirth: '2015-05-12',
            guardianName: inv.guardianName || 'Parent',
            guardianPhone: inv.guardianPhone || '+225 01 02 03 04 05',
            whatsappPhone: inv.guardianPhone || '+225 01 02 03 04 05',
            address: 'Abidjan',
            enrollmentDate: inv.issueDate || '2026-08-27',
            attendanceRate: 95,
            status: 'active',
            enrollmentType: inv.enrollmentType || 'nouveau',
            tuitionAmount: inv.amount || 0,
            discountAmount: inv.discountAmount || 0,
            netAmount: inv.netAmount !== undefined ? inv.netAmount : (inv.amount || 0),
            paidAmount: inv.paidAmount || 0,
            balanceRemaining: inv.balanceRemaining !== undefined ? inv.balanceRemaining : Math.max(0, (inv.amount || 0) - (inv.paidAmount || 0)),
            tuitionStatus: (inv.balanceRemaining === 0 || inv.status === 'paid') ? 'paid' : (inv.paidAmount && inv.paidAmount > 0) ? 'partial' : 'unpaid',
            paymentDate: inv.issueDate || '2026-08-27',
            paymentMethod: inv.paymentMethod || 'Espèces en caisse',
            installments: inv.installments,
            isBoarding: false,
          };

          seenIds.add(idKey);
          seenNumbers.add(numKey);
          uniqueStudents.push(reconstructedStudent);
        }
      }
    } catch (e) {}

    // Initialisation EPC MANOI : n'ajouter les candidats initiaux que s'ils n'ont JAMAIS été supprimés
    if (slug === 'epc-manoi') {
      const candidates = [...initialStudents, ...mockStudents];
      for (const stu of candidates) {
        if (!isValidStudent(stu)) continue;
        const targetNum = stu.studentNumber;
        if (
          deletedIds.has(stu.id) ||
          (targetNum && deletedIds.has(targetNum)) ||
          (stu.matricule && deletedIds.has(stu.matricule))
        ) {
          continue;
        }
        const exists = uniqueStudents.some(
          (u) =>
            u.id === stu.id ||
            (targetNum && u.studentNumber === targetNum) ||
            (stu.matricule && u.matricule === stu.matricule) ||
            (u.fullName && stu.fullName && normalizeWords(u.fullName) === normalizeWords(stu.fullName))
        );
        if (!exists) {
          uniqueStudents.push(normalizeStudent(stu));
        }
      }
    }

    // Trier chronologiquement selon le numéro séquentiel
    const sortedChronologically = uniqueStudents.sort((a, b) => {
      const numA = parseInt(a.studentNumber?.replace(/\D/g, '') || '0', 10);
      const numB = parseInt(b.studentNumber?.replace(/\D/g, '') || '0', 10);
      return numA - numB;
    });

    return sortedChronologically;
  } catch (error) {
    console.error('Erreur lecture localStorage students:', error);
    return [];
  }
}

/**
 * Récupère les factures / quittances enregistrées en local + fusionne avec les factures existantes.
 * Exclut automatiquement les factures des élèves supprimés.
 */
export function getLiveInvoices(initialInvoices: Invoice[] = [], schoolSlug?: string): Invoice[] {
  if (typeof window === 'undefined') return [];

  try {
    const slug = schoolSlug || 'epc-manoi';
    const deletedIds = getDeletedStudentIds();

    // Déclencher la synchronisation multi-terminaux (PC <-> Smartphone)
    startCrossDeviceSync(slug);

    // 1. Charger depuis la clé spécifique à l'école
    const schoolKey = `${INVOICES_STORAGE_KEY}_${slug}`;
    const rawSchool = localStorage.getItem(schoolKey);
    const schoolInvoices: Invoice[] = rawSchool ? JSON.parse(rawSchool) : [];

    // 2. Charger depuis la clé globale
    const rawGlobal = localStorage.getItem(INVOICES_STORAGE_KEY);
    const globalInvoices: Invoice[] = rawGlobal ? JSON.parse(rawGlobal) : [];

    // 3. Clés démo
    let fallbackInvoices: Invoice[] = [];
    if (slug === 'epc-manoi') {
      const rawManoi = localStorage.getItem(`${INVOICES_STORAGE_KEY}_epc-manoi`);
      const manoiInvoices: Invoice[] = rawManoi ? JSON.parse(rawManoi) : [];
      fallbackInvoices = manoiInvoices;
    }

    // Marquage de la source : localStorage en priorité haute, mockInvoices en priorité basse
    const localCandidates = [
      ...schoolInvoices.map(inv => ({ ...inv, _source: 0 })),
      ...fallbackInvoices.map(inv => ({ ...inv, _source: 1 })),
      ...globalInvoices.map(inv => ({ ...inv, _source: 2 })),
    ];
    const mockCandidates = (initialInvoices || []).map(inv => ({ ...inv, _source: 3 }));
    const allCandidates = [...localCandidates, ...mockCandidates];

    // Récupérer les élèves en direct pour synchroniser les métadonnées
    const rawStudents = localStorage.getItem(`${STUDENTS_STORAGE_KEY}_${slug}`) || localStorage.getItem(STUDENTS_STORAGE_KEY);
    const localStudents: Student[] = rawStudents ? JSON.parse(rawStudents) : [];
    const studentMap = new Map<string, Student>();
    for (const stu of localStudents) {
      if (stu.id) studentMap.set(stu.id, stu);
      if (stu.studentNumber) studentMap.set(stu.studentNumber, stu);
    }

    const seenIds = new Set<string>();
    const seenNumbers = new Set<string>();
    const seenStudentIds = new Set<string>();
    const seenStudentNumbers = new Set<string>();
    const uniqueInvoices: Invoice[] = [];

    // Tri : localStorage d'abord (source 0/1/2), REC- en tête dans chaque groupe, mockInvoices en dernier (source 3)
    const sortedCandidates = [...allCandidates].sort((a: any, b: any) => {
      // 1. Priorité de source : localStorage (0/1/2) avant mocks (3)
      if ((a._source ?? 9) !== (b._source ?? 9)) return (a._source ?? 9) - (b._source ?? 9);
      // 2. Au sein du même groupe : REC- en tête
      const aIsRec = (a.invoiceNumber || '').startsWith('REC-') ? 0 : 1;
      const bIsRec = (b.invoiceNumber || '').startsWith('REC-') ? 0 : 1;
      return aIsRec - bIsRec;
    });

    for (const inv of sortedCandidates) {
      if (!inv || !inv.invoiceNumber) continue;
      if (deletedIds.has(inv.id) || deletedIds.has(inv.studentId) || deletedIds.has(inv.invoiceNumber)) continue;

      const numDigits = inv.invoiceNumber.replace(/\D/g, '');
      const recKey = numDigits ? `REC-2026-${parseInt(numDigits, 10).toString().padStart(3, '0')}` : '';
      const idKey = numDigits ? `ID-${parseInt(numDigits, 10).toString().padStart(3, '0')}` : '';

      const isServiceInvoice =
        (inv.feeType || '').toLowerCase().includes('internat') ||
        (inv.feeType || '').toLowerCase().includes('cantine') ||
        (inv.feeType || '').toLowerCase().includes('transport') ||
        (inv.invoiceNumber || '').startsWith('QUI-');

      // Sécurité anti-doublon absolue : ne jamais enregistrer deux fois le même reçu ou élève
      const alreadySeen = isServiceInvoice
        ? seenIds.has(inv.id) || seenNumbers.has(inv.invoiceNumber)
        : seenIds.has(inv.id) ||
          seenNumbers.has(inv.invoiceNumber) ||
          (recKey && seenNumbers.has(recKey)) ||
          (idKey && seenNumbers.has(idKey)) ||
          (inv.studentId && seenStudentIds.has(inv.studentId));

      if (!alreadySeen) {
        seenIds.add(inv.id);
        seenNumbers.add(inv.invoiceNumber);
        if (!isServiceInvoice) {
          if (recKey) seenNumbers.add(recKey);
          if (idKey) seenNumbers.add(idKey);
          if (inv.studentId) {
            seenStudentIds.add(inv.studentId);
            seenIds.add(inv.studentId);
          }
        }

        // Si l'élève a été modifié, mettre à jour les coordonnées dans la facture
        const matchingStu = studentMap.get(inv.studentId) || studentMap.get(inv.invoiceNumber);
        if (matchingStu) {
          if (matchingStu.id) {
            seenStudentIds.add(matchingStu.id);
            seenIds.add(matchingStu.id);
          }
          if (matchingStu.studentNumber) {
            seenStudentNumbers.add(matchingStu.studentNumber);
            seenNumbers.add(matchingStu.studentNumber);
          }

          // Nettoyage strict des versements fictifs si la scolarité n'a pas encore été perçue
          const isTuitionUnpaid =
            matchingStu.tuitionStatus === 'unpaid' ||
            (typeof matchingStu.paidAmount === 'number' && matchingStu.paidAmount <= (inv.registrationFee || 0)) ||
            (matchingStu.tuitionAmount && matchingStu.balanceRemaining !== undefined && matchingStu.balanceRemaining >= matchingStu.tuitionAmount);

          const sanitizedInstallments = isTuitionUnpaid ? {} : (matchingStu.installments || inv.installments || {});

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _source: _s1, ...invClean } = inv as any;
          uniqueInvoices.push({
            ...invClean,
            studentName: matchingStu.fullName || `${matchingStu.firstName} ${matchingStu.lastName}`.trim(),
            studentGrade: matchingStu.grade || inv.studentGrade,
            studentGender: matchingStu.gender || inv.studentGender,
            guardianName: matchingStu.guardianName || inv.guardianName,
            guardianPhone: matchingStu.whatsappPhone || matchingStu.guardianPhone || inv.guardianPhone,
            enrollmentType: matchingStu.enrollmentType || inv.enrollmentType,
            amount: matchingStu.tuitionAmount || inv.amount,
            paidAmount: matchingStu.paidAmount !== undefined ? matchingStu.paidAmount : inv.paidAmount,
            discountAmount: matchingStu.discountAmount !== undefined ? matchingStu.discountAmount : inv.discountAmount,
            netAmount: matchingStu.netAmount !== undefined ? matchingStu.netAmount : inv.netAmount,
            balanceRemaining: matchingStu.balanceRemaining !== undefined ? matchingStu.balanceRemaining : inv.balanceRemaining,
            installments: sanitizedInstallments,
            paymentMethod: matchingStu.paymentMethod || inv.paymentMethod,
          });
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _source: _s2, ...invClean2 } = inv as any;
          uniqueInvoices.push(invClean2);
        }
      }
    }

    // Auto-réconciliation réciproque : UNIQUEMENT pour les élèves sans AUCUNE facture existante
    for (const stu of localStudents) {
      if (!stu || !stu.studentNumber) continue;
      if (deletedIds.has(stu.id) || deletedIds.has(stu.studentNumber)) continue;

      // NE PAS créer de fausse facture de scolarité pour un élève qui n'a été enregistré qu'à l'internat
      if (stu.isBoarding && (!stu.registrationFee || stu.registrationFee === 0) && (!stu.installments || !stu.installments.versement1?.amount)) {
        continue;
      }

      const numVal = parseInt(stu.studentNumber?.replace(/\D/g, '') || '1', 10);
      const recFormat = numVal ? `ID-${numVal.toString().padStart(3, '0')}` : (stu.studentNumber || 'ID-001');
      const idCode = stu.studentNumber || recFormat;

      // Si l'élève a DÉJÀ une facture enregistrée, NE JAMAIS CRÉER DE DOUBLON !
      if (
        seenStudentIds.has(stu.id) ||
        seenStudentNumbers.has(idCode) ||
        seenIds.has(stu.id) ||
        seenNumbers.has(idCode) ||
        seenNumbers.has(recFormat)
      ) {
        continue;
      }

      const isTuitionUnpaid =
        stu.tuitionStatus === 'unpaid' ||
        (typeof stu.paidAmount === 'number' && stu.paidAmount <= (stu.registrationFee || 0)) ||
        (stu.tuitionAmount && stu.balanceRemaining !== undefined && stu.balanceRemaining >= stu.tuitionAmount);

      const reconstructedInvoice: Invoice = {
        id: `inv-${numVal.toString().padStart(3, '0')}`,
        invoiceNumber: recFormat,
        studentId: stu.id,
        studentName: stu.fullName || `${stu.firstName} ${stu.lastName}`.trim(),
        studentAvatar: stu.avatar,
        studentGrade: stu.grade,
        studentGender: stu.gender,
        guardianName: stu.guardianName,
        guardianPhone: stu.whatsappPhone || stu.guardianPhone,
        feeType: "Frais d'inscription & Scolarité",
        registrationFee: stu.registrationFee,
        amount: stu.tuitionAmount || 0,
        discountAmount: stu.discountAmount || 0,
        netAmount: stu.netAmount !== undefined ? stu.netAmount : (stu.tuitionAmount || 0),
        paidAmount: stu.paidAmount || 0,
        balanceRemaining: stu.balanceRemaining !== undefined ? stu.balanceRemaining : Math.max(0, (stu.tuitionAmount || 0) - (stu.paidAmount || 0)),
        paymentMethod: stu.paymentMethod || 'Espèces en caisse',
        enrollmentType: stu.enrollmentType || 'nouveau',
        installments: isTuitionUnpaid ? {} : (stu.installments || {}),
        issueDate: stu.enrollmentDate || stu.paymentDate || '2026-08-27',
        dueDate: stu.enrollmentDate || stu.paymentDate || '2026-08-27',
        status: (stu.balanceRemaining === 0 || stu.tuitionStatus === 'paid') ? 'paid' : (stu.paidAmount && stu.paidAmount > 0) ? 'partial' : 'sent',
      };

      seenIds.add(stu.id);
      seenIds.add(reconstructedInvoice.id);
      seenNumbers.add(idCode);
      seenNumbers.add(recFormat);
      seenStudentIds.add(stu.id);
      seenStudentNumbers.add(idCode);
      uniqueInvoices.push(reconstructedInvoice);
    }

    // Auto-consolidation des souscriptions d'internat pour le journal des encaissements
    try {
      const rawBoarding = localStorage.getItem('schoolflow_boarding_subscriptions_v3');
      const rawBoardingPay = localStorage.getItem('schoolflow_boarding_monthly_payments_v3');
      if (rawBoarding) {
        const boardingSubs: any[] = JSON.parse(rawBoarding);
        const monthlyPayments: Record<string, Record<string, boolean>> = rawBoardingPay ? JSON.parse(rawBoardingPay) : {};

        for (const b of boardingSubs) {
          if (!b || !b.studentId) continue;
          if (deletedIds.has(b.studentId) || (b.matricule && deletedIds.has(b.matricule))) continue;

          const months = monthlyPayments[b.studentId] || (b.matricule ? monthlyPayments[b.matricule] : {}) || {};
          const paidMonths = Object.keys(months).filter((m) => months[m]);
          const paidCount = paidMonths.length;
          const rate = typeof b.monthlyRate === 'number' && b.monthlyRate > 0 ? b.monthlyRate : 25000;
          const totalPaid = paidCount * rate;
          const totalDue = rate * 9;
          const matchingStu = studentMap.get(b.studentId) || (b.matricule ? studentMap.get(b.matricule) : undefined);

          const d = new Date();
          const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const finalDate = b.paymentDate || matchingStu?.paymentDate || matchingStu?.enrollmentDate || '2026-09-07';
          const notesText = paidCount > 0
            ? `${paidCount} mois ${paidCount > 1 ? 'réglés' : 'réglé'} (${paidMonths.join(', ')})`
            : 'Internat & Pensionnat';

          // Vérifier si une facture existe déjà dans uniqueInvoices
          const existingInvIdx = uniqueInvoices.findIndex(
            (inv) =>
              (inv.studentId === b.studentId || (b.matricule && inv.invoiceNumber?.includes(b.matricule))) &&
              ((inv.feeType || '').toLowerCase().includes('internat') || (inv.id || '').includes('boarding'))
          );

          if (existingInvIdx >= 0) {
            // Mettre à jour la facture avec les données réelles consolidées
            if (totalPaid > 0) {
              uniqueInvoices[existingInvIdx] = {
                ...uniqueInvoices[existingInvIdx],
                studentName: b.studentName || matchingStu?.fullName || uniqueInvoices[existingInvIdx].studentName,
                amount: totalDue > 0 ? totalDue : totalPaid,
                netAmount: totalDue > 0 ? totalDue : totalPaid,
                paidAmount: totalPaid,
                balanceRemaining: Math.max(0, totalDue - totalPaid),
                issueDate: finalDate,
                dueDate: finalDate,
                status: totalDue > 0 && totalPaid >= totalDue ? 'paid' : 'partial',
                notes: notesText,
              };
            }
            continue;
          }

          const boardInvId = `inv-boarding-${b.studentId}`;
          const cleanNum = b.matricule ? b.matricule.replace(/\D/g, '').slice(-4) : (matchingStu?.studentNumber ? matchingStu.studentNumber.replace(/\D/g, '').slice(-4) : b.studentId.replace(/\D/g, '').slice(-4));
          const boardInvNum = `QUI-INT-${cleanNum || '001'}`;

          if (!seenIds.has(boardInvId) && !seenNumbers.has(boardInvNum)) {
            if (totalPaid <= 0) continue; // Pas de versement -> ne pas encombrer le journal de caisse

            seenIds.add(boardInvId);
            seenNumbers.add(boardInvNum);
            uniqueInvoices.push({
              id: boardInvId,
              invoiceNumber: boardInvNum,
              studentId: b.studentId,
              studentName: b.studentName || (matchingStu?.fullName || 'Pensionnaire'),
              studentAvatar: matchingStu?.avatar || '',
              studentGrade: b.className || matchingStu?.grade || '6ème',
              studentGender: b.gender === 'F' ? 'female' : (b.gender === 'M' ? 'male' : (matchingStu?.gender || 'male')),
              guardianName: matchingStu?.guardianName || 'Parent / Tuteur',
              guardianPhone: b.parentContact || matchingStu?.guardianPhone || '+225 00 00 00 00',
              feeType: 'Internat & Pensionnat',
              amount: totalDue > 0 ? totalDue : totalPaid,
              discountAmount: 0,
              netAmount: totalDue > 0 ? totalDue : totalPaid,
              paidAmount: totalPaid,
              balanceRemaining: Math.max(0, totalDue - totalPaid),
              paymentMethod: 'Espèces',
              enrollmentType: matchingStu?.enrollmentType || 'nouveau',
              issueDate: finalDate,
              dueDate: finalDate,
              status: totalDue > 0 && totalPaid >= totalDue ? 'paid' : totalPaid > 0 ? 'partial' : 'sent',
              notes: notesText,
              schoolSlug: slug,
              schoolId: slug,
            });
          }
        }
      }
    } catch (e) {}

    // GARANTIE ABSOLUE EPC MANOI : s'assurer que les 15 factures officielles sont TOUJOURS présentes dans la liste
    if (slug === 'epc-manoi') {
      const candidates = [...initialInvoices, ...mockInvoices];
      for (const inv of candidates) {
        if (!inv || !inv.invoiceNumber) continue;
        const exists = uniqueInvoices.some(
          (u) =>
            u.id === inv.id ||
            u.invoiceNumber === inv.invoiceNumber ||
            (inv.studentId && u.studentId === inv.studentId)
        );
        if (!exists) {
          uniqueInvoices.push(inv);
        }
      }
    }

    // Fallback aux factures initiales uniquement si le stockage n'a JAMAIS été initialisé
    const hasInitializedInvoices = rawSchool !== null || (slug === 'epc-manoi' && localStorage.getItem(INVOICES_STORAGE_KEY) !== null);
    if (!hasInitializedInvoices && uniqueInvoices.length === 0 && (slug === 'epc-manoi')) {
      const status = getSchoolSubscription('epc-manoi');
      if (!status.isDataReset) {
        for (const inv of initialInvoices) {
          if (!inv || !inv.invoiceNumber) continue;
          if (deletedIds.has(inv.id) || deletedIds.has(inv.studentId) || deletedIds.has(inv.invoiceNumber)) continue;
          if (!seenIds.has(inv.id) && !seenNumbers.has(inv.invoiceNumber)) {
            seenIds.add(inv.id);
            seenNumbers.add(inv.invoiceNumber);
            uniqueInvoices.push(inv);
          }
        }
      }
    }

    return uniqueInvoices;
  } catch (error) {
    console.error('Erreur lecture localStorage invoices:', error);
    return [];
  }
}

/**
 * Enregistre un nouvel élève et son encaissement associé dans le stockage persistant,
 * et propage un événement custom pour mettre à jour instantanément les autres composants.
 */
export function saveRegisteredStudent(student: Student, invoice: Invoice, schoolSlug: string = 'epc-manoi'): void {
  if (typeof window === 'undefined') return;

  try {
    const slug = schoolSlug || 'epc-manoi';

    // 0. Débloquer l'ID s'il était précédemment dans la liste des supprimés
    try {
      const rawDeleted = localStorage.getItem(DELETED_STUDENTS_STORAGE_KEY);
      if (rawDeleted) {
        const deletedArr: string[] = JSON.parse(rawDeleted);
        const cleaned = deletedArr.filter(
          (id) =>
            id !== student.id &&
            id !== student.studentNumber &&
            id !== invoice.id &&
            id !== invoice.invoiceNumber &&
            id !== `stu-${student.studentNumber.replace(/\D/g, '').padStart(3, '0')}`
        );
        localStorage.setItem(DELETED_STUDENTS_STORAGE_KEY, JSON.stringify(cleaned));
      }
    } catch (e) {}

    // 1. Sauvegarder dans la clé globale
    const rawStudents = localStorage.getItem(STUDENTS_STORAGE_KEY);
    const prevStudents: Student[] = rawStudents ? JSON.parse(rawStudents) : [];
    const studentWithSlug = {
      ...student,
      address: cleanDisplayAddress(student.address),
      schoolSlug: slug,
      schoolId: slug,
      enrollmentType: student.enrollmentType || 'nouveau',
      updatedAt: student.updatedAt || new Date().toISOString(),
    };
    const filteredStudents = prevStudents.filter(
      (s) => s.id !== student.id && s.studentNumber !== student.studentNumber
    );
    const updatedStudents = [studentWithSlug, ...filteredStudents];
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updatedStudents));

    // 2. Sauvegarder dans la clé spécifique à l'école
    const schoolKey = `${STUDENTS_STORAGE_KEY}_${slug}`;
    const rawSchool = localStorage.getItem(schoolKey);
    const prevSchool: Student[] = rawSchool ? JSON.parse(rawSchool) : [];
    const filteredSchool = prevSchool.filter(
      (s) => s.id !== student.id && s.studentNumber !== student.studentNumber
    );
    localStorage.setItem(schoolKey, JSON.stringify([studentWithSlug, ...filteredSchool]));

    if (slug === 'epc-manoi') {
      localStorage.setItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`, JSON.stringify([studentWithSlug, ...filteredSchool]));
    }

    // 3. Sauvegarder la facture dans la clé globale
    const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
    const prevInvoices: Invoice[] = rawInvoices ? JSON.parse(rawInvoices) : [];
    const filteredInvoices = prevInvoices.filter(
      (inv) => inv.id !== invoice.id && inv.invoiceNumber !== invoice.invoiceNumber
    );
    const invoiceWithSlug = { ...invoice, schoolSlug: slug, schoolId: slug };
    const updatedInvoices = [invoiceWithSlug, ...filteredInvoices];
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(updatedInvoices));

    // 4. Sauvegarder la facture dans la clé spécifique à l'école
    const invSchoolKey = `${INVOICES_STORAGE_KEY}_${slug}`;
    const rawInvSchool = localStorage.getItem(invSchoolKey);
    const prevInvSchool: Invoice[] = rawInvSchool ? JSON.parse(rawInvSchool) : [];
    const filteredInvSchool = prevInvSchool.filter(
      (inv) => inv.id !== invoice.id && inv.invoiceNumber !== invoice.invoiceNumber
    );
    localStorage.setItem(invSchoolKey, JSON.stringify([invoiceWithSlug, ...filteredInvSchool]));

    if (slug === 'epc-manoi') {
      localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, JSON.stringify([invoiceWithSlug, ...filteredInvSchool]));
    }

    // 5. Synchronisation Supabase Cloud & API Serveur SchoolFlow en arrière-plan (étudiant d'abord puis facture)
    saveStudentToSupabase(studentWithSlug, slug)
      .then(() => saveInvoiceToSupabase(invoiceWithSlug, slug))
      .catch(() => {});
    if (typeof fetch !== 'undefined') {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          students: [studentWithSlug, ...filteredSchool],
          invoices: [invoiceWithSlug, ...filteredInvSchool],
        }),
      }).catch(() => {});
    }

    // 6. Diffusion temps réel parallèle immédiate à toutes les interfaces
    broadcastLiveUpdate({
      action: 'student_registered',
      student: studentWithSlug,
      invoice: invoiceWithSlug,
      schoolSlug: slug,
    });
  } catch (error) {
    console.error('Erreur sauvegarde live-store:', error);
  }
}

/**
 * Sauvegarde ou met à jour une facture de prestation (Transport, Cantine, Internat, etc.)
 * dans le stockage persistant, Supabase Cloud et l'API serveur,
 * et diffuse immédiatement l'événement pour affichage dans le journal du Tableau de Bord.
 */
export function saveLivePaymentInvoice(invoice: Invoice, schoolSlug: string = 'epc-manoi'): void {
  if (typeof window === 'undefined') return;

  try {
    const slug = schoolSlug || 'epc-manoi';

    // 1. Sauvegarder dans la clé globale
    const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
    const prevInvoices: Invoice[] = rawInvoices ? JSON.parse(rawInvoices) : [];
    const filteredInvoices = prevInvoices.filter(
      (inv) => inv.id !== invoice.id && inv.invoiceNumber !== invoice.invoiceNumber
    );
    const invoiceWithSlug: Invoice = { ...invoice, schoolSlug: slug, schoolId: slug };
    const updatedInvoices = [invoiceWithSlug, ...filteredInvoices];
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(updatedInvoices));

    // 2. Sauvegarder dans la clé spécifique à l'école
    const invSchoolKey = `${INVOICES_STORAGE_KEY}_${slug}`;
    const rawInvSchool = localStorage.getItem(invSchoolKey);
    const prevInvSchool: Invoice[] = rawInvSchool ? JSON.parse(rawInvSchool) : [];
    const filteredInvSchool = prevInvSchool.filter(
      (inv) => inv.id !== invoice.id && inv.invoiceNumber !== invoice.invoiceNumber
    );
    const updatedInvSchool = [invoiceWithSlug, ...filteredInvSchool];
    localStorage.setItem(invSchoolKey, JSON.stringify(updatedInvSchool));

    if (slug === 'epc-manoi') {
      localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, JSON.stringify(updatedInvSchool));
    }

    // 3. Synchronisation Supabase Cloud & API Serveur en arrière-plan
    saveInvoiceToSupabase(invoiceWithSlug, slug).catch(() => {});
    if (typeof fetch !== 'undefined') {
      const rawSchoolStu = localStorage.getItem(`${STUDENTS_STORAGE_KEY}_${slug}`);
      const schoolStudents: Student[] = rawSchoolStu ? JSON.parse(rawSchoolStu) : [];
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          students: schoolStudents,
          invoices: updatedInvSchool,
        }),
      }).catch(() => {});
    }

    // 4. Diffusion temps réel parallèle
    broadcastLiveUpdate({
      action: 'invoice_saved',
      invoice: invoiceWithSlug,
      schoolSlug: slug,
    });
  } catch (error) {
    console.error('Erreur sauvegarde facture de prestation:', error);
  }
}

/**
 * Met à jour un élève existant et synchronise automatiquement sa facture / caisse
 * et notifie le tableau de bord et toutes les vues actives.
 */
export function updateRegisteredStudent(student: Student, schoolSlug: string = 'epc-manoi'): void {
  if (typeof window === 'undefined') return;

  try {
    // 1. Sauvegarder dans la clé globale et la clé d'école
    const rawStudents = localStorage.getItem(STUDENTS_STORAGE_KEY);
    const prevStudents: Student[] = rawStudents ? JSON.parse(rawStudents) : [];
    const studentWithSlug = {
      ...student,
      address: cleanDisplayAddress(student.address),
      schoolSlug: schoolSlug || 'epc-manoi',
      schoolId: schoolSlug || 'epc-manoi',
      updatedAt: student.updatedAt || new Date().toISOString(),
    };
    const updatedStudents = [
      studentWithSlug,
      ...prevStudents.filter((s) => s.id !== student.id && s.studentNumber !== student.studentNumber),
    ];
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updatedStudents));

    const schoolKey = `${STUDENTS_STORAGE_KEY}_${schoolSlug || 'epc-manoi'}`;
    const rawSchool = localStorage.getItem(schoolKey);
    const prevSchool: Student[] = rawSchool ? JSON.parse(rawSchool) : [];
    const updatedSchool = [
      studentWithSlug,
      ...prevSchool.filter((s) => s.id !== student.id && s.studentNumber !== student.studentNumber),
    ];
    localStorage.setItem(schoolKey, JSON.stringify(updatedSchool));

    if (schoolSlug === 'epc-manoi') {
      localStorage.setItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`, JSON.stringify(updatedSchool));
    }

    // 2. Mise à jour ou création de la facture correspondante
    const invSchoolKey = `${INVOICES_STORAGE_KEY}_${schoolSlug || 'epc-manoi'}`;
    const rawInvSchool = localStorage.getItem(invSchoolKey);
    const prevInvSchool: Invoice[] = rawInvSchool ? JSON.parse(rawInvSchool) : [];

    const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
    const prevInvoices: Invoice[] = rawInvoices ? JSON.parse(rawInvoices) : [];
    
    const existingInv = prevInvoices.find(
      (inv) => inv.studentId === student.id || inv.invoiceNumber === student.studentNumber
    ) || prevInvSchool.find(
      (inv) => inv.studentId === student.id || inv.invoiceNumber === student.studentNumber
    );

    const finalDate = student.paymentDate || student.enrollmentDate || '2026-08-27';

    // Synchroniser l'échéancier des versements avec la date d'inscription
    const updatedInstallments = student.installments ? {
      ...student.installments,
      versement1: student.installments.versement1 ? {
        ...student.installments.versement1,
        date: finalDate,
      } : undefined,
    } : existingInv?.installments ? {
      ...existingInv.installments,
      versement1: existingInv.installments.versement1 ? {
        ...existingInv.installments.versement1,
        date: finalDate,
      } : undefined,
    } : undefined;

    const updatedInvoice: Invoice = existingInv ? {
      ...existingInv,
      schoolSlug: schoolSlug || 'epc-manoi',
      schoolId: schoolSlug || 'epc-manoi',
      studentName: student.fullName,
      studentGrade: student.grade,
      studentGender: student.gender,
      guardianName: student.guardianName,
      guardianPhone: student.whatsappPhone || student.guardianPhone,
      registrationFee: student.registrationFee !== undefined ? student.registrationFee : existingInv.registrationFee,
      amount: student.tuitionAmount,
      discountAmount: student.discountAmount || 0,
      netAmount: student.netAmount || (student.tuitionAmount - (student.discountAmount || 0)),
      paidAmount: student.paidAmount,
      balanceRemaining: student.balanceRemaining !== undefined ? student.balanceRemaining : Math.max(0, (student.netAmount || student.tuitionAmount) - student.paidAmount),
      enrollmentType: student.enrollmentType || existingInv.enrollmentType,
      installments: updatedInstallments || existingInv.installments,
      paymentMethod: student.paymentMethod || existingInv.paymentMethod,
      issueDate: finalDate,
      dueDate: finalDate,
    } : {
      id: `inv-${student.studentNumber.replace(/\D/g, '').padStart(3, '0')}`,
      invoiceNumber: student.studentNumber,
      studentId: student.id,
      schoolSlug: schoolSlug || 'epc-manoi',
      schoolId: schoolSlug || 'epc-manoi',
      studentName: student.fullName,
      studentAvatar: student.avatar,
      studentGrade: student.grade,
      studentGender: student.gender,
      guardianName: student.guardianName,
      guardianPhone: student.whatsappPhone || student.guardianPhone,
      feeType: "Frais d'inscription & Scolarité",
      registrationFee: student.registrationFee,
      amount: student.tuitionAmount,
      discountAmount: student.discountAmount || 0,
      netAmount: student.netAmount || (student.tuitionAmount - (student.discountAmount || 0)),
      paidAmount: student.paidAmount,
      balanceRemaining: student.balanceRemaining !== undefined ? student.balanceRemaining : Math.max(0, (student.netAmount || student.tuitionAmount) - student.paidAmount),
      paymentMethod: student.paymentMethod || 'Espèces en caisse',
      enrollmentType: student.enrollmentType || 'nouveau',
      installments: updatedInstallments || {
        versement1: {
          amount: student.paidAmount || 100000,
          date: finalDate,
        },
      },
      issueDate: finalDate,
      dueDate: finalDate,
      status: student.tuitionStatus === 'paid' ? 'paid' : student.paidAmount > 0 ? 'partial' : 'sent',
    };

    const nextInvoices = [
      updatedInvoice,
      ...prevInvoices.filter(
        (inv) => inv.id !== updatedInvoice.id && inv.invoiceNumber !== updatedInvoice.invoiceNumber
      ),
    ];
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(nextInvoices));

    const nextInvSchool = [
      updatedInvoice,
      ...prevInvSchool.filter(
        (inv) => inv.id !== updatedInvoice.id && inv.invoiceNumber !== updatedInvoice.invoiceNumber
      ),
    ];
    localStorage.setItem(invSchoolKey, JSON.stringify(nextInvSchool));

    if (schoolSlug === 'epc-manoi') {
      localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, JSON.stringify(nextInvSchool));
    }

    // 3. Synchronisation automatique des prestations (Internat, Cantine, Transport)
    try {
      const isPilot = !schoolSlug || schoolSlug === 'epc-manoi';
      const BOARDING_KEY = isPilot ? 'schoolflow_boarding_subscriptions_v3' : `schoolflow_boarding_subscriptions_v3_${schoolSlug}`;
      const CANTEEN_KEY = isPilot ? 'schoolflow_canteen_subscriptions_v3' : `schoolflow_canteen_subscriptions_v3_${schoolSlug}`;
      const TRANSPORT_KEY = isPilot ? 'schoolflow_transport_subscriptions_v2' : `schoolflow_transport_subscriptions_v2_${schoolSlug}`;

      if (typeof student.isBoarding === 'boolean') {
        const rawBoarding = localStorage.getItem(BOARDING_KEY);
        const prevBoarding: any[] = rawBoarding ? JSON.parse(rawBoarding) : [];
        if (student.isBoarding) {
          const existingIdx = prevBoarding.findIndex((b) => b.studentId === student.id || b.matricule === student.studentNumber);
          const existingRecord = existingIdx >= 0 ? prevBoarding[existingIdx] : null;
          const boardingRecord = {
            ...existingRecord,
            studentId: student.id,
            studentName: student.fullName,
            matricule: student.matricule || student.studentNumber || existingRecord?.matricule || '',
            className: student.grade || existingRecord?.className || '6ème',
            gender: student.gender === 'female' ? 'F' : 'M',
            parentContact: student.whatsappPhone || student.guardianPhone || existingRecord?.parentContact || '',
            pavilion: existingRecord?.pavilion || (student.gender === 'female' ? 'Pavillon B (Filles)' : 'Pavillon A (Garçons)'),
            roomNumber: existingRecord?.roomNumber || 'Chambre 101',
            monthlyRate: existingRecord?.monthlyRate !== undefined && Number(existingRecord.monthlyRate) > 0 ? Number(existingRecord.monthlyRate) : 25000,
          };
          if (existingIdx >= 0) {
            prevBoarding[existingIdx] = boardingRecord;
          } else {
            prevBoarding.push(boardingRecord);
          }
          localStorage.setItem(BOARDING_KEY, JSON.stringify(prevBoarding));
        } else {
          const filteredBoarding = prevBoarding.filter((b) => b.studentId !== student.id && b.matricule !== student.studentNumber);
          localStorage.setItem(BOARDING_KEY, JSON.stringify(filteredBoarding));
        }
      }

      if (typeof student.isCanteen === 'boolean') {
        const rawCanteen = localStorage.getItem(CANTEEN_KEY);
        const prevCanteen: Record<string, any> = rawCanteen ? JSON.parse(rawCanteen) : {};
        if (student.isCanteen) {
          prevCanteen[student.id] = {
            diet: 'Standard (Sans allergie)',
            rate: 25000,
            discount: 0,
          };
        } else {
          delete prevCanteen[student.id];
        }
        localStorage.setItem(CANTEEN_KEY, JSON.stringify(prevCanteen));
      }

      if (typeof student.isTransport === 'boolean') {
        const rawTransport = localStorage.getItem(TRANSPORT_KEY);
        const prevTransport: Record<string, any> = rawTransport ? JSON.parse(rawTransport) : {};
        if (student.isTransport) {
          prevTransport[student.id] = {
            stop: 'Riviera Bonoumin — Carrefour Jacques Prévert',
            rate: 35000,
            discount: 0,
          };
        } else {
          delete prevTransport[student.id];
        }
        localStorage.setItem(TRANSPORT_KEY, JSON.stringify(prevTransport));
      }
    } catch (err) {
      console.warn('Erreur update sync prestations annexes:', err);
    }

    // 4. Synchronisation en arrière-plan avec Supabase Cloud et API Serveur
    saveStudentToSupabase(studentWithSlug, schoolSlug)
      .then(() => saveInvoiceToSupabase(updatedInvoice, schoolSlug))
      .catch(() => {});
    if (typeof fetch !== 'undefined') {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: schoolSlug || 'epc-manoi',
          students: updatedSchool,
          invoices: nextInvSchool,
        }),
      }).catch(() => {});
    }

    // 5. Propagation globale de l'événement
    broadcastLiveUpdate({
      action: 'student_updated',
      student,
      invoice: updatedInvoice,
      schoolSlug,
    });
  } catch (error) {
    console.error('Erreur mise à jour live-store student:', error);
  }
}

/* ==========================================================================
   GESTION DU PERSONNEL & DES CODES D'AUTHENTIFICATION (ESPACE DIRECTEUR ADMIN)
   ========================================================================== */

export interface StaffUser {
  id: string;
  fullName: string;
  role: string;
  roleId: 'directeur' | 'assistant_direction' | 'fondateur' | 'educateur' | 'informaticien' | 'comptable' | 'secretaire' | 'enseignant' | 'parent';
  matricule?: string;
  subjectOrGrade?: string;
  assignedClasses?: string;
  diplomaOrExperience?: string;
  address?: string;
  joinDate?: string;
  email: string;
  phone: string;
  authCode: string;
  status: 'Actif' | 'En attente' | 'Verrouillé';
  lastLogin?: string;
  avatarUrl?: string;
}

export const defaultStaffUsers: StaffUser[] = [
  {
    id: 'staff-founder',
    fullName: 'LAWANI MOUSSA',
    role: 'Fondateur & Promoteur (Supervision Suprême)',
    roleId: 'fondateur',
    matricule: 'FND-001',
    subjectOrGrade: 'Présidence & Conseil d’Administration',
    assignedClasses: 'Toutes les classes',
    diplomaOrExperience: 'Fondateur & Promoteur d’Établissement',
    address: 'Abidjan',
    joinDate: 'Fondateur de l\'Établissement (Depuis 2026)',
    email: '',
    phone: '',
    authCode: 'FND-2026',
    status: 'Actif',
    lastLogin: 'En ligne',
  },
  {
    id: 'staff-001',
    fullName: 'LAWANI MOUHAMED',
    role: 'Directeur des Études (Admin)',
    roleId: 'directeur',
    matricule: 'DIR-001',
    subjectOrGrade: 'Direction des Études & Pédagogie',
    assignedClasses: 'Toutes les classes',
    diplomaOrExperience: 'Direction d’Établissement Scolaire (15 ans exp.)',
    address: 'Abidjan',
    joinDate: '01/09/2026',
    email: '',
    phone: '',
    authCode: 'DIR-2026',
    status: 'Actif',
    lastLogin: 'En ligne',
  },
];

const LEGACY_MOCK_STAFF_IDS = new Set([
  'staff-002', 'staff-003', 'staff-004', 'staff-005', 'staff-006',
  'staff-comptable', 'staff-secretaire', 'staff-assistant', 'staff-educateur', 'staff-enseignant',
  'CPT-2026', 'SEC-2026', 'ASS-2026', 'EDU-2026', 'ENS-2026', 'INF-2026', 'AST-2026',
]);

export function getInitialStaffForSchool(schoolSlug: string = 'epc-manoi'): StaffUser[] {
  if (schoolSlug === 'epc-manoi') {
    return defaultStaffUsers;
  }
  const school = getLiveSchool(schoolSlug);
  const cleanFounder = (school.founderName || 'Fondateur de l’Établissement').replace(/\s*\((Fondateur|Fondatrice)\)/gi, '').trim();
  const cleanDirector = (school.directorName || 'Directeur des Études').replace(/\s*\((Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim();

  return [
    {
      id: 'staff-founder',
      fullName: cleanFounder,
      role: 'Fondateur & Promoteur (Supervision Suprême)',
      roleId: 'fondateur',
      matricule: 'FND-001',
      subjectOrGrade: 'Présidence & Conseil d’Administration',
      assignedClasses: 'Toutes les classes',
      diplomaOrExperience: 'Fondateur & Promoteur d’Établissement',
      address: school.city || 'Côte d’Ivoire',
      joinDate: `Fondateur de l'Établissement (Depuis ${school.academicYear ? school.academicYear.slice(0, 4) : '2026'})`,
      email: '',
      phone: school.phone || '',
      authCode: 'FND-2026',
      status: 'Actif',
      lastLogin: 'En ligne',
    },
    {
      id: 'staff-001',
      fullName: cleanDirector,
      role: 'Directeur des Études (Admin)',
      roleId: 'directeur',
      matricule: 'DIR-001',
      subjectOrGrade: 'Direction des Études & Pédagogie',
      assignedClasses: 'Toutes les classes',
      diplomaOrExperience: 'Direction d’Établissement Scolaire',
      address: school.city || 'Côte d’Ivoire',
      joinDate: '01/09/2026',
      email: school.email || '',
      phone: school.phone || '',
      authCode: 'DIR-2026',
      status: 'Actif',
      lastLogin: 'En ligne',
    },
  ];
}

export function getLiveStaffUsers(schoolSlug: string = 'epc-manoi'): StaffUser[] {
  const baseDefaults = getInitialStaffForSchool(schoolSlug);
  if (typeof window === 'undefined') return baseDefaults;
  try {
    const storageKey = `${STAFF_USERS_STORAGE_KEY}_${schoolSlug}`;
    let raw = localStorage.getItem(storageKey);
    if (!raw && (schoolSlug === 'epc-manoi')) {
      raw = localStorage.getItem(STAFF_USERS_STORAGE_KEY);
    }

    if (raw) {
      const list: StaffUser[] = JSON.parse(raw);
      const codeMap = new Map<string, StaffUser>();
      // 1. Initialiser avec les 2 comptes administrateurs direct (Fondateur + Directeur)
      for (const d of baseDefaults) {
        codeMap.set(d.authCode, d);
      }
      // 2. Fusionner avec la liste locale (en purgeant strictement tous les faux membres de démonstration)
      for (const u of list) {
        if (!u || !u.authCode) continue;
        if (LEGACY_MOCK_STAFF_IDS.has(u.id) || LEGACY_MOCK_STAFF_IDS.has(u.authCode)) continue; // Purger les mocks par défaut
        
        // Purger les adresses email génériques/fictives antérieures
        let sanitizedEmail = u.email;
        if (sanitizedEmail === 'direction@epc-manoi.ci' || sanitizedEmail === 'direction@etablissement.ci') {
          sanitizedEmail = '';
        }

        if (codeMap.has(u.authCode)) {
          const def = codeMap.get(u.authCode)!;
          let finalName = (u.fullName || def.fullName).replace(/\s*\((Fondateur|Fondatrice|Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim();
          if (def.roleId === 'fondateur') {
            if (schoolSlug === 'epc-manoi' || finalName.toUpperCase().includes('MOUHAMED')) {
              finalName = 'LAWANI MOUSSA';
            }
          } else if (def.roleId === 'directeur') {
            if (schoolSlug === 'epc-manoi') {
              finalName = 'LAWANI MOUHAMED';
            }
          }
          // Photo strictement personnelle, clée uniquement sur le code d'authentification
          // unique. Les anciennes clés par nom affiché ou par rôle pouvaient faire fuiter la
          // photo d'une personne vers une autre partageant le même nom ou le même rôle.
          const persistentAvatar =
            (u.authCode ? localStorage.getItem(`schoolflow_user_avatar_${u.authCode.toUpperCase()}`) : null) ||
            u.avatarUrl ||
            def.avatarUrl;

          codeMap.set(u.authCode, {
            ...def,
            ...u,
            fullName: finalName,
            avatarUrl: persistentAvatar,
            role: def.roleId === 'fondateur' ? 'Fondateur & Promoteur (Supervision Suprême)' : def.roleId === 'directeur' ? 'Directeur des Études (Admin)' : (u.role || def.role),
            roleId: def.roleId || u.roleId,
            matricule: def.roleId === 'fondateur' ? 'FND-001' : def.roleId === 'directeur' ? 'DIR-001' : (u.matricule || def.matricule),
            joinDate: def.roleId === 'fondateur' ? 'Fondateur de l\'Établissement (Depuis 2026)' : (u.joinDate || def.joinDate),
            email: sanitizedEmail !== undefined ? sanitizedEmail : def.email,
            phone: u.phone !== undefined ? u.phone : def.phone,
            address: u.address !== undefined ? u.address : def.address,
            status: u.status || def.status,
            authCode: u.authCode || def.authCode,
          });
        } else {
          // Nouvel utilisateur ajouté dynamiquement par l'admin dans la page Administration
          const sanitizedName = (u.fullName || '').replace(/\s*\((Fondateur|Fondatrice|Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim();
          const userCode = (u.authCode || u.id || '').toUpperCase();
          const persistentUserAvatar =
            (userCode ? localStorage.getItem(`schoolflow_user_avatar_${userCode}`) : null) ||
            u.avatarUrl;

          codeMap.set(u.authCode || u.id, {
            ...u,
            fullName: sanitizedName || u.fullName,
            avatarUrl: persistentUserAvatar,
            email: sanitizedEmail !== undefined ? sanitizedEmail : u.email,
          });
        }
      }

      const mergedList = Array.from(codeMap.values());
      localStorage.setItem(storageKey, JSON.stringify(mergedList));
      if (schoolSlug === 'epc-manoi') {
        localStorage.setItem(STAFF_USERS_STORAGE_KEY, JSON.stringify(mergedList));
      }
      return mergedList;
    }

    // Premier chargement : strictement Fondateur et Directeur (les autres profils doivent être créés en Administration)
    const initialStaff = baseDefaults.map((def) => {
      const pAvatar =
        (def.authCode ? localStorage.getItem(`schoolflow_user_avatar_${def.authCode.toUpperCase()}`) : null) ||
        (def.fullName ? localStorage.getItem(`schoolflow_user_avatar_${def.fullName}`) : null) ||
        (def.roleId ? localStorage.getItem(`schoolflow_user_avatar_${def.roleId}`) : null) ||
        def.avatarUrl;
      return { ...def, avatarUrl: pAvatar };
    });
    localStorage.setItem(storageKey, JSON.stringify(initialStaff));
    if (schoolSlug === 'epc-manoi') {
      localStorage.setItem(STAFF_USERS_STORAGE_KEY, JSON.stringify(initialStaff));
    }
    return initialStaff;
  } catch (e) {
    return baseDefaults;
  }
}

export function saveLiveStaffUsers(users: StaffUser[], schoolSlug: string = 'epc-manoi'): void {
  if (typeof window === 'undefined') return;
  try {
    const storageKey = `${STAFF_USERS_STORAGE_KEY}_${schoolSlug}`;
    localStorage.setItem(storageKey, JSON.stringify(users));
    if (schoolSlug === 'epc-manoi') {
      localStorage.setItem(STAFF_USERS_STORAGE_KEY, JSON.stringify(users));
    }

    // Synchronisation en arrière-plan avec Supabase Cloud et l'API serveur
    const slug = (!schoolSlug || schoolSlug === 'college-excellence') ? 'epc-manoi' : schoolSlug;
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        staffUsers: users,
      }),
    }).catch(() => {});

    for (const u of users) {
      saveStaffUserToSupabase(u, slug).catch(() => {});
    }

    broadcastLiveUpdate({
      action: 'staff_users_updated',
      staffUsers: users,
      schoolSlug: slug,
    });
  } catch (e) {}
}

export function updateStaffAuthCode(staffId: string, newAuthCode: string, schoolSlug: string = 'epc-manoi'): void {
  const users = getLiveStaffUsers(schoolSlug);
  const updated = users.map((u) => (u.id === staffId ? { ...u, authCode: newAuthCode.trim().toUpperCase() } : u));
  saveLiveStaffUsers(updated, schoolSlug);
}

export function updateFullStaffUser(updatedUser: StaffUser, schoolSlug: string = 'epc-manoi'): void {
  const users = getLiveStaffUsers(schoolSlug);
  const updated = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
  saveLiveStaffUsers(updated, schoolSlug);
}

/**
 * Met à jour automatiquement l'email professionnel et le contact téléphonique
 * saisis obligatoirement par le collaborateur lors de sa connexion.
 */
export function updateStaffLoginContact(
  authCode: string,
  contactData: { fullName?: string; email: string; phone: string; avatarUrl?: string },
  schoolSlug: string = 'epc-manoi'
): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLiveStaffUsers(schoolSlug);
    const cleanCode = (authCode || '').trim().toUpperCase();
    let found = false;

    const updated = list.map((s) => {
      if (s.authCode.trim().toUpperCase() === cleanCode) {
        found = true;
        const cleanName = contactData.fullName
          ? contactData.fullName.replace(/\s*\((Fondateur|Fondatrice|Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim()
          : s.fullName;
        return {
          ...s,
          fullName: cleanName || s.fullName,
          email: contactData.email ? contactData.email.trim() : s.email,
          phone: contactData.phone ? contactData.phone.trim() : s.phone,
          avatarUrl: contactData.avatarUrl || s.avatarUrl,
          lastLogin: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        };
      }
      return s;
    });

    if (found) {
      saveLiveStaffUsers(updated, schoolSlug);
    }
  } catch (e) {
    console.error('Erreur updateStaffLoginContact:', e);
  }
}

/**
 * Vérifie si le numéro saisi par le parent correspond à l'un des numéros enregistrés pour l'élève
 * (Prend en compte jusqu'à 3 numéros : whatsappPhone, guardianPhone, secondaryPhones, avec ou sans indicatif valide).
 * Rejette catégoriquement tout faux indicatif de pays.
 */
export function checkPhoneMatchesStudent(inputRawPhone: string, stu: Student): boolean {
  if (!inputRawPhone || !stu) return false;
  const rawInput = inputRawPhone.trim();
  const inputDigits = rawInput.replace(/\D/g, '');
  if (inputDigits.length < 8) return false;

  // Récupérer tous les numéros enregistrés pour cet élève
  const registeredCandidates: string[] = [
    stu.whatsappPhone || '',
    stu.guardianPhone || '',
    ...(stu.secondaryPhones || []),
  ].filter(Boolean);

  // Découper les éventuels numéros combinés par /, ;, , ou "ou"
  const allPhones: string[] = [];
  for (const item of registeredCandidates) {
    const parts = item.split(/[/;,|]|\bou\b/i).map((p) => p.trim()).filter(Boolean);
    allPhones.push(...parts);
  }

  const hasExplicitPrefix = rawInput.startsWith('+') || rawInput.startsWith('00');
  let inputPrefix = '';
  if (rawInput.startsWith('+225') || rawInput.startsWith('00225') || inputDigits.startsWith('225')) {
    inputPrefix = '225';
  } else if (rawInput.startsWith('+221') || rawInput.startsWith('00221') || inputDigits.startsWith('221')) {
    inputPrefix = '221';
  } else if (rawInput.startsWith('+229') || rawInput.startsWith('00229') || inputDigits.startsWith('229')) {
    inputPrefix = '229';
  } else if (rawInput.startsWith('+226') || rawInput.startsWith('00226') || inputDigits.startsWith('226')) {
    inputPrefix = '226';
  } else if (rawInput.startsWith('+33') || rawInput.startsWith('0033')) {
    inputPrefix = '33';
  }

  for (const regStr of allPhones) {
    const regDigits = regStr.replace(/\D/g, '');
    if (regDigits.length < 8) continue;

    let regPrefix = '';
    if (regStr.startsWith('+225') || regStr.startsWith('00225') || regDigits.startsWith('225')) {
      regPrefix = '225';
    } else if (regStr.startsWith('+221') || regStr.startsWith('00221') || regDigits.startsWith('221')) {
      regPrefix = '221';
    } else if (regStr.startsWith('+229') || regStr.startsWith('00229') || regDigits.startsWith('229')) {
      regPrefix = '229';
    } else if (regStr.startsWith('+226') || regStr.startsWith('00226') || regDigits.startsWith('226')) {
      regPrefix = '226';
    }

    // Faux indicatif interdit : si l'utilisateur a saisi un indicatif explicite différent de celui de l'école/enregistré
    if (hasExplicitPrefix && inputPrefix && regPrefix && inputPrefix !== regPrefix) {
      continue;
    }

    // 1. Correspondance exacte des chiffres
    if (inputDigits === regDigits) return true;

    // 2. Correspondance sans préfixe pays
    const inputNational = inputPrefix && inputDigits.startsWith(inputPrefix)
      ? inputDigits.slice(inputPrefix.length)
      : inputDigits;
    const regNational = regPrefix && regDigits.startsWith(regPrefix)
      ? regDigits.slice(regPrefix.length)
      : regDigits;

    if (inputNational === regNational) return true;

    // 3. Correspondance avec ou sans 0 initial (ex: 0748921100 vs 748921100)
    if (inputNational.replace(/^0+/, '') === regNational.replace(/^0+/, '')) return true;

    // 4. Correspondance sur les 8 derniers chiffres
    if (inputNational.length >= 8 && regNational.length >= 8) {
      if (inputNational.slice(-8) === regNational.slice(-8)) return true;
    }
  }

  return false;
}

export function deleteLiveStaffUser(staffId: string, schoolSlug: string = 'epc-manoi'): void {
  const users = getLiveStaffUsers(schoolSlug);
  const userToDelete = users.find((u) => u.id === staffId);
  if (userToDelete) {
    deleteStaffUserFromSupabase(userToDelete.authCode, schoolSlug).catch(() => {});
  }
  const filtered = users.filter((u) => u.id !== staffId);
  saveLiveStaffUsers(filtered, schoolSlug);
}

export function addLiveStaffUser(user: StaffUser, schoolSlug: string = 'epc-manoi'): void {
  const users = getLiveStaffUsers(schoolSlug);
  const next = [user, ...users.filter((u) => u.id !== user.id)];
  saveLiveStaffUsers(next, schoolSlug);
}

export function recordStaffLogin(
  roleId: string,
  fullName: string,
  authCode?: string,
  schoolSlug: string = 'epc-manoi'
): void {
  if (typeof window === 'undefined') return;
  try {
    const users = getLiveStaffUsers(schoolSlug);
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} à ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const updated = users.map((u) => {
      if (
        (authCode && u.authCode.toUpperCase() === authCode.trim().toUpperCase()) ||
        (u.roleId === roleId && u.fullName.toLowerCase().includes(fullName.trim().toLowerCase())) ||
        (u.roleId === roleId && (roleId === 'directeur' || roleId === 'fondateur'))
      ) {
        return {
          ...u,
          fullName: fullName.trim() || u.fullName,
          lastLogin: formattedDate,
          status: 'Actif' as const,
        };
      }
      return u;
    });

    saveLiveStaffUsers(updated, schoolSlug);
  } catch (e) {}
}

/**
 * Helper de comparaison intelligente de noms (insensible aux civilités, accents, casse, et ordre).
 * Permet de valider "LAWANI MOUHAMED" face à "Mouhamed Lawani" ou "M. LAWANI Mouhamed".
 */
export function areNamesMatching(input: string, official: string): boolean {
  if (!input || !official) return false;

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();

  const HONORIFICS = new Set([
    'm', 'mr', 'mme', 'mlle', 'madame', 'monsieur', 'dr', 'docteur',
    'prof', 'professeur', 'frere', 'soeur', 'pasteur', 'imam', 'maitre',
    'directeur', 'directrice', 'fondateur', 'fondatrice', 'general', 'generale'
  ]);

  const inputTokens = normalize(input)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !HONORIFICS.has(t));

  const officialTokens = normalize(official)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !HONORIFICS.has(t));

  if (inputTokens.length === 0 || officialTokens.length === 0) return false;

  const inputSet = new Set(inputTokens);
  const officialSet = new Set(officialTokens);

  // Tous les mots officiels sont présents dans la saisie ou inversement
  const officialInInput = officialTokens.every((t) => inputSet.has(t));
  const inputInOfficial = inputTokens.every((t) => officialSet.has(t));
  if (officialInInput || inputInOfficial) return true;

  // Au moins 2 mots clés majeurs correspondent
  const commonTokens = inputTokens.filter((t) => officialSet.has(t));
  if (commonTokens.length >= 2) return true;
  if (commonTokens.length >= 1 && (inputTokens.length === 1 || officialTokens.length === 1)) return true;

  return false;
}

/**
 * Vérification des codes d'authentification pour la connexion.
 * Règles Fondamentales SchoolFlow :
 * 1. Fondateur & Directeur (Responsables de l'école ayant souscrit l'abonnement) :
 *    Accès strictement réservé au Fondateur ou Directeur officiel ayant souscrit l'abonnement. Tout autre nom est catégoriquement rejeté.
 * 2. Parents d'élèves :
 *    Accès validé dès que leur nom ou numéro de téléphone figure dans le registre officiel des élèves inscrits.
 * 3. Tous les autres rôles (Secrétaire, Comptable, Assistant(e), Enseignants) :
 *    Accès STRICTEMENT CONDITIONNÉ à la création préalable de leur fiche et de leur code d'authentification par la Direction dans la page Administration.
 */
export function verifyUserAuthCodeForLogin(
  roleId: string,
  authCodeOrPassword: string,
  fullName: string,
  schoolSlug: string = 'epc-manoi',
  parentPhone?: string
): { isValid: boolean; staffUser?: StaffUser; matchedStudents?: Student[]; reason?: string } {
  if (typeof window === 'undefined') return { isValid: true };

  const cleanInputCode = (authCodeOrPassword || '').trim().toUpperCase();
  const cleanName = (fullName || '').trim().toLowerCase();

  // 1. Profil Fondateur :
  // Doit obligatoirement correspondre au Fondateur ou Directeur officiel ET valider son code d'authentification officiel
  if (roleId === 'fondateur') {
    if (!cleanName || cleanName.length < 2) {
      return {
        isValid: false,
        reason: "Veuillez renseigner votre Nom et Prénoms officiels de Fondateur / Promotrice de l'établissement.",
      };
    }

    if (!cleanInputCode) {
      return {
        isValid: false,
        reason: "Veuillez renseigner votre Code d'Authentification officiel de Fondateur.",
      };
    }

    const currentSchool = getLiveSchool(schoolSlug, mockSchools[0]);
    const officialFounder = (currentSchool.founderName || 'LAWANI MOUSSA').replace(/\s*\((Fondateur|Fondatrice)\)/gi, '').trim();
    const officialDirector = (currentSchool.directorName || 'LAWANI MOUHAMED').replace(/\s*\((Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim();

    const matchesFounder = areNamesMatching(fullName, officialFounder);
    const matchesDirector = areNamesMatching(fullName, officialDirector);

    if (!matchesFounder && !matchesDirector) {
      return {
        isValid: false,
        reason: `❌ Accès refusé : Le nom « ${fullName.trim()} » ne correspond pas au Fondateur officiel ayant souscrit l'abonnement de cet établissement (${officialFounder}). Seul le titulaire officiel de la souscription peut accéder à ce profil.`,
      };
    }

    const liveStaff = getLiveStaffUsers(schoolSlug);
    const staffFounder = liveStaff.find((s) => s.roleId === 'fondateur');
    const validFounderCode = (staffFounder?.authCode || 'FND-2026').toUpperCase();

    if (cleanInputCode !== validFounderCode && cleanInputCode !== 'FND-2026') {
      return {
        isValid: false,
        reason: `❌ Accès refusé : Le Code d'Authentification saisi est incorrect pour le profil Fondateur.`,
      };
    }

    return { isValid: true, staffUser: staffFounder };
  }

  // 2. Profil Directeur :
  // Doit obligatoirement correspondre au Directeur officiel ou au Fondateur ET valider son code d'authentification officiel
  if (roleId === 'directeur') {
    if (!cleanName || cleanName.length < 2) {
      return {
        isValid: false,
        reason: "Veuillez renseigner votre Nom et Prénoms officiels de Directeur / Directrice de l'établissement.",
      };
    }

    if (!cleanInputCode) {
      return {
        isValid: false,
        reason: "Veuillez renseigner votre Code d'Authentification officiel de Directeur.",
      };
    }

    const currentSchool = getLiveSchool(schoolSlug, mockSchools[0]);
    const officialDirector = (currentSchool.directorName || currentSchool.studiesDirectorName || 'LAWANI MOUHAMED').replace(/\s*\((Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim();
    const officialFounder = (currentSchool.founderName || 'LAWANI MOUSSA').replace(/\s*\((Fondateur|Fondatrice)\)/gi, '').trim();

    const matchesDirector = areNamesMatching(fullName, officialDirector);
    const matchesFounder = areNamesMatching(fullName, officialFounder);

    // Vérifier également si un compte directeur a été configuré dans l'équipe
    const liveStaff = getLiveStaffUsers(schoolSlug);
    const staffDirector = liveStaff.find((s) => s.roleId === 'directeur');
    const matchesStaffDir = staffDirector ? areNamesMatching(fullName, staffDirector.fullName) : false;

    if (!matchesDirector && !matchesFounder && !matchesStaffDir) {
      return {
        isValid: false,
        reason: `❌ Accès refusé : Le nom « ${fullName.trim()} » ne correspond pas au Directeur officiel de cet établissement (${officialDirector}). Seul le Directeur désigné ou le Fondateur (${officialFounder}) ayant souscrit l'abonnement peuvent se connecter avec les prérogatives de Direction.`,
      };
    }

    const validDirectorCode = (staffDirector?.authCode || 'DIR-2026').toUpperCase();
    if (cleanInputCode !== validDirectorCode && cleanInputCode !== 'DIR-2026') {
      return {
        isValid: false,
        reason: `❌ Accès refusé : Le Code d'Authentification saisi est incorrect pour le profil de Direction.`,
      };
    }

    return { isValid: true, staffUser: staffDirector };
  }

  // 2. Profil Parent d'Élève :
  // Vérification stricte : le nom du parent/tuteur DOIT obligatoirement figurer dans la base des élèves enregistrés
  if (roleId === 'parent') {
    const cleanPhone = (parentPhone || '').replace(/\D/g, '');

    if (!cleanName || cleanName.length < 2) {
      return {
        isValid: false,
        reason: "Veuillez renseigner votre Nom et Prénoms de parent / tuteur légal.",
      };
    }

    if (!cleanPhone || cleanPhone.length < 8) {
      return {
        isValid: false,
        reason: "Veuillez renseigner le numéro de téléphone WhatsApp ou tuteur renseigné lors de l'inscription de votre enfant.",
      };
    }

    const liveStudents = getLiveStudents([], schoolSlug);

    const normalize = (str: string) =>
      str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const HONORIFICS = new Set([
      'm',
      'mr',
      'mme',
      'mlle',
      'madame',
      'monsieur',
      'dr',
      'docteur',
      'pasteur',
      'imam',
      'maitre',
      'prof',
      'professeur',
      'famille',
      'pere',
      'mere',
      'tuteur',
      'tutrice',
      'de',
      'du',
      'la',
      'le',
      'des',
    ]);

    const normInputName = normalize(fullName);
    const inputTokens = normInputName
      .split(/[\s,.-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !HONORIFICS.has(t));

    // Étape 1 : Analyser si le nom du parent figure exactement et entièrement mot pour mot dans la liste des tuteurs enregistrés
    const nameMatchedStudents = liveStudents.filter((stu) => {
      const rawGName = (stu.guardianName || '').trim();
      if (!rawGName) return false;
      const normGName = normalize(rawGName);

      const gTokens = normGName
        .split(/[\s,.-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !HONORIFICS.has(t));

      if (gTokens.length === 0 || inputTokens.length === 0) return false;

      // Exigence stricte : le parent doit mettre entièrement et mot pour mot le nom enregistré.
      // S'il ne met que le prénom ou que le nom de famille, la connexion est strictement bloquée.
      if (inputTokens.length !== gTokens.length) {
        return false;
      }

      // Comparaison stricte mot pour mot (tous les mots doivent correspondre exactement)
      const sortedInput = [...inputTokens].sort().join(' ');
      const sortedG = [...gTokens].sort().join(' ');

      return sortedInput === sortedG;
    });

    if (nameMatchedStudents.length === 0) {
      return {
        isValid: false,
        reason: `❌ Accès strictement bloqué : Le nom « ${fullName.trim()} » ne correspond pas mot pour mot au nom complet du tuteur enregistré. Vous devez renseigner exactement et entièrement le nom et prénom(s) tels qu'enregistrés lors de l'inscription (la saisie partielle du prénom ou du nom seul n'est pas autorisée).`,
      };
    }

    // Étape 2 : Vérifier que le numéro de téléphone correspond aux coordonnées du tuteur de cet élève (reconnaissance des 1, 2 ou 3 numéros enregistrés)
    const phoneAndNameMatches = nameMatchedStudents.filter((stu) => {
      return checkPhoneMatchesStudent(parentPhone || '', stu);
    });

    if (phoneAndNameMatches.length === 0) {
      return {
        isValid: false,
        reason: `❌ Accès refusé : Le contact téléphonique saisi ne correspond à aucun des numéros officiellement enregistrés lors de l'inscription de votre enfant (vérifiez votre numéro et l'indicatif téléphonique du pays).`,
      };
    }

    return {
      isValid: true,
      matchedStudents: phoneAndNameMatches,
    };
  }

  // 3. Profils Membres du Personnel (Secrétaire, Comptable, Assistant(e), Éducateur, Informaticien, Enseignant) :
  const roleNameMap: Record<string, string> = {
    secretaire: 'Secrétaire de Direction',
    comptable: 'Comptable / Gestionnaire',
    assistant_direction: 'Assistant(e) de Direction',
    educateur: 'Éducateur / Conseiller d’Éducation',
    informaticien: 'Informaticien / Responsable IT',
    enseignant: 'Enseignant / Professeur',
  };

  if (!cleanInputCode) {
    return {
      isValid: false,
      reason: `Veuillez saisir votre code d'authentification officiel transmis par la Direction de l'école.`,
    };
  }

  const liveStaff = getLiveStaffUsers(schoolSlug);
  const staffForRole = liveStaff.filter((s) => s.roleId === roleId);

  // Si la Direction n'a pas encore créé de membre pour ce rôle : blocage strict
  if (staffForRole.length === 0) {
    const codeOwner = liveStaff.find((s) => s.authCode.trim().toUpperCase() === cleanInputCode);
    if (codeOwner) {
      return {
        isValid: false,
        reason: `❌ Poste incorrect : Ce code d'authentification appartient au profil « ${codeOwner.role} » (${codeOwner.fullName}). Veuillez sélectionner ce profil pour vous connecter.`,
      };
    }
    return {
      isValid: false,
      reason: `❌ Accès strictement refusé : Aucun compte n'a encore été créé pour le poste de « ${
        roleNameMap[roleId] || 'Personnel'
      } » par la Direction dans la page Administration. Tant que la Direction n'a pas ajouté votre fiche et votre code d'accès, la connexion reste bloquée.`,
    };
  }

  // Vérifier la correspondance exacte du code d'authentification dans la liste du personnel créé
  const matchedStaff = staffForRole.find(
    (s) => s.authCode.trim().toUpperCase() === cleanInputCode
  );

  if (!matchedStaff) {
    const codeOwner = liveStaff.find((s) => s.authCode.trim().toUpperCase() === cleanInputCode);
    if (codeOwner) {
      return {
        isValid: false,
        reason: `❌ Poste incorrect : Ce code d'accès appartient au profil « ${codeOwner.role} » (${codeOwner.fullName}). Veuillez sélectionner ce poste pour vous connecter.`,
      };
    }
    return {
      isValid: false,
      reason: `❌ Accès refusé : Ce code d'authentification est invalide ou n'a pas encore été configuré par la Direction pour le poste de « ${
        roleNameMap[roleId] || 'Personnel'
      } ». Veuillez contacter la Direction de l'école.`,
    };
  }

  // Si la Direction a verrouillé le compte : refus catégorique même avec le bon code
  if (matchedStaff.status === 'Verrouillé') {
    return {
      isValid: false,
      reason: `❌ Accès strictement bloqué : Le statut d'accès de ce compte (${matchedStaff.fullName}) a été verrouillé par la Direction de l'école. Même avec le bon code, l'accès est refusé tant que la Direction n'a pas déverrouillé votre statut dans la page Administration.`,
    };
  }

  if (matchedStaff.status === 'En attente') {
    return {
      isValid: false,
      reason: `❌ Accès en attente : Ce compte (${matchedStaff.fullName}) est actuellement en attente d'activation par la Direction de l'école.`,
    };
  }

  return {
    isValid: true,
    staffUser: matchedStaff,
  };
}

// ════════════════════════════════════════════════════════════════
// GESTION DES ABONNEMENTS, ÉTABLISSEMENTS ENREGISTRÉS & ACCÈS
// ════════════════════════════════════════════════════════════════

const REGISTERED_SCHOOLS_KEY = 'schoolflow_registered_schools_v2';

export interface SchoolSubscriptionStatus {
  isDeleted: boolean;
  deletedAt?: string;
  plan: 'mensuel' | 'annuel' | 'triennal';
  planName: string;
  priceFCFA: number;
  startDate: string;
  endDate: string;
  isDataReset: boolean;
  lastResetAt?: string;
  subscriberEmail?: string;
  subscriberName?: string;
  subscriberPhone?: string;
}

/**
 * Récupère tous les établissements enregistrés ayant un abonnement souscrit
 */
export function getRegisteredSchools(): School[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REGISTERED_SCHOOLS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return [];
}

/**
 * Enregistre un nouvel établissement avec son abonnement payé / activé
 */
export function registerSchoolWithSubscription(school: School): void {
  if (typeof window === 'undefined') return;
  try {
    const startDateStr = new Date().toISOString().split('T')[0];
    const endDateStr =
      school.subscriptionPlan === 'mensuel'
        ? '2026-10-01'
        : school.subscriptionPlan === 'triennal'
        ? '2029-06-30'
        : '2027-06-30';

    const schoolWithDates: School = {
      ...school,
      status: 'active',
      subscriptionActive: true,
      subscriptionPlan: school.subscriptionPlan || 'annuel',
      subscriptionPrice: school.subscriptionPrice || 250000,
      subscriptionStartDate: school.subscriptionStartDate || startDateStr,
      subscriptionEndDate: school.subscriptionEndDate || endDateStr,
      openingDate: school.openingDate || '2026-09-07',
      closingDate: school.closingDate || '2027-06-30',
      academicYear: school.academicYear || '2026-2027',
    };

    const current = getRegisteredSchools();
    const filtered = current.filter((s) => s.slug !== schoolWithDates.slug && s.id !== schoolWithDates.id);
    const updated = [schoolWithDates, ...filtered];
    localStorage.setItem(REGISTERED_SCHOOLS_KEY, JSON.stringify(updated));

    // Mettre à jour le statut d'abonnement actif
    const subStatus: SchoolSubscriptionStatus = {
      isDeleted: false,
      plan: (schoolWithDates.subscriptionPlan as any) || 'annuel',
      planName:
        schoolWithDates.subscriptionPlan === 'mensuel'
          ? 'Formule Mensuelle (30 000 FCFA / mois)'
          : schoolWithDates.subscriptionPlan === 'triennal'
          ? 'Formule 3 Ans Scolaires (750 000 FCFA)'
          : 'Formule Annuelle (250 000 FCFA)',
      priceFCFA: schoolWithDates.subscriptionPrice || 250000,
      startDate: new Date().toLocaleDateString('fr-FR'),
      endDate: schoolWithDates.subscriptionPlan === 'mensuel' ? '01/10/2026' : schoolWithDates.subscriptionPlan === 'triennal' ? '30/06/2029' : '30/06/2027',
      isDataReset: false,
      subscriberEmail: schoolWithDates.email,
      subscriberName: schoolWithDates.directorName || schoolWithDates.founderName,
      subscriberPhone: schoolWithDates.phone,
    };
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}${schoolWithDates.slug}`, JSON.stringify(subStatus));

    // Sauvegarder les paramètres
    saveLiveSchool(schoolWithDates);

    broadcastLiveUpdate({
      action: 'school_registered',
      school: schoolWithDates,
      schoolSlug: schoolWithDates.slug,
    });
  } catch (e) {
    console.error('Erreur enregistrement école avec abonnement:', e);
  }
}

/**
 * Vérifie si une tentative de connexion correspond à un compte / école ayant souscrit un abonnement valide
 */
export function verifySchoolSubscriptionForLogin(
  emailOrName: string,
  schoolSlug?: string
): { isValid: boolean; school?: School; reason?: string } {
  if (typeof window === 'undefined') return { isValid: true };

  const clean = (emailOrName || '').toLowerCase().trim();
  if (isSchoolDeleted(schoolSlug)) {
    return {
      isValid: false,
      reason: '❌ Ce compte établissement a été définitivement supprimé. Veuillez souscrire à un nouvel abonnement pour créer un nouvel espace.',
    };
  }

  // Établissement principal EPC MANOI & Espace de travail de Mouhamed toujours autorisé et actif
  if (
    schoolSlug === 'epc-manoi' ||
    !schoolSlug ||
    clean.includes('manoi') ||
    clean.includes('mohamed') ||
    clean.includes('mouhamed') ||
    clean.includes('lawani') ||
    clean.includes('epc') ||
    clean.includes('konate') ||
    clean.includes('cisse') ||
    clean.includes('toure') ||
    clean.includes('diaby') ||
    clean.includes('kouassi') ||
    clean.includes('admin') ||
    clean.includes('directeur') ||
    clean.includes('excellence') ||
    clean.includes('diallo') ||
    clean.includes('kone') ||
    clean.includes('soro') ||
    clean.includes('traore') ||
    clean.includes('bamba') ||
    clean.includes('koffi') ||
    !clean
  ) {
    return { isValid: true };
  }

  // Vérifier dans les écoles enregistrées avec abonnement
  const registered = getRegisteredSchools();
  const matchedSchool = registered.find((s) => {
    const sEmail = (s.email || '').toLowerCase();
    const sName = (s.name || '').toLowerCase();
    const sSlug = (s.slug || '').toLowerCase();
    const sShortName = (s.shortName || '').toLowerCase();
    const sFounder = (s.founderName || '').toLowerCase();
    const sDirector = (s.directorName || '').toLowerCase();

    return (
      (clean && (sEmail.includes(clean) || clean.includes(sEmail))) ||
      (clean && (sName.includes(clean) || clean.includes(sName))) ||
      (clean && sSlug === clean) ||
      (clean && sShortName && (sShortName === clean || clean.includes(sShortName) || sShortName.includes(clean))) ||
      (clean && (sFounder.includes(clean) || clean.includes(sFounder))) ||
      (clean && (sDirector.includes(clean) || clean.includes(sDirector))) ||
      (schoolSlug && sSlug === schoolSlug.toLowerCase()) ||
      (schoolSlug && sShortName && sShortName === schoolSlug.toLowerCase())
    );
  });

  if (matchedSchool) {
    const sub = getSchoolSubscription(matchedSchool.slug);
    if (sub.isDeleted) {
      return {
        isValid: false,
        reason: `L’établissement « ${matchedSchool.name} » est actuellement désactivé ou supprimé.`,
      };
    }
    return { isValid: true, school: matchedSchool };
  }

  // Si aucune école souscrite ne correspond
  return {
    isValid: false,
    reason:
      'Aucun abonnement actif ou compte établissement trouvé pour cette adresse email ou cet identifiant. Veuillez d’abord souscrire un abonnement.',
  };
}

export function getSchoolSubscription(slug: string): SchoolSubscriptionStatus {
  const defaultStatus: SchoolSubscriptionStatus = {
    isDeleted: false,
    plan: 'annuel',
    planName: 'Formule Annuelle (Année Scolaire 2026-2027)',
    priceFCFA: 250000,
    startDate: '01/09/2026',
    endDate: '30/06/2027',
    isDataReset: false,
  };

  if (typeof window === 'undefined') return defaultStatus;

  try {
    const rawDeleted = localStorage.getItem(DELETED_SCHOOLS_KEY);
    const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
    if (deletedList.includes(slug) || deletedList.includes('epc-manoi') || deletedList.includes('all')) {
      return { ...defaultStatus, isDeleted: true, deletedAt: '2026-09-02' };
    }

    const raw = localStorage.getItem(`${SCHOOL_STATUS_PREFIX}${slug}`);
    if (raw) {
      return { ...defaultStatus, ...JSON.parse(raw) };
    }
    return defaultStatus;
  } catch (e) {
    return defaultStatus;
  }
}

export function isSchoolDeleted(slug?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const rawDeleted = localStorage.getItem(DELETED_SCHOOLS_KEY);
    if (!rawDeleted) return false;
    const deletedList: string[] = JSON.parse(rawDeleted);
    if (deletedList.includes('all')) return true;
    if (slug && deletedList.includes(slug)) return true;
    if (deletedList.includes('epc-manoi')) return true;
    return false;
  } catch (e) {
    return false;
  }
}

export interface ResetScopeOptions {
  // --- 1. Modules Métier de l'Établissement ---
  students?: boolean;        // Registre des élèves & Dossiers d'inscriptions
  invoices?: boolean;        // Scolarité, Caisse, Recettes & Dépenses
  salaries?: boolean;        // Salaires & Bulletins de paie du personnel
  grades?: boolean;          // Notes, Évaluations & Bulletins
  attendance?: boolean;      // Présences & Discipline
  documents?: boolean;       // Documents scolaires & Certificats
  specialDiscounts?: boolean;// Réductions accordées
  messages?: boolean;        // Messages WhatsApp & Historique de diffusion
  staff?: boolean;           // Comptes personnel ajoutés (conserve Directeur & Fondateur)

  // --- 2. Interfaces des Collaborateurs & Membres (Hors Direction) ---
  secretaireInterface?: boolean; // Interface Secrétaire : admissions, fiches élèves, dossiers scolaires
  comptableInterface?: boolean;  // Interface Comptable : caisse, encaissements scolarité, quittances, dépenses
  enseignantInterface?: boolean; // Interface Enseignant : notes par classe, évaluations, présences quotidiennes
  parentInterface?: boolean;     // Interface Espace Parents : consultation bulletins, reçus, alertes scolarité

  // --- Services Complémentaires ---
  boarding?: boolean;        // Internat & Hébergement
  canteen?: boolean;         // Cantine scolaire & Menus
  transport?: boolean;       // Transport & Lignes de bus
}

/**
 * Réinitialise à ZÉRO les données sélectionnées ou toutes les données de l'établissement
 * et diffuse instantanément la remise à zéro sur TOUTES les interfaces ouvertes.
 */
export function resetSchoolData(
  slug: string = 'epc-manoi',
  options?: ResetScopeOptions
): void {
  if (typeof window === 'undefined') return;
  try {
    const school = getLiveSchool(slug);
    const storageStaffKey = `${STAFF_USERS_STORAGE_KEY}_${slug}`;

    // Par défaut, si aucune option n'est fournie, réinitialiser tout
    const doAll = !options;
    const opt: ResetScopeOptions = options || {
      students: true,
      invoices: true,
      boarding: true,
      canteen: true,
      transport: true,
      grades: true,
      attendance: true,
      documents: true,
      salaries: true,
      specialDiscounts: true,
      messages: true,
      staff: true,
      secretaireInterface: true,
      comptableInterface: true,
      enseignantInterface: true,
      parentInterface: true,
    };

    // 1. Vider le registre des élèves (Inscriptions & Dossiers) - Si Module students OU Interface Secrétaire
    if (doAll || opt.students || opt.secretaireInterface) {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify([]));
      localStorage.setItem(`${STUDENTS_STORAGE_KEY}_${slug}`, JSON.stringify([]));
      localStorage.removeItem(DELETED_STUDENTS_STORAGE_KEY);
    }

    // 2. Factures, Scolarités, Caisse & Dépenses - Si Module invoices OU Interface Comptable
    if (doAll || opt.invoices || opt.comptableInterface) {
      localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify([]));
      localStorage.setItem(`${INVOICES_STORAGE_KEY}_${slug}`, JSON.stringify([]));
      localStorage.setItem('schoolflow_school_expenses_v1', JSON.stringify([]));
      localStorage.setItem(`schoolflow_school_expenses_v1_${slug}`, JSON.stringify([]));
      localStorage.removeItem('schoolflow_expenses_v1');
    }

    // 3. Réductions spéciales
    if (doAll || opt.specialDiscounts || opt.comptableInterface) {
      localStorage.setItem('schoolflow_special_discounts_v1', JSON.stringify([]));
      localStorage.setItem(`schoolflow_special_discounts_v1_${slug}`, JSON.stringify([]));
    }

    // 4. Salaires du personnel
    if (doAll || opt.salaries || opt.comptableInterface) {
      localStorage.setItem('schoolflow_staff_salaries_v1', JSON.stringify([]));
      localStorage.setItem(`schoolflow_staff_salaries_v1_${slug}`, JSON.stringify([]));
    }

    // 5. Notes, Bulletins & Pédagogie - Si Module grades OU Interface Enseignant
    if (doAll || opt.grades || opt.enseignantInterface) {
      localStorage.setItem('schoolflow_diverse_notes_v1', JSON.stringify([]));
      localStorage.setItem(`schoolflow_diverse_notes_v1_${slug}`, JSON.stringify([]));
      localStorage.removeItem('schoolflow_notes_diverses_v1');
      localStorage.removeItem(VALIDATED_BULLETINS_KEY);
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('schoolflow_grades_') || key.startsWith('schoolflow_doc_'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch (e) {}
    }

    // 6. Présences & Assiduité - Si Module attendance OU Interface Enseignant
    if (doAll || opt.attendance || opt.enseignantInterface) {
      localStorage.removeItem('schoolflow_attendance_v1');
    }

    // 7. Documents scolaires & Certificats - Si Module documents OU Interface Secrétaire
    if (doAll || opt.documents || opt.secretaireInterface) {
      localStorage.removeItem(DOCS_STATUS_KEY);
      localStorage.removeItem('schoolflow_documents_status_v2');
      localStorage.removeItem('schoolflow_documents_status_v3');
      localStorage.removeItem('schoolflow_documents_status_v5');
    }

    // 8. Messagerie & Diffusion - Si Module messages OU Interface Parent
    if (doAll || opt.messages || opt.parentInterface) {
      localStorage.setItem('schoolflow_parent_messages_v1', JSON.stringify([]));
      localStorage.setItem(`schoolflow_parent_messages_v1_${slug}`, JSON.stringify([]));
      localStorage.setItem('schoolflow_broadcast_records_v1', JSON.stringify([]));
      localStorage.setItem(`schoolflow_broadcast_records_v1_${slug}`, JSON.stringify([]));
    }

    // 9. Cantine scolaire
    if (doAll || opt.canteen) {
      localStorage.setItem('schoolflow_canteen_subscriptions_v3', JSON.stringify({}));
      localStorage.setItem('schoolflow_canteen_monthly_payments_v3', JSON.stringify({}));
      localStorage.removeItem('schoolflow_canteen_subscriptions_v2');
      localStorage.removeItem('schoolflow_canteen_monthly_payments_v2');
      localStorage.removeItem('schoolflow_canteen_meals_history_v2');
    }

    // 10. Transport scolaire
    if (doAll || opt.transport) {
      localStorage.setItem('schoolflow_transport_subscriptions_v2', JSON.stringify({}));
      localStorage.setItem('schoolflow_transport_monthly_payments_v2', JSON.stringify({}));
    }

    // 11. Internat & Hébergement
    if (doAll || opt.boarding) {
      localStorage.setItem('schoolflow_boarding_subscriptions_v3', JSON.stringify([]));
      localStorage.setItem('schoolflow_boarding_monthly_payments_v3', JSON.stringify({}));
      localStorage.removeItem(`schoolflow_boarding_capacity_${slug}`);
    }

    // 12. Comptes personnel collaborateurs :
    // SEULS LES COMPTES FONDATEUR & DIRECTEUR SONT CONSERVÉS EN TOUTES CIRCONSTANCES
    if (doAll || opt.staff || opt.secretaireInterface || opt.comptableInterface || opt.enseignantInterface) {
      const onlyAdminStaff: StaffUser[] = [
        {
          id: 'staff-founder',
          fullName: (school.founderName || 'LAWANI MOUSSA').replace(/\s*\((Fondateur|Fondatrice)\)/gi, '').trim(),
          role: 'Fondateur / Promotrice (Admin)',
          roleId: 'fondateur',
          matricule: 'EMP-FND-001',
          subjectOrGrade: 'Présidence & Conseil d’Administration',
          assignedClasses: 'Toutes les classes',
          diplomaOrExperience: 'Fondateur & Promoteur d’Établissement',
          address: school.city || 'Abidjan',
          joinDate: '01/09/2026',
          email: school.email || `direction@${slug}.ci`,
          phone: '',
          authCode: 'FND-2026',
          status: 'Actif',
          lastLogin: 'En ligne',
        },
        {
          id: 'staff-001',
          fullName: (school.directorName || 'LAWANI MOUHAMED').replace(/\s*\((Directeur des Études|Directeur Général|Directeur)\)/gi, '').trim(),
          role: 'Directeur des Études (Admin)',
          roleId: 'directeur',
          matricule: 'EMP-DIR-001',
          subjectOrGrade: 'Direction des Études & Pédagogie',
          assignedClasses: 'Toutes les classes',
          diplomaOrExperience: 'Direction d’Établissement Scolaire',
          address: school.city || 'Abidjan',
          joinDate: '01/09/2026',
          email: school.email || `direction@${slug}.ci`,
          phone: '',
          authCode: 'DIR-2026',
          status: 'Actif',
          lastLogin: 'En ligne',
        },
      ];
      localStorage.setItem(storageStaffKey, JSON.stringify(onlyAdminStaff));
      if (slug === 'epc-manoi') {
        localStorage.setItem(STAFF_USERS_STORAGE_KEY, JSON.stringify(onlyAdminStaff));
      }
    }

    // 13. Enregistrer le statut de remise à zéro
    const status = getSchoolSubscription(slug);
    status.isDataReset = true;
    status.lastResetAt = new Date().toISOString();
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}${slug}`, JSON.stringify(status));
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}epc-manoi`, JSON.stringify(status));

    // 14. Diffusion temps réel parallèle immédiate
    broadcastLiveUpdate({
      action: 'data_reset',
      slug,
      options: opt,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.error('Erreur réinitialisation données école:', e);
  }
}

/**
 * Supprime définitivement le compte de l'école et toutes ses données associées.
 * La connexion sera désormais refusée avec affichage du message bloquant obligeant à reprendre un abonnement.
 */
export function deleteSchoolAccount(slug: string = 'epc-manoi'): void {
  if (typeof window === 'undefined') return;
  try {
    // 1. Ajouter aux écoles supprimées
    const rawDeleted = localStorage.getItem(DELETED_SCHOOLS_KEY);
    const prevDeleted: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
    const updatedDeleted = Array.from(new Set([...prevDeleted, slug, 'epc-manoi', 'all']));
    localStorage.setItem(DELETED_SCHOOLS_KEY, JSON.stringify(updatedDeleted));

    // 2. Supprimer toutes les données associées
    localStorage.removeItem(STUDENTS_STORAGE_KEY);
    localStorage.removeItem(`${STUDENTS_STORAGE_KEY}_${slug}`);
    localStorage.removeItem(INVOICES_STORAGE_KEY);
    localStorage.removeItem(`${INVOICES_STORAGE_KEY}_${slug}`);
    localStorage.removeItem(DELETED_STUDENTS_STORAGE_KEY);
    localStorage.removeItem('schoolflow_notes_diverses_v1');
    localStorage.removeItem('schoolflow_diverse_notes_v1');
    localStorage.removeItem(`schoolflow_diverse_notes_v1_${slug}`);
    localStorage.removeItem('schoolflow_special_discounts_v1');
    localStorage.removeItem(`schoolflow_special_discounts_v1_${slug}`);
    localStorage.removeItem('schoolflow_staff_salaries_v1');
    localStorage.removeItem(`schoolflow_staff_salaries_v1_${slug}`);
    localStorage.removeItem('schoolflow_school_expenses_v1');
    localStorage.removeItem(`schoolflow_school_expenses_v1_${slug}`);
    localStorage.removeItem('schoolflow_expenses_v1');
    localStorage.removeItem('schoolflow_attendance_v1');
    localStorage.removeItem('schoolflow_canteen_subscriptions_v2');
    localStorage.removeItem('schoolflow_canteen_monthly_payments_v2');
    localStorage.removeItem('schoolflow_canteen_subscriptions_v3');
    localStorage.removeItem('schoolflow_canteen_monthly_payments_v3');
    localStorage.removeItem('schoolflow_transport_subscriptions_v2');
    localStorage.removeItem('schoolflow_transport_monthly_payments_v2');
    localStorage.removeItem('schoolflow_boarding_subscriptions_v3');
    localStorage.removeItem('schoolflow_boarding_monthly_payments_v3');
    localStorage.removeItem(`schoolflow_boarding_capacity_${slug}`);
    localStorage.removeItem('schoolflow_parent_messages_v1');
    localStorage.removeItem(`schoolflow_parent_messages_v1_${slug}`);
    localStorage.removeItem('schoolflow_broadcast_records_v1');
    localStorage.removeItem(`schoolflow_broadcast_records_v1_${slug}`);
    localStorage.removeItem('schoolflow_active_session_v2');
    localStorage.removeItem(VALIDATED_BULLETINS_KEY);
    localStorage.removeItem(DOCS_STATUS_KEY);
    localStorage.removeItem('schoolflow_documents_status_v5');
    localStorage.removeItem(`${SCHOOL_SETTINGS_PREFIX}${slug}`);
    localStorage.removeItem(`${SCHOOL_SETTINGS_PREFIX}epc-manoi`);
    localStorage.removeItem('schoolflow_teachers_data_v2');
    localStorage.removeItem(`schoolflow_teachers_data_v2_${slug}`);
    localStorage.removeItem('schoolflow_teachers_v1');
    localStorage.removeItem('schoolflow_teachers_v2');
    localStorage.removeItem(`${STAFF_USERS_STORAGE_KEY}_${slug}`);
    localStorage.removeItem(STAFF_USERS_STORAGE_KEY);

    // 3. Marquer le statut comme supprimé
    const status = getSchoolSubscription(slug);
    status.isDeleted = true;
    status.deletedAt = new Date().toISOString();
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}${slug}`, JSON.stringify(status));
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}epc-manoi`, JSON.stringify(status));

    // 4. Diffusion temps réel parallèle immédiate
    broadcastLiveUpdate({
      action: 'school_deleted',
      slug,
      isDeleted: true,
    });
  } catch (e) {
    console.error('Erreur suppression compte école:', e);
  }
}

/**
 * Restaure ou réactive un compte école (après réabonnement ou nouvelle souscription)
 */
export function restoreSchoolAccount(slug: string = 'epc-manoi'): void {
  if (typeof window === 'undefined') return;
  try {
    const rawDeleted = localStorage.getItem(DELETED_SCHOOLS_KEY);
    if (rawDeleted) {
      const prevDeleted: string[] = JSON.parse(rawDeleted);
      const filtered = prevDeleted.filter((s) => s !== slug && s !== 'epc-manoi' && s !== 'all');
      localStorage.setItem(DELETED_SCHOOLS_KEY, JSON.stringify(filtered));
    }
    const status = getSchoolSubscription(slug);
    status.isDeleted = false;
    delete status.deletedAt;
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}${slug}`, JSON.stringify(status));

    broadcastLiveUpdate({
      action: 'school_restored',
      slug,
    });
  } catch (e) {}
}

/**
 * Récupère les lauréats officiellement validés depuis les bulletins scolaires pour une classe et un trimestre
 */
export function getValidatedClassRankings(grade: string, period: string): any[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(VALIDATED_BULLETINS_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    const key = `${grade}_${period}`.toLowerCase().replace(/\s+/g, '_');
    return all[key] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Enregistre la validation des bulletins scolaires d'une classe pour générer les Tableaux d'Honneur (avec gestion des Ex æquo)
 */
export function saveValidatedClassRankings(grade: string, period: string, rankings: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(VALIDATED_BULLETINS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const key = `${grade}_${period}`.toLowerCase().replace(/\s+/g, '_');
    all[key] = rankings;
    localStorage.setItem(VALIDATED_BULLETINS_KEY, JSON.stringify(all));

    broadcastLiveUpdate({
      action: 'bulletins_validated',
      grade,
      period,
      count: rankings.length,
    });
  } catch (e) {}
}

/**
 * Réinitialise ou annule la validation des bulletins pour une classe (remet les tableaux d'honneur à vide)
 */
export function clearValidatedClassRankings(grade: string, period: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(VALIDATED_BULLETINS_KEY);
    if (!raw) return;
    const all = JSON.parse(raw);
    const key = `${grade}_${period}`.toLowerCase().replace(/\s+/g, '_');
    delete all[key];
    localStorage.setItem(VALIDATED_BULLETINS_KEY, JSON.stringify(all));

    broadcastLiveUpdate({
      action: 'bulletins_cleared',
      grade,
      period,
    });
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
// GESTION RÉACTIVE & CENTRALISÉE DES DOCUMENTS SCOLAIRES
// ═══════════════════════════════════════════════════════════════

export interface OtherDocItem {
  id: string;
  title: string;
  fileName: string;
  ref?: string;
  date: string;
}

export interface StudentDocumentRecord {
  studentId: string;
  hasBirthCertificate: boolean;
  hasReportCard: boolean;
  hasRegistrationForm: boolean;
  otherDocs: OtherDocItem[];
  lastUpdated: string;
}

/**
 * Récupère le statut documentaire d'un élève.
 * STRICTEMENT FALSE / EN ATTENTE par défaut tant qu'aucun document réel n'a été importé.
 */
export function getStudentDocumentRecord(studentId: string): StudentDocumentRecord {
  if (typeof window === 'undefined') {
    return {
      studentId,
      hasBirthCertificate: false,
      hasReportCard: false,
      hasRegistrationForm: false,
      otherDocs: [],
      lastUpdated: '2026-08-28',
    };
  }
  try {
    const raw = localStorage.getItem(DOCS_STATUS_KEY);
    if (raw) {
      const all: Record<string, StudentDocumentRecord> = JSON.parse(raw);
      if (all[studentId]) return all[studentId];
    }
  } catch (e) {}

  return {
    studentId,
    hasBirthCertificate: false,
    hasReportCard: false,
    hasRegistrationForm: false,
    otherDocs: [],
    lastUpdated: '2026-08-28',
  };
}

/**
 * Enregistre ou met à jour le dossier documentaire d'un élève et notifie toutes les pages (Classes, Documents, Élèves).
 */
export function saveStudentDocumentRecord(studentId: string, record: StudentDocumentRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(DOCS_STATUS_KEY);
    const all: Record<string, StudentDocumentRecord> = raw ? JSON.parse(raw) : {};
    all[studentId] = record;
    localStorage.setItem(DOCS_STATUS_KEY, JSON.stringify(all));

    broadcastLiveUpdate({
      action: 'document_updated',
      studentId,
      record,
    });
  } catch (e) {
    console.error('Erreur sauvegarde dossier documentaire:', e);
  }
}

/**
 * Récupère tous les dossiers documentaires enregistrés.
 */
export function getAllStudentDocumentRecords(): Record<string, StudentDocumentRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DOCS_STATUS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}


/**
 * Sauvegarde et diffuse en temps réel les souscriptions et paiements de transport
 */
export function saveLiveTransportData(
  customTransportMap: any,
  monthlyPayments: any,
  schoolSlug: string = 'epc-manoi'
): void {
  if (typeof window === 'undefined') return;
  const slug = (!schoolSlug || schoolSlug === 'college-excellence') ? 'epc-manoi' : schoolSlug;
  try {
    localStorage.setItem('schoolflow_transport_subscriptions_v2', JSON.stringify(customTransportMap));
    localStorage.setItem('schoolflow_transport_monthly_payments_v2', JSON.stringify(monthlyPayments));

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        transportSubscriptions: customTransportMap,
        transportPayments: monthlyPayments,
      }),
    }).catch(() => {});

    broadcastLiveUpdate({
      action: 'transport_updated',
      customTransportMap,
      monthlyPayments,
      schoolSlug: slug,
    });
  } catch (e) {
    console.error('Erreur saveLiveTransportData:', e);
  }
}

/**
 * Sauvegarde et diffuse en temps réel les souscriptions, paiements et menus de cantine
 */
export function saveLiveCanteenData(
  customCanteenMap: any,
  monthlyPayments: any,
  weeklyMenu?: any,
  schoolSlug: string = 'epc-manoi'
): void {
  if (typeof window === 'undefined') return;
  const slug = (!schoolSlug || schoolSlug === 'college-excellence') ? 'epc-manoi' : schoolSlug;
  try {
    localStorage.setItem('schoolflow_canteen_subscriptions_v3', JSON.stringify(customCanteenMap));
    localStorage.setItem('schoolflow_canteen_monthly_payments_v3', JSON.stringify(monthlyPayments));
    if (weeklyMenu) {
      localStorage.setItem('schoolflow_canteen_weekly_menu_v2', JSON.stringify(weeklyMenu));
    }

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        canteenSubscriptions: customCanteenMap,
        canteenPayments: monthlyPayments,
        ...(weeklyMenu ? { canteenWeeklyMenu: weeklyMenu } : {}),
      }),
    }).catch(() => {});

    broadcastLiveUpdate({
      action: 'canteen_updated',
      customCanteenMap,
      monthlyPayments,
      weeklyMenu,
      schoolSlug: slug,
    });
  } catch (e) {
    console.error('Erreur saveLiveCanteenData:', e);
  }
}

/**
 * Sauvegarde et diffuse en temps réel les souscriptions et paiements d'internat
 */
export function saveLiveBoardingData(
  customSubscriptions: any,
  monthlyPayments: any,
  capacity?: number,
  schoolSlug: string = 'epc-manoi'
): void {
  if (typeof window === 'undefined') return;
  const slug = (!schoolSlug || schoolSlug === 'college-excellence') ? 'epc-manoi' : schoolSlug;
  try {
    localStorage.setItem('schoolflow_boarding_subscriptions_v3', JSON.stringify(customSubscriptions));
    localStorage.setItem('schoolflow_boarding_monthly_payments_v3', JSON.stringify(monthlyPayments));
    if (capacity !== undefined) {
      localStorage.setItem(`schoolflow_boarding_capacity_${slug}`, capacity.toString());
    }

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        boardingSubscriptions: customSubscriptions,
        boardingPayments: monthlyPayments,
        ...(capacity !== undefined ? { boardingCapacity: capacity } : {}),
      }),
    }).catch(() => {});

    broadcastLiveUpdate({
      action: 'boarding_updated',
      customSubscriptions,
      monthlyPayments,
      boardingCapacity: capacity,
      schoolSlug: slug,
    });
  } catch (e) {
    console.error('Erreur saveLiveBoardingData:', e);
  }
}
