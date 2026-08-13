import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` produces a self-contained server bundle so the Docker image
  // stays small and the app can be deployed by copying one folder.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Course thumbnails and lesson video uploads travel through server actions.
      bodySizeLimit: "512mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
