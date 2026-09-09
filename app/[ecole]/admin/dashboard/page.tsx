import React from 'react';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { mockKPIs, mockInvoices, mockStudents, mockSchools } from '@/lib/data/mock-data';
import { getSchoolFromSupabase, getStudentsFromSupabase, getInvoicesFromSupabase, getServicesDataFromSupabase } from '@/lib/supabase/services';

interface DashboardPageProps {
  params: Promise<{ ecole: string }> | { ecole: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage({ params }: DashboardPageProps) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;

  let dbSchool = null;
  let dbStudents: any[] = [];
  let dbInvoices: any[] = [];
  let dbServices: any = null;

  try {
    const [sc, st, inv, srv] = await Promise.all([
      getSchoolFromSupabase(ecoleSlug),
      getStudentsFromSupabase(ecoleSlug),
      getInvoicesFromSupabase(ecoleSlug),
      getServicesDataFromSupabase(ecoleSlug),
    ]);
    dbSchool = sc;
    dbStudents = st || [];
    dbInvoices = inv || [];
    dbServices = srv || null;
  } catch (err) {
    console.warn('DashboardPage Supabase fetch warning:', err);
  }

  const school = dbSchool || mockSchools[ecoleSlug] || mockSchools['epc-manoi'];
  const students = dbStudents && dbStudents.length > 0 ? dbStudents : mockStudents;
  const invoices = dbInvoices && dbInvoices.length > 0 ? dbInvoices : mockInvoices;

  return (
    <DashboardView
      school={school}
      schoolSlug={ecoleSlug}
      initialStudents={students}
      initialInvoices={invoices}
      initialKPIs={mockKPIs}
      initialServices={dbServices}
    />
  );
}
