export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getWebFormBySlug, submitWebForm } from "@/lib/platform/web-forms";

// Public (unauthenticated) web-form schema + submission endpoint.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenant = searchParams.get("tenant");
  const slug = searchParams.get("slug");
  if (!tenant || !slug) return NextResponse.json({ error: "tenant and slug required" }, { status: 400 });
  const form = await getWebFormBySlug(tenant, slug);
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json({
    name: form.name, schema: form.schema,
    successMessage: form.success_message, targetEntity: form.target_entity,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const result = await submitWebForm({
      tenantSlug: String(body.tenant ?? ""),
      slug: String(body.slug ?? ""),
      data: body.data ?? {},
      ip,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: /required|not found/i.test(msg) ? 400 : 500 });
  }
}
