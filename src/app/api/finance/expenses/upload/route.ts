import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { uploadReceipt } from "@/lib/finance/uploads";

const uploadSchema = z.object({
  expenseId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  // Base64 encoded file data
  data: z.string().min(1),
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Decode base64 data
    const buffer = Buffer.from(parsed.data.data, "base64");

    // Upload file
    const result = await uploadReceipt({
      expenseId: parsed.data.expenseId,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      data: buffer,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        receipt: {
          filename: result.filename,
          url: result.url,
          size: result.size,
          mimeType: result.mimeType,
          uploadedAt: result.uploadedAt,
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
