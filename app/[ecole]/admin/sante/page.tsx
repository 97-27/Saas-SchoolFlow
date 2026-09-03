import React from 'react';
import { ComingSoon } from '@/components/ui/coming-soon';

export default async function Page({
  params,
}: {
  params: Promise<{ ecole: string }> | { ecole: string };
}) {
  const resolvedParams = await params;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
          Santé & Suivi Médical
        </h1>
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
          2026-2027
        </span>
      </div>
      <ComingSoon
        description="Fiches médicales confidentielles, suivi des allergies, carnet de vaccination et incidents d’infirmerie."
        schoolSlug={resolvedParams.ecole}
      />
    </div>
  );
}
