/**
 * Receipt Upload Service
 * Handles file uploads and storage for expense receipts
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export interface UploadResult {
  success: boolean;
  filename?: string;
  url?: string;
  size?: number;
  mimeType?: string;
  error?: string;
  uploadedAt?: string;
}

export interface FileUploadRequest {
  filename: string;
  mimeType: string;
  data: Buffer;
  expenseId: string;
  tenantSlug?: string;
}

/**
 * Local storage configuration
 * In production, use S3/GCS/Azure Blob Storage
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

/**
 * Validate file before upload
 */
function validateFile(file: FileUploadRequest): string | null {
  // Check file size
  if (file.data.length > MAX_FILE_SIZE) {
    return `File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)`;
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.mimeType)) {
    return `File type not allowed: ${file.mimeType}`;
  }

  // Check filename
  if (!file.filename || file.filename.length === 0) {
    return "Filename cannot be empty";
  }

  // Prevent directory traversal
  if (file.filename.includes("..") || file.filename.includes("/")) {
    return "Invalid filename";
  }

  return null;
}

function getS3Client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT || "",
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: true,
  });
}

function getR2Env() {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!bucket || !publicUrl || !endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return { bucket, publicUrl: publicUrl.replace(/\/+$/, ""), endpoint, accessKeyId, secretAccessKey };
}

/**
 * Upload receipt file to Cloudflare R2 (S3-compatible)
 */
export async function uploadReceipt(
  file: FileUploadRequest
): Promise<UploadResult> {
  try {
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      return {
        success: false,
        error: validationError,
      };
    }

    const env = getR2Env();
    if (!env) {
      return {
        success: false,
        error: "R2 is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL env vars.",
      };
    }

    const client = getS3Client();
    const timestamp = Date.now();
    const ext = file.filename.split(".").pop() || "bin";
    const safeName = file.filename
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 50);
    const key = `receipts/${(file.tenantSlug || "default").replace(/[^a-zA-Z0-9-]/g, "")}/${file.expenseId}/${timestamp}_${safeName}.${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: env.bucket,
        Key: key,
        Body: file.data,
        ContentType: file.mimeType,
      })
    );

    const url = `${env.publicUrl}/${key}`;

    return {
      success: true,
      filename: `${timestamp}_${safeName}.${ext}`,
      url,
      size: file.data.length,
      mimeType: file.mimeType,
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("File upload failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload multiple receipts for an expense
 */
export async function uploadReceiptBatch(
  files: FileUploadRequest[]
): Promise<UploadResult[]> {
  return Promise.all(files.map((file) => uploadReceipt(file)));
}

/**
 * File type utilities
 */
export function getFileTypeIcon(mimeType: string): string {
  const icons: Record<string, string> = {
    "application/pdf": "📄",
    "image/jpeg": "🖼️",
    "image/jpg": "🖼️",
    "image/png": "🖼️",
    "image/webp": "🖼️",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "📝",
    "application/msword": "📝",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "📊",
    "application/vnd.ms-excel": "📊",
  };

  return icons[mimeType] || "📎";
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
