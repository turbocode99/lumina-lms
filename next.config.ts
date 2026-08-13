import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Dev and production use separate build directories.
   *
   * They share `.next` by default, and combined with `output: "standalone"` that
   * is actively broken: after `npm run build`, `next dev` reads the production
   * artifacts left behind, prints its banner, and then hangs at "Starting…"
   * forever — no error, no timeout. Clearing `.next` fixes it, which is a
   * miserable thing to have to discover. Splitting the directories means either
   * command can follow the other with no cleanup step.
   */
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",

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
