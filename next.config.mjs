/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow external images (Supabase Storage, etc.)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
