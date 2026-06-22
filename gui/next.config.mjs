/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  distDir: '.next',
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  env: {
    APP_NAME: 'IRG',
  },
}

export default nextConfig