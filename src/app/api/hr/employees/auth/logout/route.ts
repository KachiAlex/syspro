import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("employee_session");
  cookieStore.delete("employee_tenant");
  return NextResponse.json({ success: true });
}
