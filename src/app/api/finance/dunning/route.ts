export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  listDunningCandidates, issueDunningNotice, listDunningNotices, runDunningCycle,
} from "@/lib/finance/credit-control";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  try {
    if (url.searchParams.get("notices") === "true") {
      const notices = await listDunningNotices(
        context.tenantSlug, url.searchParams.get("invoiceId") ?? undefined);
      return NextResponse.json({ notices });
    }
    const candidates = await listDunningCandidates(
      context.tenantSlug, url.searchParams.get("asOf") ?? undefined);
    return NextResponse.json({ candidates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const schema = z.object({
  action: z.enum(["issue", "run"]).default("issue"),
  invoiceId: z.string().min(1).optional(),
  method: z.string().optional(),
  feeAmount: z.coerce.number().nonnegative().optional(),
  issueDate: z.string().min(8).optional(),
  asOf: z.string().min(8).optional(),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const out = parsed.data.action === "run"
      ? await runDunningCycle({
          tenantSlug: context.tenantSlug,
          asOf: parsed.data.asOf,
          method: parsed.data.method,
          userId: context.userId,
        })
      : (() => {
          if (!parsed.data.invoiceId || !parsed.data.issueDate) {
            throw new Error("invoiceId and issueDate are required");
          }
          return issueDunningNotice({
            tenantSlug: context.tenantSlug,
            invoiceId: parsed.data.invoiceId,
            issueDate: parsed.data.issueDate,
            method: parsed.data.method,
            feeAmount: parsed.data.feeAmount,
          });
        })();
    return NextResponse.json(await out, { status: parsed.data.action === "run" ? 200 : 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
