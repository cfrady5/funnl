/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cheerio is only used server-side; keep it out of the client bundle.
  serverExternalPackages: ["cheerio"],
  eslint: {
    // Linting is run separately in CI; do not block production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
