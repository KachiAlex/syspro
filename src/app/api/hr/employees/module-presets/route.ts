/**
 * Module Access Presets API
 * GET  /api/hr/employees/module-presets?tenantSlug=...
 * POST /api/hr/employees/module-presets  (save a new preset)
 * DELETE /api/hr/employees/module-presets?id=...&tenantSlug=...
 *
 * Presets are stored in tenant settings as module_access_presets.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    const rows = await SQL`
      SELECT settings->'module_access_presets' as presets
      FROM tenants
      WHERE slug = ${tenantSlug}
      LIMIT 1
    `;
    const row = (rows as any[])[0];
    const presets = row?.presets || [];
    return NextResponse.json({ presets });
  } catch (error: any) {
    console.error("module-presets GET error:", error?.message);
    return NextResponse.json({ error: "Failed to load presets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !body.tenantSlug || !body.name || !body.modules) {
    return NextResponse.json({ error: "tenantSlug, name, and modules are required" }, { status: 400 });
  }

  const { tenantSlug, name, modules } = body as {
    tenantSlug: string;
    name: string;
    modules: Record<string, boolean>;
  };

  try {
    // Fetch current settings
    const rows = await SQL`
      SELECT settings FROM tenants WHERE slug = ${tenantSlug} LIMIT 1
    `;
    const row = (rows as any[])[0];
    if (!row) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const settings = row.settings || {};
    const presets = settings.module_access_presets || [];
    const presetId = `preset_${Date.now()}`;
    presets.push({ id: presetId, name, modules, createdAt: new Date().toISOString() });
    settings.module_access_presets = presets;

    await SQL`
      UPDATE tenants SET settings = ${JSON.stringify(settings)}::jsonb WHERE slug = ${tenantSlug}
    `;

    return NextResponse.json({ success: true, preset: { id: presetId, name, modules } });
  } catch (error: any) {
    console.error("module-presets POST error:", error?.message);
    return NextResponse.json({ error: "Failed to save preset" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  const presetId = url.searchParams.get("id");
  if (!tenantSlug || !presetId) {
    return NextResponse.json({ error: "tenantSlug and id are required" }, { status: 400 });
  }

  try {
    const rows = await SQL`
      SELECT settings FROM tenants WHERE slug = ${tenantSlug} LIMIT 1
    `;
    const row = (rows as any[])[0];
    if (!row) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const settings = row.settings || {};
    const presets = (settings.module_access_presets || []).filter((p: any) => p.id !== presetId);
    settings.module_access_presets = presets;

    await SQL`
      UPDATE tenants SET settings = ${JSON.stringify(settings)}::jsonb WHERE slug = ${tenantSlug}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("module-presets DELETE error:", error?.message);
    return NextResponse.json({ error: "Failed to delete preset" }, { status: 500 });
  }
}
