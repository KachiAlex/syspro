import { NextRequest, NextResponse } from "next/server";

import { isTenantSuspended } from "@/lib/api-auth";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { APIKeyService } from "@/lib/tenant-admin/service";
import { asTenantSlug } from "@/lib/tenant-admin/utils";

export type ExternalAuth =
  | { ok: true; tenantSlug: string; keyId: string }
  | { ok: false; response: NextResponse };

/**
 * Tenant API-key auth for the public /api/external/v1 surface.
 * Clients send `x-api-key` (or `Authorization: Bearer`) + `x-tenant-slug`.
 * Keys are generated in Admin → Integrations → API Keys and are stored hashed.
 */
export async function authenticateExternal(request: NextRequest): Promise<ExternalAuth> {
  const apiKey =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const tenantSlug = request.headers.get("x-tenant-slug");

  if (!apiKey || !tenantSlug) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required. Send x-api-key (or Bearer token) and x-tenant-slug headers." },
        { status: 401 }
      ),
    };
  }

  let key: { id: string } | null = null;
  try {
    key = await new APIKeyService().authenticate(asTenantSlug(tenantSlug), apiKey);
  } catch {
    key = null;
  }
  if (!key) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid, expired, or revoked API key" }, { status: 401 }),
    };
  }

  if (await isTenantSuspended(tenantSlug)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Tenant is suspended" }, { status: 403 }),
    };
  }

  // Per-key throttle — 120 requests/minute across the external surface.
  const rl = await checkRateLimitAsync(`ext:${key.id}`, 120, 60_000);
  if (!rl.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      ),
    };
  }

  return { ok: true, tenantSlug, keyId: key.id };
}
