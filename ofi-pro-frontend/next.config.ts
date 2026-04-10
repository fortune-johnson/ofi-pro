import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',           // This enables static export (best for Vercel free tier)
  trailingSlash: true,        // Recommended for static export
  images: {
    unoptimized: true,        // Required when using static export
  },
  // You can add more config later if needed
};

export default nextConfig;
