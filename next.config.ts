import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  devIndicators: false,
  async headers() {
    const marketingCache = [
      {
        key: 'Cache-Control',
        value: 'public, s-maxage=600, stale-while-revalidate=86400',
      },
    ];
    const day = [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }];
    return [
      { source: '/', headers: marketingCache },
      { source: '/about', headers: marketingCache },
      { source: '/privacy', headers: marketingCache },
      { source: '/terms', headers: marketingCache },
      { source: '/pricing', headers: marketingCache },
      { source: '/guides', headers: marketingCache },
      { source: '/guides/:path*', headers: marketingCache },
      { source: '/lessons', headers: marketingCache },
      { source: '/og.png', headers: day },
      { source: '/logo.png', headers: day },
      { source: '/logo.webp', headers: day },
      { source: '/logo-192.png', headers: day },
    ];
  },
};

export default nextConfig;
