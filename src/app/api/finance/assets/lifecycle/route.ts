export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  recordAssetMovement,
  listAssetMovements,
  createMaintenanceTeam,
  listMaintenanceTeams,
  scheduleMaintenance,
  listMaintenance,
  completeMaintenance,
  adjustAssetValue,
  capitalizeAsset,
  upsertAssetLocation,
  listAssetLocationTree,
  upsertAssetFinanceBook,
  listAssetFinanceBooks,
  recordAssetUsage,
  postUsageDepreciation,
  getAssetActivity,
} from "@/lib/finance/asset-lifecycle";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const view = sp.get("view") ?? "maintenance";
  if (view === "movements") {
    const assetId = sp.get("assetId");
    if (!assetId) return NextResponse.json({ success: false, error: "assetId is required" }, { status: 400 });
    return NextResponse.json({ success: true, data: await listAssetMovements(tenantSlug, assetId) });
  }
  if (view === "teams") {
    return NextResponse.json({ success: true, data: await listMaintenanceTeams(tenantSlug) });
  }
  if (view === "locations") {
    return NextResponse.json({ success: true, data: await listAssetLocationTree(tenantSlug) });
  }
  if (view === "finance-books") {
    const assetId = sp.get("assetId");
    if (!assetId) return NextResponse.json({ success: false, error: "assetId is required" }, { status: 400 });
    return NextResponse.json({ success: true, data: await listAssetFinanceBooks(tenantSlug, assetId) });
  }
  if (view === "activity") {
    const assetId = sp.get("assetId");
    if (!assetId) return NextResponse.json({ success: false, error: "assetId is required" }, { status: 400 });
    return NextResponse.json({ success: true, data: await getAssetActivity(tenantSlug, assetId) });
  }
  const data = await listMaintenance(
    tenantSlug,
    sp.get("assetId") ?? undefined,
    sp.get("status") ?? undefined,
  );
  return NextResponse.json({ success: true, data });
}

const schemas = {
  move: z.object({
    tenantSlug: z.string().min(1),
    assetId: z.string().min(1),
    toLocation: z.string().min(1),
    custodian: z.string().optional(),
    notes: z.string().optional(),
  }),
  team: z.object({
    tenantSlug: z.string().min(1),
    name: z.string().min(1),
    members: z.array(z.string()).optional(),
  }),
  scheduleMaintenance: z.object({
    tenantSlug: z.string().min(1),
    assetId: z.string().min(1),
    kind: z.enum(["preventive", "repair", "inspection"]).optional(),
    teamName: z.string().optional(),
    scheduledDate: z.string().min(8),
    description: z.string().optional(),
  }),
  completeMaintenance: z.object({
    tenantSlug: z.string().min(1),
    maintenanceId: z.string().min(1),
    completedDate: z.string().min(8),
    cost: z.coerce.number().nonnegative().optional(),
    notes: z.string().optional(),
    creditAccountCode: z.string().optional(),
    financeBook: z.string().optional(),
    parts: z.array(z.object({
      item: z.string().min(1), qty: z.coerce.number().positive(), cost: z.coerce.number().nonnegative(),
    })).optional(),
    purchaseInvoiceId: z.string().optional(),
    purchaseInvoiceAmount: z.coerce.number().nonnegative().optional(),
  }),
  location: z.object({
    tenantSlug: z.string().min(1),
    name: z.string().min(1),
    parentName: z.string().optional(),
  }),
  financeBookParams: z.object({
    tenantSlug: z.string().min(1),
    assetId: z.string().min(1),
    financeBook: z.string().min(1),
    method: z.enum(["straight_line", "reducing_balance", "units_of_production"]).optional(),
    usefulLifeMonths: z.coerce.number().int().min(1).optional(),
    totalExpectedUnits: z.coerce.number().positive().optional(),
  }),
  recordUsage: z.object({
    tenantSlug: z.string().min(1),
    assetId: z.string().min(1),
    periodDate: z.string().min(8),
    units: z.coerce.number().positive(),
    financeBook: z.string().optional(),
  }),
  usageDepreciation: z.object({
    tenantSlug: z.string().min(1),
    assetId: z.string().min(1),
    periodDate: z.string().min(8),
    financeBook: z.string().optional(),
  }),
  adjust: z.object({
    tenantSlug: z.string().min(1),
    assetId: z.string().min(1),
    adjustmentDate: z.string().min(8),
    newNetBookValue: z.coerce.number().nonnegative(),
    reason: z.string().optional(),
    financeBook: z.string().optional(),
  }),
  capitalize: z.object({
    tenantSlug: z.string().min(1),
    name: z.string().min(1),
    category: z.string().optional(),
    capitalizationDate: z.string().min(8),
    amount: z.coerce.number().positive(),
    sourceAccountCode: z.string().optional(),
    assetAccountCode: z.string().optional(),
    usefulLifeMonths: z.coerce.number().int().min(1),
    salvageValue: z.coerce.number().nonnegative().optional(),
    method: z.enum(["straight_line", "reducing_balance"]).optional(),
    depreciationStartDate: z.string().optional(),
    financeBook: z.string().optional(),
  }),
} as const;

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const body = await request.json();
    const action = body?.action as keyof typeof schemas | undefined;
    const schema = action ? schemas[action] : undefined;
    if (!schema) {
      return NextResponse.json(
        { success: false, error: `action must be one of: ${Object.keys(schemas).join(", ")}` },
        { status: 400 },
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const input = parsed.data as any;
    const userId = (_scope as any).user?.id;
    let data: unknown;
    switch (action) {
      case "move":
        data = await recordAssetMovement(input);
        break;
      case "team":
        data = await createMaintenanceTeam(input);
        break;
      case "scheduleMaintenance":
        data = await scheduleMaintenance(input);
        break;
      case "completeMaintenance":
        data = await completeMaintenance({ ...input, userId });
        break;
      case "adjust": {
        // Impairment/write-down posts a GL entry — gated like disposal.
        const { sql } = await import("@/lib/sql-client");
        const [asset] = (await sql`
          select name, net_book_value from fixed_assets
          where id = ${input.assetId} and tenant_slug = ${input.tenantSlug} limit 1
        `) as any[];
        const { gateOrRun } = await import("@/lib/finance/gated-actions");
        const outcome = await gateOrRun(
          input.tenantSlug,
          "asset_value_adjustment",
          {
            ...input,
            assetName: asset?.name,
            delta: Math.abs(Number(input.newNetBookValue) - Number(asset?.net_book_value ?? 0)),
          },
          { requestedBy: userId ?? "unknown" }
        );
        if (outcome.status === "pending") {
          return NextResponse.json(
            { success: true, pendingApproval: true, approvalId: outcome.approvalId },
            { status: 202 }
          );
        }
        if (outcome.status === "denied") {
          return NextResponse.json({ success: false, error: outcome.error }, { status: 403 });
        }
        data = outcome.result;
        break;
      }
      case "capitalize": {
        const { gateOrRun } = await import("@/lib/finance/gated-actions");
        const outcome = await gateOrRun(
          input.tenantSlug,
          "asset_capitalize",
          { ...input },
          { requestedBy: userId ?? "unknown" }
        );
        if (outcome.status === "pending") {
          return NextResponse.json(
            { success: true, pendingApproval: true, approvalId: outcome.approvalId },
            { status: 202 }
          );
        }
        if (outcome.status === "denied") {
          return NextResponse.json({ success: false, error: outcome.error }, { status: 403 });
        }
        data = outcome.result;
        break;
      }
      case "location":
        data = await upsertAssetLocation(input);
        break;
      case "financeBookParams":
        data = await upsertAssetFinanceBook(input);
        break;
      case "recordUsage":
        data = await recordAssetUsage(input);
        break;
      case "usageDepreciation":
        data = await postUsageDepreciation({ ...input, userId });
        break;
    }
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
