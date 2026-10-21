export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  defineCustomField,
  deleteCustomField,
  getCustomFieldValues,
  listCustomFields,
  setCustomFieldValues,
} from "@/lib/platform/custom-fields";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

const defSchema = z.object({
  doctype: z.string().min(1),
  fieldName: z.string().min(1),
  label: z.string().min(1),
  fieldType: z.enum(["text", "number", "date", "boolean", "select"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

const valuesSchema = z.object({
  action: z.literal("setValues"),
  doctype: z.string().min(1),
  recordId: z.string().min(1),
  values: z.record(z.unknown()),
});

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "admin", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get("recordId");
  if (recordId) {
    const values = await getCustomFieldValues(
      context.tenantSlug,
      searchParams.get("doctype") ?? "",
      recordId
    );
    if ("error" in (values as any)) {
      return NextResponse.json(values, { status: 404 });
    }
    return NextResponse.json({ values });
  }
  const fields = await listCustomFields(context.tenantSlug, searchParams.get("doctype") ?? undefined);
  return NextResponse.json({ fields });
}

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "admin", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();

  if (body?.action === "setValues") {
    const parsed = valuesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }
    const result = await setCustomFieldValues(
      context.tenantSlug, parsed.data.doctype, parsed.data.recordId, parsed.data.values
    );
    if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json({ ok: true });
  }

  const parsed = defSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const field = await defineCustomField(context.tenantSlug, parsed.data);
    return NextResponse.json({ field }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requireModuleAccess(request, "admin", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const deleted = await deleteCustomField(context.tenantSlug, id);
  if (!deleted) return NextResponse.json({ error: "Field not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
