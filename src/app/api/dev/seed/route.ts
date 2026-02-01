import { NextRequest, NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

/**
 * Development-only endpoint to seed database with mock data.
 * Should only be used in development environments.
 * 
 * Usage: POST /api/dev/seed?tenantSlug=kreatix-default
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seeding is disabled in production" },
      { status: 403 }
    );
  }

  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") || "kreatix-default";

    await seedDatabase(tenantSlug);

    return NextResponse.json(
      { success: true, message: `Database seeded for tenant: ${tenantSlug}` },
      { status: 200 }
    );
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seeding failed" },
      { status: 500 }
    );
  }
}
