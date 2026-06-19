/**
 * Resume Upload Service
 * Uploads resumes to Cloudinary for Vercel serverless compatibility
 */

import { v2 as cloudinary } from "cloudinary";

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
  candidateId?: string;
}

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
  "text/plain",
];

function validateFile(file: FileUploadRequest): string | null {
  if (file.data.length > MAX_FILE_SIZE) {
    return `File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)`;
  }
  if (!ALLOWED_TYPES.includes(file.mimeType)) {
    return `File type not allowed: ${file.mimeType}`;
  }
  if (!file.filename || file.filename.length === 0) {
    return "Filename cannot be empty";
  }
  if (file.filename.includes("..") || file.filename.includes("/")) {
    return "Invalid filename";
  }
  return null;
}

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
  }

  const url = process.env.CLOUDINARY_URL;
  if (url) {
    try {
      const parsed = new URL(url);
      return {
        cloud_name: parsed.hostname,
        api_key: parsed.username,
        api_secret: parsed.password,
      };
    } catch {
      // ignore
    }
  }

  return null;
}

export async function uploadResume(
  file: FileUploadRequest
): Promise<UploadResult> {
  try {
    const validationError = validateFile(file);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const config = getCloudinaryConfig();
    if (!config) {
      return {
        success: false,
        error: "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET env vars.",
      };
    }

    cloudinary.config(config);

    // Build data URI for Cloudinary upload
    const dataUri = `data:${file.mimeType};base64,${file.data.toString("base64")}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "syspro/resumes",
      resource_type: "raw",
      public_id: `resume_${Date.now()}_${file.filename.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 50)}`,
    });

    return {
      success: true,
      filename: file.filename,
      url: result.secure_url,
      size: file.data.length,
      mimeType: file.mimeType,
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Resume upload failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
