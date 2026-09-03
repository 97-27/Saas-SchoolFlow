'use client';

import React, { useState } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { ReadOnlyGuard } from './read-only-guard';

interface DashboardShellProps {
  children: React.ReactNode;
  schoolSlug?: string;
  breadcrumbs?: string[];
}

export function DashboardShell({
  children,
  schoolSlug = 'epc-manoi',
  breadcrumbs,
}: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <ReadOnlyGuard>
      <div className="min-h-screen bg-[#f8fafc] print:bg-white print:min-h-0">
        {/* Sidebar */}
        <div className="print:hidden">
          <Sidebar
            schoolSlug={schoolSlug}
            isMobileOpen={isMobileMenuOpen}
            onMobileClose={() => setIsMobileMenuOpen(false)}
          />
        </div>

        {/* Main Content Area */}
        <div className="lg:pl-64 flex flex-col min-h-screen print:pl-0 print:min-h-0">
          <div className="print:hidden">
            <Topbar
              schoolSlug={schoolSlug}
              onMenuToggle={() => setIsMobileMenuOpen(true)}
              breadcrumbs={breadcrumbs}
            />
          </div>
          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto print:p-0 print:m-0 print:max-w-full">
            {children}
          </main>
        </div>
      </div>
    </ReadOnlyGuard>
  );
}
