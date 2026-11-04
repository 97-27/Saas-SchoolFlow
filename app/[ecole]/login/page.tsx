import { LoginView } from '@/components/auth/login-view';
import { loadLoginSchool } from '@/lib/server/login-school';

export const dynamic = 'force-dynamic';

interface LoginPageProps {
  params: Promise<{ ecole: string }>;
}

export default async function DirectLoginPage({ params }: LoginPageProps) {
  const resolvedParams = await params;
  const school = await loadLoginSchool(resolvedParams.ecole);

  return <LoginView schoolSlug={school.slug} initialSchool={school} />;
}
