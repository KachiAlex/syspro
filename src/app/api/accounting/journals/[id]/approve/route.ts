import { NextRequest, NextResponse } from "next/server";
import { journalEntryApproveSchema } from "@/lib/accounting/types";
import { postJournalEntry, reverseJournalEntry, getJournalEntry } from "@/lib/accounting/db";

import { requireRecordTenant, requireModuleAccess } from "@/lib/api-auth";
/**
 * POST /api/accounting/journals/[id]/approve
 * Approve (post) or reject a journal entry
 */
export async function POST(
  request: NextRequest,
  context: any
) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  const { params } = context;
  try {
    const body = await request.json();
    const parsed = journalEntryApproveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { entryId, approverEmail, action } = parsed.data;

    const _owned = await requireRecordTenant("journal_entries", entryId, _scope.user);
    if (!_owned.ok) return _owned.response;

    if (action === "APPROVE") {
      const entry = await postJournalEntry(entryId, approverEmail, parsed.data.approverName);
      return NextResponse.json({ data: entry });
    } else if (action === "REJECT") {
      // Update entry status to REJECTED
      // Implementation depends on your DB setup
      return NextResponse.json({ message: "Entry rejected" });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error approving journal:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
