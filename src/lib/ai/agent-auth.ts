/**
 * Shared auth for AI agent endpoints: tenant API key (x-api-key +
 * x-tenant-slug), platform key, or employee session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import { isTenantSuspended } from "@/lib/api-auth";
import { APIKeyService } from "@/lib/tenant-admin/service";
import { asTenantSlug } from "@/lib/tenant-admin/utils";

export interface AgentAuth {
  tenantSlug: string;
  authMethod: "api_key" | "session";
  /** Session employee id, when authenticated via session cookie. */
  employeeId?: string;
  /** Session employee role, when authenticated via session cookie. */
  employeeRole?: string;
}

export async function authenticateAgent(
  request: NextRequest,
): Promise<AgentAuth | NextResponse | null> {
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

  const session = resolveEmployeeSession(request);
  if (session && (await isTenantSuspended(session.tenantSlug))) {
    return NextResponse.json({ error: "Tenant is suspended" }, { status: 403 });
  }
  if (session) {
    return {
      tenantSlug: session.tenantSlug,
      authMethod: "session",
      employeeId: session.id,
      employeeRole: session.role,
    };
  }

  return null;
}
