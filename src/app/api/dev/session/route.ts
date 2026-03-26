import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tenantSlug = String(body.tenantSlug || "");
    const userId = String(body.userId || "dev-user-1");
    const roleId = String(body.roleId || "admin");

    const res = NextResponse.json({ ok: true });
    // Set cookies in a way Next.js recognizes on the server side
    res.cookies.set("tenantSlug", tenantSlug, { path: "/", sameSite: "lax" });
    res.cookies.set("X-User-Id", userId, { path: "/", sameSite: "lax" });
    res.cookies.set("X-Role-Id", roleId, { path: "/", sameSite: "lax" });

    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tenantSlug = String(url.searchParams.get("tenantSlug") || "");
    const userId = String(url.searchParams.get("userId") || "dev-user-1");
    const roleId = String(url.searchParams.get("roleId") || "admin");

    const redirectUrl = `/tenant-admin?tenantSlug=${encodeURIComponent(tenantSlug)}`;
    // NextResponse.redirect expects an absolute URL in some runtimes; build
    // an absolute URL using the incoming request as the base.
    const absoluteRedirect = new URL(redirectUrl, req.url).toString();
    const res = NextResponse.redirect(absoluteRedirect);
    res.cookies.set("tenantSlug", tenantSlug, { path: "/", sameSite: "lax" });
    res.cookies.set("X-User-Id", userId, { path: "/", sameSite: "lax" });
    res.cookies.set("X-Role-Id", roleId, { path: "/", sameSite: "lax" });
    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
