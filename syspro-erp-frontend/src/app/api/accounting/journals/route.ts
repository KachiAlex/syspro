import { NextRequest, NextResponse } from "next/server";
import {
  journalEntryCreateSchema,
  journalEntryApproveSchema,
} from "@/lib/accounting/types";
import {
  createJournalEntry,
  getJournalEntries,
  postJournalEntry,
  reverseJournalEntry,
} from "@/lib/accounting/db";

/**
 * GET /api/accounting/journals
 * List journal entries with filters
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug");
    const fiscalPeriodId = url.searchParams.get("fiscalPeriodId");
    const approvalStatus = url.searchParams.get("approvalStatus");
    const journalType = url.searchParams.get("journalType");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const entries = await getJournalEntries(tenantSlug, {
      fiscalPeriodId: fiscalPeriodId || undefined,
      approvalStatus: approvalStatus || undefined,
      journalType: journalType || undefined,
    });

    return NextResponse.json({ data: entries });
  } catch (error) {
    console.error("Error fetching journals:", error);
    return NextResponse.json(
      { error: "Failed to fetch journals" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/journals
 * Create a new journal entry
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = journalEntryCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Validate lines have at least debit and credit
    const lines = parsed.data.lines;
    const hasDebit = lines.some((l) => l.debitAmount > 0);
    const hasCredit = lines.some((l) => l.creditAmount > 0);

    if (!hasDebit || !hasCredit) {
      return NextResponse.json(
        {
          error:
            "Journal must have at least one debit and one credit line",
        },
        { status: 400 }
      );
    }

    const { entry, lines: createdLines } =
      await createJournalEntry(parsed.data);

    return NextResponse.json(
      { data: { entry, lines: createdLines } },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating journal:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
