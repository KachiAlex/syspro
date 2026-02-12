import { NextRequest, NextResponse } from "next/server";
import { journalEntryApproveSchema } from "@/lib/accounting/types";
import { postJournalEntry, reverseJournalEntry, getJournalEntry } from "@/lib/accounting/db";

/**
 * POST /api/accounting/journals/[id]/approve
 * Approve (post) or reject a journal entry
 */
export async function POST(
  request: NextRequest,
  context: any
) {
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
