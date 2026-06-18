import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { financeAccountCreateSchema } from "@/lib/finance/types";
import { listFinanceAccounts, insertFinanceAccount } from "@/lib/finance/db";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  regionId: z.string().optional(),
  branchId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    regionId: url.searchParams.get("regionId") ?? undefined,
    branchId: url.searchParams.get("branchId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const accounts = await listFinanceAccounts(parsed.data);
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Finance accounts list failed", error);
    return NextResponse.json({ error: "Failed to load finance accounts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = financeAccountCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const account = await insertFinanceAccount(parsed.data);
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error("Finance account create failed", error);
    return NextResponse.json({ error: "Failed to create finance account" }, { status: 500 });
  }
}
