import { LoginView } from '@/components/auth/login-view';
import { defaultSchool } from '@/lib/data/mock-data';

export default function GlobalLoginPage() {
  return <LoginView schoolSlug="epc-manoi" initialSchool={defaultSchool} />;
}
