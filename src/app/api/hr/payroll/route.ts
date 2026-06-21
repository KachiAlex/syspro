import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPayrollRun, listPayrollRuns } from "@/lib/hr/db";

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  config: z.object({
    taxRate: z.number().min(0).max(100),
    pensionRate: z.number().min(0).max(100),
    healthInsuranceRate: z.number().min(0).max(100),
    transportAllowance: z.number().min(0),
    housingAllowance: z.number().min(0),
    mealAllowance: z.number().min(0),
  }),
  entries: z.array(
    z.object({
      employeeId: z.string().min(1),
      employeeName: z.string().min(1),
      department: z.string().optional(),
      position: z.string().optional(),
      baseSalary: z.number().min(0),
      transportAllowance: z.number().min(0),
      housingAllowance: z.number().min(0),
      mealAllowance: z.number().min(0),
      bonus: z.number().min(0),
      tax: z.number().min(0),
      pension: z.number().min(0),
      healthInsurance: z.number().min(0),
      otherDeductions: z.number().min(0),
      totalDeductions: z.number().min(0),
      grossPay: z.number().min(0),
      netPay: z.number(),
    })
  ),
  processedBy: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }

  try {
    const runs = await listPayrollRuns(tenantSlug);
    return NextResponse.json({ runs });
  } catch (error) {
    console.error("Failed to list payroll runs:", error);
    return NextResponse.json({ error: "Failed to list payroll runs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await createPayrollRun(parsed.data);
    return NextResponse.json({
      runId: result.runId,
      anomalies: result.anomalies,
      compliance: result.compliance,
    });
  } catch (error) {
    console.error("Failed to create payroll run:", error);
    return NextResponse.json(
      { error: "Failed to create payroll run" },
      { status: 500 }
    );
  }
}
