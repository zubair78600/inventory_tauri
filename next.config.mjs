/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  distDir: 'out',
  // Disable server-side features for static export

  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
