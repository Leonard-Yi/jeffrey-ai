/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'charset', value: 'utf-8' },
      ],
    },
  ],
};

module.exports = nextConfig;
