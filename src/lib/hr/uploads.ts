/**
 * Resume Upload Service
 * Handles file uploads and storage for candidate resumes
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

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

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "resumes");
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

function generateSafeFilename(originalName: string, prefix?: string): string {
  const timestamp = Date.now();
  const ext = originalName.split(".").pop() || "bin";
  const safeName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 50);
  const prefixStr = prefix ? `${prefix}_` : "";
  return `${prefixStr}${timestamp}_${safeName}`.slice(0, 255);
}

export async function uploadResume(
  file: FileUploadRequest
): Promise<UploadResult> {
  try {
    const validationError = validateFile(file);
    if (validationError) {
      return { success: false, error: validationError };
    }

    try {
      await mkdir(UPLOAD_DIR, { recursive: true });
    } catch (err) {
      console.error("Failed to create upload directory:", err);
    }

    const safeFilename = generateSafeFilename(file.filename, file.candidateId);
    const filepath = join(UPLOAD_DIR, safeFilename);
    await writeFile(filepath, file.data);

    const url = `/uploads/resumes/${safeFilename}`;

    return {
      success: true,
      filename: safeFilename,
      url,
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
