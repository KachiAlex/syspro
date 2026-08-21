import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getEnvStatus } from "@/lib/env-check";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET() {
  const checks: Record<string, any> = { status: "ok", timestamp: new Date().toISOString() };

  try {
    const sql = getSql();
    const result = await sql`SELECT 1 as connected`;
    checks.database = {
      status: "connected",
      driver: "neon",
      urlConfigured: !!process.env.DATABASE_URL,
      sample: Array.isArray(result) && result.length > 0 ? result[0] : null,
    };
  } catch (err) {
    checks.status = "degraded";
    checks.database = {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      urlConfigured: !!process.env.DATABASE_URL,
    };
  }

  checks.env = getEnvStatus();

  const allRequiredSet = Object.values(checks.env).every((e: any) => !e.required || e.set);
  if (!allRequiredSet && checks.status === "ok") {
    checks.status = "degraded";
  }

  const statusCode = checks.status === "ok" ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
