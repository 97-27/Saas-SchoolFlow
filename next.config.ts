import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Identifiant de la version déployée, figé à la compilation (côté serveur ET côté navigateur) :
  // un écran resté ouvert détecte ainsi qu'une nouvelle version est en ligne et se recharge seul.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || 'local',
  },
  // Les erreurs TypeScript bloquent désormais le build (et donc le déploiement Vercel) au lieu
  // d'être ignorées en silence.
  typescript: {
    ignoreBuildErrors: false,
  },
  async redirects() {
    return [
      {
        source: '/college-excellence',
        destination: '/epc-manoi/admin',
        permanent: true,
      },
      {
        source: '/college-excellence/:path*',
        destination: '/epc-manoi/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

