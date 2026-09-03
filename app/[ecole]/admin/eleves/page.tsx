import React from 'react';
import { mockSchools, mockStudents } from '@/lib/data/mock-data';
import { StudentTable } from '@/components/students/student-table';

interface ElevesPageProps {
  params: Promise<{ ecole: string }> | { ecole: string };
}

export default async function ElevesPage({ params }: ElevesPageProps) {
  const resolvedParams = await params;
  const ecoleSlug = resolvedParams.ecole;
  const school = mockSchools[ecoleSlug] || mockSchools['college-excellence'];

  return (
    <div className="pb-12">
      {/* Student Directory with unified top header, pushed-up action buttons, and continuous scrolling table */}
      <StudentTable
        initialStudents={mockStudents}
        schoolSlug={ecoleSlug}
        academicYear={school.academicYear}
        schoolName={school.name}
        school={school}
      />
    </div>
  );
}
