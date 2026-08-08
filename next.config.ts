import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output keeps the Docker image small: the self-host story is
  // `docker compose up`, not `next start` against a full node_modules.
  output: "standalone",
  experimental: {
    // The webhook receiver reads the raw body to verify its HMAC signature.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
