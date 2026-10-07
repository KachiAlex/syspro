export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { deleteBudgetAllocation } from "@/lib/projects/db";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; allocationId: string } }
) {
  try {
    const context = validateTenantContext(request as any, "delete");
    const _gate1 = await requireModuleGate(request, "projects", "write");
    if (_gate1) return _gate1;
    const deleted = await deleteBudgetAllocation(params.allocationId, context.tenantSlug);
    if (!deleted) {
      return NextResponse.json({ error: 'Budget allocation not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Budget allocation deleted successfully' });
  } catch (error) {
    console.error('Failed to delete budget allocation:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete budget allocation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
