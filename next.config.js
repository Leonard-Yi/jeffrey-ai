/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type checking is run separately via `npm run typecheck` to reduce peak build memory.
  // Run `npm run typecheck` before deploying to ensure type safety.
  typescript: { ignoreBuildErrors: true },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'charset', value: 'utf-8' },
      ],
    },
  ],
  // Mark native modules as external so Turbopack doesn't try to bundle them
  serverExternalPackages: ['nodejieba'],
  // Empty turbopack config to silence error about webpack config in Next.js 16 (Turbopack is default)
  turbopack: {},
  webpack: (config) => {
    // Limit parallel compilation threads to reduce build-time memory peak.
    config.parallelism = 1;
    return config;
  },
};

module.exports = nextConfig;
