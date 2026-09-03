-- ==============================================================================
-- SCHOOLFLOW AFRICA - SCHÉMA DE BASE DE DONNÉES SUPABASE (POSTGRESQL)
-- Année scolaire de référence : 2026-2027 | Devises en FCFA
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE : ÉTABLISSEMENTS (SCHOOLS)
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT,
    motto TEXT DEFAULT 'Discipline • Rigueur • Réussite',
    slogan TEXT DEFAULT 'La Lumière du Savoir',
    logo_url TEXT,
    country_emblem_url TEXT,
    logo_color TEXT DEFAULT '#059669',
    city TEXT DEFAULT 'Abidjan',
    country TEXT DEFAULT 'Côte d’Ivoire',
    district TEXT,
    phone TEXT,
    whatsapp_phone TEXT,
    email TEXT,
    website TEXT,
    academic_year TEXT DEFAULT '2026-2027',
    current_term TEXT DEFAULT 'Trimestre 1',
    founder_name TEXT,
    director_name TEXT,
    subscription_plan TEXT DEFAULT 'annuel',
    subscription_price NUMERIC DEFAULT 250000,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLE : UTILISATEURS / PERSONNEL DE L'ÉCOLE (STAFF)
CREATE TABLE IF NOT EXISTS public.staff_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role_id TEXT NOT NULL, -- 'directeur', 'assistant_direction', 'fondateur', 'comptable', 'secretaire', 'enseignant', 'parent'
    role_title TEXT NOT NULL,
    department TEXT,
    auth_code TEXT NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLE : ÉLÈVES (STUDENTS)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_number TEXT NOT NULL, -- ex: ID-001
    matricule TEXT, -- ex: 26014829K
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    grade TEXT NOT NULL, -- Maternelle (P.S.) à 3ème
    gender TEXT CHECK (gender IN ('male', 'female')) NOT NULL,
    date_of_birth DATE,
    address TEXT,
    guardian_name TEXT NOT NULL,
    guardian_phone TEXT NOT NULL,
    whatsapp_phone TEXT,
    avatar_url TEXT,
    enrollment_type TEXT DEFAULT 'nouveau', -- 'nouveau' ou 'ancien'
    registration_fee NUMERIC DEFAULT 15000, -- Frais d'inscription en FCFA
    tuition_amount NUMERIC DEFAULT 150000, -- Scolarité brute en FCFA
    discount_amount NUMERIC DEFAULT 0, -- Réduction en FCFA
    net_amount NUMERIC DEFAULT 150000, -- Montant net après réduction en FCFA
    paid_amount NUMERIC DEFAULT 0, -- Somme versée en FCFA
    balance_remaining NUMERIC DEFAULT 150000, -- Reste à payer en FCFA
    tuition_status TEXT DEFAULT 'unpaid', -- 'paid', 'partial', 'unpaid'
    attendance_rate NUMERIC DEFAULT 100,
    status TEXT DEFAULT 'active', -- 'active', 'on_leave', 'transferred'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLE : VERSEMENTS & FACTURES DE SCOLARITÉ (INVOICES & PAYMENTS)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL, -- ex: FAC-2026-001
    fee_type TEXT DEFAULT 'Scolarité Annuelle',
    amount NUMERIC NOT NULL,
    paid_amount NUMERIC DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    net_amount NUMERIC NOT NULL,
    balance_remaining NUMERIC DEFAULT 0,
    payment_method TEXT DEFAULT 'Espèces', -- 'Espèces', 'Wave', 'Orange Money', 'Virement'
    status TEXT DEFAULT 'draft', -- 'paid', 'sent', 'draft', 'overdue', 'partial'
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABLE : HISTORIQUE DES TRANCHES DE VERSEMENTS (INSTALLMENTS)
CREATE TABLE IF NOT EXISTS public.installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    installment_number INT NOT NULL, -- 1, 2, 3, 4, 5
    amount NUMERIC NOT NULL, -- Montant en FCFA
    payment_method TEXT DEFAULT 'Espèces',
    receipt_number TEXT,
    payment_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABLE : NOTES ET ÉVALUATIONS (GRADES)
CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    grade_level TEXT NOT NULL, -- Classe (ex: CM2, 3ème)
    period TEXT NOT NULL, -- 'Trimestre 1', 'Trimestre 2', 'Trimestre 3'
    subject TEXT NOT NULL, -- Matière (Français, Mathématiques, etc.)
    evaluation_type TEXT DEFAULT 'interrogation', -- 'interrogation', 'devoir', 'composition'
    mark NUMERIC NOT NULL, -- Note sur 20
    out_of NUMERIC DEFAULT 20,
    coefficient NUMERIC DEFAULT 1,
    teacher_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. TABLE : PRÉSENCES ET ABSENCES (ATTENDANCE)
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    session_period TEXT DEFAULT 'morning', -- 'morning', 'afternoon'
    status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused')) DEFAULT 'present',
    justification TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TABLE : SALAIRES DU PERSONNEL (SALARIES)
CREATE TABLE IF NOT EXISTS public.staff_salaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.staff_users(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- ex: 'Septembre 2026'
    base_salary NUMERIC NOT NULL,
    bonuses NUMERIC DEFAULT 0,
    deductions NUMERIC DEFAULT 0,
    net_salary NUMERIC NOT NULL,
    payment_date DATE,
    payment_method TEXT DEFAULT 'Virement Bancaire',
    status TEXT DEFAULT 'pending', -- 'paid', 'pending'
    receipt_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INDEXES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_students_school ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.students(grade);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON public.invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_period ON public.grades(student_id, period);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(date);
