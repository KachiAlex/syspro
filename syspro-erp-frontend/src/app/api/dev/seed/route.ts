import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const tenant = url.searchParams.get("tenantSlug") || "kreatix-default";

    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL not set — cannot seed database");
      return NextResponse.json({ error: "DATABASE_URL not set on server" }, { status: 500 });
    }

    // Dynamically import the seeder to avoid loading it in production code paths
    const mod = await import("@/lib/seed");
    if (!mod || typeof mod.seedDatabaseForTenant !== "function") {
      console.error("Seeder not found at @/lib/seed");
      return NextResponse.json({ error: "Seeder not available" }, { status: 500 });
    }

    console.log(`Dev seed request received for tenant: ${tenant}`);
    await mod.seedDatabaseForTenant(tenant);

    return NextResponse.json({ ok: true, tenant });
  } catch (error) {
    console.error("Dev seed failed", error);
    return NextResponse.json({ error: "Dev seed failed" }, { status: 500 });
  }
}
