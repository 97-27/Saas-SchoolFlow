import { supabase, isSupabaseConfigured } from './client';
import { School, Student, Invoice } from '@/lib/data/types';
import { cleanDisplayAddress } from '@/lib/utils/formatters';

/**
 * ══════════════════════════════════════════════════════════════════
 * SERVICES SUPABASE : SYNCHRONISATION LIVE & BASE DE DONNÉES RÉELLE
 * ══════════════════════════════════════════════════════════════════
 */

// ── Cache mémoire pour éviter les lookups répétés sur la table schools ──
const schoolIdCache = new Map<string, string>(); // slug → UUID

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

    // Récupérer le cachet officiel sauvegardé
    let stampUrl = '';
    try {
      const { data: stampRow } = await supabase
        .from('staff_users')
        .select('avatar_url')
        .eq('school_id', data.id)
        .eq('role_id', 'school_stamp')
        .maybeSingle();
      if (stampRow?.avatar_url) {
        stampUrl = stampRow.avatar_url;
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

    // Sauvegarder le cachet officiel dans Supabase Cloud si fourni
    const schoolId = upsertedSchool?.id;
    if (schoolId && school.stampUrl && school.stampUrl.trim() !== '') {
      try {
        const { data: existingStamp } = await supabase
          .from('staff_users')
          .select('id')
          .eq('school_id', schoolId)
          .eq('role_id', 'school_stamp')
          .maybeSingle();

        if (existingStamp?.id) {
          await supabase
            .from('staff_users')
            .update({ avatar_url: school.stampUrl })
            .eq('id', existingStamp.id);
        } else {
          await supabase.from('staff_users').insert({
            school_id: schoolId,
            role_id: 'school_stamp',
            role_title: 'Cachet Officiel',
            is_active: true,
          });
        }
      } catch (stampErr) {
        console.warn('Erreur sauvegarde stamp dans Supabase:', stampErr);
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
        const match = (d.address || '').match(/\[SF_META:(.*?)\]/);
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


