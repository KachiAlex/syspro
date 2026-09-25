import { NextRequest } from "next/server";

/**
 * Parse `limit`/`offset` query params with bounded defaults so list endpoints
 * never return unbounded result sets.
 */
export function getPagination(
  request: Request | NextRequest,
  opts?: { defaultLimit?: number; maxLimit?: number }
): { limit: number; offset: number } {
  const url = new URL(request.url);
  const maxLimit = opts?.maxLimit ?? 500;
  const defaultLimit = opts?.defaultLimit ?? 100;

  const rawLimit = Number(url.searchParams.get("limit"));
  const rawOffset = Number(url.searchParams.get("offset"));

  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), maxLimit)
    : defaultLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}
