import React from 'react';
import { TrendBadge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendText?: string;
  isPositiveGood?: boolean;
  subtitle?: string;
  iconBgColor?: string;
  iconColor?: string;
  genderBreakdown?: {
    girls: number;
    boys: number;
  };
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendText,
  isPositiveGood = true,
  subtitle,
  iconBgColor = 'bg-emerald-50',
  iconColor = 'text-emerald-600',
  genderBreakdown,
}: StatCardProps) {
  const totalStudents =
    genderBreakdown && genderBreakdown.girls + genderBreakdown.boys > 0
      ? genderBreakdown.girls + genderBreakdown.boys
      : 0;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* Top Header: Icon + Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-3.5">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${iconBgColor} ${iconColor} flex items-center justify-center shrink-0 shadow-xs`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 font-sans leading-tight">
            {title}
          </h3>
        </div>

        {/* Value + Trend Badge */}
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl xl:text-[28px] font-extrabold text-slate-900 tracking-tight font-heading whitespace-nowrap">
            {value}
          </span>
          {trend !== undefined && (
            <div className="shrink-0">
              <TrendBadge value={trend} isPositiveGood={isPositiveGood} />
            </div>
          )}
        </div>

        {/* Gender Breakdown: Filles & Garçons */}
        {genderBreakdown && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-200/70 font-semibold text-[11px]">
                <span className="text-[11px] font-bold">♀</span>
                <span>{genderBreakdown.girls.toLocaleString('fr-FR')} Filles</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/70 font-semibold text-[11px]">
                <span className="text-[11px] font-bold">♂</span>
                <span>{genderBreakdown.boys.toLocaleString('fr-FR')} Garçons</span>
              </span>
            </div>

            {/* Visual ratio bar */}
            {totalStudents > 0 && (
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-pink-400 h-full transition-all duration-300"
                  style={{
                    width: `${(genderBreakdown.girls / totalStudents) * 100}%`,
                  }}
                  title={`Filles: ${Math.round((genderBreakdown.girls / totalStudents) * 100)}%`}
                />
                <div
                  className="bg-blue-400 h-full transition-all duration-300"
                  style={{
                    width: `${(genderBreakdown.boys / totalStudents) * 100}%`,
                  }}
                  title={`Garçons: ${Math.round((genderBreakdown.boys / totalStudents) * 100)}%`}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subtitle / Footer info */}
      {(subtitle || trendText) && (
        <div className="mt-3.5 pt-3 border-t border-slate-100/90 flex items-center justify-between gap-1 text-[11px] text-slate-500 flex-wrap">
          <span className="leading-tight">{subtitle}</span>
          {trendText && (
            <span className="font-semibold text-slate-600 shrink-0">{trendText}</span>
          )}
        </div>
      )}
    </div>
  );
}
