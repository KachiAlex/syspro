import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { uploadReceipt } from "@/lib/finance/uploads";

/**
 * POST /api/hr/employees/portal/expenses/upload
 * Upload a receipt/attachment for an expense request.
 * Returns the R2 URL to be stored with the expense.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = decodeEmployeeToken(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  try {
    const body = await request.json();
    const { filename, mimeType, data } = body;

    if (!filename || !data) {
      return NextResponse.json({ error: "filename and data are required" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(data, "base64");

    const result = await uploadReceipt({
      filename,
      mimeType: mimeType || "application/octet-stream",
      data: fileBuffer,
      expenseId: `portal_${session.id}_${Date.now()}`,
      tenantSlug: session.tenantSlug,
    });

    if (!result.success || !result.url) {
      return NextResponse.json({ error: result.error || "Upload failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      filename: result.filename,
      size: result.size,
      mimeType: result.mimeType,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Portal expense upload error:", error?.message);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
