/**
 * Environment variable validation for production readiness.
 * Call validateEnv() at startup to catch missing configuration early.
 */

export interface EnvCheck {
  name: string;
  required: boolean;
  description: string;
  devOnly?: boolean;
}

const ENV_CHECKS: EnvCheck[] = [
  { name: "DATABASE_URL", required: true, description: "Neon database connection string" },
  { name: "GROQ_API_KEY", required: false, description: "Groq API key for AI capabilities (optional — deterministic fallbacks work without it)" },
  { name: "SYSPRO_AI_API_KEY", required: false, description: "API key for external AI agent access via /api/ai/agent" },
  { name: "CRON_SECRET", required: false, description: "Bearer token for cron job endpoints (auto-appraisal, etc.)" },
  { name: "NEXT_PUBLIC_APP_URL", required: false, description: "Public app URL for CSRF validation and link generation" },
];

export function validateEnv(): { valid: boolean; missing: string[]; warnings: string[] } {
  const isProduction = process.env.NODE_ENV === "production";
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const check of ENV_CHECKS) {
    const value = process.env[check.name];
    if (!value) {
      if (check.required) {
        missing.push(`${check.name}: ${check.description}`);
      } else if (isProduction) {
        warnings.push(`${check.name} is not set. ${check.description}. Some features may be limited.`);
      }
    }
  }

  if (missing.length > 0) {
    console.error("[env] Missing required environment variables:\n" + missing.map((m) => `  - ${m}`).join("\n"));
  }
  if (warnings.length > 0) {
    console.warn("[env] Environment warnings:\n" + warnings.map((w) => `  - ${w}`).join("\n"));
  }

  return { valid: missing.length === 0, missing, warnings };
}

export function getEnvStatus(): Record<string, { set: boolean; required: boolean; description: string }> {
  const status: Record<string, { set: boolean; required: boolean; description: string }> = {};
  for (const check of ENV_CHECKS) {
    status[check.name] = {
      set: !!process.env[check.name],
      required: check.required,
      description: check.description,
    };
  }
  return status;
}
