export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { portalView } from "@/lib/finance/portal";

type Params = { params: Promise<{ token: string }> };

/**
 * PUBLIC endpoint — the token in the URL is the credential. No tenant auth.
 * Read-only view of a customer's invoices/payments or a vendor's bills/POs.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  try {
    const view = await portalView(token);
    if ("error" in view) {
      return NextResponse.json({ error: view.error }, { status: view.status });
    }
    return NextResponse.json(view, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
