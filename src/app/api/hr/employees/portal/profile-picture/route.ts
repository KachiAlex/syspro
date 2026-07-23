import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { decodeEmployeeToken, resolveEmployeeSession } from "@/lib/hr/auth";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

function getR2Env() {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!bucket || !publicUrl || !endpoint || !accessKeyId || !secretAccessKey) return null;
  return { bucket, publicUrl: publicUrl.replace(/\/+$/, ""), endpoint, accessKeyId, secretAccessKey };
}

export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const body = await request.json();
    const { filename, mimeType, data } = body;

    if (!filename || !mimeType || !data) {
      return NextResponse.json({ error: "Missing filename, mimeType, or data" }, { status: 400 });
    }
    if (!ALLOWED.includes(mimeType)) {
      return NextResponse.json({ error: "File type not allowed. Use JPEG, PNG, or WebP." }, { status: 400 });
    }

    const buffer = Buffer.from(data, "base64");
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 });
    }

    const env = getR2Env();
    if (!env) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `profile-pictures/${session.id}/${Date.now()}_${safeName}`;

    const client = new S3Client({
      region: "auto",
      endpoint: env.endpoint,
      credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
      forcePathStyle: true,
    });

    await client.send(
      new PutObjectCommand({
        Bucket: env.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const url = `${env.publicUrl}/${key}`;
    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    console.error("Profile picture upload error:", error?.message);
    return NextResponse.json({ error: "Failed to upload profile picture" }, { status: 500 });
  }
}
