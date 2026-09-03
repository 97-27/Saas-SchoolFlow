import React from 'react';
import { mockSchools } from '@/lib/data/mock-data';
import { SettingsForm } from '@/components/settings/settings-form';
import { Sliders, Sparkles } from 'lucide-react';

interface ParametresPageProps {
  params: Promise<{ ecole: string }> | { ecole: string };
}

export default async function ParametresPage({ params }: ParametresPageProps) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header (Pandhowan style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Paramètres de l&apos;Établissement
            </h1>
            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {school.academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Configurez le nom, le logo, la ville, l&apos;année scolaire et les services de {school.name}
          </p>
        </div>

        {/* Status Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs text-xs font-semibold text-slate-700 self-start sm:self-auto">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Fiche Établissement Active</span>
        </div>
      </div>

      {/* Interactive Settings Form Component */}
      <SettingsForm initialSchool={school} />
    </div>
  );
}
