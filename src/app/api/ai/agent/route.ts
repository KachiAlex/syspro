export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgent, CAPABILITY_DEFINITIONS, getConversationHistory, buildConversationContext, type AgentCapability } from "@/lib/ai/agent";
import { routeIntent } from "@/lib/ai/intent-router";
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

const capabilityEnum = z.enum([
  "screen_candidates",
  "generate_report",
  "appraise_performance",
  "summarize",
  "generate_training_plan",
  "proactive_insights",
]);

const agentSchema = z.object({
  capability: capabilityEnum.optional(),
  payload: z.record(z.unknown()).optional(),
  message: z.string().min(1).max(10_000).optional(),
  tenantSlug: z.string().min(1).max(100).optional(),
  useAI: z.boolean().optional(),
  conversationId: z.string().max(200).optional(),
}).refine((data) => data.message || (data.capability && data.payload), {
  message: "Provide either a free-text 'message' or 'capability' + 'payload'",
}).refine((data) => JSON.stringify(data.payload ?? {}).length <= MAX_PAYLOAD_SIZE, {
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

  let capability = parsed.data.capability as AgentCapability | undefined;
  let payload = parsed.data.payload ?? {};
  let routedIntent: { rationale?: string } | null = null;

  // Free-text message → intent router. An explicit capability acts as a
  // hint: the router only fills in the payload for it.
  if (parsed.data.message) {
    const conversationContext = parsed.data.conversationId
      ? await buildConversationContext(parsed.data.conversationId, tenantSlug).catch(() => "")
      : "";
    const routed = await routeIntent(parsed.data.message, {
      hint: capability ?? null,
      conversationContext,
      useAI: parsed.data.useAI,
    });
    if (!routed.capability) {
      return NextResponse.json({
        success: true,
        capability: null,
        result: {
          reply:
            "I can screen candidates, generate staff reports, appraise performance, " +
            "summarize a department/CRM pipeline/procurement, draft training plans, " +
            "or scan for anomalies. What would you like?",
        },
        metadata: { source: "router", generatedAt: new Date().toISOString() },
      });
    }
    capability = routed.capability;
    payload = { ...routed.payload, ...payload };
    routedIntent = { rationale: routed.rationale };
  }

  const result = await runAgent({
    capability: capability as AgentCapability,
    payload,
    tenantSlug,
    useAI: parsed.data.useAI,
    conversationId: parsed.data.conversationId,
  });

  if (routedIntent?.rationale && result && typeof result === "object") {
    (result as any).routedIntent = routedIntent;
  }
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
    const history = await getConversationHistory(conversationId, auth.tenantSlug);
    return NextResponse.json({ conversationId, turns: history });
  }

  return NextResponse.json({
    agent: "Syspro AI Agent",
    version: "1.2.0",
    capabilities: CAPABILITY_DEFINITIONS.map((c) => ({
      name: c.name,
      description: c.description,
      inputSchema: c.inputSchema,
      outputDescription: c.outputDescription,
    })),
    model: "llama-3.3-70b-versatile",
    provider: "groq",
    authMethods: ["api_key", "session"],
    features: ["intent_router", "conversation_memory", "deterministic_fallbacks", "mcp_compatible"],
    usage: {
      freeText: "POST {message: '...', capability?: <hint>, conversationId?}",
      direct: "POST {capability: '<name>', payload: {...}}",
    },
    endpoints: {
      execute: "POST /api/ai/agent",
      capabilities: "GET /api/ai/agent",
      conversation: "GET /api/ai/agent?conversationId=<id>",
      mcp: "GET /api/ai/agent/mcp",
    },
  });
}
