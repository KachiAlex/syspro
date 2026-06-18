import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { saveReceipt } from "@/lib/finance/db";

const uploadSchema = z.object({
  expenseId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().optional().default("application/octet-stream"),
  // Base64 encoded file data
  data: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Upload validation failed:", parsed.error.flatten());
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await saveReceipt({
      expenseId: parsed.data.expenseId,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      data: parsed.data.data,
    });

    return NextResponse.json(
      {
        success: true,
        receipt: {
          id: result.id,
          filename: result.filename,
          size: result.size,
          mimeType: result.mimeType,
          createdAt: result.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Receipt upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload receipt" },
      { status: 500 }
    );
  }
}
