'use client';

import { Student, Invoice, School } from '@/lib/data/types';
import { mockSchools } from '@/lib/data/mock-data';
import { saveSchoolToSupabase, saveStudentToSupabase } from '@/lib/supabase/services';

const STUDENTS_STORAGE_KEY = 'schoolflow_registered_students_v1';
const INVOICES_STORAGE_KEY = 'schoolflow_registered_invoices_v1';
const SCHOOL_SETTINGS_PREFIX = 'schoolflow_school_settings_v1_';
const DELETED_STUDENTS_STORAGE_KEY = 'schoolflow_deleted_student_ids_v1';
export const DATA_UPDATED_EVENT = 'schoolflow_data_updated';

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
export function deleteLiveStudents(idsToDelete: string[]): void {
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

    // Déclencher l'événement global pour mise à jour instantanée de toutes les vues
    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { deletedIds: idsToDelete },
      })
    );
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

    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { action: 'grades_portal_updated', portalStatus: status },
      })
    );
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

    // Déclenchement événement custom pour réactivité immédiate dans l'onglet
    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { school },
      })
    );
  } catch (error) {
    console.error('Erreur sauvegarde live school:', error);
  }
}

/**
 * Récupère les élèves enregistrés en local + fusionne avec les élèves initiaux.
 * Exclut automatiquement tous les élèves supprimés.
 */
export function getLiveStudents(initialStudents: Student[] = [], schoolSlug?: string): Student[] {
  if (typeof window === 'undefined') return initialStudents;

  try {
    const isManoiOrDemo = !schoolSlug || schoolSlug === 'epc-manoi' || schoolSlug === 'college-excellence';

    // Si c'est une NOUVELLE école souscrite (pas la démo MANOI), charger ses données isolées
    if (!isManoiOrDemo) {
      const schoolKey = `${STUDENTS_STORAGE_KEY}_${schoolSlug}`;
      const rawSchool = localStorage.getItem(schoolKey);
      if (rawSchool) {
        return JSON.parse(rawSchool);
      }
      return []; // Zéro élève par défaut pour toute nouvelle école
    }

    const status = getSchoolSubscription('epc-manoi');
    const deletedIds = getDeletedStudentIds();
    const raw = localStorage.getItem(STUDENTS_STORAGE_KEY);
    const localStudents: Student[] = raw ? JSON.parse(raw) : [];

    // Si les données de l'école ont été réinitialisées à zéro, ne pas réinjecter les mockStudents
    if (status.isDataReset) {
      return localStudents.filter(
        (stu) => stu && stu.studentNumber && !deletedIds.has(stu.id) && !deletedIds.has(stu.studentNumber)
      );
    }

    const seenIds = new Set<string>();
    const seenNumbers = new Set<string>();
    const uniqueStudents: Student[] = [];

    // Priorité absolue aux élèves inscrits en local
    for (const stu of [...localStudents, ...initialStudents]) {
      if (!stu || !stu.studentNumber) continue;
      if (deletedIds.has(stu.id) || deletedIds.has(stu.studentNumber)) continue;
      if (!seenIds.has(stu.id) && !seenNumbers.has(stu.studentNumber)) {
        seenIds.add(stu.id);
        seenNumbers.add(stu.studentNumber);
        uniqueStudents.push(stu);
      }
    }

    // Trier chronologiquement selon le numéro séquentiel
    const sortedChronologically = uniqueStudents.sort((a, b) => {
      const numA = parseInt(a.studentNumber?.replace(/\D/g, '') || '0', 10);
      const numB = parseInt(b.studentNumber?.replace(/\D/g, '') || '0', 10);
      return numA - numB;
    });

    // Ré-indexer de façon continue et stricte (ID-001, ID-002... ID-NNN) sans aucun saut
    const reindexedStudents = sortedChronologically.map((stu, idx) => {
      const continuousId = `ID-${(idx + 1).toString().padStart(3, '0')}`;
      return {
        ...stu,
        studentNumber: continuousId,
      };
    });

    return reindexedStudents;
  } catch (error) {
    console.error('Erreur lecture localStorage students:', error);
    return initialStudents;
  }
}

/**
 * Récupère les factures / quittances enregistrées en local + fusionne avec les factures initiales.
 * Exclut automatiquement les factures des élèves supprimés.
 */
export function getLiveInvoices(initialInvoices: Invoice[] = [], schoolSlug?: string): Invoice[] {
  if (typeof window === 'undefined') return initialInvoices;

  try {
    const isManoiOrDemo = !schoolSlug || schoolSlug === 'epc-manoi' || schoolSlug === 'college-excellence';

    // Si c'est une NOUVELLE école souscrite (pas la démo MANOI), charger ses factures isolées
    if (!isManoiOrDemo) {
      const schoolKey = `${INVOICES_STORAGE_KEY}_${schoolSlug}`;
      const rawSchool = localStorage.getItem(schoolKey);
      if (rawSchool) {
        return JSON.parse(rawSchool);
      }
      return []; // Zéro facture / 0 FCFA pour toute nouvelle école
    }

    const status = getSchoolSubscription('epc-manoi');
    const deletedIds = getDeletedStudentIds();
    const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
    const localInvoices: Invoice[] = rawInvoices ? JSON.parse(rawInvoices) : [];

    // Si les données de l'école ont été réinitialisées à zéro, ne pas réinjecter les factures initiales
    if (status.isDataReset) {
      return localInvoices.filter(
        (inv) => inv && inv.invoiceNumber && !deletedIds.has(inv.id) && !deletedIds.has(inv.studentId) && !deletedIds.has(inv.invoiceNumber)
      );
    }

    // Récupérer les élèves en direct pour synchroniser les noms/prénoms modifiés
    const rawStudents = localStorage.getItem(STUDENTS_STORAGE_KEY);
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
    for (const inv of [...localInvoices, ...initialInvoices]) {
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

    return uniqueInvoices;
  } catch (error) {
    console.error('Erreur lecture localStorage invoices:', error);
    return initialInvoices;
  }
}

/**
 * Enregistre un nouvel élève et son encaissement associé dans le stockage persistant,
 * et propage un événement custom pour mettre à jour instantanément les autres composants.
 */
export function saveRegisteredStudent(student: Student, invoice: Invoice): void {
  if (typeof window === 'undefined') return;

  try {
    // 1. Sauvegarde élève
    const rawStudents = localStorage.getItem(STUDENTS_STORAGE_KEY);
    const prevStudents: Student[] = rawStudents ? JSON.parse(rawStudents) : [];
    const filteredStudents = prevStudents.filter(
      (s) => s.id !== student.id && s.studentNumber !== student.studentNumber
    );
    const updatedStudents = [student, ...filteredStudents];
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updatedStudents));

    // 2. Sauvegarde facture / quittance
    const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
    const prevInvoices: Invoice[] = rawInvoices ? JSON.parse(rawInvoices) : [];
    const filteredInvoices = prevInvoices.filter(
      (inv) => inv.id !== invoice.id && inv.invoiceNumber !== invoice.invoiceNumber
    );
    const updatedInvoices = [invoice, ...filteredInvoices];
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(updatedInvoices));

    // Synchronisation en arrière-plan avec Supabase Cloud
    saveStudentToSupabase(student, 'epc-manoi').catch(() => {});

    // 3. Déclenchement événement custom pour réactivité immédiate dans l'onglet
    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { student, invoice },
      })
    );
  } catch (error) {
    console.error('Erreur sauvegarde live-store:', error);
  }
}

/**
 * Met à jour un élève existant et synchronise automatiquement sa facture / caisse
 * et notifie le tableau de bord et toutes les vues actives.
 */
export function updateRegisteredStudent(student: Student): void {
  if (typeof window === 'undefined') return;

  try {
    // 1. Mise à jour de l'élève
    const rawStudents = localStorage.getItem(STUDENTS_STORAGE_KEY);
    const prevStudents: Student[] = rawStudents ? JSON.parse(rawStudents) : [];
    const updatedStudents = [
      student,
      ...prevStudents.filter((s) => s.id !== student.id && s.studentNumber !== student.studentNumber),
    ];
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updatedStudents));

    // 2. Mise à jour ou création de la facture correspondante
    const rawInvoices = localStorage.getItem(INVOICES_STORAGE_KEY);
    const prevInvoices: Invoice[] = rawInvoices ? JSON.parse(rawInvoices) : [];
    
    const existingInv = prevInvoices.find(
      (inv) => inv.studentId === student.id || inv.invoiceNumber === student.studentNumber
    );

    const updatedInvoice: Invoice = existingInv ? {
      ...existingInv,
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

    // Synchronisation en arrière-plan avec Supabase Cloud
    saveStudentToSupabase(student, 'epc-manoi').catch(() => {});

    // 3. Propagation globale de l'événement
    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { student, invoice: updatedInvoice },
      })
    );
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
  roleId: 'directeur' | 'assistant_direction' | 'fondateur' | 'comptable' | 'secretaire' | 'enseignant' | 'parent';
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

const STAFF_USERS_STORAGE_KEY = 'schoolflow_registered_staff_v1';

export const defaultStaffUsers: StaffUser[] = [
  {
    id: 'staff-001',
    fullName: 'M. Jean-Marc Kouassi',
    role: 'Directeur des Études (Admin)',
    roleId: 'directeur',
    matricule: 'EMP-DIR-001',
    subjectOrGrade: 'Direction des Études & Pédagogie',
    assignedClasses: 'Toutes les classes',
    diplomaOrExperience: 'Master en Gestion des Établissements Scolaires (15 ans exp.)',
    address: 'Cocody Riviera 3, Abidjan',
    joinDate: '01/09/2018',
    email: 'direction@mon-etablissement.com',
    phone: '+225 07 45 67 89 01',
    authCode: 'DIR-2026',
    status: 'Actif',
    lastLogin: '31/08/2026 à 08:30',
  },
  {
    id: 'staff-008',
    fullName: 'Mme Clarisse Touré',
    role: 'Assistant(e) de Direction',
    roleId: 'assistant_direction',
    matricule: 'EMP-AST-008',
    subjectOrGrade: 'Coordination & Scolarités',
    assignedClasses: 'Maternelle à 3ème',
    diplomaOrExperience: 'Licence en Administration Scolaire (7 ans exp.)',
    address: 'Angré 8ème Tranche, Abidjan',
    joinDate: '01/09/2021',
    email: 'adjointe@mon-etablissement.com',
    phone: '+225 07 22 33 44 55',
    authCode: 'AST-2026',
    status: 'Actif',
    lastLogin: '31/08/2026 à 08:15',
  },
  {
    id: 'staff-002',
    fullName: 'Mr Lawani El Hadj',
    role: 'Fondateur / Fondatrice (Supervision)',
    roleId: 'fondateur',
    matricule: 'EMP-FND-002',
    subjectOrGrade: 'Présidence & Conseil d\'Administration',
    email: 'fondateur@mon-etablissement.com',
    phone: '+225 07 11 22 33 44',
    authCode: 'FND-2026',
    status: 'Actif',
    lastLogin: '30/08/2026 à 15:45',
  },
  {
    id: 'staff-003',
    fullName: 'Mme Aïcha Diop',
    role: 'Comptable / Gestionnaire',
    roleId: 'comptable',
    matricule: 'EMP-CPT-003',
    subjectOrGrade: 'Comptabilité & Caisse',
    email: 'comptabilite@mon-etablissement.com',
    phone: '+225 05 66 77 88 99',
    authCode: 'CPT-2026',
    status: 'Actif',
    lastLogin: '31/08/2026 à 09:12',
  },
  {
    id: 'staff-004',
    fullName: 'Mme Estelle Kouamé',
    role: 'Secrétaire de Direction',
    roleId: 'secretaire',
    matricule: 'EMP-SEC-005',
    subjectOrGrade: 'Accueil & Scolarités',
    email: 'secretariat@mon-etablissement.com',
    phone: '+225 07 88 99 00 11',
    authCode: 'SEC-2026',
    status: 'Actif',
    lastLogin: '31/08/2026 à 08:00',
  },
  {
    id: 'staff-005',
    fullName: 'M. Koffi Sylvain',
    role: 'Enseignant / Professeur',
    roleId: 'enseignant',
    matricule: 'EMP-ENS-004',
    subjectOrGrade: 'Mathématiques & SVT (Collège)',
    email: 'prof.koffi@mon-etablissement.com',
    phone: '+225 01 23 45 67 89',
    authCode: 'ENS-2026',
    status: 'Actif',
    lastLogin: '30/08/2026 à 18:20',
  },
  {
    id: 'staff-006',
    fullName: 'Mme Bamba Fatou',
    role: 'Enseignant / Professeur',
    roleId: 'enseignant',
    matricule: 'EMP-ENS-006',
    subjectOrGrade: 'Français & Histoire-Géo',
    email: 'prof.bamba@mon-etablissement.com',
    phone: '+225 07 99 88 77 66',
    authCode: 'ENS-7842',
    status: 'Actif',
    lastLogin: '29/08/2026 à 14:10',
  },
  {
    id: 'staff-007',
    fullName: 'M. Yao Kouamé',
    role: 'Enseignant / Professeur',
    roleId: 'enseignant',
    matricule: 'EMP-ENS-007',
    subjectOrGrade: 'Maître titulaire CM2',
    email: 'prof.yao@mon-etablissement.com',
    phone: '+225 05 44 33 22 11',
    authCode: 'ENS-9130',
    status: 'Actif',
    lastLogin: '31/08/2026 à 07:45',
  },
];

export function getLiveStaffUsers(schoolSlug: string = 'epc-manoi'): StaffUser[] {
  if (typeof window === 'undefined') return defaultStaffUsers;
  try {
    const sub = getSchoolSubscription(schoolSlug);
    const storageKey = `${STAFF_USERS_STORAGE_KEY}_${schoolSlug}`;
    let raw = localStorage.getItem(storageKey);
    if (!raw && schoolSlug === 'epc-manoi') {
      raw = localStorage.getItem(STAFF_USERS_STORAGE_KEY);
    }

    if (sub.isDataReset) {
      if (raw) {
        const parsed: StaffUser[] = JSON.parse(raw);
        return parsed;
      }
      const school = getLiveSchool(schoolSlug);
      const onlyDirector: StaffUser[] = [
        {
          id: 'staff-001',
          fullName: school.directorName || 'Directeur Général (Admin)',
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
      localStorage.setItem(storageKey, JSON.stringify(onlyDirector));
      return onlyDirector;
    }

    if (raw) {
      return JSON.parse(raw);
    }

    // Si nouvelle école (pas epc-manoi)
    if (schoolSlug !== 'epc-manoi' && schoolSlug !== 'college-excellence') {
      const school = getLiveSchool(schoolSlug);
      const onlyDirector: StaffUser[] = [
        {
          id: 'staff-001',
          fullName: school.directorName || 'Directeur Général (Admin)',
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
      localStorage.setItem(storageKey, JSON.stringify(onlyDirector));
      return onlyDirector;
    }

    // Par défaut pour epc-manoi si non réinitialisé
    localStorage.setItem(STAFF_USERS_STORAGE_KEY, JSON.stringify(defaultStaffUsers));
    localStorage.setItem(storageKey, JSON.stringify(defaultStaffUsers));
    return defaultStaffUsers;
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
    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { staffUsers: users, schoolSlug },
      })
    );
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

export function recordStaffLogin(
  roleId: string,
  fullName: string,
  authCode?: string,
  schoolSlug: string = 'epc-manoi',
  extraDetails?: { email?: string; phone?: string; subjectOrGrade?: string; assignedClasses?: string }
): void {
  if (typeof window === 'undefined') return;
  try {
    const users = getLiveStaffUsers(schoolSlug);
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} à ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let matched = false;
    const updated = users.map((u) => {
      if (
        (authCode && u.authCode.toUpperCase() === authCode.trim().toUpperCase()) ||
        (u.roleId === roleId && u.fullName.toLowerCase().includes(fullName.trim().toLowerCase())) ||
        (u.roleId === roleId && roleId === 'directeur')
      ) {
        matched = true;
        return {
          ...u,
          fullName: fullName.trim() || u.fullName,
          lastLogin: formattedDate,
          status: 'Actif' as const,
        };
      }
      return u;
    });

    // Si le membre se connecte pour la première fois avec le code de son poste : on l'ajoute automatiquement à la liste du personnel !
    if (!matched && roleId !== 'parent') {
      const roleTitles: Record<string, string> = {
        assistant_direction: 'Assistant(e) de Direction',
        fondateur: 'Fondateur / Fondatrice (Supervision)',
        comptable: 'Comptable / Gestionnaire',
        secretaire: 'Secrétaire de Direction',
        enseignant: 'Enseignant / Professeur',
      };

      const newMember: StaffUser = {
        id: `staff-${Date.now()}`,
        fullName: fullName.trim(),
        role: roleTitles[roleId] || 'Personnel Établissement',
        roleId: roleId as any,
        matricule: `EMP-${roleId.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
        subjectOrGrade: extraDetails?.subjectOrGrade || (roleId === 'enseignant' ? 'Enseignement Général' : roleId === 'comptable' ? 'Comptabilité & Caisse' : roleId === 'secretaire' ? 'Accueil & Scolarité' : 'Administration'),
        assignedClasses: extraDetails?.assignedClasses || 'Toutes les classes',
        email: extraDetails?.email || `${roleId}@${schoolSlug}.ci`,
        phone: extraDetails?.phone || '+225 07 00 00 00 00',
        authCode: authCode || `${roleId.slice(0, 3).toUpperCase()}-2026`,
        status: 'Actif',
        lastLogin: formattedDate,
      };

      updated.push(newMember);
    }

    saveLiveStaffUsers(updated, schoolSlug);
  } catch (e) {}
}

export function addLiveStaffUser(user: StaffUser, schoolSlug: string = 'epc-manoi'): void {
  const users = getLiveStaffUsers(schoolSlug);
  const next = [user, ...users.filter((u) => u.id !== user.id)];
  saveLiveStaffUsers(next, schoolSlug);
}

// ════════════════════════════════════════════════════════════════
// GESTION DES ABONNEMENTS, ÉTABLISSEMENTS ENREGISTRÉS & ACCÈS
// ════════════════════════════════════════════════════════════════

const DELETED_SCHOOLS_KEY = 'schoolflow_deleted_schools_v1';
const SCHOOL_STATUS_PREFIX = 'schoolflow_school_status_v1_';
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

    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { action: 'school_registered', school },
      })
    );
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

export function resetSchoolData(
  slug: string = 'epc-manoi',
  options?: {
    scope?: 'all' | 'custom';
    resetComptable?: boolean;
    resetSecretaire?: boolean;
    resetFondateur?: boolean;
    resetEnseignants?: boolean;
    resetParents?: boolean;
    resetStaffList?: boolean;
  }
): void {
  if (typeof window === 'undefined') return;
  try {
    const school = getLiveSchool(slug);
    const storageStaffKey = `${STAFF_USERS_STORAGE_KEY}_${slug}`;

    // 1. Vider le registre des élèves et factures (Scolarités, Caisse, Inscriptions)
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify([]));
    localStorage.removeItem(DELETED_STUDENTS_STORAGE_KEY);
    localStorage.removeItem('schoolflow_notes_diverses_v1');
    localStorage.removeItem('schoolflow_diverse_notes_v1');
    localStorage.removeItem('schoolflow_special_discounts_v1');
    localStorage.removeItem('schoolflow_staff_salaries_v1');
    localStorage.removeItem('schoolflow_school_expenses_v1');
    localStorage.removeItem('schoolflow_expenses_v1');
    localStorage.removeItem('schoolflow_attendance_v1');
    localStorage.removeItem('schoolflow_canteen_subscriptions_v2');
    localStorage.removeItem('schoolflow_canteen_monthly_payments_v2');
    localStorage.removeItem('schoolflow_canteen_meals_history_v2');
    localStorage.removeItem('schoolflow_transport_subscriptions_v2');
    localStorage.removeItem('schoolflow_transport_monthly_payments_v2');
    localStorage.removeItem('schoolflow_boarding_subscriptions_v3');
    localStorage.removeItem('schoolflow_boarding_monthly_payments_v3');
    localStorage.removeItem(`schoolflow_boarding_capacity_${slug}`);
    localStorage.removeItem('schoolflow_parent_messages_v1');
    localStorage.removeItem('schoolflow_broadcast_records_v1');
    localStorage.removeItem(VALIDATED_BULLETINS_KEY);
    localStorage.removeItem(DOCS_STATUS_KEY);
    localStorage.removeItem('schoolflow_documents_status_v2');
    localStorage.removeItem('schoolflow_documents_status_v3');

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

    // 2. Réinitialiser la liste du personnel : SEUL LE DIRECTEUR EST PRÉSENT
    const onlyDirector: StaffUser[] = [
      {
        id: 'staff-001',
        fullName: school.directorName || 'Directeur Général (Admin)',
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

    // 4. Émettre l'événement global pour actualiser toutes les pages en direct
    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { action: 'data_reset', slug },
      })
    );
  } catch (e) {
    console.error('Erreur réinitialisation données école:', e);
  }
}

/**
 * Supprime définitivement le compte de l'école et toutes ses données associées.
 * La connexion sera désormais refusée avec affichage du message bloquant.
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
    localStorage.removeItem(INVOICES_STORAGE_KEY);
    localStorage.removeItem(DELETED_STUDENTS_STORAGE_KEY);
    localStorage.removeItem('schoolflow_notes_diverses_v1');
    localStorage.removeItem('schoolflow_diverse_notes_v1');
    localStorage.removeItem('schoolflow_special_discounts_v1');
    localStorage.removeItem('schoolflow_staff_salaries_v1');
    localStorage.removeItem('schoolflow_school_expenses_v1');
    localStorage.removeItem('schoolflow_expenses_v1');
    localStorage.removeItem('schoolflow_attendance_v1');
    localStorage.removeItem('schoolflow_canteen_subscriptions_v2');
    localStorage.removeItem('schoolflow_canteen_monthly_payments_v2');
    localStorage.removeItem('schoolflow_transport_subscriptions_v2');
    localStorage.removeItem('schoolflow_transport_monthly_payments_v2');
    localStorage.removeItem('schoolflow_boarding_subscriptions_v3');
    localStorage.removeItem('schoolflow_boarding_monthly_payments_v3');
    localStorage.removeItem(`schoolflow_boarding_capacity_${slug}`);
    localStorage.removeItem('schoolflow_parent_messages_v1');
    localStorage.removeItem('schoolflow_broadcast_records_v1');
    localStorage.removeItem('schoolflow_active_session_v2');
    localStorage.removeItem(VALIDATED_BULLETINS_KEY);
    localStorage.removeItem(DOCS_STATUS_KEY);
    localStorage.removeItem(`${SCHOOL_SETTINGS_PREFIX}${slug}`);
    localStorage.removeItem(`${SCHOOL_SETTINGS_PREFIX}epc-manoi`);
    localStorage.removeItem(`${SCHOOL_SETTINGS_PREFIX}college-excellence`);
    localStorage.removeItem('schoolflow_active_school_settings_v1');
    localStorage.removeItem(`${STAFF_USERS_STORAGE_KEY}_${slug}`);

    // 3. Marquer le statut comme supprimé
    const status = getSchoolSubscription(slug);
    status.isDeleted = true;
    status.deletedAt = new Date().toISOString();
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}${slug}`, JSON.stringify(status));
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}epc-manoi`, JSON.stringify(status));
    localStorage.setItem(`${SCHOOL_STATUS_PREFIX}college-excellence`, JSON.stringify(status));

    // 4. Émettre événement global
    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { action: 'school_deleted', slug },
      })
    );
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

    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { action: 'school_restored', slug },
      })
    );
  } catch (e) {}
}

const VALIDATED_BULLETINS_KEY = 'schoolflow_validated_class_bulletins_v1';

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

    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { action: 'bulletins_validated', grade, period, count: rankings.length },
      })
    );
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

    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { action: 'bulletins_cleared', grade, period },
      })
    );
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
// GESTION RÉACTIVE & CENTRALISÉE DES DOCUMENTS SCOLAIRES
// ═══════════════════════════════════════════════════════════════

export const DOCS_STATUS_KEY = 'schoolflow_documents_status_v5';

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

    window.dispatchEvent(
      new CustomEvent(DATA_UPDATED_EVENT, {
        detail: { action: 'document_updated', studentId, record },
      })
    );
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

