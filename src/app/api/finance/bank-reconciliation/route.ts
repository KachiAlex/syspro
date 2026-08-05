import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createReconciliation,
  listReconciliations,
  getReconciliation,
  addReconciliationItem,
  getReconciliationItems,
  toggleItemReconciliation,
  finalizeReconciliation,
} from "@/lib/finance/bank-reconciliation";

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  accountId: z.string().min(1),
  statementDate: z.string().min(1),
  statementBalance: z.coerce.number(),
  bookBalance: z.coerce.number(),
  notes: z.string().optional(),
});

const addItemSchema = z.object({
  reconciliationId: z.string().min(1),
  transactionType: z.enum(["deposit", "withdrawal", "bank_charge", "interest", "transfer"]),
  transactionDate: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number(),
  bookEntryId: z.string().optional(),
});

const finalizeSchema = z.object({
  adjustedBookBalance: z.coerce.number(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const id = searchParams.get("id");
    if (id) {
      const recon = await getReconciliation(id, tenantSlug);
      if (!recon) {
        return NextResponse.json({ success: false, error: "Reconciliation not found" }, { status: 404 });
      }
      const items = await getReconciliationItems(id);
      return NextResponse.json({ success: true, data: { ...recon, items } });
    }

    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;
    const reconciliations = await listReconciliations(tenantSlug, limit);
    return NextResponse.json({ success: true, data: reconciliations });
  } catch (error) {
    console.error("Error fetching reconciliations:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || "create";

    if (action === "add_item") {
      const parsed = addItemSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
      }
      const item = await addReconciliationItem(parsed.data);
      return NextResponse.json({ success: true, data: item });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }
    const recon = await createReconciliation(parsed.data);
    return NextResponse.json({ success: true, data: recon });
  } catch (error) {
    console.error("Error creating reconciliation:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    const id = searchParams.get("id");
    const action = body.action;

    if (!tenantSlug || !id) {
      return NextResponse.json({ success: false, error: "tenantSlug and id are required" }, { status: 400 });
    }

    if (action === "toggle_item") {
      const item = await toggleItemReconciliation(body.itemId, body.isReconciled);
      return NextResponse.json({ success: true, data: item });
    }

    if (action === "finalize") {
      const parsed = finalizeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
      }
      const recon = await finalizeReconciliation(id, tenantSlug, parsed.data.adjustedBookBalance, parsed.data.notes);
      return NextResponse.json({ success: true, data: recon });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating reconciliation:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
