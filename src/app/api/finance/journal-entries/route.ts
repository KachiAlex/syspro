export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getJournalEntries, createJournalEntry } from "@/lib/finance/accounting";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "finance", "read");
    if (!_scope.ok) return _scope.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0;
    const referenceType = searchParams.get("referenceType") || undefined;
    const accountCode = searchParams.get("accountCode") || undefined;

    const entries = await getJournalEntries({ tenantSlug, limit, offset, referenceType, accountCode });

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  try {
    const body = await request.json();
    const { tenantSlug, entryDate, description, referenceType, lines } = body;

    if (!tenantSlug || !entryDate || !description || !lines || !Array.isArray(lines) || lines.length < 2) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const totalDebits = lines.reduce((s: number, l: any) => s + Number(l.debitAmount || 0), 0);
    const totalCredits = lines.reduce((s: number, l: any) => s + Number(l.creditAmount || 0), 0);
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json({ success: false, error: "Debits and credits must be equal" }, { status: 400 });
    }

    // Maker-checker on manual journals: when the tenant has configured a
    // journal-entry threshold (settings.approvals.journalEntryMinAmount) or a
    // matching approval rule, the JE is created DRAFT — invisible to all
    // reports — until the approval chain posts or rejects it.
    const refType = referenceType || "manual";
    let gated = false;
    if (refType === "manual") {
      const { requiresApproval } = await import("@/lib/finance/approvals");
      gated = await requiresApproval(tenantSlug, "journal_entry", { amount: totalDebits });
    }

    const entry = await createJournalEntry({
      tenantSlug,
      entryDate: new Date(entryDate).toISOString().split('T')[0],
      referenceType: refType,
      description,
      status: gated ? "DRAFT" : "POSTED",
      lines: lines.map((l: any) => ({
        accountCode: l.accountCode,
        debitAmount: Number(l.debitAmount || 0),
        creditAmount: Number(l.creditAmount || 0),
        description: l.description,
      })),
    });

    let approval = null;
    if (gated) {
      const { initiateApproval } = await import("@/lib/finance/approvals");
      approval = await initiateApproval({
        tenantSlug,
        entityType: "journal_entry",
        entityId: entry.id,
        requestedBy: "system",
        entityData: { amount: totalDebits, description },
      });
    }

    return NextResponse.json({ success: true, data: entry, approval, pendingApproval: gated });
  } catch (error) {
    console.error("Error creating journal entry:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
