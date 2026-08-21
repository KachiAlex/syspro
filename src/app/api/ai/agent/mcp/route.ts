import { NextRequest, NextResponse } from "next/server";
import { runAgent, CAPABILITY_DEFINITIONS, type AgentCapability } from "@/lib/ai/agent";
import { resolveEmployeeSession } from "@/lib/hr/auth";

/**
 * MCP-compatible tool server for the Syspro AI Agent.
 *
 * Supports two transport modes:
 *  1. SSE (Server-Sent Events) — for streaming MCP clients
 *  2. HTTP POST — for simple request/response MCP clients
 *
 * External AI solutions (Claude, GPT, etc.) can connect to this endpoint
 * to discover and invoke the agent's capabilities as MCP tools.
 *
 * Auth: x-api-key header (matching SYSPRO_AI_API_KEY env var) + x-tenant-slug header,
 * or a valid employee session cookie.
 */

function authenticate(request: NextRequest): { tenantSlug: string } | null {
  const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey && apiKey === process.env.SYSPRO_AI_API_KEY) {
    const tenantSlug = request.headers.get("x-tenant-slug");
    if (tenantSlug) return { tenantSlug };
  }

  const session = resolveEmployeeSession(request);
  if (session) return { tenantSlug: session.tenantSlug };

  return null;
}

// ─── MCP Protocol Types ───

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

interface MCPToolCallRequest {
  method: string;
  params?: Record<string, unknown>;
  id?: string | number;
}

interface MCPToolCallResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

// ─── Build MCP Tools from Capability Definitions ───

function buildMCPTools(): MCPTool[] {
  return CAPABILITY_DEFINITIONS.map((cap) => {
    const properties: Record<string, { type: string; description: string }> = {};
    const required: string[] = [];

    for (const [key, schema] of Object.entries(cap.inputSchema)) {
      properties[key] = { type: schema.type, description: schema.description };
      if (schema.required) required.push(key);
    }

    // Add tenantSlug as optional (resolved from auth if not provided)
    properties.tenantSlug = {
      type: "string",
      description: "Tenant slug (optional, resolved from auth if not provided)",
    };

    return {
      name: cap.name,
      description: cap.description,
      inputSchema: {
        type: "object",
        properties,
        required,
      },
    };
  });
}

// ─── Handle MCP JSON-RPC Requests ───

async function handleMCPRequest(
  mcpRequest: MCPToolCallRequest,
  tenantSlug: string,
): Promise<MCPToolCallResponse> {
  const { method, params, id } = mcpRequest;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "syspro-ai-agent",
            version: "1.0.0",
          },
        },
      };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: buildMCPTools(),
        },
      };

    case "tools/call": {
      const toolName = params?.name as string;
      const toolArgs = (params?.arguments as Record<string, unknown>) || {};

      // Validate tool exists
      const capDef = CAPABILITY_DEFINITIONS.find((c) => c.name === toolName);
      if (!capDef) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        };
      }

      // Execute via unified agent
      const result = await runAgent({
        capability: toolName as AgentCapability,
        payload: toolArgs,
        tenantSlug: (toolArgs.tenantSlug as string) || tenantSlug,
        useAI: toolArgs.useAI !== false,
      });

      if (!result.success) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32000, message: result.error ?? "Tool execution failed" },
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
          metadata: result.metadata,
        },
      };
    }

    case "ping":
      return {
        jsonrpc: "2.0",
        id,
        result: {},
      };

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown method: ${method}` },
      };
  }
}

// ─── POST: MCP JSON-RPC over HTTP ───

export async function POST(request: NextRequest) {
  const auth = authenticate(request);
  if (!auth) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Authentication required. Provide x-api-key + x-tenant-slug headers or a valid session.",
        },
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  // Handle batch requests
  if (Array.isArray(body)) {
    const results = await Promise.all(
      body.map((req) => handleMCPRequest(req as MCPToolCallRequest, auth.tenantSlug)),
    );
    return NextResponse.json(results);
  }

  const response = await handleMCPRequest(body as MCPToolCallRequest, auth.tenantSlug);
  return NextResponse.json(response);
}

// ─── GET: SSE transport + discovery ───

export async function GET(request: NextRequest) {
  const auth = authenticate(request);
  if (!auth) {
    return NextResponse.json(
      {
        error: "Authentication required. Provide x-api-key + x-tenant-slug headers or a valid session.",
      },
      { status: 401 },
    );
  }

  const accept = request.headers.get("accept") || "";

  // If client wants SSE, set up event stream
  if (accept.includes("text/event-stream")) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send endpoint event for MCP SSE transport
        controller.enqueue(
          encoder.encode(`event: endpoint\ndata: ${new URL("/api/ai/agent/mcp", request.url).toString()}\n\n`),
        );

        // Keep alive ping
        const interval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
          } catch {
            clearInterval(interval);
          }
        }, 30000);

        // Clean up on abort
        request.signal.addEventListener("abort", () => {
          clearInterval(interval);
          try { controller.close(); } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Default: return MCP server info
  return NextResponse.json({
    server: "syspro-ai-agent",
    version: "1.0.0",
    protocolVersion: "2024-11-05",
    transports: {
      sse: "GET /api/ai/agent/mcp (Accept: text/event-stream)",
      http: "POST /api/ai/agent/mcp (JSON-RPC 2.0)",
    },
    tools: buildMCPTools().map((t) => ({ name: t.name, description: t.description })),
    auth: {
      apiKey: "x-api-key header (set SYSPRO_AI_API_KEY env var)",
      tenantSlug: "x-tenant-slug header (for API key auth)",
      session: "Employee session cookie",
    },
  });
}
