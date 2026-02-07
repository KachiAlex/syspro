import { NextRequest, NextResponse } from "next/server";

import { createSlaPolicy, listSlaPolicies } from "@/lib/support-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const policies = listSlaPolicies(tenantSlug);
  return NextResponse.json({ policies });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    tenantSlug?: string;
    name?: string;
    priority?: "critical" | "high" | "medium" | "low";
    impactLevel?: "critical" | "high" | "medium" | "low";
    responseMinutes?: number;
    resolutionMinutes?: number;
    escalationChain?: string[];
    autoEscalate?: boolean;
    active?: boolean;
    description?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string;
  };

  const required: Array<keyof typeof body> = [
    "name",
    "priority",
    "impactLevel",
    "responseMinutes",
    "resolutionMinutes",
  ];
  const missing = required.find((field) => body[field] === undefined || body[field] === null);
  if (missing) {
    return NextResponse.json({ error: `Missing field: ${missing}` }, { status: 400 });
  }

  const tenantSlug = body.tenantSlug || "default";
  const policy = createSlaPolicy({
    tenantSlug,
    name: body.name!,
    priority: body.priority!,
    impactLevel: body.impactLevel!,
    responseMinutes: body.responseMinutes!,
    resolutionMinutes: body.resolutionMinutes!,
    escalationChain: body.escalationChain || [],
    autoEscalate: body.autoEscalate ?? true,
    active: body.active ?? true,
    description: body.description,
    metadata: body.metadata,
    createdBy: body.createdBy,
  });

  return NextResponse.json({ policy }, { status: 201 });
}
