import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uploadResume } from "@/lib/hr/uploads";

const uploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().optional().default("application/octet-stream"),
  data: z.string().min(1), // Base64 encoded file data
  candidateId: z.string().optional(),
  tenantSlug: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Resume upload validation failed:", parsed.error.flatten());
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { filename, mimeType, data, candidateId, tenantSlug } = parsed.data;

    // Decode base64 to Buffer
    const fileBuffer = Buffer.from(data, "base64");

    const result = await uploadResume({
      filename,
      mimeType,
      data: fileBuffer,
      candidateId,
      tenantSlug,
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
        resume: {
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
    console.error("Resume upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload resume" },
      { status: 500 }
    );
  }
}
