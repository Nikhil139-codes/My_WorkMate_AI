import fs from "node:fs/promises";
import path from "node:path";

export interface StorageUploadOptions {
  workspaceId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface StorageUploadResult {
  storageKey: string;
  fileSize: number;
  publicUrl?: string;
}

export interface IStorageProvider {
  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;
  getFile(storageKey: string): Promise<Buffer | null>;
  deleteFile(storageKey: string): Promise<boolean>;
  getDownloadUrl(storageKey: string): Promise<string>;
}

export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.env.STORAGE_LOCAL_DIR || "./uploads";
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch {
      // Ignore if directory already exists
    }
  }

  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    const timestamp = Date.now();
    const sanitizedFilename = options.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const workspaceFolder = path.join(this.baseDir, options.workspaceId);
    await this.ensureDir(workspaceFolder);

    const relativeKey = `${options.workspaceId}/${timestamp}_${sanitizedFilename}`;
    const destinationPath = path.join(this.baseDir, relativeKey);

    await fs.writeFile(destinationPath, options.buffer);

    return {
      storageKey: relativeKey,
      fileSize: options.buffer.length,
      publicUrl: `/api/documents/raw/${encodeURIComponent(relativeKey)}`,
    };
  }

  async getFile(storageKey: string): Promise<Buffer | null> {
    try {
      const fullPath = path.join(this.baseDir, storageKey);
      return await fs.readFile(fullPath);
    } catch {
      return null;
    }
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.baseDir, storageKey);
      await fs.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    return `/api/documents/raw/${encodeURIComponent(storageKey)}`;
  }
}

/**
 * Storage factory - easily swappable with S3StorageProvider or GCSStorageProvider in future phases
 */
export function getStorageProvider(): IStorageProvider {
  const driver = process.env.STORAGE_DRIVER || "local";
  switch (driver) {
    case "local":
    default:
      return new LocalStorageProvider();
  }
}

export const storage = getStorageProvider();
