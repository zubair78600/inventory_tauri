import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Keep tracing scoped to this project (avoids /Users root inference)
  outputFileTracingRoot: __dirname,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
