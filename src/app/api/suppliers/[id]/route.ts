import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "delete");
    const result = await db.query(
      `DELETE FROM suppliers WHERE id = $1 AND tenant_slug = $2 RETURNING id`,
      [params.id, context.tenantSlug]
    );
    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Supplier deleted" });
  } catch (error) {
    console.error("Supplier delete failed:", error);
    return NextResponse.json({ error: "Failed to delete supplier", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
