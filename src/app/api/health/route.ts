import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function GET() {
  const checks: Record<string, any> = { status: "ok" };

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

  const statusCode = checks.status === "ok" ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
