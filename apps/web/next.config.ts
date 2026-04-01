import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/api/files/**',
      },
    ],
  },
  async rewrites() {
    // API_INTERNAL_URL is set in Docker (http://api:8000); NEXT_PUBLIC_API_URL is used locally
    const apiUrl = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/files/:path*',
        destination: `${apiUrl}/api/files/:path*`,
      },
    ];
  },
};

export default nextConfig;
