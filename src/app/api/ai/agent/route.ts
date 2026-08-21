import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgent, CAPABILITY_DEFINITIONS, type AgentCapability } from "@/lib/ai/agent";
import { resolveEmployeeSession } from "@/lib/hr/auth";

// ─── Auth ───

function authenticate(request: NextRequest): { tenantSlug: string; authMethod: "api_key" | "session" } | null {
  // 1. Try API key (for external integrations)
  const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey && apiKey === process.env.SYSPRO_AI_API_KEY) {
    const tenantSlug = request.headers.get("x-tenant-slug");
    if (tenantSlug) return { tenantSlug, authMethod: "api_key" };
  }

  // 2. Try employee session (for internal calls)
  const session = resolveEmployeeSession(request);
  if (session) {
    return { tenantSlug: session.tenantSlug, authMethod: "session" };
  }

  return null;
}

// ─── Request Schema ───

const agentSchema = z.object({
  capability: z.enum(["screen_candidates", "generate_report", "appraise_performance"]),
  payload: z.record(z.unknown()),
  tenantSlug: z.string().min(1).optional(),
  useAI: z.boolean().optional(),
});

// ─── POST: Execute Agent ───

export async function POST(request: NextRequest) {
  const auth = authenticate(request);
  if (!auth) {
    return NextResponse.json(
      {
        error: "Authentication required. Provide x-api-key header (with x-tenant-slug) or a valid session cookie.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = agentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Use tenantSlug from auth if not provided in body
  const tenantSlug = parsed.data.tenantSlug || auth.tenantSlug;
  if (auth.authMethod === "api_key" && !tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required in body or x-tenant-slug header" }, { status: 400 });
  }

  const result = await runAgent({
    capability: parsed.data.capability as AgentCapability,
    payload: parsed.data.payload,
    tenantSlug,
    useAI: parsed.data.useAI,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

// ─── GET: List Capabilities ───

export async function GET(request: NextRequest) {
  const auth = authenticate(request);
  if (!auth) {
    return NextResponse.json(
      {
        error: "Authentication required. Provide x-api-key header (with x-tenant-slug) or a valid session cookie.",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    agent: "Syspro AI Agent",
    version: "1.0.0",
    capabilities: CAPABILITY_DEFINITIONS.map((c) => ({
      name: c.name,
      description: c.description,
      inputSchema: c.inputSchema,
      outputDescription: c.outputDescription,
    })),
    model: "llama-3.3-70b-versatile",
    provider: "groq",
    authMethods: ["api_key", "session"],
    endpoints: {
      execute: "POST /api/ai/agent",
      capabilities: "GET /api/ai/agent",
      mcp: "GET /api/ai/agent/mcp",
    },
  });
}
