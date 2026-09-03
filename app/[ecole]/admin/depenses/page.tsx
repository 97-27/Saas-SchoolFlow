import React from 'react';
import { mockSchools } from '@/lib/data/mock-data';
import { ExpensesView } from '@/components/expenses/expenses-view';

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <ExpensesView
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
