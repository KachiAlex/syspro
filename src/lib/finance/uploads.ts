/**
 * Receipt Upload Service
 * Handles file uploads and storage for expense receipts
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
  expenseId: string;
}

/**
 * Local storage configuration
 * In production, use S3/GCS/Azure Blob Storage
 */
const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "receipts");
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

/**
 * Generate safe filename with timestamp
 */
function generateSafeFilename(originalName: string, expenseId: string): string {
  const timestamp = Date.now();
  const ext = originalName.split(".").pop() || "bin";
  const safeName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/^\.+/, "") // Remove leading dots
    .slice(0, 50); // Limit length

  return `${expenseId}_${timestamp}_${safeName}`.slice(0, 255);
}

/**
 * Upload receipt file to local storage
 * In production, replace with cloud storage (S3, GCS, Azure)
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

    // Create upload directory if it doesn't exist
    try {
      await mkdir(UPLOAD_DIR, { recursive: true });
    } catch (err) {
      console.error("Failed to create upload directory:", err);
    }

    // Generate safe filename
    const safeFilename = generateSafeFilename(file.filename, file.expenseId);
    const filepath = join(UPLOAD_DIR, safeFilename);

    // Write file
    await writeFile(filepath, file.data);

    // Return success with relative URL
    const url = `/uploads/receipts/${safeFilename}`;

    return {
      success: true,
      filename: safeFilename,
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
 * Generate download URL for receipt
 * In production, use signed URLs from cloud storage
 */
export function getReceiptUrl(filename: string): string {
  return `/uploads/receipts/${filename}`;
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
