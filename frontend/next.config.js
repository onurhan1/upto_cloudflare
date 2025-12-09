/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages configuration
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787',
  },
  // Removed output: 'export' - Cloudflare Pages will handle Next.js with dynamic routes
};

module.exports = nextConfig;

