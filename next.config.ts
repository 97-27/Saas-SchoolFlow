import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
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

