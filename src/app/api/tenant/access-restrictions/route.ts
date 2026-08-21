import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";

async function ensureRestrictionsTable() {
  await SQL`
    create table if not exists tenant_access_restrictions (
      id text primary key,
      tenant_slug text not null unique,
      restrictions text[] default array[]::text[],
      updated_at timestamptz default now()
    )
  `;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug");

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "tenantSlug is required" },
      { status: 400 }
    );
  }

  try {
    await ensureRestrictionsTable();
    const [row] = (await SQL`
      select restrictions from tenant_access_restrictions where tenant_slug = ${tenantSlug}
    `) as any[];

    const restrictions = row?.restrictions ?? [];

    return NextResponse.json({
      tenantSlug,
      restrictions,
    });
  } catch (error) {
    console.error("Failed to fetch restrictions:", error);
    return NextResponse.json(
      { error: "Failed to fetch restrictions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenantSlug, restrictions } = body;

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "tenantSlug is required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(restrictions)) {
    return NextResponse.json(
      { error: "restrictions must be an array" },
      { status: 400 }
    );
  }

  try {
    await ensureRestrictionsTable();
    const id = `${tenantSlug}-restrictions`;
    await SQL`
      insert into tenant_access_restrictions (id, tenant_slug, restrictions, updated_at)
      values (${id}, ${tenantSlug}, ${restrictions}, now())
      on conflict (tenant_slug) do update set restrictions = ${restrictions}, updated_at = now()
    `;

    return NextResponse.json({
      tenantSlug,
      restrictions,
      message: `Access restrictions updated. ${restrictions.length} module(s) restricted.`,
    });
  } catch (error) {
    console.error("Failed to save restrictions:", error);
    return NextResponse.json(
      { error: "Failed to save restrictions" },
      { status: 500 }
    );
  }
}
