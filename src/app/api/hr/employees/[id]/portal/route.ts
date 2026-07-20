import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { setEmployeePassword, generatePassword } from "@/lib/hr/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || !body.tenantSlug) {
    return NextResponse.json(
      { error: "tenantSlug is required" },
      { status: 400 }
    );
  }

  const tenantSlug = body.tenantSlug as string;
  const isPortalActive = body.isPortalActive === true;
  const password = body.password as string | undefined;
  const generatePwd = body.generatePassword === true;

  try {
    await ensureHrTables(SQL);

    // If a password is provided or requested, set it (this also activates the portal)
    if (password || generatePwd) {
      const pwd = password || generatePassword();
      await setEmployeePassword(tenantSlug, id, pwd);

      // Fetch employee details for credential response
      const rows = await SQL`
        select name, email from admin_employees
        where id = ${id} and tenant_slug = ${tenantSlug}
        limit 1
      `;
      const emp = (rows as any[])[0];
      return NextResponse.json({
        success: true,
        isPortalActive: true,
        portalCredentials: emp ? { name: emp.name, email: emp.email, password: pwd } : null,
      });
    }

    // Otherwise just toggle portal status
    await SQL`
      update admin_employees
      set is_portal_active = ${isPortalActive},
          password_hash = case when ${isPortalActive} then password_hash else null end,
          updated_at = now()
      where id = ${id} and tenant_slug = ${tenantSlug}
    `;

    return NextResponse.json({ success: true, isPortalActive });
  } catch (error) {
    console.error("Employee portal update failed", error);
    return NextResponse.json(
      { error: "Failed to update portal status" },
      { status: 500 }
    );
  }
}
