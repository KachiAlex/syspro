import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  const clearOpts = {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  response.cookies.set("syspro_session", "", clearOpts);
  response.cookies.set("employee_session", "", clearOpts);
  response.cookies.set("tenantSlug", "", { ...clearOpts, httpOnly: false });
  response.cookies.set("X-User-Id", "", { ...clearOpts, httpOnly: false });
  response.cookies.set("X-Role-Id", "", { ...clearOpts, httpOnly: false });
  response.cookies.set("X-User-Email", "", { ...clearOpts, httpOnly: false });
  response.cookies.set("employee_tenant", "", { ...clearOpts, httpOnly: false });
  return response;
}
