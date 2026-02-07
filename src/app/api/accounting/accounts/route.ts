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

    return NextResponse.json({ accounts, data: accounts });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching accounts:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to fetch accounts", details: errorMessage },
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
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const parsed = chartOfAccountCreateSchema.safeParse(body);

    if (!parsed.success) {
      console.log("Validation errors:", parsed.error.flatten());
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const account = await createChartOfAccount(parsed.data);

    return NextResponse.json({ account, data: account }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating account:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to create account", details: errorMessage },
      { status: 500 }
    );
  }
}
