export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { handleGatewayWebhook, type GatewayProvider } from "@/lib/finance/gateway-providers";

// Provider webhook receiver — verifies signature, posts AR receipt via
// the canonical payment path. Public by necessity (provider calls it);
// authenticity is established by HMAC signature verification.

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenant = searchParams.get("tenant");
  const provider = searchParams.get("provider") as GatewayProvider | null;
  if (!tenant || !provider || !["paystack", "flutterwave"].includes(provider))
    return NextResponse.json({ error: "tenant + valid provider required" }, { status: 400 });

  const rawBody = await request.text();
  const signature = provider === "paystack"
    ? request.headers.get("x-paystack-signature")
    : request.headers.get("verif-hash");

  try {
    const result = await handleGatewayWebhook({
      tenantSlug: tenant, provider, rawBody, signature,
    });
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg },
      { status: /signature|not configured|Invalid/i.test(msg) ? 401 : 400 });
  }
}
