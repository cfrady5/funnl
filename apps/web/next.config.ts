import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@tiresias/core', '@tiresias/video', '@tiresias/render-worker'],
  // Server code reads local media/renders; Remotion's renderer is never bundled into the web app.
  serverExternalPackages: ['@remotion/renderer', '@remotion/bundler'],
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
};

export default config;
