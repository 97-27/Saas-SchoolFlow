import type { Metadata } from 'next';
import { PlatformDashboard } from '@/components/platform/platform-dashboard';

export const metadata: Metadata = {
  title: 'Espace plateforme',
  robots: { index: false, follow: false },
};

export default function PlatformPage() {
  return <PlatformDashboard />;
}
