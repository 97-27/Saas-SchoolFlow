// Module SERVEUR uniquement : utilise la clé service_role (lib/supabase/admin.ts). Les composants
// navigateur doivent importer lib/supabase/remote.ts, qui passe par les routes API protégées.
import { supabaseAdmin as supabase } from './admin';
import { isSupabaseConfigured } from './client';
import { School, Student, Invoice } from '@/lib/data/types';
import { LEGACY_DEMO_STUDENT_IDS } from '@/lib/data/legacy-ids';
import { cleanDisplayAddress } from '@/lib/utils/formatters';
import { normalizePhone } from '@/lib/data/student-match';

/**
 * ══════════════════════════════════════════════════════════════════
 * SERVICES SUPABASE : SYNCHRONISATION LIVE & BASE DE DONNÉES RÉELLE
 * ══════════════════════════════════════════════════════════════════
 */

const schoolIdCache = new Map<string, string>([
  ['epc-manoi', 'f72b9cc2-90c5-43a6-a584-d16c1c485a77'],
  ['college-excellence', 'f72b9cc2-90c5-43a6-a584-d16c1c485a77']
]); // slug → UUID

async function getSchoolId(slug: string): Promise<string | null> {
  // Ne jamais retomber silencieusement sur l'ecole pilote quand le slug est vide/undefined
  // (bug de course possible avant hydratation) : cela lisait/ecrivait dans les vraies donnees
  // de production d'EPC MANOI a la place de l'ecole appelante.
  if (!slug) return null;
  const cleanSlug = slug === 'college-excellence' ? 'epc-manoi' : slug;
  if (schoolIdCache.has(cleanSlug)) return schoolIdCache.get(cleanSlug)!;
  try {
    const { data } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();
    if (data?.id) {
      schoolIdCache.set(cleanSlug, data.id);
      return data.id;
    }
  } catch (e) {}
  return null;
}

// 1. GESTION DES ÉCOLES (SCHOOLS)
export async function getSchoolFromSupabase(slug: string): Promise<School | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cleanSlug = slug === 'college-excellence' ? 'epc-manoi' : slug;
    let { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (!data) return null;

    // Récupérer le cachet officiel ET les informations complémentaires (code du Ministère,
    // numéro d'agrément) : la table "schools" n'a pas de colonne dédiée pour ces champs, donc
    // ils étaient jusqu'ici purement locaux au navigateur — jamais synchronisés vers les autres
    // appareils ni relus après un rafraîchissement Supabase, ce qui les faisait réapparaître
    // comme "non configurés" alors qu'ils l'étaient bel et bien sur l'appareil d'origine.
    let stampUrl = '';
    let ministryCode = '';
    let approvalNumber = '';
    try {
      const { data: stampRow } = await supabase
        .from('staff_users')
        .select('avatar_url, department')
        .eq('school_id', data.id)
        .eq('role_id', 'school_stamp')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (stampRow?.avatar_url) {
        stampUrl = stampRow.avatar_url;
      }
      if (stampRow?.department) {
        try {
          const extra = JSON.parse(stampRow.department);
          ministryCode = extra.ministryCode || '';
          approvalNumber = extra.approvalNumber || '';
        } catch (e) {}
      }
    } catch (e) {}

    return {
      id: data.id,
      slug: data.slug,
      name: data.name,
      shortName: data.short_name || '',
      motto: data.motto || 'Discipline • Rigueur • Réussite',
      slogan: data.slogan || 'La Lumière du Savoir',
      logoUrl: data.logo_url || '',
      countryEmblemUrl: data.country_emblem_url || '',
      stampUrl: stampUrl,
      ministryCode: ministryCode,
      approvalNumber: approvalNumber,
      logoColor: data.logo_color || '#059669',
      city: data.city || 'Abidjan',
      country: data.country || 'Côte d’Ivoire',
      district: data.district || '',
      phone: data.phone || '',
      whatsappPhone: data.whatsapp_phone || '',
      email: data.email || '',
      website: data.website || '',
      academicYear: data.academic_year || '2026-2027',
      currentTerm: data.current_term || 'Trimestre 1',
      founderName: data.founder_name || '',
      directorName: data.director_name || '',
      subscriptionPlan: data.subscription_plan || 'annuel',
      subscriptionPrice: Number(data.subscription_price) || 250000,
      status: data.status || 'active',
      createdAt: data.created_at,
    };
  } catch (err) {
    console.error('Erreur getSchoolFromSupabase:', err);
    return null;
  }
}

export async function getAllSchoolsFromSupabase(): Promise<School[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      shortName: d.short_name || d.name.slice(0, 8).toUpperCase(),
      logoColor: d.logo_color || '#059669',
      academicYear: d.academic_year || '2026-2027',
      currentTerm: d.current_term || 'Trimestre 1',
      termType: 'trimestriel',
      phone: d.phone || '',
      whatsappPhone: d.whatsapp_phone || d.phone || '',
      email: d.email || '',
      motto: d.motto || 'Discipline • Rigueur • Réussite',
      slogan: d.slogan || 'La Lumière du Savoir',
      city: d.city || 'Abidjan',
      country: d.country || 'Côte d’Ivoire',
      district: d.district || 'Abidjan',
      ministryCode: '',
      founderName: d.founder_name || 'Fondateur / Promoteur',
      directorName: d.director_name || 'Directeur Général',
      studiesDirectorName: d.director_name || 'Direction des Études',
      logoUrl: d.logo_url || '',
      stampUrl: '',
      countryEmblemUrl: d.country_emblem_url || '',
      status: (d.status as any) || 'active',
      subscriptionPlan: (d.subscription_plan as any) || 'annuel',
      subscriptionPrice: Number(d.subscription_price) || 250000,
      subscriptionActive: d.status === 'active',
      createdAt: d.created_at,
    }));
  } catch (e) {
    return [];
  }
}

export async function saveSchoolToSupabase(school: School): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  if (!school.slug || school.slug === 'college-excellence') return true; // Refuser de sauvegarder l'école exemple college-excellence
  try {
    const payload: Record<string, any> = {
      slug: school.slug,
      name: school.name,
      short_name: school.shortName,
      motto: school.motto,
      slogan: school.slogan,
      logo_color: school.logoColor || '#059669',
      city: school.city,
      country: school.country,
      district: school.district,
      phone: school.phone,
      whatsapp_phone: school.whatsappPhone,
      email: school.email,
      website: school.website,
      academic_year: school.academicYear || '2026-2027',
      current_term: school.currentTerm || 'Trimestre 1',
      founder_name: school.founderName,
      director_name: school.directorName,
      subscription_plan: school.subscriptionPlan || 'annuel',
      subscription_price: school.subscriptionPrice || 250000,
      status: school.status || 'active',
      updated_at: new Date().toISOString(),
    };

    if (school.logoUrl !== undefined && school.logoUrl !== '') {
      payload.logo_url = school.logoUrl;
    }
    if (school.countryEmblemUrl !== undefined && school.countryEmblemUrl !== '') {
      payload.country_emblem_url = school.countryEmblemUrl;
    }

    const { data: upsertedSchool, error } = await supabase
      .from('schools')
      .upsert(payload, { onConflict: 'slug' })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Erreur saveSchoolToSupabase:', error.message);
      return false;
    }

    // Sauvegarder le cachet officiel ET le code du Ministère / numéro d'agrément dans Supabase
    // Cloud (aucune colonne dédiée sur "schools" pour ces trois champs : réutilise la ligne
    // synthétique "school_stamp" déjà utilisée pour le cachet, comme le fait le reste du code
    // pour les données système sans colonne propre — ex: notes diverses, messages parents).
    const schoolId = upsertedSchool?.id;
    const hasStamp = school.stampUrl && school.stampUrl.trim() !== '';
    const hasMinistryCode = school.ministryCode && school.ministryCode.trim() !== '';
    const hasApprovalNumber = school.approvalNumber && school.approvalNumber.trim() !== '';
    if (schoolId && (hasStamp || hasMinistryCode || hasApprovalNumber)) {
      try {
        const extraInfo = JSON.stringify({
          ministryCode: school.ministryCode || '',
          approvalNumber: school.approvalNumber || '',
        });

        const { data: existingStamp } = await supabase
          .from('staff_users')
          .select('id')
          .eq('school_id', schoolId)
          .eq('role_id', 'school_stamp')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const updatePayload: Record<string, any> = { department: extraInfo };
        if (hasStamp) updatePayload.avatar_url = school.stampUrl;

        if (existingStamp?.id) {
          await supabase
            .from('staff_users')
            .update(updatePayload)
            .eq('id', existingStamp.id);
        } else {
          await supabase.from('staff_users').insert({
            school_id: schoolId,
            role_id: 'school_stamp',
            role_title: 'Cachet Officiel',
            full_name: 'Cachet & Tampon Établissement',
            auth_code: 'STAMP-2026',
            is_active: true,
            department: extraInfo,
            ...(hasStamp ? { avatar_url: school.stampUrl } : {}),
          });
        }
      } catch (stampErr) {
        console.warn('Erreur sauvegarde stamp/infos école dans Supabase:', stampErr);
      }
    }

    return true;
  } catch (err) {
    console.error('Erreur saveSchoolToSupabase catch:', err);
    return false;
  }
}

/**
 * Crée une TOUTE NOUVELLE école lors d'une inscription — jamais un upsert(onConflict:'slug')
 * comme saveSchoolToSupabase (adapté aux mises à jour d'une école déjà existante). Un upsert
 * ici aurait fusionné silencieusement dans la ligne d'une AUTRE école si le slug généré côté
 * client entrait en collision (course entre deux inscriptions simultanées, ou simple vérif
 * d'unicité échouée par une panne réseau passagère) : le sigle, le nom, les coordonnées de
 * l'ancienne école auraient été écrasés par les nouvelles, et le nouveau Directeur/Fondateur
 * se serait vu attribuer l'accès aux vraies données (élèves, paiements) de cette autre école.
 * Un vrai INSERT échoue proprement sur la contrainte d'unicité du slug en cas de collision
 * (code Postgres 23505) au lieu d'écraser quoi que ce soit — l'appelant peut alors régénérer
 * un autre slug et réessayer.
 */
export async function createNewSchoolInSupabase(
  school: School
): Promise<{ success: boolean; collision?: boolean; id?: string }> {
  if (!isSupabaseConfigured) return { success: false };
  if (!school.slug || school.slug === 'college-excellence') return { success: false };
  try {
    const payload: Record<string, any> = {
      slug: school.slug,
      name: school.name,
      short_name: school.shortName,
      motto: school.motto,
      slogan: school.slogan,
      logo_color: school.logoColor || '#059669',
      city: school.city,
      country: school.country,
      district: school.district,
      phone: school.phone,
      whatsapp_phone: school.whatsappPhone,
      email: school.email,
      website: school.website,
      academic_year: school.academicYear || '2026-2027',
      current_term: school.currentTerm || 'Trimestre 1',
      founder_name: school.founderName,
      director_name: school.directorName,
      subscription_plan: school.subscriptionPlan || 'annuel',
      subscription_price: school.subscriptionPrice || 250000,
      status: school.status || 'active',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('schools')
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (error) {
      // Code Postgres pour violation de contrainte unique/exclusion — le slug existe déjà.
      const isUniqueViolation = (error as any).code === '23505';
      if (!isUniqueViolation) {
        console.error('Erreur createNewSchoolInSupabase:', error.message);
      }
      return { success: false, collision: isUniqueViolation };
    }

    if (data?.id) {
      schoolIdCache.set(school.slug, data.id);
    }
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('Erreur createNewSchoolInSupabase catch:', err);
    return { success: false };
  }
}

// Durée de chaque forfait d'abonnement, en mois — sert à calculer l'échéance réelle.
const SUBSCRIPTION_PLAN_MONTHS: Record<string, number> = {
  mensuel: 1,
  annuel: 12,
  triennal: 36,
};

export interface SchoolSubscriptionInfo {
  isExpired: boolean;
  endDate: string; // ISO
  plan: string;
  daysRemaining: number;
}

/**
 * Calcule l'échéance réelle de l'abonnement d'une école directement depuis la base Cloud
 * partagée (jamais depuis le localStorage, qui peut être vidé ou falsifié depuis l'appareil).
 * L'échéance de base = date d'inscription réelle (created_at, colonne immuable posée une seule
 * fois à la création de la ligne) + la durée du forfait souscrit. Un renouvellement manuel
 * (paiement confirmé hors application) peut prolonger cette échéance via renewSchoolSubscription
 * ci-dessous, stocké dans une fiche staff_users synthétique (même procédé déjà utilisé pour le
 * cachet officiel et les données de services — aucune colonne dédiée n'existe sur "schools").
 */
export async function getSchoolSubscriptionInfo(slug: string): Promise<SchoolSubscriptionInfo | null> {
  if (!isSupabaseConfigured || !slug) return null;
  try {
    const cleanSlug = slug === 'college-excellence' ? 'epc-manoi' : slug;
    const { data: school } = await supabase
      .from('schools')
      .select('id, created_at, subscription_plan')
      .eq('slug', cleanSlug)
      .maybeSingle();
    if (!school?.id || !school.created_at) return null;

    const months = SUBSCRIPTION_PLAN_MONTHS[school.subscription_plan] || 12;
    const baseEnd = new Date(school.created_at);
    baseEnd.setMonth(baseEnd.getMonth() + months);

    let overrideEnd: Date | null = null;
    const { data: overrideRow } = await supabase
      .from('staff_users')
      .select('department')
      .eq('school_id', school.id)
      .eq('role_id', 'system_subscription_override')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (overrideRow?.department) {
      try {
        const parsed = JSON.parse(overrideRow.department);
        if (parsed.overrideEndDate) {
          const d = new Date(parsed.overrideEndDate);
          if (!isNaN(d.getTime())) overrideEnd = d;
        }
      } catch (e) {}
    }

    const effectiveEnd = overrideEnd && overrideEnd.getTime() > baseEnd.getTime() ? overrideEnd : baseEnd;
    const now = new Date();
    const daysRemaining = Math.ceil((effectiveEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      isExpired: now.getTime() > effectiveEnd.getTime(),
      endDate: effectiveEnd.toISOString(),
      plan: school.subscription_plan || 'annuel',
      daysRemaining,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Renouvelle manuellement l'abonnement d'une école (paiement confirmé hors application, par
 * ex. virement/Orange Money reçu directement) en prolongeant son échéance de N mois à partir
 * d'aujourd'hui OU de son échéance actuelle si elle n'est pas encore dépassée (le renouvellement
 * s'ajoute au temps restant plutôt que de le perdre).
 */
export async function renewSchoolSubscription(
  slug: string,
  additionalMonths: number,
  note?: string
): Promise<{ success: boolean; newEndDate?: string }> {
  if (!isSupabaseConfigured || !slug || additionalMonths <= 0) return { success: false };
  try {
    const cleanSlug = slug === 'college-excellence' ? 'epc-manoi' : slug;
    const schoolId = await getSchoolId(cleanSlug);
    if (!schoolId) return { success: false };

    const current = await getSchoolSubscriptionInfo(cleanSlug);
    const base = current && !current.isExpired ? new Date(current.endDate) : new Date();
    base.setMonth(base.getMonth() + additionalMonths);
    const newEndDate = base.toISOString();

    const payload = {
      overrideEndDate: newEndDate,
      renewedAt: new Date().toISOString(),
      additionalMonths,
      note: note || '',
    };

    const { data: existing } = await supabase
      .from('staff_users')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role_id', 'system_subscription_override')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase.from('staff_users').update({ department: JSON.stringify(payload) }).eq('id', existing.id);
    } else {
      await supabase.from('staff_users').insert({
        school_id: schoolId,
        role_id: 'system_subscription_override',
        role_title: 'Renouvellement Abonnement (Système)',
        full_name: 'SYSTEM SUBSCRIPTION OVERRIDE',
        auth_code: 'SYS-SUB-OVERRIDE',
        is_active: true,
        department: JSON.stringify(payload),
      });
    }

    return { success: true, newEndDate };
  } catch (e) {
    console.error('Erreur renewSchoolSubscription:', e);
    return { success: false };
  }
}

// 2. GESTION DES ÉLÈVES (STUDENTS)
export async function getStudentsFromSupabase(schoolSlug: string): Promise<Student[]> {
  if (!isSupabaseConfigured || !schoolSlug) return [];
  try {
    const cleanSlug = schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug;
    const slugs = [cleanSlug];

    const { data: schools } = await supabase
      .from('schools')
      .select('id')
      .in('slug', slugs);

    if (!schools || schools.length === 0) return [];
    const schoolIds = schools.map((s: any) => s.id);

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .in('school_id', schoolIds)
      .order('student_number', { ascending: true });

    if (error || !data) return [];

    // Chaque ligne de la table est un élève réel (la base interdit déjà deux fois le même numéro
    // de dossier dans une école). On ne retire donc que les répétitions exactes d'identifiant ou de
    // numéro, JAMAIS par le nom : deux enfants homonymes (ex : deux « BAMBA Awa », CE2 et 6ème)
    // sont deux élèves distincts, et l'un des deux disparaissait de toutes les listes et effectifs.
    const seenIds = new Set<string>();
    const seenNumbers = new Set<string>();
    const uniqueData: any[] = [];
    for (const d of data) {
      if (LEGACY_DEMO_STUDENT_IDS.has(d.id)) continue;
      const numKey = (d.student_number || '').trim().toUpperCase();
      if (seenIds.has(d.id) || (numKey && seenNumbers.has(numKey))) continue;
      seenIds.add(d.id);
      if (numKey) seenNumbers.add(numKey);
      uniqueData.push(d);
    }

    return uniqueData.map((d: any) => {
      let meta: any = {};
      let cleanAddress = cleanDisplayAddress(d.address || '');
      try {
        // Le bloc [SF_META:{...}] est toujours ajouté une seule fois en fin de chaîne
        // d'adresse (voir saveStudentToSupabase / batchUpsertStudents plus bas). Un match
        // non-glouton "(.*?)\]" s'arrêtait au premier "]" rencontré — quasi systématiquement
        // celui de "secondaryPhones":[] (vide pour la quasi-totalité des élèves), qui apparaît
        // AVANT la fin réelle du JSON. Le JSON.parse échouait alors silencieusement (catch
        // vide plus bas), et TOUTES les métadonnées (date d'inscription, versements/échéances,
        // notes, internat) retombaient sur leurs valeurs par défaut à chaque lecture — même
        // juste après une sauvegarde réussie. Ancré en fin de chaîne (glouton) pour capturer le
        // JSON complet, quel que soit son contenu interne.
        const match = (d.address || '').match(/\[SF_META:([\s\S]*)\]\s*$/);
        if (match && match[1]) {
          meta = JSON.parse(match[1]);
        }
      } catch (e) {}

      // Formater la date en YYYY-MM-DD strictement valide pour les inputs de type date
      const parseIsoDate = (dt: any, fallback: string) => {
        if (!dt) return fallback;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) return dt;
        try {
          const parsed = new Date(dt);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
          }
        } catch (e) {}
        return fallback;
      };

      const defaultDate = '2026-09-07';
      const enrollmentDate = parseIsoDate(meta.enrollmentDate, defaultDate);
      const paymentDate = parseIsoDate(meta.paymentDate, enrollmentDate);
      const isBoarding = Boolean(
        meta.isBoarding ||
        (meta.notes && meta.notes.toLowerCase().includes('internat (oui)')) ||
        (d.address && d.address.toLowerCase().includes('internat (oui)'))
      );

      return {
        id: d.id,
        studentNumber: d.student_number,
        matricule: d.matricule || '',
        firstName: d.first_name,
        lastName: d.last_name,
        fullName: d.full_name,
        grade: d.grade,
        gender: d.gender,
        dateOfBirth: d.date_of_birth || '',
        address: cleanAddress,
        guardianName: d.guardian_name,
        guardianPhone: d.guardian_phone,
        whatsappPhone: d.whatsapp_phone || '',
        secondaryPhones: meta.secondaryPhones || [],
        // Pas de photo : vide (l'écran affiche les initiales). Avant, la photo d'une inconnue
        // (banque d'images) s'affichait à la place, puis était parfois enregistrée sur la fiche.
        avatar: d.avatar_url && !d.avatar_url.includes('images.unsplash.com') ? d.avatar_url : '',
        enrollmentType: d.enrollment_type || 'nouveau',
        registrationFee: Number(d.registration_fee) || 0,
        tuitionAmount: Number(d.tuition_amount) || 0,
        discountAmount: Number(d.discount_amount) || 0,
        netAmount: Number(d.net_amount) || 0,
        paidAmount: Number(d.paid_amount) || 0,
        balanceRemaining: Number(d.balance_remaining) || 0,
        tuitionStatus: d.tuition_status || 'unpaid',
        attendanceRate: Number(d.attendance_rate) || 100,
        status: d.status || 'active',
        enrollmentDate: enrollmentDate,
        paymentDate: paymentDate,
        installments: meta.installments || {},
        notes: meta.notes || '',
        isBoarding: isBoarding,
        updatedAt: meta.updatedAt || d.updated_at || d.created_at || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error('Erreur getStudentsFromSupabase:', err);
    return [];
  }
}

export async function saveStudentToSupabase(
  student: Student,
  schoolSlug: string,
  opts: { identityOnly?: boolean; expectedVersements?: number[] | null } = {}
): Promise<boolean | 'conflict'> {
  if (!isSupabaseConfigured || !schoolSlug) return false;
  try {
    const cleanSlug = schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug;
    // Utiliser le cache pour éviter une requête school à chaque appel
    let schoolId = await getSchoolId(cleanSlug);

    if (!schoolId) {
      // Créer l'école si inexistante
      const { data: newSchool } = await supabase
        .from('schools')
        .insert({ slug: cleanSlug, name: cleanSlug.toUpperCase() })
        .select('id')
        .single();
      if (newSchool?.id) {
        schoolId = newSchool.id;
        schoolIdCache.set(cleanSlug, newSchool.id);
      }
    }

    if (!schoolId) return false;

    const metaObj = {
      enrollmentDate: student.enrollmentDate || student.paymentDate || '2026-09-07',
      paymentDate: student.paymentDate || student.enrollmentDate || '2026-09-07',
      installments: student.installments || {},
      updatedAt: student.updatedAt || new Date().toISOString(),
      secondaryPhones: student.secondaryPhones || [],
      notes: student.notes || '',
      isBoarding: Boolean(student.isBoarding || (student.notes && student.notes.toLowerCase().includes('internat (oui)'))),
    };
    const cleanAddress = cleanDisplayAddress(student.address || '');
    const addressWithMeta = `${cleanAddress} [SF_META:${JSON.stringify(metaObj)}]`;

    const payload = {
      school_id: schoolId,
      student_number: student.studentNumber,
      matricule: student.matricule,
      first_name: student.firstName || student.fullName.split(' ')[0] || '',
      last_name: student.lastName || student.fullName.split(' ').slice(1).join(' ') || '',
      full_name: student.fullName,
      grade: student.grade,
      gender: student.gender,
      date_of_birth: student.dateOfBirth || null,
      address: addressWithMeta,
      guardian_name: student.guardianName,
      guardian_phone: student.guardianPhone,
      whatsapp_phone: student.whatsappPhone,
      avatar_url: student.avatar,
      enrollment_type: student.enrollmentType || 'nouveau',
      registration_fee: student.registrationFee || 0,
      tuition_amount: student.tuitionAmount || 0,
      discount_amount: student.discountAmount || 0,
      net_amount: student.netAmount || student.tuitionAmount || 0,
      paid_amount: student.paidAmount || 0,
      balance_remaining: student.balanceRemaining || 0,
      tuition_status: student.tuitionStatus || 'unpaid',
      attendance_rate: student.attendanceRate || 100,
      status: student.status || 'active',
      updated_at: new Date().toISOString(),
    };

    // Où écrire, sans jamais écraser la fiche d'un autre élève (voir planStudentWrite)
    const rows = await loadStudentRows(schoolId);
    const index = indexStudentRows(rows);
    const plan = planStudentWrite(student, rows, index.byId, index.byNumber, index.maxNumber);
    if (plan.action === 'skip') {
      console.warn(`saveStudentToSupabase: ${student.studentNumber} ignoré (${plan.reason}).`);
      return true;
    }
    payload.student_number = plan.studentNumber;

    if (plan.action === 'update') {
      // Modification d'identité (nom, classe, contact, statut) : les montants et l'historique des
      // versements restent ceux de la BASE. Un appareil pas à jour ne peut donc plus effacer un
      // versement enregistré entre-temps sur un autre poste en corrigeant simplement un nom.
      let updatePayload: Record<string, any> = payload;
      const needsDbMeta = opts.identityOnly || Array.isArray(opts.expectedVersements);
      let dbMeta: any = {};
      if (needsDbMeta) {
        const { data: current, error: readErr } = await supabase
          .from('students')
          .select('address')
          .eq('id', plan.id)
          .eq('school_id', schoolId)
          .maybeSingle();
        // Base illisible : on n'écrit rien plutôt que de risquer d'effacer des versements.
        if (readErr) return false;
        const m = String(current?.address || '').match(/\[SF_META:([\s\S]*)\]\s*$/);
        if (m) {
          try {
            dbMeta = JSON.parse(m[1]);
          } catch (e) {}
        }
      }

      // CONTRÔLE DES VERSEMENTS : l'écran indique les versements qu'il avait affichés à l'ouverture
      // de la fiche. Si la base en contient d'autres (versement saisi sur un autre appareil, ou fiche
      // ouverte depuis une copie ancienne sans ses versements), l'enregistrement est REFUSÉ : avant,
      // il effaçait ces versements (constaté le 04/11 : 25 000 F de SORY Khadija, 40 000 F de SAYI
      // Hamza, 60 000 F de SORY Aboubacar…). Un renvoi identique (nouvel essai) reste accepté.
      if (!opts.identityOnly && Array.isArray(opts.expectedVersements)) {
        const amounts = (inst: any) =>
          [1, 2, 3, 4, 5].map((i) => Number(inst?.[`versement${i}`]?.amount) || 0);
        const dbAmounts = amounts(dbMeta.installments);
        const expected = [0, 1, 2, 3, 4].map((i) => Number(opts.expectedVersements![i]) || 0);
        const incoming = amounts(student.installments);
        const same = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);
        if (!same(dbAmounts, expected) && !same(dbAmounts, incoming)) {
          console.warn(`saveStudentToSupabase: conflit de versements pour ${student.studentNumber}, enregistrement refusé.`);
          return 'conflict';
        }
      }

      if (opts.identityOnly) {
        const mergedMeta = { ...metaObj, installments: dbMeta.installments ?? metaObj.installments };
        const {
          registration_fee: _rf,
          tuition_amount: _ta,
          discount_amount: _da,
          net_amount: _na,
          paid_amount: _pa,
          balance_remaining: _br,
          tuition_status: _ts,
          ...identity
        } = payload;
        updatePayload = { ...identity, address: `${cleanAddress} [SF_META:${JSON.stringify(mergedMeta)}]` };
      }
      const { error: updateErr } = await supabase
        .from('students')
        .update(updatePayload)
        .eq('id', plan.id)
        .eq('school_id', schoolId);
      if (updateErr) {
        console.error('Erreur saveStudentToSupabase update:', updateErr.message);
        return false;
      }
    } else {
      const { error: insertErr } = await supabase
        .from('students')
        .insert(payload);
      if (insertErr) {
        console.error('Erreur saveStudentToSupabase insert:', insertErr.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('Erreur saveStudentToSupabase catch:', err);
    return false;
  }
}

export async function batchUpsertStudents(students: Student[], schoolSlug: string): Promise<boolean> {
  if (!isSupabaseConfigured || !students || students.length === 0 || !schoolSlug) return false;
  try {
    const cleanSlug = schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug;
    const schoolId = await getSchoolId(cleanSlug);
    if (!schoolId) return false;

    // Résoudre l'id réel (clé primaire) de chaque élève existant avant l'upsert. La table
    // n'a pas de contrainte unique sur (school_id, student_number), donc upsert({onConflict:
    // 'school_id, student_number'}) ne détecte jamais de conflit et INSÈRE une nouvelle ligne
    // à chaque appel au lieu de mettre à jour — c'est ce qui a fait exploser la table students
    // à plus de 1600 lignes en doublon. On upsert désormais sur l'id (la vraie clé primaire).
    // Où écrire chaque élève, sans jamais écraser la fiche d'un autre (voir planStudentWrite).
    const rows = await loadStudentRows(schoolId);
    const index = indexStudentRows(rows);
    const planned: Array<{ student: Student; existingId?: string; studentNumber: string }> = [];
    for (const student of students) {
      const plan = planStudentWrite(student, rows, index.byId, index.byNumber, index.maxNumber);
      if (plan.action === 'skip') continue;
      const existingId = plan.action === 'update' ? plan.id : undefined;
      // Réserver le numéro dans ce même lot pour qu'aucun autre élève du lot ne le reprenne.
      const reserved = {
        id: existingId || `pending-${planned.length}`,
        student_number: plan.studentNumber,
        full_name: student.fullName,
        grade: student.grade,
        guardian_phone: student.guardianPhone || '',
      };
      index.byNumber.set(plan.studentNumber, reserved);
      if (!existingId) rows.push(reserved);
      if (planned.some((p) => p.existingId && p.existingId === existingId)) continue; // même fiche deux fois dans le lot
      planned.push({ student, existingId, studentNumber: plan.studentNumber });
    }
    if (planned.length === 0) return true;

    const payloads = planned.map(({ student, existingId, studentNumber }) => {
      const names = (student.fullName || `${student.firstName || ''} ${student.lastName || ''}`).trim().split(' ');
      const firstName = student.firstName || names.slice(1).join(' ') || student.fullName || 'Élève';
      const lastName = student.lastName || names[0] || 'Nom';

      // La table students n'a pas de colonne dédiée pour la date d'inscription, les versements,
      // les notes, etc. : ces champs sont encodés dans un bloc [SF_META:...] caché en fin
      // d'adresse (voir saveStudentToSupabase). Sans ce même encodage ici, chaque synchronisation
      // en arrière-plan écrasait l'adresse SANS ce bloc, effaçant silencieusement la vraie date
      // d'inscription — qui retombait alors sur la date par défaut au prochain chargement.
      const metaObj = {
        enrollmentDate: student.enrollmentDate || student.paymentDate || '2026-09-07',
        paymentDate: student.paymentDate || student.enrollmentDate || '2026-09-07',
        installments: student.installments || {},
        updatedAt: student.updatedAt || new Date().toISOString(),
        secondaryPhones: student.secondaryPhones || [],
        notes: student.notes || '',
        isBoarding: Boolean(student.isBoarding || (student.notes && student.notes.toLowerCase().includes('internat (oui)'))),
      };
      const cleanAddress = cleanDisplayAddress(student.address || '');
      const addressWithMeta = `${cleanAddress} [SF_META:${JSON.stringify(metaObj)}]`;

      return {
        ...(existingId ? { id: existingId } : {}),
        school_id: schoolId,
        student_number: studentNumber,
        matricule: student.matricule || null,
        first_name: firstName,
        last_name: lastName,
        full_name: student.fullName || `${firstName} ${lastName}`.trim(),
        grade: student.grade || 'Maternelle (P.S.)',
        gender: student.gender === 'female' ? 'female' : 'male',
        date_of_birth: student.dateOfBirth || null,
        address: addressWithMeta,
        guardian_name: student.guardianName || 'Parent',
        guardian_phone: student.guardianPhone || '+225 00 00 00 00',
        whatsapp_phone: student.whatsappPhone || null,
        avatar_url: student.avatar || null,
        enrollment_type: student.enrollmentType || 'nouveau',
        registration_fee: student.registrationFee || 0,
        tuition_amount: student.tuitionAmount || 0,
        discount_amount: student.discountAmount || 0,
        net_amount: student.netAmount || student.tuitionAmount || 0,
        paid_amount: student.paidAmount || 0,
        balance_remaining: student.balanceRemaining || 0,
        tuition_status: student.tuitionStatus || 'unpaid',
        attendance_rate: student.attendanceRate || 100,
        status: student.status || 'active',
        updated_at: new Date().toISOString(),
      };
    });

    const toUpdate = payloads.filter((p: any) => p.id);
    const toInsert = payloads.filter((p: any) => !p.id);
    let ok = true;
    if (toUpdate.length > 0) {
      const { error } = await supabase.from('students').upsert(toUpdate);
      if (error) {
        console.error('Erreur batchUpsertStudents (mises à jour):', error.message);
        ok = false;
      }
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('students').insert(toInsert);
      if (error) {
        console.error('Erreur batchUpsertStudents (nouveaux élèves):', error.message);
        ok = false;
      }
    }
    return ok;
  } catch (err) {
    console.error('Erreur batchUpsertStudents catch:', err);
    return false;
  }
}

const isUUID = (str: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

/** Même élève si les noms contiennent exactement les mêmes mots (ordre, accents et casse ignorés). */
const isSameStudentName = (a?: string, b?: string): boolean => {
  const norm = (s?: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ');
  const na = norm(a);
  return na !== '' && na === norm(b);
};

interface StudentRowLite {
  id: string;
  student_number: string;
  full_name: string;
  grade: string;
  guardian_phone?: string | null;
}

/**
 * Même enfant = même nom, même classe ET même téléphone du parent. Le nom et la classe seuls ne
 * suffisent pas : deux homonymes dans la même classe (cas réel dans les écoles) sont deux enfants,
 * et le second inscrit était silencieusement refusé à l'enregistrement.
 */
const isSameChild = (row: StudentRowLite, student: Student): boolean => {
  if (!isSameStudentName(row.full_name, student.fullName)) return false;
  if ((row.grade || '') !== (student.grade || '')) return false;
  const a = normalizePhone(row.guardian_phone);
  const b = normalizePhone(student.guardianPhone || student.whatsappPhone);
  return !a || !b || a === b;
};

type StudentWritePlan =
  | { action: 'update'; id: string; studentNumber: string }
  | { action: 'insert'; studentNumber: string }
  | { action: 'skip'; reason: string };

/**
 * Décide où écrire un élève envoyé par un navigateur, SANS JAMAIS écraser la fiche d'un autre
 * élève. Avant, un élève encore muni de son identifiant provisoire (« stu-185 ») était retrouvé
 * par son seul numéro de dossier : si ce numéro appartenait entre-temps à un autre enfant
 * (inscrit depuis un autre appareil, ou copie locale ancienne), la fiche de cet autre enfant
 * était écrasée — les fiches « changeaient de nom » d'une synchronisation à l'autre.
 */
function planStudentWrite(
  student: Student,
  rows: StudentRowLite[],
  byId: Map<string, StudentRowLite>,
  byNumber: Map<string, StudentRowLite>,
  maxNumber: { value: number }
): StudentWritePlan {
  const number = student.studentNumber;

  // 1. Fiche déjà en base sous son identifiant définitif : on la met à jour (sans voler le
  //    numéro d'un autre élève si le numéro envoyé est déjà pris).
  //    Le numéro de dossier n'est JAMAIS modifié par un navigateur : c'est la base qui numérote
  //    (renumber_students, migration 006). Un écran resté sur d'anciens numéros ne peut donc pas
  //    remettre un ancien numéro après un décalage.
  if (student.id && isUUID(student.id) && byId.has(student.id)) {
    const row = byId.get(student.id)!;
    return { action: 'update', id: row.id, studentNumber: row.student_number || number || '' };
  }

  // 1 bis. Identifiant définitif (UUID) inconnu de la base : seule la base attribue ces
  //    identifiants, donc cette fiche a existé puis a été SUPPRIMÉE. Une copie restée dans un
  //    autre navigateur ne doit jamais la recréer (c'est ce qui obligeait à supprimer 2 ou 3 fois).
  if (student.id && isUUID(student.id)) {
    return { action: 'skip', reason: 'élève supprimé de la base' };
  }

  // 1 ter. Copie provisoire de plus de 24 h jamais enregistrée : c'est le reste d'un élève
  //    supprimé gardé par un navigateur (GBALÉ Imiran ID-192 a été recréé ainsi le 01/11). Une
  //    vraie inscription hors connexion est envoyée dès le retour du réseau, bien avant 24 h.
  const touched = student.updatedAt ? new Date(student.updatedAt).getTime() : 0;
  if (touched && touched < Date.now() - 24 * 60 * 60 * 1000) {
    return { action: 'skip', reason: 'copie provisoire ancienne, jamais enregistrée' };
  }

  const sameChildElsewhere = rows.find((r) => isSameChild(r, student));
  const owner = number ? byNumber.get(number) : undefined;

  // 2. Même numéro ET même nom : c'est bien le même élève (identifiant encore provisoire).
  if (owner && isSameStudentName(owner.full_name, student.fullName)) {
    return { action: 'update', id: owner.id, studentNumber: owner.student_number };
  }
  // 3. Le même enfant existe déjà sous un autre numéro : copie ancienne, ne rien réécrire.
  if (sameChildElsewhere) {
    return { action: 'skip', reason: `déjà enregistré sous ${sameChildElsewhere.student_number}` };
  }
  // 4. Numéro pris par un AUTRE élève : vrai nouvel élève, on lui attribue le prochain numéro libre.
  if (owner || !number) {
    maxNumber.value += 1;
    return { action: 'insert', studentNumber: `ID-${String(maxNumber.value).padStart(3, '0')}` };
  }
  // 5. Numéro libre : nouvel élève.
  return { action: 'insert', studentNumber: number };
}

interface InvoiceRowLite {
  id: string;
  invoice_number: string;
  student_id: string;
  fee_type: string;
}

/**
 * Rattache une facture envoyée par un navigateur au BON élève et à la bonne ligne. Avant, une
 * facture sans identifiant définitif était rattachée à l'élève qui portait le numéro du reçu
 * (« ID-185 ») — même s'il s'agissait d'un autre enfant — et écrasait sa facture.
 */
function planInvoiceWrite(
  inv: Invoice,
  students: StudentRowLite[],
  studentById: Map<string, StudentRowLite>,
  studentByNumber: Map<string, StudentRowLite>,
  invoices: InvoiceRowLite[]
): { studentId: string; existingId?: string; invoiceNumber: string } | null {
  let stu: StudentRowLite | undefined = inv.studentId && isUUID(inv.studentId) ? studentById.get(inv.studentId) : undefined;
  // Facture d'un élève supprimé (identifiant définitif disparu de la base) : on ne la rattache à
  // personne d'autre, même si un autre enfant porte aujourd'hui le même numéro ou le même nom.
  if (!stu && inv.studentId && isUUID(inv.studentId)) return null;
  if (!stu) {
    const digits = (inv.studentId || inv.invoiceNumber || '').replace(/\D/g, '');
    const numbers = [
      inv.studentId,
      (inv.invoiceNumber || '').replace('REC-2026-', 'ID-'),
      digits ? `ID-${digits.padStart(3, '0')}` : '',
    ].filter(Boolean) as string[];
    const candidate = numbers.map((n) => studentByNumber.get(n)).find(Boolean);
    if (inv.studentName) {
      if (candidate && isSameStudentName(candidate.full_name, inv.studentName)) {
        stu = candidate;
      } else {
        // Homonymes : on ne rattache que si UN SEUL élève correspond (au besoin en précisant la
        // classe). Sinon on ne devine pas : mieux vaut ne rien écrire que créditer le mauvais enfant.
        const named = students.filter((r) => isSameStudentName(r.full_name, inv.studentName));
        const sameGrade = named.filter((r) => (r.grade || '') === (inv.studentGrade || ''));
        stu = named.length === 1 ? named[0] : sameGrade.length === 1 ? sameGrade[0] : undefined;
      }
    } else {
      stu = candidate;
    }
  }
  if (!stu) return null;

  const feeType = inv.feeType || "Frais d'inscription & Scolarité";
  const byId = inv.id && isUUID(inv.id) ? invoices.find((r) => r.id === inv.id && r.student_id === stu!.id) : undefined;
  const sameType = invoices.find((r) => r.student_id === stu!.id && r.fee_type === feeType);
  const byNumber = inv.invoiceNumber ? invoices.find((r) => r.invoice_number === inv.invoiceNumber) : undefined;
  const existing = byId || sameType || (byNumber && byNumber.student_id === stu.id ? byNumber : undefined);

  // Reçu déjà en base : il garde son numéro (la base le renumérote avec l'élève, migration 006).
  if (existing) return { studentId: stu.id, existingId: existing.id, invoiceNumber: existing.invoice_number };

  let invoiceNumber = inv.invoiceNumber;
  if (byNumber) {
    // Numéro de reçu déjà utilisé par la facture d'un AUTRE élève : ne jamais l'écraser.
    const alt = stu.student_number;
    invoiceNumber = alt && !invoices.some((r) => r.invoice_number === alt) ? alt : `${inv.invoiceNumber}-${stu.id.slice(0, 4).toUpperCase()}`;
  }
  return { studentId: stu.id, invoiceNumber };
}

async function loadInvoiceRows(schoolId: string): Promise<InvoiceRowLite[]> {
  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, student_id, fee_type')
    .eq('school_id', schoolId)
    .limit(20000);
  return (data || []) as InvoiceRowLite[];
}

async function loadStudentRows(schoolId: string): Promise<StudentRowLite[]> {
  const { data } = await supabase
    .from('students')
    .select('id, student_number, full_name, grade, guardian_phone')
    .eq('school_id', schoolId)
    .limit(10000);
  return (data || []) as StudentRowLite[];
}

function indexStudentRows(rows: StudentRowLite[]) {
  const byId = new Map<string, StudentRowLite>();
  const byNumber = new Map<string, StudentRowLite>();
  let max = 0;
  for (const r of rows) {
    byId.set(r.id, r);
    if (r.student_number) byNumber.set(r.student_number, r);
    const n = parseInt((r.student_number || '').replace(/\D/g, ''), 10);
    if (!isNaN(n) && n > max && n < 100000) max = n;
  }
  return { byId, byNumber, maxNumber: { value: max } };
}

export async function deleteStudentFromSupabase(identifier: string, schoolSlug: string): Promise<boolean> {
  if (!isSupabaseConfigured || !identifier) return false;
  try {
    // Utiliser le cache pour éviter une requête school répétée
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return false;

    // Suppression UNIQUEMENT par l'identifiant définitif (UUID). Avant, un numéro de dossier
    // (« ID-059 ») ou un matricule suffisait : supprimer une ancienne copie d'élève portant ce
    // numéro effaçait l'enfant qui le porte aujourd'hui. Un numéro n'identifie pas un élève.
    if (!isUUID(identifier)) return false;

    // Factures d'abord (contrainte d'intégrité), puis la fiche.
    const { error: invErr } = await supabase.from('invoices').delete().eq('school_id', schoolId).eq('student_id', identifier);
    if (invErr) {
      console.warn('deleteStudentFromSupabase (factures):', invErr.message);
      return false;
    }
    const { error } = await supabase.from('students').delete().eq('school_id', schoolId).eq('id', identifier);
    if (error) {
      console.warn('deleteStudentFromSupabase:', error.message);
      return false;
    }
    // Vérification : la fiche ne doit plus exister. On ne déclare la suppression réussie que si
    // la base le confirme (fini les suppressions « réussies » qu'il fallait refaire).
    const { data: still } = await supabase.from('students').select('id').eq('school_id', schoolId).eq('id', identifier).limit(1);
    const gone = !still || still.length === 0;
    // Les élèves suivants reculent d'un numéro (choix de l'établissement : pas de trou).
    if (gone) await renumberSchoolStudents(schoolId);
    return gone;
  } catch (err) {
    console.warn('deleteStudentFromSupabase catch:', err);
    return false;
  }
}

/**
 * LISTE DES REÇUS SUPPRIMÉS (table deleted_invoices, migration 005)
 * Un appareil qui garde une vieille copie d'un reçu supprimé la renvoyait à la synchronisation
 * suivante, et le reçu « revenait » (cas QUI-INT-003). La base retient désormais chaque reçu
 * supprimé : les envois automatiques d'arrière-plan ne peuvent plus le recréer. Un NOUVEAU reçu
 * saisi volontairement à l'écran (saveInvoiceToSupabase) reste toujours possible et efface la
 * mention. Si la migration n'est pas encore faite, ces fonctions ne font simplement rien.
 */
type InvoiceTombstoneRow = { invoice_number: string; student_id: string; fee_type: string };

async function recordDeletedInvoices(schoolId: string, rows: InvoiceTombstoneRow[]): Promise<void> {
  if (!rows.length) return;
  try {
    await supabase.from('deleted_invoices').upsert(
      rows.map((r) => ({
        school_id: schoolId,
        invoice_number: r.invoice_number || '',
        student_id: r.student_id,
        fee_type: r.fee_type || '',
        deleted_at: new Date().toISOString(),
      })),
      { onConflict: 'school_id,student_id,fee_type,invoice_number' }
    );
  } catch (e) {}
}

async function loadInvoiceTombstones(schoolId: string): Promise<{ numbers: Set<string>; keys: Set<string> }> {
  const out = { numbers: new Set<string>(), keys: new Set<string>() };
  try {
    const { data, error } = await supabase
      .from('deleted_invoices')
      .select('invoice_number, student_id, fee_type')
      .eq('school_id', schoolId)
      .limit(20000);
    if (error || !data) return out;
    for (const r of data as InvoiceTombstoneRow[]) {
      if (r.invoice_number) out.numbers.add(r.invoice_number);
      out.keys.add(`${r.student_id}|${r.fee_type || ''}`);
    }
  } catch (e) {}
  return out;
}

async function clearInvoiceTombstone(schoolId: string, studentId: string, feeType: string): Promise<void> {
  try {
    await supabase.from('deleted_invoices').delete().eq('school_id', schoolId).eq('student_id', studentId).eq('fee_type', feeType);
  } catch (e) {}
}

/**
 * Renumérote les élèves de l'école sans trou (ID-001, ID-002…) et leurs reçus avec eux, dans
 * la base, en une seule opération (fonction renumber_students, migration 006). Appelée après
 * chaque suppression d'élève. Sans la migration, ne fait rien.
 */
async function renumberSchoolStudents(schoolId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('renumber_students', { p_school: schoolId });
    if (error) console.warn('renumber_students:', error.message);
  } catch (e) {}
}

/** Supprime des factures (par id) en notant chacune dans la liste des reçus supprimés. */
async function deleteInvoiceRows(schoolId: string, rows: Array<InvoiceTombstoneRow & { id: string }>): Promise<boolean> {
  if (!rows.length) return true;
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('school_id', schoolId)
    .in('id', rows.map((r) => r.id));
  if (error) return false;
  await recordDeletedInvoices(schoolId, rows);
  return true;
}

export type ServiceKind = 'internat' | 'cantine' | 'transport';

const SERVICE_INVOICE_PATTERNS: Record<ServiceKind, { feeType: string; prefixes: string[] }> = {
  internat: { feeType: 'internat', prefixes: ['QUI-INT-'] },
  cantine: { feeType: 'cantine', prefixes: ['QUI-CAN-', 'CAN-'] },
  transport: { feeType: 'transport', prefixes: ['QUI-TRA-', 'QUI-TRP-', 'TRP-'] },
};

/**
 * Supprime en base TOUS les reçus d'un service (internat, cantine ou transport) d'un élève, et
 * seulement ceux-là : son reçu de scolarité n'est jamais touché. Avant, l'écran demandait la
 * suppression d'un reçu « inv-boarding-… » qui n'existe pas en base : le vrai reçu restait et
 * revenait à la synchronisation suivante (« ça ne supprime pas »). Renvoie le nombre supprimé,
 * ou -1 en cas d'échec.
 */
export async function deleteServiceInvoicesFromSupabase(studentId: string, kind: ServiceKind, schoolSlug: string): Promise<number> {
  if (!isSupabaseConfigured || !isUUID(studentId) || !SERVICE_INVOICE_PATTERNS[kind]) return -1;
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return -1;
    const { feeType, prefixes } = SERVICE_INVOICE_PATTERNS[kind];
    const { data: rows, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, fee_type, student_id')
      .eq('school_id', schoolId)
      .eq('student_id', studentId);
    if (error) return -1;
    const targets = (rows || []).filter(
      (r: any) =>
        (r.fee_type || '').toLowerCase().includes(feeType) ||
        prefixes.some((p) => (r.invoice_number || '').toUpperCase().startsWith(p))
    );
    if (targets.length === 0) return 0;
    return (await deleteInvoiceRows(schoolId, targets as any)) ? targets.length : -1;
  } catch (err) {
    console.warn('deleteServiceInvoicesFromSupabase catch:', err);
    return -1;
  }
}

export async function deleteInvoiceFromSupabase(identifier: string, schoolSlug: string): Promise<boolean> {
  if (!isSupabaseConfigured || !identifier) return false;
  try {
    // Utiliser le cache pour éviter une requête school répétée
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return false;

    // On relit d'abord les lignes visées pour pouvoir les noter dans la liste des reçus supprimés.
    const cols = 'id, invoice_number, fee_type, student_id';
    const targets: any[] = [];
    if (isUUID(identifier)) {
      const { data: a } = await supabase.from('invoices').select(cols).eq('school_id', schoolId).eq('id', identifier);
      const { data: b } = await supabase.from('invoices').select(cols).eq('school_id', schoolId).eq('student_id', identifier);
      targets.push(...(a || []), ...(b || []));
    } else {
      const { data: a } = await supabase.from('invoices').select(cols).eq('school_id', schoolId).eq('invoice_number', identifier);
      targets.push(...(a || []));
      const { data: foundRows } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .or(`student_number.eq.${identifier},matricule.eq.${identifier}`)
        .limit(1);
      if (foundRows && foundRows.length > 0) {
        const { data: b } = await supabase.from('invoices').select(cols).eq('school_id', schoolId).eq('student_id', foundRows[0].id);
        targets.push(...(b || []));
      }
    }
    const unique = Array.from(new Map(targets.map((t) => [t.id, t])).values());
    return await deleteInvoiceRows(schoolId, unique);
  } catch (err) {
    console.warn('deleteInvoiceFromSupabase catch:', err);
    return false;
  }
}


// 3. GESTION DES FACTURES (INVOICES)
export async function getInvoicesFromSupabase(schoolSlug: string): Promise<Invoice[]> {
  if (!isSupabaseConfigured || !schoolSlug) return [];
  try {
    const cleanSlug = schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug;
    const slugs = [cleanSlug];

    const { data: schools } = await supabase
      .from('schools')
      .select('id')
      .in('slug', slugs);

    if (!schools || schools.length === 0) return [];
    const schoolIds = schools.map((s: any) => s.id);

    const { data, error } = await supabase
      .from('invoices')
      .select('*, students(*)')
      .in('school_id', schoolIds)
      .order('invoice_number', { ascending: true });

    if (error || !data) return [];

    const seenInv = new Set<string>();
    const uniqueInvs: any[] = [];
    for (const d of data) {
      const invKey = (d.invoice_number || d.id || '').trim().toUpperCase();
      if (invKey && seenInv.has(invKey)) continue;
      if (invKey) seenInv.add(invKey);
      uniqueInvs.push(d);
    }

    return uniqueInvs.map((d: any) => ({
      id: d.id,
      invoiceNumber: d.invoice_number,
      studentId: d.student_id,
      studentName: d.students?.full_name || 'Élève',
      studentAvatar: d.students?.avatar_url && !d.students.avatar_url.includes('images.unsplash.com') ? d.students.avatar_url : '',
      studentGrade: d.students?.grade || '',
      studentGender: d.students?.gender || 'male',
      guardianName: d.students?.guardian_name || '',
      guardianPhone: d.students?.guardian_phone || '',
      feeType: d.fee_type || "Frais d'inscription & Scolarité",
      registrationFee: Number(d.registration_fee) || Number(d.students?.registration_fee) || 0,
      amount: Number(d.amount) || 0,
      paidAmount: Number(d.paid_amount) || 0,
      discountAmount: Number(d.discount_amount) || 0,
      netAmount: Number(d.net_amount) || 0,
      balanceRemaining: Number(d.balance_remaining) || 0,
      paymentMethod: d.payment_method || 'Espèces en caisse',
      enrollmentType: d.students?.enrollment_type || 'nouveau',
      installments: d.installments || {},
      issueDate: d.issue_date || '2026-09-07',
      dueDate: d.due_date || '2026-09-07',
      status: d.status || 'draft',
    }));
  } catch (err) {
    console.error('Erreur getInvoicesFromSupabase:', err);
    return [];
  }
}

export async function saveInvoiceToSupabase(invoice: Invoice, schoolSlug: string): Promise<boolean> {
  if (!isSupabaseConfigured || !schoolSlug) return false;
  try {
    const cleanSlug = schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug;
    // Utiliser le cache pour éviter une requête school à chaque appel
    let schoolId = await getSchoolId(cleanSlug);

    if (!schoolId) {
      const { data: newSchool } = await supabase
        .from('schools')
        .insert({ slug: cleanSlug, name: cleanSlug.toUpperCase() })
        .select('id')
        .single();
      if (newSchool?.id) {
        schoolId = newSchool.id;
        schoolIdCache.set(cleanSlug, newSchool.id);
      }
    }

    if (!schoolId) return false;

    // Rattacher la facture au BON élève et à la bonne ligne (voir planInvoiceWrite)
    const studentRows = await loadStudentRows(schoolId);
    const studentIndex = indexStudentRows(studentRows);
    const plan = planInvoiceWrite(invoice, studentRows, studentIndex.byId, studentIndex.byNumber, await loadInvoiceRows(schoolId));

    if (!plan) {
      console.warn('saveInvoiceToSupabase: impossible de lier la facture à un élève pour', invoice.invoiceNumber);
      return false;
    }

    const payload: Record<string, any> = {
      school_id: schoolId,
      invoice_number: plan.invoiceNumber,
      student_id: plan.studentId,
      fee_type: invoice.feeType || "Frais d'inscription & Scolarité",
      amount: invoice.amount || 0,
      paid_amount: invoice.paidAmount || 0,
      discount_amount: invoice.discountAmount || 0,
      net_amount: invoice.netAmount || invoice.amount || 0,
      balance_remaining: invoice.balanceRemaining || 0,
      payment_method: invoice.paymentMethod || 'Espèces en caisse',
      issue_date: invoice.issueDate || new Date().toISOString().split('T')[0],
      due_date: invoice.dueDate || new Date().toISOString().split('T')[0],
      status: invoice.status || 'draft',
    };

    // Facture existante : même identifiant, ou même élève + même type de frais (un élève n'a qu'une
    // facture par type), ou même numéro de reçu APPARTENANT à ce même élève.
    const existingInvoiceId = plan.existingId;

    if (existingInvoiceId) {
      const { error: updateErr } = await supabase
        .from('invoices')
        .update(payload)
        .eq('id', existingInvoiceId);
      if (updateErr) {
        console.warn('saveInvoiceToSupabase update warning:', updateErr.message);
        return false;
      }
    } else {
      const { error: insertErr } = await supabase
        .from('invoices')
        .insert(payload);
      if (insertErr) {
        console.warn('saveInvoiceToSupabase insert warning:', insertErr.message);
        return false;
      }
      // Nouveau reçu saisi volontairement : il annule une éventuelle suppression précédente.
      await clearInvoiceTombstone(schoolId, plan.studentId, payload.fee_type);
    }
    return true;
  } catch (err) {
    console.warn('saveInvoiceToSupabase catch:', err);
    return false;
  }
}

export async function batchUpsertInvoices(invoices: Invoice[], schoolSlug: string): Promise<boolean> {
  if (!isSupabaseConfigured || !invoices || invoices.length === 0 || !schoolSlug) return false;
  try {
    const cleanSlug = schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug;
    const schoolId = await getSchoolId(cleanSlug);
    if (!schoolId) return false;

    // Élèves et factures de l'établissement chargés une seule fois, puis chaque facture est
    // rattachée au BON élève et à la bonne ligne (voir planInvoiceWrite).
    const studentRows = await loadStudentRows(schoolId);
    const studentIndex = indexStudentRows(studentRows);
    const invoiceRows = await loadInvoiceRows(schoolId);
    const tombstones = await loadInvoiceTombstones(schoolId);

    const payloads: any[] = [];
    for (const inv of invoices) {
      const plan = planInvoiceWrite(inv, studentRows, studentIndex.byId, studentIndex.byNumber, invoiceRows);
      if (plan) {
        const existingId = plan.existingId;
        // Envoi automatique d'un reçu SUPPRIMÉ (vieille copie d'un appareil) : refusé.
        const feeKey = `${plan.studentId}|${inv.feeType || "Frais d'inscription & Scolarité"}`;
        if (!existingId && tombstones.keys.has(feeKey)) {
          continue;
        }
        // Réserver le numéro dans ce même lot
        if (!existingId) invoiceRows.push({ id: `pending-${payloads.length}`, invoice_number: plan.invoiceNumber, student_id: plan.studentId, fee_type: inv.feeType || "Frais d'inscription & Scolarité" });
        if (existingId && payloads.some((p) => p.id === existingId)) continue; // même facture deux fois dans le lot
        payloads.push({
          ...(existingId ? { id: existingId } : {}),
          school_id: schoolId,
          student_id: plan.studentId,
          invoice_number: plan.invoiceNumber,
          fee_type: inv.feeType || "Frais d'inscription & Scolarité",
          amount: inv.amount || 0,
          paid_amount: inv.paidAmount || 0,
          discount_amount: inv.discountAmount || 0,
          net_amount: inv.netAmount || inv.amount || 0,
          balance_remaining: inv.balanceRemaining || 0,
          payment_method: inv.paymentMethod || 'Espèces en caisse',
          status: inv.status || 'draft',
          issue_date: inv.issueDate || '2026-09-07',
          due_date: inv.dueDate || '2026-09-07',
        });
      }
    }

    if (payloads.length === 0) return true;

    const toUpdate = payloads.filter((p) => p.id);
    const toInsert = payloads.filter((p) => !p.id);
    let ok = true;
    if (toUpdate.length > 0) {
      const { error } = await supabase.from('invoices').upsert(toUpdate);
      if (error) {
        console.warn('Erreur batchUpsertInvoices (mises à jour):', error.message);
        ok = false;
      }
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('invoices').insert(toInsert);
      if (error) {
        console.warn('Erreur batchUpsertInvoices (nouvelles factures):', error.message);
        ok = false;
      }
    }
    return ok;
  } catch (err) {
    console.warn('Erreur batchUpsertInvoices catch:', err);
    return false;
  }
}

// 4. GESTION DU PERSONNEL (STAFF USERS)
export async function getStaffUsersFromSupabase(schoolSlug: string): Promise<any[]> {
  if (!isSupabaseConfigured || !schoolSlug) return [];
  try {
    const cleanSlug = schoolSlug === 'college-excellence' ? 'epc-manoi' : schoolSlug;
    const slugs = [cleanSlug];

    // Utiliser le cache pour éviter des requêtes répétées sur schools
    const schoolIds: string[] = [];
    const missingSlugs: string[] = [];
    for (const slug of slugs) {
      const cached = schoolIdCache.get(slug);
      if (cached) schoolIds.push(cached);
      else missingSlugs.push(slug);
    }
    if (missingSlugs.length > 0) {
      const { data: schools } = await supabase
        .from('schools')
        .select('id, slug')
        .in('slug', missingSlugs);
      if (schools) {
        for (const s of schools) {
          schoolIdCache.set(s.slug, s.id);
          schoolIds.push(s.id);
        }
      }
    }

    if (schoolIds.length === 0) return [];
    const schoolIds_ = schoolIds;

    const { data, error } = await supabase
      .from('staff_users')
      .select('*')
      .in('school_id', schoolIds_)
      .neq('role_id', 'school_stamp')
      .neq('role_id', 'system_services_data')
      .neq('role_id', 'system_diverse_notes')
      .neq('role_id', 'system_parent_messages')
      .neq('role_id', 'system_subscription_override')
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      fullName: d.full_name,
      email: d.email || '',
      phone: d.phone || '',
      roleId: d.role_id,
      role: d.role_title,
      authCode: d.auth_code,
      status: d.is_active ? 'Actif' : 'Verrouillé',
      avatarUrl: d.avatar_url,
      // Jamais dérivé du code d'accès : le matricule est imprimé (fiches de paie, listes) et
      // "EMP-<code>" révélait le code de connexion secret de chaque employé.
      matricule: d.matricule || `EMP-${String(d.id).replace(/-/g, '').slice(0, 6).toUpperCase()}`,
      subjectOrGrade: d.subject_or_grade || 'Administration',
      assignedClasses: d.assigned_classes || 'Toutes',
      address: d.address || 'Abidjan, Côte d’Ivoire',
      joinDate: '01/09/2026',
      lastLogin: 'Récemment',
    }));
  } catch (err) {
    console.error('Erreur getStaffUsersFromSupabase:', err);
    return [];
  }
}

export async function saveStaffUserToSupabase(staff: {
  fullName: string;
  email: string;
  phone: string;
  roleId: string;
  role: string;
  authCode: string;
  status: string;
  avatarUrl?: string;
  matricule?: string;
}, schoolSlug: string, allowCodeChange: boolean = false): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    // Cache pour éviter la requête school répétée
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return false;

    const payload = {
      school_id: schoolId,
      full_name: staff.fullName,
      email: staff.email,
      phone: staff.phone,
      role_id: staff.roleId,
      role_title: staff.role,
      auth_code: staff.authCode,
      avatar_url: staff.avatarUrl || null,
      is_active: staff.status === 'Actif',
    };

    // Retrouver la fiche existante : d'abord par son identifiant réel (un changement de code ne
    // doit pas créer une nouvelle fiche), puis par code, et pour Directeur/Fondateur par rôle (une
    // seule fiche par école). Sans cela, des enregistrements simultanés depuis plusieurs appareils
    // avaient créé 4 fiches Directeur et 4 fiches Fondateur.
    let existingStaff: { id: string }[] | null = null;
    const staffId = (staff as { id?: string }).id;
    if (staffId && isUUID(staffId)) {
      const { data } = await supabase.from('staff_users').select('id').eq('school_id', schoolId).eq('id', staffId).limit(1);
      existingStaff = data;
    }
    if (!existingStaff || existingStaff.length === 0) {
      const { data } = await supabase
        .from('staff_users')
        .select('id')
        .eq('school_id', schoolId)
        .eq('auth_code', staff.authCode)
        .limit(1);
      existingStaff = data;
    }
    if ((!existingStaff || existingStaff.length === 0) && (staff.roleId === 'directeur' || staff.roleId === 'fondateur')) {
      const { data } = await supabase
        .from('staff_users')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role_id', staff.roleId)
        .order('created_at', { ascending: true })
        .limit(1);
      existingStaff = data;
    }

    if (existingStaff && existingStaff.length > 0) {
      // Le code d'accès d'une fiche existante ne change QUE sur demande explicite (modification
      // du code dans la fiche du membre). Un appareil qui garde un ancien code en mémoire ne peut
      // plus le remettre en base en enregistrant un nom, une photo ou un statut.
      const { auth_code: _code, ...withoutCode } = payload;
      const { error: updateErr } = await supabase
        .from('staff_users')
        .update(allowCodeChange ? payload : withoutCode)
        .eq('id', existingStaff[0].id);
      if (updateErr) {
        console.warn('saveStaffUserToSupabase update warning:', updateErr.message);
        return false;
      }
    } else {
      const { error: insertErr } = await supabase
        .from('staff_users')
        .insert(payload);
      if (insertErr) {
        console.warn('saveStaffUserToSupabase insert warning:', insertErr.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.warn('saveStaffUserToSupabase catch:', err);
    return false;
  }
}

export async function deleteStaffUserFromSupabase(authCode: string, schoolSlug: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return false;

    const { error } = await supabase
      .from('staff_users')
      .delete()
      .eq('school_id', schoolId)
      .eq('auth_code', authCode);

    if (error) {
      console.warn('deleteStaffUserFromSupabase warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('deleteStaffUserFromSupabase catch:', err);
    return false;
  }
}

/**
 * Téléverse une photo de profil vers Supabase Storage (Bucket 'avatars')
 * et renvoie l'URL publique permanente HTTPS.
 */
export async function uploadAvatarToSupabase(
  fileOrBlob: Blob | File,
  fileName: string
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const { error } = await supabase.storage
      .from('avatars')
      .upload(cleanFileName, fileOrBlob, {
        upsert: true,
        contentType: (fileOrBlob as any).type || 'image/jpeg',
      });

    if (error) {
      console.warn('uploadAvatarToSupabase notice:', error.message);
      return null;
    }

    const { data: publicData } = supabase.storage
      .from('avatars')
      .getPublicUrl(cleanFileName);

    return publicData?.publicUrl || null;
  } catch (err) {
    console.warn('uploadAvatarToSupabase catch:', err);
    return null;
  }
}

/**
 * Sauvegarde la configuration et les souscriptions des services (Internat, Cantine, Transport) dans Supabase
 */
export async function saveServicesDataToSupabase(schoolSlug: string, servicesData: any): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    // Migration 004 appliquée : abonnements et mois payés ne s'écrivent plus que ligne par ligne
    // (applyServiceChangesToSupabase). Les listes complètes envoyées par un navigateur — même
    // d'une ancienne version encore ouverte — sont ignorées : elles écrasaient le travail des
    // autres postes.
    if (servicesData && typeof servicesData === 'object' && (await serviceTablesAvailable())) {
      const rest = { ...servicesData };
      for (const k of LEGACY_SERVICE_KEYS) delete rest[k];
      if (Object.keys(rest).length === 0) return true;
      servicesData = rest;
    }
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return false;

    const payload = {
      school_id: schoolId,
      role_id: 'system_services_data',
      role_title: 'Services Data Sync',
      full_name: 'SYSTEM SERVICES SYNC',
      auth_code: 'SYS-SRV-DATA',
      department: JSON.stringify(servicesData),
      is_active: true,
    };

    const { data: existing } = await supabase
      .from('staff_users')
      .select('id, department')
      .eq('school_id', schoolId)
      .eq('role_id', 'system_services_data')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Les deux appelants de cette fonction (dashboard-view.tsx et /api/sync) reconstruisent et
    // envoient systématiquement les 6 collections au complet à chaque appel — il n'existe pas de
    // "mise à jour partielle" où un champ manquant signifierait "ne pas y toucher". Fusionner en
    // gardant l'ancienne valeur dès qu'une collection arrive vide écrasait donc silencieusement
    // toute suppression légitime du DERNIER élève d'un service (internat/cantine/transport) : la
    // liste vide envoyée était rejetée et l'ancien abonné revenait au prochain rafraîchissement.
    // Fusion par PRESENCE DE CLE (et non par "valeur non vide") : un appelant peut desormais
    // n'envoyer qu'une partie des 6 collections (ex: seulement boardingSubscriptions) quand il
    // n'a pas d'information fiable sur les autres - ces cles absentes conservent alors la vraie
    // valeur actuellement stockee dans Supabase (existing.department), au lieu d'etre ecrasees
    // par une valeur par defaut devinee. Une cle PRESENTE dans servicesData, meme avec une valeur
    // vide ([] ou {}), est en revanche toujours acceptee telle quelle - c'est la seule facon de
    // retirer legitimement le dernier abonne d'un service.
    let mergedData = servicesData;
    if (existing?.department) {
      try {
        const prev = JSON.parse(existing.department);
        mergedData = { ...prev, ...servicesData };
      } catch (e) {}
    }

    if (existing?.id) {
      await supabase
        .from('staff_users')
        .update({ department: JSON.stringify(mergedData) })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('staff_users')
        .insert({
          school_id: schoolId,
          role_id: 'system_services_data',
          role_title: 'Services Data Sync',
          full_name: 'SYSTEM SERVICES SYNC',
          auth_code: 'SYS-SRV-DATA',
          department: JSON.stringify(mergedData),
          is_active: true,
        });
    }
    return true;
  } catch (err) {
    console.warn('saveServicesDataToSupabase catch:', err);
    return false;
  }
}

/**
 * Récupère la configuration et les souscriptions des services (Internat, Cantine, Transport) depuis Supabase
 */
export async function getServicesDataFromSupabase(schoolSlug: string): Promise<any | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return null;

    const { data } = await supabase
      .from('staff_users')
      .select('department')
      .eq('school_id', schoolId)
      .eq('role_id', 'system_services_data')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let blob: Record<string, any> | null = null;
    if (data?.department) {
      try {
        blob = JSON.parse(data.department);
      } catch (e) {
        blob = null;
      }
    }
    // Migration 004 appliquée : abonnements et mois payés viennent des vraies tables (le bloc ne
    // garde que la capacité de l'internat, le menu de la cantine et l'échéancier).
    const fromTables = await readServiceTables(schoolId);
    if (fromTables) return { ...(blob || {}), ...fromTables };
    return blob;
  } catch (err) {
    console.warn('getServicesDataFromSupabase catch:', err);
    return null;
  }
}

/* ==========================================================================
   INTERNAT / CANTINE / TRANSPORT EN VRAIES TABLES (migration 004)
   ========================================================================== */

const SERVICE_MONTHS = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai'];
const LEGACY_SERVICE_KEYS = [
  'boardingSubscriptions',
  'boardingPayments',
  'canteenSubscriptions',
  'canteenPayments',
  'transportSubscriptions',
  'transportPayments',
];

let serviceTablesCache: { at: number; ok: boolean } | null = null;

/** Vrai si la migration 004 a été exécutée (résultat gardé 1 minute). */
export async function serviceTablesAvailable(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  if (serviceTablesCache && Date.now() - serviceTablesCache.at < 60000) return serviceTablesCache.ok;
  const { error } = await supabase.from('service_subscriptions').select('id').limit(1);
  serviceTablesCache = { at: Date.now(), ok: !error };
  return !error;
}

/**
 * Relit les tables et les présente sous la forme attendue par les écrans (mêmes clés que
 * l'ancien bloc) : aucun écran de lecture n'a besoin de changer. null si tables absentes.
 */
async function readServiceTables(schoolId: string): Promise<Record<string, any> | null> {
  if (!(await serviceTablesAvailable())) return null;
  const [subsRes, payRes] = await Promise.all([
    supabase
      .from('service_subscriptions')
      .select('student_id, service, monthly_rate, discount, details, student:students(full_name, grade, gender, matricule, guardian_phone, whatsapp_phone)')
      .eq('school_id', schoolId)
      .limit(20000),
    supabase.from('service_month_payments').select('student_id, service, month').eq('school_id', schoolId).limit(100000),
  ]);
  if (subsRes.error || payRes.error) return null;

  const boardingSubscriptions: any[] = [];
  const canteenSubscriptions: Record<string, any> = {};
  const transportSubscriptions: Record<string, any> = {};
  for (const s of (subsRes.data || []) as any[]) {
    const st = Array.isArray(s.student) ? s.student[0] : s.student;
    const d = (s.details && typeof s.details === 'object' ? s.details : {}) as Record<string, any>;
    const female = st?.gender === 'female';
    if (s.service === 'internat') {
      boardingSubscriptions.push({
        studentId: s.student_id,
        studentName: st?.full_name || '',
        matricule: st?.matricule || '',
        className: st?.grade || '',
        gender: female ? 'F' : 'M',
        parentContact: d.parentContact || st?.whatsapp_phone || st?.guardian_phone || '',
        pavilion: d.pavilion || (female ? 'Pavillon B (Filles)' : 'Pavillon A (Garçons)'),
        roomNumber: d.roomNumber || '',
        monthlyRate: s.monthly_rate,
        paymentDate: d.paymentDate || '',
      });
    } else {
      const target = s.service === 'cantine' ? canteenSubscriptions : transportSubscriptions;
      target[s.student_id] = { ...d, rate: s.monthly_rate, discount: s.discount, studentName: st?.full_name || '' };
    }
  }

  const payments: Record<string, Record<string, Record<string, boolean>>> = { internat: {}, cantine: {}, transport: {} };
  for (const p of (payRes.data || []) as any[]) {
    const bucket = payments[p.service];
    if (!bucket) continue;
    (bucket[p.student_id] ||= {})[p.month] = true;
  }

  return {
    boardingSubscriptions,
    boardingPayments: payments.internat,
    canteenSubscriptions,
    canteenPayments: payments.cantine,
    transportSubscriptions,
    transportPayments: payments.transport,
  };
}

export interface ServiceChange {
  service: ServiceKind;
  /** Identifiant, numéro de dossier ou matricule de l'élève. */
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
  /** true si la migration 004 n'est pas encore faite (l'ancien bloc reste utilisé). */
  legacy: boolean;
  applied: number;
  skipped: string[];
  /** true si l'envoi a été refusé par le garde-fou (retraits massifs). */
  refused?: boolean;
}

/**
 * Applique des changements LIGNE PAR LIGNE (un abonnement, un mois) : un poste ne peut plus
 * écraser les abonnements ou les mois enregistrés par un autre poste.
 */
export async function applyServiceChangesToSupabase(schoolSlug: string, changes: ServiceChange[]): Promise<ServiceChangeResult> {
  const result: ServiceChangeResult = { ok: true, legacy: false, applied: 0, skipped: [] };
  if (!isSupabaseConfigured || !Array.isArray(changes)) return { ...result, ok: false };
  if (!(await serviceTablesAvailable())) return { ...result, legacy: true };
  const schoolId = await getSchoolId(schoolSlug);
  if (!schoolId) return { ...result, ok: false };

  const valid = changes
    .filter((c) => c && ['internat', 'cantine', 'transport'].includes(c.service) && typeof c.studentKey === 'string' && c.studentKey)
    .slice(0, 500);
  if (valid.length === 0) return result;

  // GARDE-FOU : une action à l'écran ne retire jamais qu'UN élève d'un service à la fois.
  // Un envoi qui en retire plusieurs (ou décoche les mois de plusieurs élèves) vient forcément
  // d'un écran à la liste incomplète ou périmée : on refuse tout, rien n'est effacé.
  const removedStudents = new Set(
    valid.filter((c) => c.action === 'unsubscribe' || (c.action === 'setMonth' && !c.paid)).map((c) => `${c.service}:${c.studentKey}`)
  );
  if (removedStudents.size > 2) {
    console.error(`applyServiceChanges refusé : ${removedStudents.size} retraits en un seul envoi`, Array.from(removedStudents).slice(0, 10));
    return { ...result, ok: false, refused: true };
  }

  // Résolution des élèves (identifiant, numéro de dossier ou matricule) en une requête.
  const keys = Array.from(new Set(valid.map((c) => c.studentKey)));
  const uuids = keys.filter(isUUID);
  const others = keys.filter((k) => !isUUID(k));
  const found: any[] = [];
  if (uuids.length) {
    const { data } = await supabase.from('students').select('id, student_number, matricule').eq('school_id', schoolId).in('id', uuids);
    found.push(...(data || []));
  }
  if (others.length) {
    const { data: byNum } = await supabase.from('students').select('id, student_number, matricule').eq('school_id', schoolId).in('student_number', others);
    const { data: byMat } = await supabase.from('students').select('id, student_number, matricule').eq('school_id', schoolId).in('matricule', others);
    found.push(...(byNum || []), ...(byMat || []));
  }
  const resolve = (key: string): string | undefined =>
    (found.find((s) => s.id === key) || found.find((s) => s.student_number === key) || found.find((s) => s.matricule && s.matricule === key))?.id;

  for (const c of valid) {
    const studentId = resolve(c.studentKey);
    if (!studentId) {
      result.skipped.push(c.studentKey);
      continue;
    }
    const base = { school_id: schoolId, student_id: studentId, service: c.service };
    let error: any = null;
    if (c.action === 'subscribe') {
      ({ error } = await supabase.from('service_subscriptions').upsert(
        {
          ...base,
          monthly_rate: Math.max(0, Math.round(Number(c.monthlyRate) || 0)),
          discount: Math.max(0, Math.round(Number(c.discount) || 0)),
          details: c.details && typeof c.details === 'object' ? c.details : {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'school_id,student_id,service' }
      ));
    } else if (c.action === 'unsubscribe') {
      ({ error } = await supabase.from('service_month_payments').delete().match(base));
      if (!error) ({ error } = await supabase.from('service_subscriptions').delete().match(base));
    } else if (c.action === 'setMonth' && c.month && SERVICE_MONTHS.includes(c.month)) {
      if (c.paid) {
        ({ error } = await supabase
          .from('service_month_payments')
          .upsert({ ...base, month: c.month }, { onConflict: 'school_id,student_id,service,month', ignoreDuplicates: true }));
      } else {
        ({ error } = await supabase.from('service_month_payments').delete().match({ ...base, month: c.month }));
      }
    } else {
      result.skipped.push(c.studentKey);
      continue;
    }
    if (error) {
      console.warn('applyServiceChangesToSupabase:', error.message);
      result.ok = false;
    } else {
      result.applied += 1;
    }
  }
  return result;
}

// ─── CORBEILLE ET JOURNAL (migration 007) ─────────────────────────────────

export interface JournalEntry {
  id: number;
  at: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  table: 'students' | 'invoices' | 'service_subscriptions' | 'service_month_payments';
  rowId: string | null;
  studentId: string | null;
  /** Nom et numéro actuels de l'élève (ou ceux de la fiche supprimée). */
  studentName: string;
  studentNumber: string;
  oldRow: Record<string, any> | null;
  newRow: Record<string, any> | null;
  /** Nom du membre du personnel (ou son rôle), jamais son code d'accès. */
  actor: string;
  restoredAt: string | null;
  restoredBy: string | null;
}

export interface JournalPage {
  available: boolean;
  entries: JournalEntry[];
}

const ROLE_LABELS: Record<string, string> = {
  fondateur: 'Fondateur',
  directeur: 'Directeur',
  comptable: 'Comptable',
  secretaire: 'Secrétaire',
  assistant_direction: 'Assistant(e) de direction',
  enseignant: 'Enseignant(e)',
  educateur: 'Éducateur',
  parent: 'Parent',
  base: 'Base de données (script)',
};

/**
 * Lit le journal de l'école. `kind` = 'trash' (suppressions), 'changes' (modifications) ou
 * 'all'. Les lignes techniques sont regroupées côté écran.
 */
export async function getJournalFromSupabase(schoolSlug: string, kind: 'trash' | 'changes' | 'all' = 'trash', limit = 400): Promise<JournalPage> {
  const empty: JournalPage = { available: false, entries: [] };
  if (!isSupabaseConfigured) return empty;
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return empty;
    let q = supabase
      .from('data_journal')
      .select('id, at, op, table_name, row_id, student_id, old_row, new_row, actor, restored_at, restored_by')
      .eq('school_id', schoolId)
      .order('at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 1000));
    if (kind === 'trash') q = q.eq('op', 'DELETE');
    else if (kind === 'changes') q = q.in('op', ['UPDATE', 'INSERT']);
    const { data, error } = await q;
    if (error) return empty;
    const rows = (data || []) as any[];

    // Noms des élèves actuels, et noms des membres du personnel (pour « qui »).
    const studentIds = Array.from(new Set(rows.map((r) => r.student_id).filter(Boolean)));
    const names = new Map<string, { name: string; number: string }>();
    if (studentIds.length) {
      const { data: st } = await supabase.from('students').select('id, full_name, student_number').in('id', studentIds.slice(0, 1000));
      (st || []).forEach((s: any) => names.set(s.id, { name: s.full_name || '', number: s.student_number || '' }));
    }
    // Élèves supprimés : leur nom vient de la fiche gardée dans le journal.
    rows.forEach((r) => {
      if (r.table_name === 'students' && r.student_id && !names.has(r.student_id)) {
        const row = r.old_row || r.new_row || {};
        names.set(r.student_id, { name: row.full_name || '', number: row.student_number || '' });
      }
    });
    const missing = studentIds.filter((id) => !names.has(id));
    if (missing.length) {
      const { data: gone } = await supabase
        .from('data_journal')
        .select('student_id, old_row')
        .eq('school_id', schoolId)
        .eq('table_name', 'students')
        .eq('op', 'DELETE')
        .in('student_id', missing.slice(0, 500));
      (gone || []).forEach((g: any) => {
        if (!names.has(g.student_id)) names.set(g.student_id, { name: g.old_row?.full_name || '', number: g.old_row?.student_number || '' });
      });
    }

    const staffIds = Array.from(
      new Set(rows.map((r) => String(r.actor || '').split('|')[1]).filter(Boolean))
    );
    const staffNames = new Map<string, string>();
    if (staffIds.length) {
      const { data: staff } = await supabase.from('staff_users').select('id, full_name').in('id', staffIds.slice(0, 200));
      (staff || []).forEach((s: any) => staffNames.set(String(s.id), s.full_name || ''));
    }
    const actorName = (raw: string | null): string => {
      const [role, staffId] = String(raw || 'base').split('|');
      const person = staffId ? staffNames.get(staffId) : '';
      const roleName = ROLE_LABELS[role] || role || 'Inconnu';
      return person ? `${person} (${roleName})` : roleName;
    };

    return {
      available: true,
      entries: rows.map((r) => {
        const who = r.student_id ? names.get(r.student_id) : undefined;
        return {
          id: Number(r.id),
          at: r.at,
          op: r.op,
          table: r.table_name,
          rowId: r.row_id,
          studentId: r.student_id,
          studentName: who?.name || '',
          studentNumber: who?.number || '',
          oldRow: r.old_row,
          newRow: r.new_row,
          actor: actorName(r.actor),
          restoredAt: r.restored_at,
          restoredBy: r.restored_by ? actorName(r.restored_by) : null,
        } as JournalEntry;
      }),
    };
  } catch (e) {
    return empty;
  }
}

/** Restaure une suppression (avec ce qui a été supprimé en même temps) ou annule une modification. */
export async function restoreJournalInSupabase(
  schoolSlug: string,
  entryId: number,
  actor: string
): Promise<{ ok: boolean; restored?: number; message: string }> {
  if (!isSupabaseConfigured || !Number.isFinite(entryId)) return { ok: false, message: 'Requête invalide.' };
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return { ok: false, message: 'Établissement introuvable.' };
    const { data, error } = await supabase.rpc('restore_journal', { p_school: schoolId, p_id: entryId, p_actor: actor });
    if (error) return { ok: false, message: `La base a refusé la restauration : ${error.message}` };
    const res = (data || {}) as any;
    return { ok: Boolean(res.ok), restored: Number(res.restored) || 0, message: String(res.message || '') };
  } catch (e: any) {
    return { ok: false, message: 'Erreur de connexion avec la base.' };
  }
}

/**
 * SUPPRESSION DÉFINITIVE depuis la corbeille : efface du journal une suppression (avec ce qui a été
 * supprimé en même temps, selon les mêmes règles que restore_journal), ou toute la corbeille
 * (entryId = 'all'). Ensuite, plus aucune restauration n'est possible.
 */
export async function purgeJournalInSupabase(
  schoolSlug: string,
  entryId: number | 'all'
): Promise<{ ok: boolean; removed: number; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, removed: 0, message: 'Base non configurée.' };
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return { ok: false, removed: 0, message: 'Établissement introuvable.' };

    let ids: number[] = [];
    if (entryId === 'all') {
      const { data, error } = await supabase
        .from('data_journal')
        .select('id')
        .eq('school_id', schoolId)
        .eq('op', 'DELETE')
        .is('restored_at', null)
        .limit(5000);
      if (error) return { ok: false, removed: 0, message: 'Lecture de la corbeille impossible.' };
      ids = (data || []).map((r: any) => Number(r.id));
    } else {
      if (!Number.isFinite(entryId)) return { ok: false, removed: 0, message: 'Requête invalide.' };
      const { data: e, error } = await supabase
        .from('data_journal')
        .select('id, at, op, table_name, student_id, old_row, restored_at')
        .eq('school_id', schoolId)
        .eq('id', entryId)
        .maybeSingle();
      if (error || !e) return { ok: false, removed: 0, message: 'Élément introuvable.' };
      if (e.op !== 'DELETE') return { ok: false, removed: 0, message: 'Seuls les éléments de la corbeille peuvent être supprimés définitivement.' };
      if (e.restored_at) return { ok: false, removed: 0, message: 'Cet élément a déjà été restauré.' };
      ids = [Number(e.id)];
      if (e.student_id && (e.table_name === 'students' || e.table_name === 'service_subscriptions')) {
        const t = new Date(e.at).getTime();
        const { data: near } = await supabase
          .from('data_journal')
          .select('id, table_name, old_row')
          .eq('school_id', schoolId)
          .eq('op', 'DELETE')
          .is('restored_at', null)
          .eq('student_id', e.student_id)
          .gte('at', new Date(t - 15 * 60 * 1000).toISOString())
          .lte('at', new Date(t + 15 * 60 * 1000).toISOString());
        const svc = String(e.old_row?.service || '');
        (near || []).forEach((o: any) => {
          const same =
            e.table_name === 'students' ||
            ((o.table_name === 'service_subscriptions' || o.table_name === 'service_month_payments') && o.old_row?.service === svc) ||
            (o.table_name === 'invoices' && svc && String(o.old_row?.fee_type || '').toLowerCase().includes(svc.toLowerCase()));
          if (same && !ids.includes(Number(o.id))) ids.push(Number(o.id));
        });
      }
    }
    if (ids.length === 0) return { ok: true, removed: 0, message: 'La corbeille est déjà vide.' };

    let removed = 0;
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { error } = await supabase.from('data_journal').delete().eq('school_id', schoolId).in('id', chunk);
      if (error) return { ok: false, removed, message: `La base a refusé la suppression : ${error.message}` };
      removed += chunk.length;
    }
    return { ok: true, removed, message: `${removed} élément(s) supprimé(s) définitivement.` };
  } catch (e) {
    return { ok: false, removed: 0, message: 'Erreur de connexion avec la base.' };
  }
}

/** Élèves restaurés depuis la corbeille ces 30 derniers jours (pour les retirer des listes noires locales). */
export async function getRestoredStudentIds(schoolSlug: string): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return [];
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('data_journal')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('table_name', 'students')
      .eq('op', 'DELETE')
      .gte('restored_at', since)
      .limit(1000);
    if (error) return [];
    return Array.from(new Set((data || []).map((r: any) => r.student_id).filter(Boolean)));
  } catch (e) {
    return [];
  }
}

/** Compteur de version de l'école (augmente à chaque modification, migration 004). */
export async function getSchoolDataVersion(schoolSlug: string): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return null;
    const { data, error } = await supabase.from('school_data_versions').select('version').eq('school_id', schoolId).maybeSingle();
    if (error || !data) return null;
    return Number(data.version);
  } catch (e) {
    return null;
  }
}

/**
 * Sauvegarde/récupère les Notes Diverses de tous les collaborateurs d'une école dans Supabase
 * (même mécanisme que saveServicesDataToSupabase). Chaque note porte son authorCode ; le
 * cloisonnement par collaborateur reste appliqué côté client au moment de l'affichage — ce
 * blob partagé sert uniquement de support de synchronisation multi-appareils.
 */
export async function saveDiverseNotesToSupabase(schoolSlug: string, notes: any[]): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return false;

    const payload = {
      school_id: schoolId,
      role_id: 'system_diverse_notes',
      role_title: 'Diverse Notes Sync',
      full_name: 'SYSTEM DIVERSE NOTES SYNC',
      auth_code: 'SYS-NOTES-DATA',
      department: JSON.stringify(notes || []),
      is_active: true,
    };

    const { data: existing } = await supabase
      .from('staff_users')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role_id', 'system_diverse_notes')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase.from('staff_users').update({ department: payload.department }).eq('id', existing.id);
    } else {
      await supabase.from('staff_users').insert(payload);
    }
    return true;
  } catch (err) {
    console.warn('saveDiverseNotesToSupabase catch:', err);
    return false;
  }
}

export async function getDiverseNotesFromSupabase(schoolSlug: string): Promise<any[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return null;

    const { data, error } = await supabase
      .from('staff_users')
      .select('department')
      .eq('school_id', schoolId)
      .eq('role_id', 'system_diverse_notes')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // null = lecture impossible (l'appelant ne doit alors rien écraser) ; [] = aucune note.
    if (error) return null;
    if (data?.department) return JSON.parse(data.department);
    return [];
  } catch (err) {
    console.warn('getDiverseNotesFromSupabase catch:', err);
    return null;
  }
}

/**
 * Sauvegarde/récupère les messages envoyés par les parents à la Direction dans Supabase.
 * Visibilité restreinte côté route (proxy.ts) et navigation (sidebar) au fondateur, directeur,
 * secrétaire et assistant de direction — jamais aux enseignants.
 */
export async function saveParentMessagesToSupabase(schoolSlug: string, messages: any[]): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return false;

    const payload = {
      school_id: schoolId,
      role_id: 'system_parent_messages',
      role_title: 'Parent Messages Sync',
      full_name: 'SYSTEM PARENT MESSAGES SYNC',
      auth_code: 'SYS-MSG-DATA',
      department: JSON.stringify(messages || []),
      is_active: true,
    };

    const { data: existing } = await supabase
      .from('staff_users')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role_id', 'system_parent_messages')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase.from('staff_users').update({ department: payload.department }).eq('id', existing.id);
    } else {
      await supabase.from('staff_users').insert(payload);
    }
    return true;
  } catch (err) {
    console.warn('saveParentMessagesToSupabase catch:', err);
    return false;
  }
}

export async function getParentMessagesFromSupabase(schoolSlug: string): Promise<any[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return null;

    const { data, error } = await supabase
      .from('staff_users')
      .select('department')
      .eq('school_id', schoolId)
      .eq('role_id', 'system_parent_messages')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // null = lecture impossible (l'appelant ne doit alors rien écraser) ; [] = aucun message.
    if (error) return null;
    if (data?.department) return JSON.parse(data.department);
    return [];
  } catch (err) {
    console.warn('getParentMessagesFromSupabase catch:', err);
    return null;
  }
}

/**
 * Met à jour UNIQUEMENT les coordonnées (nom, email, téléphone, photo) du membre du personnel
 * identifié par son code — jamais son rôle, son code ni son statut. Utilisé quand un membre
 * non-administrateur met à jour sa propre fiche à la connexion.
 */
export async function updateStaffContactInSupabase(
  schoolSlug: string,
  authCode: string,
  contact: { fullName?: string; email?: string; phone?: string; avatarUrl?: string }
): Promise<boolean> {
  if (!isSupabaseConfigured || !authCode) return false;
  try {
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return false;

    const update: Record<string, any> = {};
    if (contact.fullName) update.full_name = contact.fullName;
    if (contact.email !== undefined) update.email = contact.email;
    if (contact.phone !== undefined) update.phone = contact.phone;
    if (contact.avatarUrl) update.avatar_url = contact.avatarUrl;
    if (Object.keys(update).length === 0) return true;

    const { error } = await supabase
      .from('staff_users')
      .update(update)
      .eq('school_id', schoolId)
      .eq('auth_code', authCode)
      .not('role_id', 'like', 'system_%');
    return !error;
  } catch (err) {
    console.warn('updateStaffContactInSupabase catch:', err);
    return false;
  }
}
