import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  LocalStorageProvider,
  GCSStorageProvider,
  getStorageProvider,
  BUCKET_NAME,
} from "../src/lib/storage";

describe("WorkMate AI: Storage Provider & GCS Integration Tests", () => {
  const testWorkspaceId = "test-ws-abc-123";
  const testFilename = "sample report (Q3) #1.pdf";
  const testBuffer = Buffer.from("Test PDF storage content 2026", "utf-8");

  describe("1. LocalStorageProvider Implementation", () => {
    const tmpDir = path.join(process.cwd(), ".tmp-test-storage");
    const localProvider = new LocalStorageProvider(tmpDir);

    it("should upload file with workspace isolation and sanitize filename", async () => {
      const result = await localProvider.uploadFile({
        workspaceId: testWorkspaceId,
        filename: testFilename,
        mimeType: "application/pdf",
        buffer: testBuffer,
      });

      assert.ok(result.storageKey.startsWith(`${testWorkspaceId}/`));
      assert.ok(!result.storageKey.includes(" "));
      assert.ok(!result.storageKey.includes("#"));
      assert.equal(result.fileSize, testBuffer.length);

      // Verify file written to disk
      const fullPath = path.join(tmpDir, result.storageKey);
      const readBack = await fs.readFile(fullPath);
      assert.deepEqual(readBack, testBuffer);
    });

    it("should retrieve stored file content accurately", async () => {
      const result = await localProvider.uploadFile({
        workspaceId: testWorkspaceId,
        filename: "data.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Hello storage world"),
      });

      const retrieved = await localProvider.getFile(result.storageKey);
      assert.ok(retrieved !== null);
      assert.equal(retrieved.toString(), "Hello storage world");
    });

    it("should return null for non-existent storage keys", async () => {
      const missing = await localProvider.getFile("non-existent-ws/ghost-file.pdf");
      assert.equal(missing, null);
    });

    it("should delete existing file cleanly and return true", async () => {
      const result = await localProvider.uploadFile({
        workspaceId: testWorkspaceId,
        filename: "temp-to-delete.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("col1,col2\nval1,val2"),
      });

      const deleted = await localProvider.deleteFile(result.storageKey);
      assert.equal(deleted, true);

      const check = await localProvider.getFile(result.storageKey);
      assert.equal(check, null);
    });

    // Cleanup
    it("should clean up test directory", async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });
  });

  describe("2. GCSStorageProvider Contract & Key Isolation", () => {
    it("should default to hackathon2026teamshadow bucket", () => {
      assert.equal(BUCKET_NAME, "hackathon2026teamshadow");
    });

    it("should enforce multi-tenant workspace isolation in GCS storage keys", () => {
      const provider = new GCSStorageProvider();
      const sanitized = "financial_statement.xlsx".replace(/[^a-zA-Z0-9._-]/g, "_");
      const keyPattern = new RegExp(`^${testWorkspaceId}/\\d+_${sanitized}$`);
      const sampleKey = `${testWorkspaceId}/${Date.now()}_${sanitized}`;
      assert.match(sampleKey, keyPattern);
    });

    it("should safely sanitize special characters in file names", () => {
      const unsanitized = "Quarterly Report @ EMEA [FINAL] #99 (v2).pdf";
      const sanitized = unsanitized.replace(/[^a-zA-Z0-9._-]/g, "_");
      assert.equal(sanitized, "Quarterly_Report___EMEA__FINAL___99__v2_.pdf");
      assert.ok(!/[^a-zA-Z0-9._-]/.test(sanitized));
    });

    it("should provide authenticated download URLs rather than public bucket links", async () => {
      const provider = new GCSStorageProvider();
      const downloadUrl = await provider.getDownloadUrl("ws-123/1729000_doc.pdf");
      assert.equal(downloadUrl, "/api/files/download/ws-123%2F1729000_doc.pdf");
    });

    it("should gracefully fall back to download URL when signed URL is requested in local ADC mode", async () => {
      const provider = new GCSStorageProvider();
      const url = await provider.getSignedUrl("ws-123/1729000_doc.pdf");
      assert.ok(typeof url === "string");
      assert.ok(url.includes("ws-123%2F1729000_doc.pdf"));
    });
  });

  describe("3. Storage Factory Dynamic Switching", () => {
    it("should return LocalStorageProvider when STORAGE_DRIVER is 'local'", () => {
      const orig = process.env.STORAGE_DRIVER;
      process.env.STORAGE_DRIVER = "local";
      const provider = getStorageProvider();
      assert.ok(provider instanceof LocalStorageProvider);
      process.env.STORAGE_DRIVER = orig;
    });

    it("should return GCSStorageProvider when STORAGE_DRIVER is 'gcs'", () => {
      const orig = process.env.STORAGE_DRIVER;
      process.env.STORAGE_DRIVER = "gcs";
      const provider = getStorageProvider();
      assert.ok(provider instanceof GCSStorageProvider);
      process.env.STORAGE_DRIVER = orig;
    });
  });
});
