import { supabase, isSupabaseConfigured } from './client';
import { School, Student, Invoice } from '@/lib/data/types';
import { cleanDisplayAddress } from '@/lib/utils/formatters';

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
  const cleanSlug = (!slug || slug === 'college-excellence') ? 'epc-manoi' : slug;
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

// 2. GESTION DES ÉLÈVES (STUDENTS)
export async function getStudentsFromSupabase(schoolSlug: string): Promise<Student[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const cleanSlug = schoolSlug === 'college-excellence' ? 'epc-manoi' : (schoolSlug || 'epc-manoi');
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

    const seen = new Set<string>();
    const uniqueData: any[] = [];
    for (const d of data) {
      const numKey = (d.student_number || '').trim().toUpperCase();
      const nameKey = (d.full_name || `${d.last_name || ''} ${d.first_name || ''}`).trim().toLowerCase().replace(/\s+/g, ' ');
      const matKey = (d.matricule || '').trim().toUpperCase();

      if (
        (numKey && seen.has(numKey)) ||
        (nameKey && seen.has(nameKey)) ||
        (matKey && matKey !== '' && seen.has(matKey))
      ) {
        continue;
      }

      if (numKey) seen.add(numKey);
      if (nameKey) seen.add(nameKey);
      if (matKey) seen.add(matKey);
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
        avatar: d.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
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

export async function saveStudentToSupabase(student: Student, schoolSlug: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const cleanSlug = (!schoolSlug || schoolSlug === 'college-excellence') ? 'epc-manoi' : schoolSlug;
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

    // Vérifier si l'élève existe déjà (par id UUID direct ou par student_number)
    let existingId: string | null = null;
    if (student.id && isUUID(student.id)) {
      const { data: byId } = await supabase
        .from('students')
        .select('id')
        .eq('id', student.id)
        .limit(1);
      if (byId && byId.length > 0) {
        existingId = byId[0].id;
      }
    }

    if (!existingId && student.studentNumber) {
      const { data: byNum } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .eq('student_number', student.studentNumber)
        .limit(1);
      if (byNum && byNum.length > 0) {
        existingId = byNum[0].id;
      }
    }

    if (existingId) {
      const { error: updateErr } = await supabase
        .from('students')
        .update(payload)
        .eq('id', existingId);
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
  if (!isSupabaseConfigured || !students || students.length === 0) return false;
  try {
    const cleanSlug = (!schoolSlug || schoolSlug === 'college-excellence') ? 'epc-manoi' : schoolSlug;
    const schoolId = await getSchoolId(cleanSlug);
    if (!schoolId) return false;

    // Résoudre l'id réel (clé primaire) de chaque élève existant avant l'upsert. La table
    // n'a pas de contrainte unique sur (school_id, student_number), donc upsert({onConflict:
    // 'school_id, student_number'}) ne détecte jamais de conflit et INSÈRE une nouvelle ligne
    // à chaque appel au lieu de mettre à jour — c'est ce qui a fait exploser la table students
    // à plus de 1600 lignes en doublon. On upsert désormais sur l'id (la vraie clé primaire).
    const studentNumbers = students.map((s) => s.studentNumber).filter(Boolean) as string[];
    const existingMap = new Map<string, string>(); // student_number -> id
    if (studentNumbers.length > 0) {
      const { data: existingRows } = await supabase
        .from('students')
        .select('id, student_number')
        .eq('school_id', schoolId)
        .in('student_number', studentNumbers);
      (existingRows || []).forEach((r: any) => {
        if (r.student_number) existingMap.set(r.student_number, r.id);
      });
    }

    const payloads = students.map((student) => {
      const names = (student.fullName || `${student.firstName || ''} ${student.lastName || ''}`).trim().split(' ');
      const firstName = student.firstName || names.slice(1).join(' ') || student.fullName || 'Élève';
      const lastName = student.lastName || names[0] || 'Nom';
      const existingId = (student.studentNumber && existingMap.get(student.studentNumber)) ||
        (student.id && isUUID(student.id) ? student.id : undefined);

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
        student_number: student.studentNumber,
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

    const { error } = await supabase.from('students').upsert(payloads);

    if (error) {
      console.error('Erreur batchUpsertStudents:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Erreur batchUpsertStudents catch:', err);
    return false;
  }
}

const isUUID = (str: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export async function deleteStudentFromSupabase(identifier: string, schoolSlug: string): Promise<boolean> {
  if (!isSupabaseConfigured || !identifier) return false;
  try {
    // Utiliser le cache pour éviter une requête school répétée
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return false;

    if (isUUID(identifier)) {
      // Supprimer d'abord les factures liées pour respecter les contraintes d'intégrité
      await supabase.from('invoices').delete().eq('school_id', schoolId).eq('student_id', identifier);
      await supabase.from('invoices').delete().eq('school_id', schoolId).eq('id', identifier);
      const { error } = await supabase.from('students').delete().eq('school_id', schoolId).eq('id', identifier);
      if (!error) return true;
    } else {
      // Trouver l'ID UUID de l'élève par son matricule ou numéro d'élève
      const { data: foundRows } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .or(`student_number.eq.${identifier},matricule.eq.${identifier}`)
        .limit(1);

      if (foundRows && foundRows.length > 0) {
        const studentIdToDelete = foundRows[0].id;
        await supabase.from('invoices').delete().eq('school_id', schoolId).eq('student_id', studentIdToDelete);
        const { error } = await supabase.from('students').delete().eq('school_id', schoolId).eq('id', studentIdToDelete);
        if (!error) return true;
      }

      // Nettoyage de sécurité direct
      await supabase.from('invoices').delete().eq('school_id', schoolId).eq('invoice_number', identifier);
      await supabase.from('students').delete().eq('school_id', schoolId).eq('student_number', identifier);
      await supabase.from('students').delete().eq('school_id', schoolId).eq('matricule', identifier);
    }
    return true;
  } catch (err) {
    console.warn('deleteStudentFromSupabase catch:', err);
    return false;
  }
}

export async function deleteInvoiceFromSupabase(identifier: string, schoolSlug: string): Promise<boolean> {
  if (!isSupabaseConfigured || !identifier) return false;
  try {
    // Utiliser le cache pour éviter une requête school répétée
    const schoolId = await getSchoolId(schoolSlug);
    if (!schoolId) return false;

    if (isUUID(identifier)) {
      await supabase.from('invoices').delete().eq('school_id', schoolId).eq('id', identifier);
      await supabase.from('invoices').delete().eq('school_id', schoolId).eq('student_id', identifier);
    } else {
      await supabase.from('invoices').delete().eq('school_id', schoolId).eq('invoice_number', identifier);
      const { data: foundRows } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .or(`student_number.eq.${identifier},matricule.eq.${identifier}`)
        .limit(1);
      if (foundRows && foundRows.length > 0) {
        await supabase.from('invoices').delete().eq('school_id', schoolId).eq('student_id', foundRows[0].id);
      }
    }
    return true;
  } catch (err) {
    console.warn('deleteInvoiceFromSupabase catch:', err);
    return false;
  }
}


// 3. GESTION DES FACTURES (INVOICES)
export async function getInvoicesFromSupabase(schoolSlug: string): Promise<Invoice[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const cleanSlug = schoolSlug === 'college-excellence' ? 'epc-manoi' : (schoolSlug || 'epc-manoi');
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
      studentAvatar: d.students?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
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
  if (!isSupabaseConfigured) return false;
  try {
    const cleanSlug = (!schoolSlug || schoolSlug === 'college-excellence') ? 'epc-manoi' : schoolSlug;
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

    // Résoudre l'UUID réel de l'élève — requête ciblée (pas de chargement de TOUS les étudiants)
    let validStudentUUID: string | null = null;
    if (invoice.studentId && isUUID(invoice.studentId)) {
      validStudentUUID = invoice.studentId;
    } else {
      // Essayer d'abord par student_number dérivé du numéro de facture
      const studentNum = invoice.invoiceNumber?.replace('REC-2026-', 'ID-') || invoice.studentId || '';
      const cleanNum = (invoice.studentId || invoice.invoiceNumber || '').replace(/\D/g, '');
      const numWithPad = cleanNum ? `ID-${cleanNum.padStart(3, '0')}` : '';

      const candidates = [studentNum, numWithPad].filter(Boolean);
      if (candidates.length > 0) {
        const { data: foundRows } = await supabase
          .from('students')
          .select('id')
          .eq('school_id', schoolId)
          .in('student_number', candidates)
          .limit(1);
        if (foundRows && foundRows.length > 0) validStudentUUID = foundRows[0].id;
      }

      // Fallback par nom si toujours pas trouvé
      if (!validStudentUUID && invoice.studentName) {
        const { data: byNameRows } = await supabase
          .from('students')
          .select('id')
          .eq('school_id', schoolId)
          .ilike('full_name', invoice.studentName)
          .limit(1);
        if (byNameRows && byNameRows.length > 0) validStudentUUID = byNameRows[0].id;
      }
    }

    if (!validStudentUUID) {
      console.warn('saveInvoiceToSupabase: impossible de lier la facture à un élève pour', invoice.invoiceNumber);
      return false;
    }

    const payload: Record<string, any> = {
      school_id: schoolId,
      invoice_number: invoice.invoiceNumber,
      student_id: validStudentUUID,
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

    // Vérifier si la facture existe déjà
    let existingInvoiceId: string | null = null;
    if (invoice.id && isUUID(invoice.id)) {
      const { data: byId } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', invoice.id)
        .limit(1);
      if (byId && byId.length > 0) existingInvoiceId = byId[0].id;
    }

    if (!existingInvoiceId && invoice.invoiceNumber) {
      const { data: byNum } = await supabase
        .from('invoices')
        .select('id')
        .eq('school_id', schoolId)
        .eq('invoice_number', invoice.invoiceNumber)
        .limit(1);
      if (byNum && byNum.length > 0) existingInvoiceId = byNum[0].id;
    }

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
    }
    return true;
  } catch (err) {
    console.warn('saveInvoiceToSupabase catch:', err);
    return false;
  }
}

export async function batchUpsertInvoices(invoices: Invoice[], schoolSlug: string): Promise<boolean> {
  if (!isSupabaseConfigured || !invoices || invoices.length === 0) return false;
  try {
    const cleanSlug = (!schoolSlug || schoolSlug === 'college-excellence') ? 'epc-manoi' : schoolSlug;
    const schoolId = await getSchoolId(cleanSlug);
    if (!schoolId) return false;

    // Charger les élèves de l'établissement une seule fois pour résoudre les UUIDs sans requêtes en boucle
    const { data: schoolStudents } = await supabase
      .from('students')
      .select('id, student_number, full_name')
      .eq('school_id', schoolId);

    const stuMap = new Map<string, string>();
    (schoolStudents || []).forEach((s: any) => {
      if (s.id) {
        stuMap.set(s.id, s.id);
        if (s.student_number) stuMap.set(s.student_number.toUpperCase(), s.id);
        if (s.full_name) stuMap.set(s.full_name.trim().toLowerCase(), s.id);
      }
    });

    // Résoudre l'id réel (clé primaire) de chaque facture existante avant l'upsert — même
    // raison que pour batchUpsertStudents : (school_id, invoice_number) n'est pas une
    // contrainte unique réelle sur cette table, donc onConflict sur ces colonnes ne détecte
    // jamais rien et chaque appel INSÉRAIT une nouvelle ligne (jusqu'à plus de 100 doublons
    // pour une seule quittance d'internat).
    const { data: existingInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number')
      .eq('school_id', schoolId);
    const invMap = new Map<string, string>(); // invoice_number -> id
    (existingInvoices || []).forEach((r: any) => {
      if (r.invoice_number) invMap.set(r.invoice_number, r.id);
    });

    const payloads: any[] = [];
    for (const inv of invoices) {
      let stuUUID: string | null = null;
      if (inv.studentId && isUUID(inv.studentId)) {
        stuUUID = inv.studentId;
      } else if (inv.studentId && stuMap.has(inv.studentId.toUpperCase())) {
        stuUUID = stuMap.get(inv.studentId.toUpperCase())!;
      } else if (inv.invoiceNumber) {
        const studentNum = inv.invoiceNumber.replace('REC-2026-', 'ID-').toUpperCase();
        if (stuMap.has(studentNum)) stuUUID = stuMap.get(studentNum)!;
      }
      if (!stuUUID && inv.studentName && stuMap.has(inv.studentName.trim().toLowerCase())) {
        stuUUID = stuMap.get(inv.studentName.trim().toLowerCase())!;
      }

      if (stuUUID) {
        const existingId = (inv.invoiceNumber && invMap.get(inv.invoiceNumber)) ||
          (inv.id && isUUID(inv.id) ? inv.id : undefined);
        payloads.push({
          ...(existingId ? { id: existingId } : {}),
          school_id: schoolId,
          student_id: stuUUID,
          invoice_number: inv.invoiceNumber,
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

    const { error } = await supabase.from('invoices').upsert(payloads);

    if (error) {
      console.warn('Erreur batchUpsertInvoices:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Erreur batchUpsertInvoices catch:', err);
    return false;
  }
}

// 4. GESTION DU PERSONNEL (STAFF USERS)
export async function getStaffUsersFromSupabase(schoolSlug: string): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const cleanSlug = schoolSlug === 'college-excellence' ? 'epc-manoi' : (schoolSlug || 'epc-manoi');
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
      matricule: d.matricule || `EMP-${d.auth_code}`,
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
}, schoolSlug: string): Promise<boolean> {
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

    // Vérifier si le membre du personnel existe déjà
    const { data: existingStaff } = await supabase
      .from('staff_users')
      .select('id')
      .eq('school_id', schoolId)
      .eq('auth_code', staff.authCode)
      .limit(1);

    if (existingStaff && existingStaff.length > 0) {
      const { error: updateErr } = await supabase
        .from('staff_users')
        .update(payload)
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
      .maybeSingle();

    // Les deux appelants de cette fonction (dashboard-view.tsx et /api/sync) reconstruisent et
    // envoient systématiquement les 6 collections au complet à chaque appel — il n'existe pas de
    // "mise à jour partielle" où un champ manquant signifierait "ne pas y toucher". Fusionner en
    // gardant l'ancienne valeur dès qu'une collection arrive vide écrasait donc silencieusement
    // toute suppression légitime du DERNIER élève d'un service (internat/cantine/transport) : la
    // liste vide envoyée était rejetée et l'ancien abonné revenait au prochain rafraîchissement.
    const mergedData = servicesData;

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
      .maybeSingle();

    if (data?.department) {
      return JSON.parse(data.department);
    }
    return null;
  } catch (err) {
    console.warn('getServicesDataFromSupabase catch:', err);
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

    const { data } = await supabase
      .from('staff_users')
      .select('department')
      .eq('school_id', schoolId)
      .eq('role_id', 'system_diverse_notes')
      .maybeSingle();

    if (data?.department) return JSON.parse(data.department);
    return null;
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

    const { data } = await supabase
      .from('staff_users')
      .select('department')
      .eq('school_id', schoolId)
      .eq('role_id', 'system_parent_messages')
      .maybeSingle();

    if (data?.department) return JSON.parse(data.department);
    return null;
  } catch (err) {
    console.warn('getParentMessagesFromSupabase catch:', err);
    return null;
  }
}
