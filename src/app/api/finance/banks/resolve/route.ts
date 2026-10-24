export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getGatewayConfig } from "@/lib/finance/gateway-providers";
import { requireModuleAccess } from "@/lib/api-auth";

const resolveSchema = z.object({
  tenantSlug: z.string().min(1),
  bankCode: z.string().min(1),
  accountNumber: z.string().regex(/^\d{6,20}$/),
});

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;

  const body = await request.json().catch(() => null);
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tenantSlug, bankCode, accountNumber } = parsed.data;

  let secretKey: string | null = null;
  try {
    const cfg = await getGatewayConfig(tenantSlug, "paystack");
    secretKey = cfg?.secret_key ?? null;
  } catch {
    secretKey = null;
  }

  if (!secretKey) {
    return NextResponse.json(
      { error: "Account name lookup requires an active Paystack gateway in Payments settings" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.status) {
      return NextResponse.json(
        { error: payload?.message || "Unable to resolve account number" },
        { status: 422 }
      );
    }
    return NextResponse.json({ accountName: payload.data.account_name });
  } catch (error) {
    console.error("Account resolve failed", error);
    return NextResponse.json({ error: "Account lookup failed" }, { status: 502 });
  }
}
