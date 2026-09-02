/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint draait apart via `npm run lint`; blokkeer production build niet op stijlkwesties.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
