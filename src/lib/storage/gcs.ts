import { Storage, Bucket } from "@google-cloud/storage";
import {
  IStorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from "./index";

export const BUCKET_NAME =
  process.env.GCS_BUCKET || "hackathon2026teamshadow";

/**
 * Shared Google Cloud Storage client instance.
 * Credentials are automatically resolved via Application Default Credentials (ADC)
 * locally or via the attached runtime service account on Cloud Run / GCP.
 */
export const gcsStorage = new Storage(
  process.env.GCS_PROJECT_ID ? { projectId: process.env.GCS_PROJECT_ID } : {}
);

/**
 * Target GCS Bucket reference
 */
export const bucket: Bucket = gcsStorage.bucket(BUCKET_NAME);

export class GCSStorageProvider implements IStorageProvider {
  private bucket: Bucket;
  private bucketName: string;

  constructor(bucketName?: string) {
    this.bucketName = bucketName || BUCKET_NAME;
    this.bucket = gcsStorage.bucket(this.bucketName);
  }

  /**
   * Upload file to GCS with workspace isolation.
   * Path format: <workspaceId>/<timestamp>_<sanitizedFilename>
   */
  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    const timestamp = Date.now();
    const sanitizedFilename = options.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `${options.workspaceId}/${timestamp}_${sanitizedFilename}`;

    const file = this.bucket.file(storageKey);

    await file.save(options.buffer, {
      contentType: options.mimeType || "application/octet-stream",
      resumable: false,
      metadata: {
        workspaceId: options.workspaceId,
        originalFilename: options.filename,
        uploadedAt: new Date().toISOString(),
      },
    });

    return {
      storageKey,
      fileSize: options.buffer.length,
      publicUrl: `/api/files/download/${encodeURIComponent(storageKey)}`,
    };
  }

  /**
   * Retrieve file content from GCS as a Buffer.
   * Supports keys with or without the 'uploads/' prefix for backward compatibility.
   */
  async getFile(storageKey: string): Promise<Buffer | null> {
    try {
      let file = this.bucket.file(storageKey);
      let [exists] = await file.exists();

      // If not found, try checking with 'uploads/' prefix or without it
      if (!exists) {
        if (storageKey.startsWith("uploads/")) {
          const stripped = storageKey.replace(/^uploads\//, "");
          file = this.bucket.file(stripped);
          [exists] = await file.exists();
        } else {
          file = this.bucket.file(`uploads/${storageKey}`);
          [exists] = await file.exists();
        }
      }

      if (!exists) {
        return null;
      }

      const [buffer] = await file.download();
      return buffer;
    } catch (error: any) {
      console.error(`[GCSStorageProvider] Error fetching ${storageKey}:`, error.message);
      return null;
    }
  }

  /**
   * Delete an object from GCS bucket safely.
   */
  async deleteFile(storageKey: string): Promise<boolean> {
    try {
      let file = this.bucket.file(storageKey);
      let [exists] = await file.exists();

      if (!exists) {
        if (storageKey.startsWith("uploads/")) {
          file = this.bucket.file(storageKey.replace(/^uploads\//, ""));
          [exists] = await file.exists();
        } else {
          file = this.bucket.file(`uploads/${storageKey}`);
          [exists] = await file.exists();
        }
      }

      if (exists) {
        await file.delete();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error(`[GCSStorageProvider] Error deleting ${storageKey}:`, error.message);
      return false;
    }
  }

  /**
   * Get application download route URL for secure, authenticated streaming.
   */
  async getDownloadUrl(storageKey: string): Promise<string> {
    return `/api/files/download/${encodeURIComponent(storageKey)}`;
  }

  /**
   * Generate short-lived signed URL (15 minutes default).
   * Note: Works automatically in production on Cloud Run with Service Account Token Creator role.
   * For local ADC user logins, fallback to authenticated backend download route.
   */
  async getSignedUrl(storageKey: string, expiresInMinutes = 15): Promise<string> {
    try {
      const file = this.bucket.file(storageKey);
      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });
      return url;
    } catch (error: any) {
      console.warn(
        `[GCSStorageProvider] Signed URL generation failed (expected with local personal ADC): ${error.message}. Falling back to backend download route.`
      );
      return `/api/files/download/${encodeURIComponent(storageKey)}`;
    }
  }

  /**
   * List files in the GCS bucket under a given prefix.
   */
  async listFiles(prefix = ""): Promise<
    Array<{
      name: string;
      size: number;
      contentType: string;
      updated: string;
    }>
  > {
    try {
      const [files] = await this.bucket.getFiles({ prefix });
      return files.map((f) => ({
        name: f.name,
        size: Number(f.metadata.size || 0),
        contentType: String(f.metadata.contentType || "application/octet-stream"),
        updated: String(f.metadata.updated || ""),
      }));
    } catch (error: any) {
      console.error("[GCSStorageProvider] List files error:", error.message);
      throw error;
    }
  }
}
