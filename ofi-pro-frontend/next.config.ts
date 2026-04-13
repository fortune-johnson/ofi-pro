import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',        // ← Comment out or remove this line
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
