import { NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";

export async function GET() {
  try {
    // Quick DB timestamp check
    const nowRes = await SQL`select now() as now`;
    // Check whether tenants table exists
    const tenantsRes = await SQL`select to_regclass('public.tenants') as tenants_reg`;

    return NextResponse.json({
      ok: true,
      now: nowRes?.[0]?.now ?? null,
      tenants_reg: tenantsRes?.[0]?.tenants_reg ?? null,
    });
  } catch (error) {
    console.error("DB health failed", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
