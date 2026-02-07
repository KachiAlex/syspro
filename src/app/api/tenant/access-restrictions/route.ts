import { NextRequest, NextResponse } from "next/server";

// TODO: Replace with actual database storage
// For now, we're using an in-memory cache (will reset on server restart)
const restrictionsCache = new Map<string, string[]>();

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
    // TODO: Fetch from database instead of cache
    // const restrictions = await db.accessRestrictions.findUnique({
    //   where: { tenantSlug },
    //   select: { restrictions: true }
    // });

    const restrictions = restrictionsCache.get(tenantSlug) || [];

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
    // TODO: Save to database instead of cache
    // await db.accessRestrictions.upsert({
    //   where: { tenantSlug },
    //   update: { restrictions },
    //   create: { tenantSlug, restrictions }
    // });

    restrictionsCache.set(tenantSlug, restrictions);

    // TODO: Trigger event to refetch permissions across all users
    // await emitTenantEvent(tenantSlug, 'restrictions-updated', { restrictions });

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
