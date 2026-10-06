export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { POST as parseResume } from "@/app/api/hr/resumes/parse/route";
import { checkRateLimitAsync, getRateLimitKey } from "@/lib/rate-limit";

// Public entry point for the /apply resume parser — the underlying handler is
// stateless (base64 file -> extracted text fields, no DB or storage writes).
export async function POST(request: NextRequest) {
  const { allowed, retryAfter } = await checkRateLimitAsync(`apply-parse:${getRateLimitKey(request)}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 15_000_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  return parseResume(request);
}
