import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const sql = SQL;

    const rows = await sql`
      SELECT tenant_slug FROM admin_employees
      WHERE email = ${email.toLowerCase()} AND is_portal_active = true
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      tenantSlug: (rows[0] as any).tenant_slug,
    });
  } catch (error) {
    console.error("Employee lookup error:", error);
    return NextResponse.json(
      { error: "Lookup failed" },
      { status: 500 }
    );
  }
}
