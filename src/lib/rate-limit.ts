import { NextRequest, NextResponse } from 'next/server';

// ─── In-memory cache (fast path for warm instances) ───
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// ─── DB-backed table (survives cold starts) ───
let rateLimitTableEnsured = false;

async function ensureRateLimitTable(): Promise<void> {
  if (rateLimitTableEnsured) return;
  try {
    const { sql } = await import('@/lib/sql-client');
    await sql`
      create table if not exists api_rate_limits (
        key text primary key,
        count integer not null default 0,
        reset_time bigint not null,
        updated_at timestamptz not null default now()
      )
    `;
    rateLimitTableEnsured = true;
  } catch (err) {
    console.error('[rate-limit] Failed to ensure api_rate_limits table:', err);
  }
}

export function getRateLimitKey(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  return ip;
}

/**
 * Synchronous rate limit check using in-memory cache.
 * Use in middleware where async DB calls add too much latency.
 * Best-effort: works on warm instances, resets on cold starts.
 */
export function checkRateLimit(
  key: string,
  limit: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (record.count >= limit) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, retryAfter: 0 };
}

/**
 * Async rate limit check backed by DB for serverless reliability.
 * Use in route handlers where async is acceptable.
 * Falls back to in-memory if DB is unavailable.
 */
export async function checkRateLimitAsync(
  key: string,
  limit: number = 100,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const now = Date.now();
  const resetTime = now + windowMs;

  // Fast path: check in-memory cache first
  const memRecord = rateLimitStore.get(key);
  if (memRecord && now <= memRecord.resetTime && memRecord.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((memRecord.resetTime - now) / 1000) };
  }

  // DB-backed check
  try {
    await ensureRateLimitTable();
    const { sql } = await import('@/lib/sql-client');

    const rows = await sql`
      insert into api_rate_limits (key, count, reset_time, updated_at)
      values (${key}, 1, ${resetTime}, now())
      on conflict (key) do update
      set count = case
        when api_rate_limits.reset_time <= ${now} then 1
        else api_rate_limits.count + 1
      end,
      reset_time = case
        when api_rate_limits.reset_time <= ${now} then ${resetTime}
        else api_rate_limits.reset_time
      end,
      updated_at = now()
      returning count, reset_time
    `;

    const row = (rows as any[])?.[0];
    if (row) {
      const count = row.count;
      const dbResetTime = Number(row.reset_time);

      // Update in-memory cache
      rateLimitStore.set(key, { count, resetTime: dbResetTime });

      if (count >= limit) {
        return { allowed: false, remaining: 0, retryAfter: Math.ceil((dbResetTime - now) / 1000) };
      }
      return { allowed: true, remaining: limit - count, retryAfter: 0 };
    }
  } catch {
    // Fall back to in-memory only
  }

  return checkRateLimit(key, limit, windowMs);
}

export function rateLimitMiddleware(
  limit: number = 100,
  windowMs: number = 60000
) {
  return (request: NextRequest) => {
    const key = getRateLimitKey(request);
    const { allowed, remaining, retryAfter } = checkRateLimit(key, limit, windowMs);

    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + retryAfter * 1000).toISOString(),
          },
        }
      );
    }

    // Continue with response headers
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    return response;
  };
}
