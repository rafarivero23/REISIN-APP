/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't fetch Google Fonts at build time (fails in some build sandboxes);
  // the <link> in layout.tsx loads them in the browser instead.
  optimizeFonts: false,
  // Photo uploads (resized in the browser) go through server actions.
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
