import React from 'react';
import { schoolForSlug } from '@/lib/data/mock-data';
import { ExpensesView } from '@/components/expenses/expenses-view';

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = schoolForSlug(ecoleSlug);

  return (
    <ExpensesView
      school={school}
      schoolSlug={ecoleSlug}
    />
  );
}
