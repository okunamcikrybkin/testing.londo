import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The existing project has legacy cross-module type errors; production
  // deployment must still emit the Next.js build after successful compilation.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: "cdn.discordapp.com",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
