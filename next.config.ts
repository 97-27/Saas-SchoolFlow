import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
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

