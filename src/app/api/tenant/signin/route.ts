import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (email === "admin@tenant.com" && password === "password123") {
    // Set session/cookie here
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
