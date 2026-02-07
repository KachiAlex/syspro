import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // React Compiler causes Turbopack to look for a missing internal cache handler on Windows; disable until Next fixes it.
  reactCompiler: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Leave empty for now; prior turbopack.resolveAlias was rejected by Next 16.
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
