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
  // En-têtes de sécurité (audit) : pas d'inclusion dans le site d'un autre (clickjacking), pas de
  // devinette du type de fichier, HTTPS imposé, peu d'infos transmises aux autres sites.
  // (Pas de Content-Security-Policy ici : elle demande un essai en conditions réelles.)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
        ],
      },
    ];
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

