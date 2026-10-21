export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listJournalEntryTemplates,
  upsertJournalEntryTemplate,
  deleteJournalEntryTemplate,
  postFromTemplate,
} from "@/lib/finance/je-templates";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const data = await listJournalEntryTemplates(tenantSlug);
  return NextResponse.json({ success: true, data });
}

const lineSchema = z.object({
  accountCode: z.string().optional(),
  accountId: z.string().optional(),
  debitAmount: z.coerce.number().optional(),
  creditAmount: z.coerce.number().optional(),
  description: z.string().optional(),
  partyType: z.string().optional(),
  partyId: z.string().optional(),
  dimensions: z.record(z.string()).optional(),
});

const upsertSchema = z.object({
  tenantSlug: z.string().min(1),
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  journalType: z.enum(["MANUAL", "SYSTEM", "ADJUSTMENT", "REVERSING", "CLOSING"]).optional(),
  lines: z.array(lineSchema).min(1),
  active: z.boolean().optional(),
});

const executeSchema = z.object({
  action: z.literal("execute"),
  tenantSlug: z.string().min(1),
  templateId: z.string().min(1),
  entryDate: z.string().min(8),
  description: z.string().optional(),
  referenceId: z.string().optional(),
  financeBook: z.string().optional(),
  totalDebit: z.coerce.number().positive().optional(),
  status: z.enum(["POSTED", "DRAFT"]).optional(),
});

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const body = await request.json();
    if (body?.action === "execute") {
      const parsed = executeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
      }
      const { action: _a, ...input } = parsed.data;
      const entry = await postFromTemplate({
        ...input,
        createdBy: (_scope as any).user?.id,
      });
      return NextResponse.json({ success: true, data: entry });
    }
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const data = await upsertJournalEntryTemplate(parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  const id = request.nextUrl.searchParams.get("id");
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  if (!id || !tenantSlug) {
    return NextResponse.json({ success: false, error: "id and tenantSlug are required" }, { status: 400 });
  }
  const deleted = await deleteJournalEntryTemplate(id, tenantSlug);
  if (!deleted) {
    return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
