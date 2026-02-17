export default {
  // React Compiler triggers issues on some environments; keep disabled.
  reactCompiler: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {},
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};
