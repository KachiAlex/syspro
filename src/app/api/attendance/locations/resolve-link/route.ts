export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { parseCoordsFromUrl } from "@/lib/geo-utils";

const ALLOWED_HOSTS = [
  /(^|\.)google\.[a-z.]+$/i, // google.com, google.com.ng, maps.google.*
  /(^|\.)goo\.gl$/i, // goo.gl, maps.app.goo.gl
];

export async function POST(request: NextRequest) {
  const scope = await requireModuleAccess(request, "people", "write");
  if (!scope.ok) return scope.response;

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (!/^https?:$/.test(parsed.protocol) || !ALLOWED_HOSTS.some((re) => re.test(parsed.hostname))) {
    return NextResponse.json({ error: "Only Google Maps links are supported" }, { status: 400 });
  }

  // Full maps URLs carry coordinates directly
  const direct = parseCoordsFromUrl(url);
  if (direct) return NextResponse.json(direct);

  // Short links (goo.gl, maps.app.goo.gl) must be expanded — fetch and inspect the redirect target
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    let coords = parseCoordsFromUrl(res.url);
    if (!coords) {
      // Maps place pages embed !3d..!4d.. coordinates in the HTML
      const html = await res.text().catch(() => "");
      coords = parseCoordsFromUrl(html.slice(0, 500000));
    }
    if (!coords) {
      return NextResponse.json({ error: "Could not find coordinates in that link. Open it in a browser, then copy the full URL." }, { status: 422 });
    }
    return NextResponse.json(coords);
  } catch {
    return NextResponse.json({ error: "Could not resolve that link. Open it in a browser, then copy the full URL." }, { status: 502 });
  }
}
