import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

// Use a flat-config array without importing `eslint/config` (compat for
// environments where `eslint/config` isn't exported).
export default [
  ...nextVitals,
  ...nextTs,
  // Mirror the original global ignores from the previous config.
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];
