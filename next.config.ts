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
    return [
      { source: '/', headers: marketingCache },
      { source: '/about', headers: marketingCache },
      { source: '/privacy', headers: marketingCache },
      { source: '/terms', headers: marketingCache },
      { source: '/og.png', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
      {
        source: '/logo.png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default nextConfig;
