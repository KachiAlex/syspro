export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uploadResume } from "@/lib/hr/uploads";
import { checkRateLimitAsync, getRateLimitKey } from "@/lib/rate-limit";

// Public resume upload for the /apply job application flow.
// uploadResume enforces mime whitelist, 10MB cap and filename sanitisation.
const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().optional().default("application/octet-stream"),
  data: z.string().min(1).max(14_000_000), // base64 of <=10MB
  tenantSlug: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const { allowed, retryAfter } = await checkRateLimitAsync(`apply-upload:${getRateLimitKey(request)}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  try {
    const body = await request.json();
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { filename, mimeType, data, tenantSlug } = parsed.data;
    const fileBuffer = Buffer.from(data, "base64");

    const result = await uploadResume({
      filename,
      mimeType,
      data: fileBuffer,
      tenantSlug,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
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
    console.error("Public resume upload failed:", error);
    return NextResponse.json({ error: "Failed to upload resume" }, { status: 500 });
  }
}
