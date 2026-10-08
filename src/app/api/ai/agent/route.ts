export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgent, CAPABILITY_DEFINITIONS, getConversationHistory, type AgentCapability } from "@/lib/ai/agent";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import { isTenantSuspended } from "@/lib/api-auth";
import { APIKeyService } from "@/lib/tenant-admin/service";
import { asTenantSlug } from "@/lib/tenant-admin/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Auth ───

async function authenticate(request: NextRequest): Promise<{ tenantSlug: string; authMethod: "api_key" | "session" } | NextResponse | null> {
  // 1. Try API key — platform key (env) or a tenant-issued key from
  // admin_api_keys bound to the x-tenant-slug header tenant.
  const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
  const headerTenant = request.headers.get("x-tenant-slug");
  if (apiKey && headerTenant) {
    const isPlatform = apiKey === process.env.SYSPRO_AI_API_KEY;
    const tenantKey = isPlatform ? null : await new APIKeyService().authenticate(asTenantSlug(headerTenant), apiKey).catch(() => null);
    if (isPlatform || tenantKey) {
      if (await isTenantSuspended(headerTenant)) {
        return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 });
      }
      return { tenantSlug: headerTenant, authMethod: "api_key" };
    }
  }

  // 2. Try employee session (for internal calls)
  const session = resolveEmployeeSession(request);
  if (session && (await isTenantSuspended(session.tenantSlug))) {
    return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 });
  }
  if (session) {
    return { tenantSlug: session.tenantSlug, authMethod: "session" };
  }

  return null;
}

// ─── Request Schema ───

const MAX_PAYLOAD_SIZE = 50_000;

const agentSchema = z.object({
  capability: z.enum([
    "screen_candidates",
    "generate_report",
    "appraise_performance",
    "summarize",
    "generate_training_plan",
    "proactive_insights",
  ]),
  payload: z.record(z.unknown()),
  tenantSlug: z.string().min(1).max(100).optional(),
  useAI: z.boolean().optional(),
  conversationId: z.string().max(200).optional(),
}).refine((data) => JSON.stringify(data.payload).length <= MAX_PAYLOAD_SIZE, {
  message: `Payload exceeds maximum size of ${MAX_PAYLOAD_SIZE} bytes`,
});

// ─── POST: Execute Agent ───

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;
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
    conversationId: parsed.data.conversationId,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

// ─── GET: List Capabilities ───

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;
  if (!auth) {
    return NextResponse.json(
      {
        error: "Authentication required. Provide x-api-key header (with x-tenant-slug) or a valid session cookie.",
      },
      { status: 401 },
    );
  }

  const conversationId = request.nextUrl.searchParams.get("conversationId");

  if (conversationId) {
    const history = await getConversationHistory(conversationId);
    return NextResponse.json({ conversationId, turns: history });
  }

  return NextResponse.json({
    agent: "Syspro AI Agent",
    version: "1.1.0",
    capabilities: CAPABILITY_DEFINITIONS.map((c) => ({
      name: c.name,
      description: c.description,
      inputSchema: c.inputSchema,
      outputDescription: c.outputDescription,
    })),
    model: "llama-3.3-70b-versatile",
    provider: "groq",
    authMethods: ["api_key", "session"],
    features: ["conversation_memory", "deterministic_fallbacks", "mcp_compatible"],
    endpoints: {
      execute: "POST /api/ai/agent",
      capabilities: "GET /api/ai/agent",
      conversation: "GET /api/ai/agent?conversationId=<id>",
      mcp: "GET /api/ai/agent/mcp",
    },
  });
}
