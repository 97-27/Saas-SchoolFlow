'use client';

import { Student, Invoice, School } from '@/lib/data/types';
import { mockSchools } from '@/lib/data/mock-data';
import { saveSchoolToSupabase, saveStudentToSupabase, saveInvoiceToSupabase, saveStaffUserToSupabase, deleteStaffUserFromSupabase } from '@/lib/supabase/services';

const STUDENTS_STORAGE_KEY = 'schoolflow_registered_students_v1';
const INVOICES_STORAGE_KEY = 'schoolflow_registered_invoices_v1';
const SCHOOL_SETTINGS_PREFIX = 'schoolflow_school_settings_v1_';
const DELETED_STUDENTS_STORAGE_KEY = 'schoolflow_deleted_student_ids_v1';
const DELETED_SCHOOLS_KEY = 'schoolflow_deleted_schools_v1';
const SCHOOL_STATUS_PREFIX = 'schoolflow_school_status_v1_';
const STAFF_USERS_STORAGE_KEY = 'schoolflow_staff_users_v1';
const VALIDATED_BULLETINS_KEY = 'schoolflow_validated_class_bulletins_v1';
export const DOCS_STATUS_KEY = 'schoolflow_documents_status_v5';
export const DATA_UPDATED_EVENT = 'schoolflow_data_updated';
export const REALTIME_SYNC_CHANNEL_NAME = 'schoolflow_realtime_sync_v2';

// ════════════════════════════════════════════════════════════════
// MOTEUR DE SYNCHRONISATION EN TEMPS RÉEL PARALLÈLE (MULTI-INTERFACES)
// ════════════════════════════════════════════════════════════════

let syncBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    syncBroadcastChannel = new BroadcastChannel(REALTIME_SYNC_CHANNEL_NAME);
    syncBroadcastChannel.onmessage = (event) => {
      // Propagation locale immédiate dans cet onglet sans boucle infinie
      window.dispatchEvent(
        new CustomEvent(DATA_UPDATED_EVENT, {
          detail: { ...(event.data || {}), isCrossTabSync: true },
        })
      );
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
 * Diffuse instantanément un événement de mise à jour à l'interface active et à TOUTES les autres fenêtres ouvertes en direct.
 */
export function broadcastLiveUpdate(detail: Record<string, any> = {}): void {
  if (typeof window === 'undefined') return;

  // 1. Dispatch local immédiat
  window.dispatchEvent(
    new CustomEvent(DATA_UPDATED_EVENT, {
      detail,
    })
  );

  // 2. Diffusion instantanée cross-onglets et cross-fenêtres
  if (syncBroadcastChannel) {
    try {
      syncBroadcastChannel.postMessage({
        ...detail,
        broadcastTime: Date.now(),
      });
    } catch (e) {
      console.warn('Erreur broadcast message:', e);
    }
  }
}

/**
 * Récupère les IDs supprimés par l'administrateur
 */
export function getDeletedStudentIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_STUDENTS_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (error) {
    return new Set();
  }
}

/**
 * Supprime un ou plusieurs élèves de manière centralisée et définitive de toutes les pages.
 */
export function deleteLiveStudents(idsToDelete: string[], schoolSlug?: string): void {
  if (typeof window === 'undefined' || !idsToDelete || idsToDelete.length === 0) return;

  try {
    const rawDeleted = localStorage.getItem(DELETED_STUDENTS_STORAGE_KEY);
    const prevDeleted: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
    const updatedDeleted = Array.from(new Set([...prevDeleted, ...idsToDelete]));
    localStorage.setItem(DELETED_STUDENTS_STORAGE_KEY, JSON.stringify(updatedDeleted));

    const deleteSet = new Set(updatedDeleted);

    // Nettoyer stockage local des élèves
    const rawStudents = localStorage.getItem(STUDENTS_STORAGE_KEY);
    if (rawStudents) {
      const prevStudents: Student[] = JSON.parse(rawStudents);
      const filtered = prevStudents.filter(
        (s) => !deleteSet.has(s.id) && !deleteSet.has(s.studentNumber)
      );
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(filtered));
    }

    if (schoolSlug && schoolSlug !== 'epc-manoi' && schoolSlug !== 'college-excellence') {
      const schoolKey = `${STUDENTS_STORAGE_KEY}_${schoolSlug}`;
      const rawSchool = localStorage.getItem(schoolKey);
      if (rawSchool) {
        const prevSchool: Student[] = JSON.parse(rawSchool);
        const filtered = prevSchool.filter(
          (s) => !deleteSet.has(s.id) && !deleteSet.has(s.studentNumber)
        );
        localStorage.setItem(schoolKey, JSON.stringify(filtered));
      }
    }

    // Nettoyer stockage local des factures / scolarités
    const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
    if (rawInvoices) {
      const prevInvoices: Invoice[] = JSON.parse(rawInvoices);
      const filtered = prevInvoices.filter(
        (inv) =>
          !deleteSet.has(inv.id) &&
          !deleteSet.has(inv.studentId) &&
          !deleteSet.has(inv.invoiceNumber)
      );
      localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(filtered));
    }

    if (schoolSlug && schoolSlug !== 'epc-manoi' && schoolSlug !== 'college-excellence') {
      const invSchoolKey = `${INVOICES_STORAGE_KEY}_${schoolSlug}`;
      const rawInvSchool = localStorage.getItem(invSchoolKey);
      if (rawInvSchool) {
        const prevInvSchool: Invoice[] = JSON.parse(rawInvSchool);
        const filtered = prevInvSchool.filter(
          (inv) =>
            !deleteSet.has(inv.id) &&
            !deleteSet.has(inv.studentId) &&
            !deleteSet.has(inv.invoiceNumber)
        );
        localStorage.setItem(invSchoolKey, JSON.stringify(filtered));
      }
    }

    // Déclencher la diffusion temps réel parallèle
    broadcastLiveUpdate({
      action: 'students_deleted',
      deletedIds: idsToDelete,
      schoolSlug,
    });
  } catch (error) {
    console.error('Erreur suppression live-store students:', error);
  }
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
      founderName: slug === 'epc-manoi' || slug === 'college-excellence' ? 'LAWANI MOUHAMED' : 'Fondateur / Promoteur',
      directorName: 'M. Jean-Marc Kouassi (Direction Pédagogique)',
      studiesDirectorName: 'Direction des Études',
      status: 'active',
      subscriptionPlan: 'annuel',
      createdAt: '2026-09-01',
    };
  }

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

    // 3. Si c'est l'école officielle par défaut (epc-manoi / college-excellence)
    if (!raw && (slug === 'epc-manoi' || slug === 'college-excellence')) {
      raw =
        localStorage.getItem(`${SCHOOL_SETTINGS_PREFIX}epc-manoi`) ||
        localStorage.getItem(`${SCHOOL_SETTINGS_PREFIX}college-excellence`) ||
        localStorage.getItem('schoolflow_active_school_settings_v1');
    }

    if (raw) {
      const local = JSON.parse(raw);
      const fallback = defaultSchool || mockSchools['epc-manoi'] || mockSchools['college-excellence'];
      return {
        ...fallback,
        ...local,
        name: local.name || fallback?.name || slug.toUpperCase().replace(/-/g, ' '),
        shortName: local.shortName || fallback?.shortName || slug.slice(0, 10).toUpperCase(),
        founderName: local.founderName || fallback?.founderName || (slug === 'epc-manoi' || slug === 'college-excellence' ? 'LAWANI MOUHAMED' : 'Fondateur de l’Établissement'),
        directorName: local.directorName || fallback?.directorName || 'M. Jean-Marc Kouassi (Direction Pédagogique)',
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
export function saveLiveSchool(school: School): void {
  if (typeof window === 'undefined') return;

  try {
    const json = JSON.stringify(school);
    // Sauvegarder sur le slug spécifique
    localStorage.setItem(`${SCHOOL_SETTINGS_PREFIX}${school.slug}`, json);

    if (school.slug === 'epc-manoi' || school.slug === 'college-excellence') {
      localStorage.setItem(`${SCHOOL_SETTINGS_PREFIX}epc-manoi`, json);
      localStorage.setItem(`${SCHOOL_SETTINGS_PREFIX}college-excellence`, json);
      localStorage.setItem('schoolflow_active_school_settings_v1', json);
    }

    // Synchronisation en arrière-plan avec Supabase Cloud
    saveSchoolToSupabase(school).catch(() => {});

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

    // 2. Charger depuis la clé globale
    const rawGlobal = localStorage.getItem(STUDENTS_STORAGE_KEY);
    const globalStudents: Student[] = rawGlobal ? JSON.parse(rawGlobal) : [];

    // 3. Charger depuis les clés démo si applicable
    let fallbackStudents: Student[] = [];
    if (slug === 'epc-manoi' || slug === 'college-excellence') {
      const rawManoi = localStorage.getItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`);
      const manoiStudents: Student[] = rawManoi ? JSON.parse(rawManoi) : [];
      fallbackStudents = manoiStudents;
    }

    const allCandidates = [
      ...schoolStudents,
      ...fallbackStudents,
      ...globalStudents,
    ];

    const seenIds = new Set<string>();
    const seenNumbers = new Set<string>();
    const uniqueStudents: Student[] = [];

    // Priorité absolue aux élèves enregistrés
    for (const stu of allCandidates) {
      if (!isValidStudent(stu)) continue;
      if (deletedIds.has(stu.id) || (stu.studentNumber && deletedIds.has(stu.studentNumber))) continue;
      
      const idKey = stu.id || stu.studentNumber;
      const numKey = stu.studentNumber || stu.id;
      if (!seenIds.has(idKey) && !seenNumbers.has(numKey)) {
        seenIds.add(idKey);
        seenNumbers.add(numKey);
        uniqueStudents.push(stu);
      }
    }

    // Réconciliation automatique : si des factures locales existent sans objet élève correspondant, les réintégrer immédiatement
    try {
      const rawInvoicesSchool = localStorage.getItem(`${INVOICES_STORAGE_KEY}_${slug}`);
      const rawInvoicesGlobal = localStorage.getItem(INVOICES_STORAGE_KEY);
      const candidateInvoices: Invoice[] = [
        ...(rawInvoicesSchool ? JSON.parse(rawInvoicesSchool) : []),
        ...(rawInvoicesGlobal ? JSON.parse(rawInvoicesGlobal) : []),
      ];

      for (const inv of candidateInvoices) {
        if (!inv || !inv.invoiceNumber) continue;
        if (deletedIds.has(inv.id) || deletedIds.has(inv.studentId) || deletedIds.has(inv.invoiceNumber)) continue;

        const idKey = inv.studentId || inv.id || inv.invoiceNumber;
        const numKey = inv.invoiceNumber || inv.studentId || inv.id;
        if (!seenIds.has(idKey) && !seenNumbers.has(numKey)) {
          const numVal = parseInt(inv.invoiceNumber?.replace(/\D/g, '') || '1', 10);
          const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
          const letterCode = letters[(numVal - 1) % letters.length];
          const matriculeCode = `${26014800 + numVal}${letterCode}`;

          const nameParts = (inv.studentName || 'Élève').trim().split(' ');
          const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : (nameParts[0] || 'Élève');
          const lastName = (nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0] || '').toUpperCase();

          const reconstructedStudent: Student = {
            id: inv.studentId || `stu-${numVal.toString().padStart(3, '0')}`,
            studentNumber: inv.invoiceNumber.startsWith('ID-') ? inv.invoiceNumber : `ID-${numVal.toString().padStart(3, '0')}`,
            matricule: matriculeCode,
            firstName,
            lastName,
            fullName: inv.studentName,
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

    // Si aucun élève n'a encore été créé en local et que ce n'est pas un reset, utiliser les élèves initiaux
    if (uniqueStudents.length === 0 && (slug === 'epc-manoi' || slug === 'college-excellence')) {
      const status = getSchoolSubscription('epc-manoi');
      if (!status.isDataReset) {
        for (const stu of initialStudents) {
          if (!isValidStudent(stu)) continue;
          if (deletedIds.has(stu.id) || (stu.studentNumber && deletedIds.has(stu.studentNumber))) continue;
          if (!seenIds.has(stu.id) && !seenNumbers.has(stu.studentNumber)) {
            seenIds.add(stu.id);
            seenNumbers.add(stu.studentNumber);
            uniqueStudents.push(stu);
          }
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

    // 1. Charger depuis la clé spécifique à l'école
    const schoolKey = `${INVOICES_STORAGE_KEY}_${slug}`;
    const rawSchool = localStorage.getItem(schoolKey);
    const schoolInvoices: Invoice[] = rawSchool ? JSON.parse(rawSchool) : [];

    // 2. Charger depuis la clé globale
    const rawGlobal = localStorage.getItem(INVOICES_STORAGE_KEY);
    const globalInvoices: Invoice[] = rawGlobal ? JSON.parse(rawGlobal) : [];

    // 3. Clés démo
    let fallbackInvoices: Invoice[] = [];
    if (slug === 'epc-manoi' || slug === 'college-excellence') {
      const rawManoi = localStorage.getItem(`${INVOICES_STORAGE_KEY}_epc-manoi`);
      const manoiInvoices: Invoice[] = rawManoi ? JSON.parse(rawManoi) : [];
      fallbackInvoices = manoiInvoices;
    }

    const allCandidates = [
      ...schoolInvoices,
      ...fallbackInvoices,
      ...globalInvoices,
    ];

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
    const uniqueInvoices: Invoice[] = [];

    // Priorité absolue aux encaissements enregistrés en local
    for (const inv of allCandidates) {
      if (!inv || !inv.invoiceNumber) continue;
      if (deletedIds.has(inv.id) || deletedIds.has(inv.studentId) || deletedIds.has(inv.invoiceNumber)) continue;
      if (!seenIds.has(inv.id) && !seenNumbers.has(inv.invoiceNumber)) {
        seenIds.add(inv.id);
        seenNumbers.add(inv.invoiceNumber);

        // Si l'élève a été modifié, mettre à jour les coordonnées dans la facture
        const matchingStu = studentMap.get(inv.studentId) || studentMap.get(inv.invoiceNumber);
        if (matchingStu) {
          uniqueInvoices.push({
            ...inv,
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
            installments: matchingStu.installments || inv.installments,
            paymentMethod: matchingStu.paymentMethod || inv.paymentMethod,
          });
        } else {
          uniqueInvoices.push(inv);
        }
      }
    }

    // Auto-réconciliation réciproque : si des élèves existent sans facture associée, créer la facture correspondante
    for (const stu of localStudents) {
      if (!stu || !stu.studentNumber) continue;
      if (deletedIds.has(stu.id) || deletedIds.has(stu.studentNumber)) continue;

      const idKey = stu.id || stu.studentNumber;
      const numKey = stu.studentNumber || stu.id;
      if (!seenIds.has(idKey) && !seenNumbers.has(numKey)) {
        const numVal = parseInt(stu.studentNumber?.replace(/\D/g, '') || '1', 10);
        const reconstructedInvoice: Invoice = {
          id: `inv-${numVal.toString().padStart(3, '0')}`,
          invoiceNumber: stu.studentNumber,
          studentId: stu.id,
          studentName: stu.fullName || `${stu.firstName} ${stu.lastName}`.trim(),
          studentAvatar: stu.avatar,
          studentGrade: stu.grade,
          studentGender: stu.gender,
          guardianName: stu.guardianName,
          guardianPhone: stu.whatsappPhone || stu.guardianPhone,
          feeType: "Frais d'inscription & Scolarité",
          amount: stu.tuitionAmount || 0,
          discountAmount: stu.discountAmount || 0,
          netAmount: stu.netAmount !== undefined ? stu.netAmount : (stu.tuitionAmount || 0),
          paidAmount: stu.paidAmount || 0,
          balanceRemaining: stu.balanceRemaining !== undefined ? stu.balanceRemaining : Math.max(0, (stu.tuitionAmount || 0) - (stu.paidAmount || 0)),
          paymentMethod: stu.paymentMethod || 'Espèces en caisse',
          enrollmentType: stu.enrollmentType || 'nouveau',
          installments: stu.installments,
          issueDate: stu.paymentDate || '2026-08-27',
          dueDate: stu.paymentDate || '2026-08-27',
          status: (stu.balanceRemaining === 0 || stu.tuitionStatus === 'paid') ? 'paid' : (stu.paidAmount && stu.paidAmount > 0) ? 'partial' : 'sent',
        };

        seenIds.add(idKey);
        seenNumbers.add(numKey);
        uniqueInvoices.push(reconstructedInvoice);
      }
    }

    // Fallback aux factures initiales uniquement si aucune facture locale n'existe pour la démo
    if (uniqueInvoices.length === 0 && (slug === 'epc-manoi' || slug === 'college-excellence')) {
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
      schoolSlug: slug,
      schoolId: slug,
      enrollmentType: student.enrollmentType || 'nouveau',
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

    if (slug === 'epc-manoi' || slug === 'college-excellence') {
      localStorage.setItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`, JSON.stringify([studentWithSlug, ...filteredSchool]));
      localStorage.setItem(`${STUDENTS_STORAGE_KEY}_college-excellence`, JSON.stringify([studentWithSlug, ...filteredSchool]));
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

    if (slug === 'epc-manoi' || slug === 'college-excellence') {
      localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, JSON.stringify([invoiceWithSlug, ...filteredInvSchool]));
      localStorage.setItem(`${INVOICES_STORAGE_KEY}_college-excellence`, JSON.stringify([invoiceWithSlug, ...filteredInvSchool]));
    }

    // 5. Synchronisation automatique des prestations (Internat, Cantine, Transport)
    try {
      // Internat
      const BOARDING_KEY = 'schoolflow_boarding_subscriptions_v3';
      const rawBoarding = localStorage.getItem(BOARDING_KEY);
      const prevBoarding: any[] = rawBoarding ? JSON.parse(rawBoarding) : [];
      if (student.isBoarding) {
        const existingIdx = prevBoarding.findIndex((b) => b.studentId === student.id || b.matricule === student.studentNumber);
        const boardingRecord = {
          studentId: student.id,
          studentName: student.fullName,
          matricule: student.matricule || student.studentNumber,
          className: student.grade,
          gender: student.gender === 'female' ? 'F' : 'M',
          parentContact: student.whatsappPhone || student.guardianPhone,
          pavilion: student.gender === 'female' ? 'Pavillon B (Filles)' : 'Pavillon A (Garçons)',
          roomNumber: 'Chambre 101',
          monthlyRate: 50000,
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

      // Cantine
      const CANTEEN_KEY = 'schoolflow_canteen_subscriptions_v3';
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

      // Transport
      const TRANSPORT_KEY = 'schoolflow_transport_subscriptions_v2';
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
    } catch (err) {
      console.warn('Erreur sync prestations annexes:', err);
    }

    // 6. Synchronisation Supabase Cloud en arrière-plan
    saveStudentToSupabase(studentWithSlug, slug).catch(() => {});
    saveInvoiceToSupabase(invoiceWithSlug, slug).catch(() => {});

    // 7. Diffusion temps réel parallèle immédiate
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
      schoolSlug: schoolSlug || 'epc-manoi',
      schoolId: schoolSlug || 'epc-manoi',
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

    if (schoolSlug === 'epc-manoi' || schoolSlug === 'college-excellence') {
      localStorage.setItem(`${STUDENTS_STORAGE_KEY}_epc-manoi`, JSON.stringify(updatedSchool));
      localStorage.setItem(`${STUDENTS_STORAGE_KEY}_college-excellence`, JSON.stringify(updatedSchool));
    }

    // 2. Mise à jour ou création de la facture correspondante
    const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
    const prevInvoices: Invoice[] = rawInvoices ? JSON.parse(rawInvoices) : [];
    
    const existingInv = prevInvoices.find(
      (inv) => inv.studentId === student.id || inv.invoiceNumber === student.studentNumber
    );

    const updatedInvoice: Invoice = existingInv ? {
      ...existingInv,
      schoolSlug: schoolSlug || 'epc-manoi',
      schoolId: schoolSlug || 'epc-manoi',
      studentName: student.fullName,
      studentGrade: student.grade,
      studentGender: student.gender,
      guardianName: student.guardianName,
      guardianPhone: student.whatsappPhone || student.guardianPhone,
      amount: student.tuitionAmount,
      discountAmount: student.discountAmount || 0,
      netAmount: student.netAmount || (student.tuitionAmount - (student.discountAmount || 0)),
      paidAmount: student.paidAmount,
      balanceRemaining: student.balanceRemaining !== undefined ? student.balanceRemaining : Math.max(0, (student.netAmount || student.tuitionAmount) - student.paidAmount),
      enrollmentType: student.enrollmentType || existingInv.enrollmentType,
      installments: student.installments || existingInv.installments,
      paymentMethod: student.paymentMethod || existingInv.paymentMethod,
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
      amount: student.tuitionAmount,
      discountAmount: student.discountAmount || 0,
      netAmount: student.netAmount || (student.tuitionAmount - (student.discountAmount || 0)),
      paidAmount: student.paidAmount,
      balanceRemaining: student.balanceRemaining !== undefined ? student.balanceRemaining : Math.max(0, (student.netAmount || student.tuitionAmount) - student.paidAmount),
      paymentMethod: student.paymentMethod || 'Espèces en caisse',
      enrollmentType: student.enrollmentType || 'nouveau',
      installments: student.installments,
      issueDate: student.paymentDate || '2026-08-27',
      dueDate: student.paymentDate || '2026-08-27',
      status: student.tuitionStatus === 'paid' ? 'paid' : student.paidAmount > 0 ? 'partial' : 'sent',
    };

    const nextInvoices = [
      updatedInvoice,
      ...prevInvoices.filter(
        (inv) => inv.id !== updatedInvoice.id && inv.invoiceNumber !== updatedInvoice.invoiceNumber
      ),
    ];
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(nextInvoices));

    const invSchoolKey = `${INVOICES_STORAGE_KEY}_${schoolSlug || 'epc-manoi'}`;
    const rawInvSchool = localStorage.getItem(invSchoolKey);
    const prevInvSchool: Invoice[] = rawInvSchool ? JSON.parse(rawInvSchool) : [];
    const nextInvSchool = [
      updatedInvoice,
      ...prevInvSchool.filter(
        (inv) => inv.id !== updatedInvoice.id && inv.invoiceNumber !== updatedInvoice.invoiceNumber
      ),
    ];
    localStorage.setItem(invSchoolKey, JSON.stringify(nextInvSchool));

    if (schoolSlug === 'epc-manoi' || schoolSlug === 'college-excellence') {
      localStorage.setItem(`${INVOICES_STORAGE_KEY}_epc-manoi`, JSON.stringify(nextInvSchool));
      localStorage.setItem(`${INVOICES_STORAGE_KEY}_college-excellence`, JSON.stringify(nextInvSchool));
    }

    // 3. Synchronisation automatique des prestations (Internat, Cantine, Transport)
    try {
      if (typeof student.isBoarding === 'boolean') {
        const BOARDING_KEY = 'schoolflow_boarding_subscriptions_v3';
        const rawBoarding = localStorage.getItem(BOARDING_KEY);
        const prevBoarding: any[] = rawBoarding ? JSON.parse(rawBoarding) : [];
        if (student.isBoarding) {
          const existingIdx = prevBoarding.findIndex((b) => b.studentId === student.id || b.matricule === student.studentNumber);
          const boardingRecord = {
            studentId: student.id,
            studentName: student.fullName,
            matricule: student.matricule || student.studentNumber,
            className: student.grade,
            gender: student.gender === 'female' ? 'F' : 'M',
            parentContact: student.whatsappPhone || student.guardianPhone,
            pavilion: student.gender === 'female' ? 'Pavillon B (Filles)' : 'Pavillon A (Garçons)',
            roomNumber: 'Chambre 101',
            monthlyRate: 50000,
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
        const CANTEEN_KEY = 'schoolflow_canteen_subscriptions_v3';
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
        const TRANSPORT_KEY = 'schoolflow_transport_subscriptions_v2';
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

    // 4. Synchronisation en arrière-plan avec Supabase Cloud
    saveStudentToSupabase(student, schoolSlug).catch(() => {});
    saveInvoiceToSupabase(updatedInvoice, schoolSlug).catch(() => {});

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
    fullName: 'LAWANI MOUHAMED (Fondateur)',
    role: 'Fondateur / Promotrice (Admin)',
    roleId: 'fondateur',
    matricule: 'EMP-FND-001',
    subjectOrGrade: 'Présidence & Conseil d’Administration',
    assignedClasses: 'Toutes les classes',
    diplomaOrExperience: 'Fondateur & Promoteur d’Établissement',
    address: 'Abidjan',
    joinDate: '01/09/2026',
    email: 'fondateur@epc-manoi.ci',
    phone: '+225 07 48 92 11 00',
    authCode: 'FND-2026',
    status: 'Actif',
    lastLogin: 'En ligne',
  },
  {
    id: 'staff-001',
    fullName: 'Dr. Jean-Marc Kouassi (Direction Pédagogique)',
    role: 'Directeur Général (Admin)',
    roleId: 'directeur',
    matricule: 'EMP-DIR-001',
    subjectOrGrade: 'Direction des Études & Pédagogie',
    assignedClasses: 'Toutes les classes',
    diplomaOrExperience: 'Direction d’Établissement Scolaire (15 ans exp.)',
    address: 'Abidjan',
    joinDate: '01/09/2026',
    email: 'direction@epc-manoi.ci',
    phone: '+225 07 45 67 89 01',
    authCode: 'DIR-2026',
    status: 'Actif',
    lastLogin: 'En ligne',
  },
  {
    id: 'staff-sec',
    fullName: 'Mme Fatou Traoré',
    role: 'Secrétaire de Direction',
    roleId: 'secretaire',
    matricule: 'EMP-SEC-001',
    subjectOrGrade: 'Secrétariat & Accueil',
    assignedClasses: 'Administration',
    diplomaOrExperience: 'BTS Secrétariat de Direction (6 ans exp.)',
    address: 'Abidjan',
    joinDate: '01/09/2026',
    email: 'secretaire@epc-manoi.ci',
    phone: '+225 07 58 12 34 56',
    authCode: 'SEC-2026',
    status: 'Actif',
    lastLogin: '05/09/2026 à 08:30',
  },
  {
    id: 'staff-cpt',
    fullName: 'M. Amadou Diallo',
    role: 'Comptable / Gestionnaire',
    roleId: 'comptable',
    matricule: 'EMP-CPT-001',
    subjectOrGrade: 'Comptabilité & Caisse',
    assignedClasses: 'Gestion Financière',
    diplomaOrExperience: 'Master Finance & Comptabilité (8 ans exp.)',
    address: 'Abidjan',
    joinDate: '01/09/2026',
    email: 'comptable@epc-manoi.ci',
    phone: '+225 05 44 22 11 00',
    authCode: 'CPT-2026',
    status: 'Actif',
    lastLogin: '05/09/2026 à 09:15',
  },
  {
    id: 'staff-ast',
    fullName: 'M. Soro Ibrahim',
    role: 'Assistant(e) de Direction',
    roleId: 'assistant_direction',
    matricule: 'EMP-AST-001',
    subjectOrGrade: 'Direction Adjointe',
    assignedClasses: 'Administration',
    diplomaOrExperience: 'Licence Administration Publique',
    address: 'Abidjan',
    joinDate: '01/09/2026',
    email: 'assistant@epc-manoi.ci',
    phone: '+225 07 11 22 33 44',
    authCode: 'AST-2026',
    status: 'Actif',
    lastLogin: '04/09/2026 à 16:40',
  },
  {
    id: 'staff-edu',
    fullName: 'M. Kouamé Yao',
    role: 'Éducateur / Conseiller d’Éducation',
    roleId: 'educateur',
    matricule: 'EMP-EDU-001',
    subjectOrGrade: 'Vie Scolaire & Discipline',
    assignedClasses: 'Collège (6ème à 3ème)',
    diplomaOrExperience: 'Certificat d’Éducateur Spécialisé',
    address: 'Abidjan',
    joinDate: '01/09/2026',
    email: 'educateur@epc-manoi.ci',
    phone: '+225 01 02 03 04 05',
    authCode: 'EDU-2026',
    status: 'Actif',
    lastLogin: '05/09/2026 à 07:45',
  },
  {
    id: 'staff-inf',
    fullName: 'Ing. Franck N’Guessan',
    role: 'Informaticien / Responsable IT',
    roleId: 'informaticien',
    matricule: 'EMP-INF-001',
    subjectOrGrade: 'Systèmes & Réseau',
    assignedClasses: 'Infrastructure & SI',
    diplomaOrExperience: 'Ingénieur Télécoms & Réseaux',
    address: 'Abidjan',
    joinDate: '01/09/2026',
    email: 'informatique@epc-manoi.ci',
    phone: '+225 07 99 88 77 66',
    authCode: 'INF-2026',
    status: 'Actif',
    lastLogin: '05/09/2026 à 10:00',
  },
  {
    id: 'staff-ens',
    fullName: 'M. Paul Koffi',
    role: 'Enseignant / Professeur',
    roleId: 'enseignant',
    matricule: 'EMP-ENS-001',
    subjectOrGrade: 'Mathématiques & Sciences',
    assignedClasses: '6ème, 5ème, 4ème, 3ème',
    diplomaOrExperience: 'CAPES Mathématiques (10 ans exp.)',
    address: 'Abidjan',
    joinDate: '01/09/2026',
    email: 'enseignant@epc-manoi.ci',
    phone: '+225 07 00 11 22 33',
    authCode: 'ENS-2026',
    status: 'Actif',
    lastLogin: '05/09/2026 à 10:30',
  },
];

export function getLiveStaffUsers(schoolSlug: string = 'epc-manoi'): StaffUser[] {
  if (typeof window === 'undefined') return defaultStaffUsers;
  try {
    const storageKey = `${STAFF_USERS_STORAGE_KEY}_${schoolSlug}`;
    let raw = localStorage.getItem(storageKey);
    if (!raw && (schoolSlug === 'epc-manoi' || schoolSlug === 'college-excellence')) {
      raw = localStorage.getItem(STAFF_USERS_STORAGE_KEY);
    }

    if (raw) {
      const list: StaffUser[] = JSON.parse(raw);
      // S'assurer que le Fondateur et le Directeur figurent toujours dans la liste
      const hasFounder = list.some((u) => u.roleId === 'fondateur');
      const hasDirector = list.some((u) => u.roleId === 'directeur');
      let updated = list;
      if (!hasFounder) {
        updated = [defaultStaffUsers[0], ...updated];
      }
      if (!hasDirector) {
        updated = [defaultStaffUsers[1], ...updated];
      }
      return updated;
    }

    const school = getLiveSchool(schoolSlug);
    const initialStaff: StaffUser[] = [
      {
        id: 'staff-founder',
        fullName: school.founderName || 'LAWANI MOUHAMED (Fondateur)',
        role: 'Fondateur / Promotrice (Admin)',
        roleId: 'fondateur',
        matricule: 'EMP-FND-001',
        subjectOrGrade: 'Présidence & Conseil d’Administration',
        assignedClasses: 'Toutes les classes',
        diplomaOrExperience: 'Fondateur & Promoteur d’Établissement',
        address: school.city || 'Abidjan',
        joinDate: '01/09/2026',
        email: `fondateur@${schoolSlug}.ci`,
        phone: school.phone || '+225 07 48 92 11 00',
        authCode: 'FND-2026',
        status: 'Actif',
        lastLogin: 'En ligne',
      },
      {
        id: 'staff-001',
        fullName: school.directorName || 'Dr. Jean-Marc Kouassi (Direction)',
        role: 'Directeur Général (Admin)',
        roleId: 'directeur',
        matricule: 'EMP-DIR-001',
        subjectOrGrade: 'Direction & Pédagogie',
        assignedClasses: 'Toutes les classes',
        diplomaOrExperience: 'Direction d’Établissement Scolaire',
        address: school.city || 'Abidjan',
        joinDate: '01/09/2026',
        email: school.email || `direction@${schoolSlug}.ci`,
        phone: school.phone || '+225 07 45 67 89 01',
        authCode: 'DIR-2026',
        status: 'Actif',
        lastLogin: 'En ligne',
      },
    ];
    localStorage.setItem(storageKey, JSON.stringify(initialStaff));
    return initialStaff;
  } catch (e) {
    return defaultStaffUsers;
  }
}

export function saveLiveStaffUsers(users: StaffUser[], schoolSlug: string = 'epc-manoi'): void {
  if (typeof window === 'undefined') return;
  try {
    const storageKey = `${STAFF_USERS_STORAGE_KEY}_${schoolSlug}`;
    localStorage.setItem(storageKey, JSON.stringify(users));
    if (schoolSlug === 'epc-manoi' || schoolSlug === 'college-excellence') {
      localStorage.setItem(STAFF_USERS_STORAGE_KEY, JSON.stringify(users));
    }

    // Synchronisation en arrière-plan avec Supabase Cloud
    for (const u of users) {
      saveStaffUserToSupabase(u, schoolSlug).catch(() => {});
    }

    broadcastLiveUpdate({
      action: 'staff_users_updated',
      staffUsers: users,
      schoolSlug,
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
 * Vérification des codes d'authentification pour la connexion.
 * Règles Fondamentales SchoolFlow :
 * 1. Fondateur & Directeur (Responsables de l'école ayant souscrit l'abonnement) :
 *    Accès direct dès que l'abonnement de l'école est actif, leur permettant d'administrer l'école et de créer les codes.
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
): { isValid: boolean; staffUser?: StaffUser; reason?: string } {
  if (typeof window === 'undefined') return { isValid: true };

  const cleanInputCode = (authCodeOrPassword || '').trim().toUpperCase();
  const cleanName = (fullName || '').trim().toLowerCase();

  // 1. Profils Administrateurs Maîtres (Fondateur & Directeur / Responsables de l'établissement ayant souscrit l'abonnement) :
  if (roleId === 'fondateur' || roleId === 'directeur') {
    return { isValid: true };
  }

  // 2. Profil Parent d'Élève :
  // Vérification que le parent ou son enfant figure bien dans la liste officielle des élèves de l'école
  if (roleId === 'parent') {
    const cleanPhone = (parentPhone || '').replace(/\D/g, '');
    const liveStudents = getLiveStudents([], schoolSlug);
    const matchedStudents = liveStudents.filter((stu) => {
      const gPhone = (stu.guardianPhone || '').replace(/\D/g, '');
      const wPhone = (stu.whatsappPhone || '').replace(/\D/g, '');
      const gName = (stu.guardianName || '').toLowerCase();
      const sNum = (stu.studentNumber || '').toUpperCase();
      const sMat = (stu.matricule || '').toUpperCase();
      return (
        (cleanPhone.length >= 8 && (gPhone.includes(cleanPhone) || wPhone.includes(cleanPhone))) ||
        (cleanName.length >= 3 && gName.includes(cleanName)) ||
        (cleanInputCode.length >= 3 && (sNum.includes(cleanInputCode) || sMat.includes(cleanInputCode)))
      );
    });

    if (matchedStudents.length > 0) {
      return { isValid: true };
    }

    return {
      isValid: false,
      reason:
        "❌ Accès refusé : Vos coordonnées ou le dossier de votre enfant ne figurent pas dans la base des élèves enregistrés de l'établissement. Veuillez contacter le secrétariat de l'école.",
    };
  }

  // 3. Profils Membres du Personnel (Secrétaire, Comptable, Assistant(e), Éducateur, Informaticien, Enseignant) :
  const defaultCodeMap: Record<string, string> = {
    secretaire: 'SEC-2026',
    comptable: 'CPT-2026',
    assistant_direction: 'AST-2026',
    educateur: 'EDU-2026',
    informaticien: 'INF-2026',
    enseignant: 'ENS-2026',
  };

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
      reason: `Veuillez saisir votre code d'authentification transmis par la Direction de l'école.`,
    };
  }

  const liveStaff = getLiveStaffUsers(schoolSlug);
  const staffForRole = liveStaff.filter((s) => s.roleId === roleId);

  // Vérifier la correspondance exacte du code d'authentification dans la liste du personnel
  const matchedStaff = staffForRole.find(
    (s) => s.authCode.trim().toUpperCase() === cleanInputCode
  );

  const isDefaultCode = defaultCodeMap[roleId] && cleanInputCode === defaultCodeMap[roleId].toUpperCase();

  if (!matchedStaff && !isDefaultCode) {
    return {
      isValid: false,
      reason: `❌ Code d'authentification incorrect pour le poste de ${
        roleNameMap[roleId] || 'Personnel'
      }. Veuillez vérifier le code créé par la Direction.`,
    };
  }

  const candidateStaff =
    matchedStaff ||
    staffForRole.find((s) => s.authCode.trim().toUpperCase() === cleanInputCode) ||
    staffForRole[0];

  if (candidateStaff && candidateStaff.status === 'Verrouillé') {
    return {
      isValid: false,
      reason: `❌ Accès refusé : Ce compte d'accès (${candidateStaff.fullName}) a été verrouillé et bloqué par la Direction de l'établissement.`,
    };
  }

  if (candidateStaff && candidateStaff.status === 'En attente') {
    return {
      isValid: false,
      reason: `❌ Accès refusé : Ce compte est actuellement en attente d'activation par la Direction.`,
    };
  }

  return {
    isValid: true,
    staffUser: matchedStaff || candidateStaff || undefined,
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
    const current = getRegisteredSchools();
    const filtered = current.filter((s) => s.slug !== school.slug && s.id !== school.id);
    const updated = [school, ...filtered];
    localStorage.setItem(REGISTERED_SCHOOLS_KEY, JSON.stringify(updated));

    // Mettre à jour le statut d'abonnement actif
    const subStatus: SchoolSubscriptionStatus = {
      isDeleted: false,
      plan: (school.subscriptionPlan as any) || 'annuel',
      planName:
        school.subscriptionPlan === 'mensuel'
          ? 'Formule Mensuelle (30 000 FCFA / mois)'
          : school.subscriptionPlan === 'triennal'
          ? 'Formule 3 Ans Scolaires (750 000 FCFA)'
          : 'Formule Annuelle (250 000 FCFA)',
      priceFCFA: school.subscriptionPrice || 250000,
      startDate: new Date().toLocaleDateString('fr-FR'),
      endDate: '30/06/2027',
      isDataReset: false,
      subscriberEmail: school.email,
      subscriberName: school.directorName || school.founderName,
      subscriberPhone: school.phone,
    };
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}${school.slug}`, JSON.stringify(subStatus));

    // Sauvegarder les paramètres
    saveLiveSchool(school);

    broadcastLiveUpdate({
      action: 'school_registered',
      school,
      schoolSlug: school.slug,
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
    schoolSlug === 'college-excellence' ||
    !schoolSlug ||
    clean.includes('manoi') ||
    clean.includes('mohamed') ||
    clean.includes('mouhamed') ||
    clean.includes('epc') ||
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
    const sFounder = (s.founderName || '').toLowerCase();
    const sDirector = (s.directorName || '').toLowerCase();

    return (
      (clean && (sEmail.includes(clean) || clean.includes(sEmail))) ||
      (clean && (sName.includes(clean) || clean.includes(sName))) ||
      (clean && sSlug === clean) ||
      (clean && (sFounder.includes(clean) || clean.includes(sFounder))) ||
      (clean && (sDirector.includes(clean) || clean.includes(sDirector))) ||
      (schoolSlug && sSlug === schoolSlug.toLowerCase())
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
    if (deletedList.includes('epc-manoi') || deletedList.includes('college-excellence')) return true;
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Réinitialise à ZÉRO toutes les données de toutes les pages de l'établissement (élèves, finances, scolarité, cantine, transport, etc.)
 * et diffuse instantanément la remise à zéro sur TOUTES les interfaces ouvertes.
 */
export function resetSchoolData(
  slug: string = 'epc-manoi'
): void {
  if (typeof window === 'undefined') return;
  try {
    const school = getLiveSchool(slug);
    const storageStaffKey = `${STAFF_USERS_STORAGE_KEY}_${slug}`;

    // 1. Vider le registre des élèves et factures (Scolarités, Caisse, Inscriptions)
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(`${STUDENTS_STORAGE_KEY}_${slug}`, JSON.stringify([]));
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(`${INVOICES_STORAGE_KEY}_${slug}`, JSON.stringify([]));
    localStorage.removeItem(DELETED_STUDENTS_STORAGE_KEY);

    // Dépenses
    localStorage.setItem('schoolflow_school_expenses_v1', JSON.stringify([]));
    localStorage.setItem(`schoolflow_school_expenses_v1_${slug}`, JSON.stringify([]));
    localStorage.removeItem('schoolflow_expenses_v1');

    // Réductions spéciales
    localStorage.setItem('schoolflow_special_discounts_v1', JSON.stringify([]));
    localStorage.setItem(`schoolflow_special_discounts_v1_${slug}`, JSON.stringify([]));

    // Salaires du personnel
    localStorage.setItem('schoolflow_staff_salaries_v1', JSON.stringify([]));
    localStorage.setItem(`schoolflow_staff_salaries_v1_${slug}`, JSON.stringify([]));

    // Notes diverses
    localStorage.setItem('schoolflow_diverse_notes_v1', JSON.stringify([]));
    localStorage.setItem(`schoolflow_diverse_notes_v1_${slug}`, JSON.stringify([]));
    localStorage.removeItem('schoolflow_notes_diverses_v1');

    // Messagerie & Diffusion
    localStorage.setItem('schoolflow_parent_messages_v1', JSON.stringify([]));
    localStorage.setItem(`schoolflow_parent_messages_v1_${slug}`, JSON.stringify([]));
    localStorage.setItem('schoolflow_broadcast_records_v1', JSON.stringify([]));
    localStorage.setItem(`schoolflow_broadcast_records_v1_${slug}`, JSON.stringify([]));

    // Enseignants & Personnel Pédagogique
    localStorage.setItem('schoolflow_teachers_data_v2', JSON.stringify([]));
    localStorage.setItem(`schoolflow_teachers_data_v2_${slug}`, JSON.stringify([]));
    localStorage.removeItem('schoolflow_teachers_v1');
    localStorage.removeItem('schoolflow_teachers_v2');

    // Cantine, Transport & Internat
    localStorage.setItem('schoolflow_canteen_subscriptions_v3', JSON.stringify({}));
    localStorage.setItem('schoolflow_canteen_monthly_payments_v3', JSON.stringify({}));
    localStorage.removeItem('schoolflow_canteen_subscriptions_v2');
    localStorage.removeItem('schoolflow_canteen_monthly_payments_v2');
    localStorage.removeItem('schoolflow_canteen_meals_history_v2');

    localStorage.setItem('schoolflow_transport_subscriptions_v2', JSON.stringify({}));
    localStorage.setItem('schoolflow_transport_monthly_payments_v2', JSON.stringify({}));

    localStorage.setItem('schoolflow_boarding_subscriptions_v3', JSON.stringify([]));
    localStorage.setItem('schoolflow_boarding_monthly_payments_v3', JSON.stringify({}));
    localStorage.removeItem(`schoolflow_boarding_capacity_${slug}`);

    // Présences, Bulletins & Documents
    localStorage.removeItem('schoolflow_attendance_v1');
    localStorage.removeItem(VALIDATED_BULLETINS_KEY);
    localStorage.removeItem(DOCS_STATUS_KEY);
    localStorage.removeItem('schoolflow_documents_status_v2');
    localStorage.removeItem('schoolflow_documents_status_v3');
    localStorage.removeItem('schoolflow_documents_status_v5');

    // Nettoyer les clés dynamiques de notes par classe
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

    // 2. Réinitialiser la liste du personnel : SEUL LE COMPTE FONDATEUR / DIRECTEUR EST CONSERVÉ
    const onlyDirector: StaffUser[] = [
      {
        id: 'staff-001',
        fullName: school.directorName || school.founderName || 'Directeur Général (Admin)',
        role: 'Directeur Général (Admin)',
        roleId: 'directeur',
        matricule: 'EMP-DIR-001',
        subjectOrGrade: 'Direction & Pédagogie',
        assignedClasses: 'Toutes les classes',
        diplomaOrExperience: 'Direction d’Établissement Scolaire',
        address: school.city || 'Abidjan',
        joinDate: '01/09/2026',
        email: school.email || `direction@${slug}.ci`,
        phone: school.phone || '+225 07 45 67 89 01',
        authCode: 'DIR-2026',
        status: 'Actif',
        lastLogin: 'En ligne',
      },
    ];
    localStorage.setItem(storageStaffKey, JSON.stringify(onlyDirector));
    if (slug === 'epc-manoi' || slug === 'college-excellence') {
      localStorage.setItem(STAFF_USERS_STORAGE_KEY, JSON.stringify(onlyDirector));
    }

    // 3. Enregistrer le statut de remise à zéro
    const status = getSchoolSubscription(slug);
    status.isDataReset = true;
    status.lastResetAt = new Date().toISOString();
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}${slug}`, JSON.stringify(status));
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}epc-manoi`, JSON.stringify(status));
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}college-excellence`, JSON.stringify(status));

    // 4. Diffusion temps réel parallèle immédiate
    broadcastLiveUpdate({
      action: 'data_reset',
      slug,
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
    const updatedDeleted = Array.from(new Set([...prevDeleted, slug, 'epc-manoi', 'college-excellence', 'all']));
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
    localStorage.removeItem(`${SCHOOL_SETTINGS_PREFIX}college-excellence`);
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
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}college-excellence`, JSON.stringify(status));

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
      const filtered = prevDeleted.filter((s) => s !== slug && s !== 'epc-manoi' && s !== 'college-excellence' && s !== 'all');
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

