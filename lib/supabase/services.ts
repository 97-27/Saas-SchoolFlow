import { supabase, isSupabaseConfigured } from './client';
import { School, Student, Invoice } from '@/lib/data/types';

/**
 * ══════════════════════════════════════════════════════════════════
 * SERVICES SUPABASE : SYNCHRONISATION LIVE & BASE DE DONNÉES RÉELLE
 * ══════════════════════════════════════════════════════════════════
 */

// 1. GESTION DES ÉCOLES (SCHOOLS)
export async function getSchoolFromSupabase(slug: string): Promise<School | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      slug: data.slug,
      name: data.name,
      shortName: data.short_name || '',
      motto: data.motto || 'Discipline • Rigueur • Réussite',
      slogan: data.slogan || 'La Lumière du Savoir',
      logoUrl: data.logo_url || '',
      countryEmblemUrl: data.country_emblem_url || '',
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
  try {
    const payload = {
      slug: school.slug,
      name: school.name,
      short_name: school.shortName,
      motto: school.motto,
      slogan: school.slogan,
      logo_url: school.logoUrl,
      country_emblem_url: school.countryEmblemUrl,
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

    const { error } = await supabase
      .from('schools')
      .upsert(payload, { onConflict: 'slug' });

    if (error) {
      console.error('Erreur saveSchoolToSupabase:', error.message);
      return false;
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
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', schoolSlug)
      .single();

    if (!school) return [];

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', school.id)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      studentNumber: d.student_number,
      matricule: d.matricule || '',
      firstName: d.first_name,
      lastName: d.last_name,
      fullName: d.full_name,
      grade: d.grade,
      gender: d.gender,
      dateOfBirth: d.date_of_birth || '',
      address: d.address || '',
      guardianName: d.guardian_name,
      guardianPhone: d.guardian_phone,
      whatsappPhone: d.whatsapp_phone || '',
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
      paymentDate: d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : '01/09/2026',
    }));
  } catch (err) {
    console.error('Erreur getStudentsFromSupabase:', err);
    return [];
  }
}

export async function saveStudentToSupabase(student: Student, schoolSlug: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    let { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', schoolSlug)
      .single();

    if (!school) {
      // Créer l'école si inexistante
      const { data: newSchool } = await supabase
        .from('schools')
        .insert({
          slug: schoolSlug,
          name: schoolSlug.toUpperCase(),
        })
        .select('id')
        .single();
      school = newSchool;
    }

    if (!school) return false;

    const payload = {
      school_id: school.id,
      student_number: student.studentNumber,
      matricule: student.matricule,
      first_name: student.firstName || student.fullName.split(' ')[0] || '',
      last_name: student.lastName || student.fullName.split(' ').slice(1).join(' ') || '',
      full_name: student.fullName,
      grade: student.grade,
      gender: student.gender,
      date_of_birth: student.dateOfBirth || null,
      address: student.address,
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

    const { error } = await supabase
      .from('students')
      .upsert(payload, { onConflict: 'student_number' });

    if (error) {
      console.error('Erreur saveStudentToSupabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Erreur saveStudentToSupabase catch:', err);
    return false;
  }
}

// 3. GESTION DES FACTURES (INVOICES)
export async function getInvoicesFromSupabase(schoolSlug: string): Promise<Invoice[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', schoolSlug)
      .single();

    if (!school) return [];

    const { data, error } = await supabase
      .from('invoices')
      .select('*, students(*)')
      .eq('school_id', school.id)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      invoiceNumber: d.invoice_number,
      studentId: d.student_id,
      studentName: d.students?.full_name || 'Élève',
      studentAvatar: d.students?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      studentGrade: d.students?.grade || '',
      studentGender: d.students?.gender || 'male',
      guardianName: d.students?.guardian_name || '',
      guardianPhone: d.students?.guardian_phone || '',
      feeType: d.fee_type || 'Scolarité Annuelle',
      amount: Number(d.amount) || 0,
      paidAmount: Number(d.paid_amount) || 0,
      discountAmount: Number(d.discount_amount) || 0,
      netAmount: Number(d.net_amount) || 0,
      balanceRemaining: Number(d.balance_remaining) || 0,
      paymentMethod: d.payment_method || 'Espèces',
      enrollmentType: d.students?.enrollment_type || 'nouveau',
      issueDate: d.issue_date || '2026-09-01',
      dueDate: d.due_date || '2027-05-30',
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
    let { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', schoolSlug)
      .single();

    if (!school) {
      const { data: newSchool } = await supabase
        .from('schools')
        .insert({
          slug: schoolSlug,
          name: schoolSlug.toUpperCase(),
        })
        .select('id')
        .single();
      school = newSchool;
    }

    if (!school) return false;

    const payload = {
      school_id: school.id,
      invoice_number: invoice.invoiceNumber,
      student_id: invoice.studentId || null,
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
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('invoices')
      .upsert(payload, { onConflict: 'invoice_number' });

    if (error) {
      console.warn('saveInvoiceToSupabase warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('saveInvoiceToSupabase catch:', err);
    return false;
  }
}
