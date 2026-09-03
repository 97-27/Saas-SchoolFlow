import { LoginView } from '@/components/auth/login-view';
import { mockSchools } from '@/lib/data/mock-data';

interface LoginPageProps {
  params: Promise<{ ecole: string }>;
}

export default async function DirectLoginPage({ params }: LoginPageProps) {
  const resolvedParams = await params;
  const school = mockSchools[resolvedParams.ecole] || mockSchools['college-excellence'];

  return <LoginView schoolSlug={resolvedParams.ecole} initialSchool={school} />;
}
