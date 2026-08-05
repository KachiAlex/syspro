import { NextRequest, NextResponse } from "next/server";
import { getJournalEntries, createJournalEntry } from "@/lib/finance/accounting";

export async function GET(request: NextRequest) {
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

    const entry = await createJournalEntry({
      tenantSlug,
      entryDate: new Date(entryDate).toISOString().split('T')[0],
      referenceType: referenceType || "manual",
      description,
      lines: lines.map((l: any) => ({
        accountCode: l.accountCode,
        debitAmount: Number(l.debitAmount || 0),
        creditAmount: Number(l.creditAmount || 0),
        description: l.description,
      })),
    });

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error("Error creating journal entry:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
