import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createPayrollAdjustment,
  listPayrollAdjustments,
} from "@/lib/hr/db";

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().min(1),
  type: z.enum(["increment", "deduction"]),
  category: z.enum(["bonus", "promotion", "fine", "loan_repayment", "other"]),
  amount: z.number().min(0),
  reason: z.string().optional(),
  effectivePeriod: z.string().regex(/^\d{4}-\d{2}$/),
  approvedBy: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  const employeeId = url.searchParams.get("employeeId") || undefined;
  const period = url.searchParams.get("period") || undefined;
  const status = url.searchParams.get("status") as
    | "pending"
    | "applied"
    | "rejected"
    | undefined;

  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }

  try {
    const adjustments = await listPayrollAdjustments(tenantSlug, {
      employeeId,
      period,
      status,
    });
    return NextResponse.json({ adjustments });
  } catch (error) {
    console.error("Failed to list payroll adjustments:", error);
    return NextResponse.json(
      { error: "Failed to list adjustments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await createPayrollAdjustment(parsed.data);
    return NextResponse.json({ id: result.id });
  } catch (error) {
    console.error("Failed to create payroll adjustment:", error);
    return NextResponse.json(
      { error: "Failed to create adjustment" },
      { status: 500 }
    );
  }
}
