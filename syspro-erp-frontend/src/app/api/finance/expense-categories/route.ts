import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

const categoryCreateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  accountId: z.string().min(1),
  requiresVendor: z.boolean().default(true),
  requiresReceipt: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const sql = SQL;
    const categories = await sql`
      SELECT id, code, name, account_id, requires_vendor, requires_receipt
      FROM expense_categories
      ORDER BY name
    `;
    
    return NextResponse.json({ categories });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Expense categories fetch failed:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to load expense categories", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = categoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    console.log("Validation errors:", parsed.error.flatten());
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sql = SQL;
    const { code, name, accountId, requiresVendor, requiresReceipt } = parsed.data;
    const id = `cat_${code.toLowerCase()}`;

    // Check if category already exists
    const existing = await sql`SELECT id FROM expense_categories WHERE id = ${id}`;
    if ((existing as any[]).length > 0) {
      return NextResponse.json(
        { error: "Category with this code already exists" },
        { status: 409 }
      );
    }

    // Insert new category
    const result = await sql`
      INSERT INTO expense_categories (id, code, name, account_id, requires_vendor, requires_receipt)
      VALUES (${id}, ${code}, ${name}, ${accountId}, ${requiresVendor}, ${requiresReceipt})
      RETURNING id, code, name, account_id, requires_vendor, requires_receipt
    `;

    const category = result[0];
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Create category failed:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to create category", details: errorMessage },
      { status: 500 }
    );
  }
}
