import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  chartOfAccountCreateSchema,
  chartOfAccountUpdateSchema,
} from "@/lib/accounting/types";
import {
  createChartOfAccount,
  getChartOfAccounts,
  getChartOfAccount,
  updateChartOfAccount,
} from "@/lib/accounting/db";

/**
 * GET /api/accounting/accounts
 * List all accounts for a tenant with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug");
    const accountType = url.searchParams.get("accountType");
    const branchId = url.searchParams.get("branchId");
    const isActive = url.searchParams.get("isActive");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const accounts = await getChartOfAccounts(tenantSlug, {
      accountType: accountType || undefined,
      branchId: branchId || undefined,
      isActive: isActive ? isActive === "true" : undefined,
    });

    return NextResponse.json({ data: accounts });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/accounts
 * Create a new chart of account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = chartOfAccountCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const account = await createChartOfAccount(parsed.data);

    return NextResponse.json({ data: account }, { status: 201 });
  } catch (error) {
    console.error("Error creating account:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
