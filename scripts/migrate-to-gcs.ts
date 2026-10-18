/**
 * Safe Migration Script: Local Uploads -> Google Cloud Storage (GCS)
 *
 * Requirements:
 * - Preserves existing local files (does not delete them).
 * - Preserves all MongoDB Atlas metadata and references.
 * - Uploads each physical file to gs://hackathon2026teamshadow using identical storageKey.
 * - Verifies GCS copy existence and size integrity.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-gcs.ts
 */

import { loadEnvConfig } from "@next/env";

// Load environment variables before any code or modules that depend on them
loadEnvConfig(process.cwd());

import fs from "node:fs/promises";
import path from "node:path";
import { connectToDatabase } from "../src/lib/db/mongodb";
import { Document as DocumentModel } from "../src/lib/db/models";
import { Dataset } from "../src/lib/db/models/Dataset";
import { bucket, BUCKET_NAME } from "../src/lib/storage/gcs";

async function runMigration() {
  console.log("=======================================================");
  console.log(" WorkMate AI — Local to Google Cloud Storage Migration ");
  console.log(` Target Bucket: gs://${BUCKET_NAME}`);
  console.log("=======================================================\n");

  const uploadsBaseDir = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || "./uploads");
  console.log(`[Source Dir] ${uploadsBaseDir}`);

  // 1. Connect to Database
  console.log("[Database] Connecting to MongoDB Atlas...");
  await connectToDatabase();
  console.log("[Database] Connected successfully.\n");

  let totalMigrated = 0;
  let totalVerified = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  // 2. Query Documents
  const documents = await DocumentModel.find({}).lean();
  console.log(`Found ${documents.length} document record(s) in MongoDB.`);

  for (const doc of documents) {
    const storageKey = (doc as any).storageKey;
    if (!storageKey) continue;

    const localFilePath = path.join(uploadsBaseDir, storageKey);
    console.log(`\nProcessing Document [${doc._id}]: ${doc.originalFilename}`);
    console.log(`  Storage Key: ${storageKey}`);

    try {
      // Check local file
      let localBuffer: Buffer;
      try {
        localBuffer = await fs.readFile(localFilePath);
      } catch (err: any) {
        console.warn(`  [WARN] Local file missing at ${localFilePath}: ${err.message}`);
        totalSkipped++;
        continue;
      }

      // Check GCS status
      const gcsFile = bucket.file(storageKey);
      const [exists] = await gcsFile.exists();

      if (exists) {
        const [meta] = await gcsFile.getMetadata();
        if (Number(meta.size) === localBuffer.length) {
          console.log(`  [SKIP] Already present and verified in GCS (${meta.size} bytes).`);
          totalSkipped++;
          totalVerified++;
          continue;
        }
      }

      // Upload to GCS
      console.log(`  [UPLOADING] Uploading to gs://${BUCKET_NAME}/${storageKey} (${localBuffer.length} bytes)...`);
      await gcsFile.save(localBuffer, {
        contentType: (doc as any).mimeType || "application/octet-stream",
        resumable: false,
        metadata: {
          workspaceId: (doc as any).workspaceId,
          originalFilename: (doc as any).originalFilename,
          migratedAt: new Date().toISOString(),
        },
      });

      // Verify upload
      const [verifiedExists] = await gcsFile.exists();
      const [verifiedMeta] = await gcsFile.getMetadata();

      if (verifiedExists && Number(verifiedMeta.size) === localBuffer.length) {
        console.log(`  [PASS] Verified in GCS: ${verifiedMeta.size} bytes matches local copy.`);
        totalMigrated++;
        totalVerified++;
      } else {
        throw new Error(`Size mismatch after upload: expected ${localBuffer.length}, got ${verifiedMeta.size}`);
      }
    } catch (err: any) {
      console.error(`  [FAIL] Failed to migrate ${storageKey}:`, err.message);
      totalFailed++;
    }
  }

  // 3. Query Datasets
  const datasets = await Dataset.find({}).lean();
  console.log(`\nFound ${datasets.length} dataset record(s) in MongoDB.`);

  for (const ds of datasets) {
    const keys = [
      { key: (ds as any).storageKey, label: "Original" },
      { key: (ds as any).cleanedStorageKey, label: "Cleaned" },
    ].filter((item) => Boolean(item.key));

    for (const { key, label } of keys) {
      const localFilePath = path.join(uploadsBaseDir, key);
      console.log(`\nProcessing Dataset [${ds._id}] (${label}): ${(ds as any).originalFilename}`);
      console.log(`  Storage Key: ${key}`);

      try {
        let localBuffer: Buffer;
        try {
          localBuffer = await fs.readFile(localFilePath);
        } catch (err: any) {
          console.warn(`  [WARN] Local file missing at ${localFilePath}: ${err.message}`);
          totalSkipped++;
          continue;
        }

        const gcsFile = bucket.file(key);
        const [exists] = await gcsFile.exists();

        if (exists) {
          const [meta] = await gcsFile.getMetadata();
          if (Number(meta.size) === localBuffer.length) {
            console.log(`  [SKIP] Already present and verified in GCS (${meta.size} bytes).`);
            totalSkipped++;
            totalVerified++;
            continue;
          }
        }

        console.log(`  [UPLOADING] Uploading to gs://${BUCKET_NAME}/${key} (${localBuffer.length} bytes)...`);
        await gcsFile.save(localBuffer, {
          contentType: (ds as any).mimeType || "text/csv",
          resumable: false,
          metadata: {
            workspaceId: (ds as any).workspaceId,
            originalFilename: (ds as any).originalFilename,
            migratedAt: new Date().toISOString(),
          },
        });

        const [verifiedExists] = await gcsFile.exists();
        const [verifiedMeta] = await gcsFile.getMetadata();

        if (verifiedExists && Number(verifiedMeta.size) === localBuffer.length) {
          console.log(`  [PASS] Verified in GCS: ${verifiedMeta.size} bytes matches local copy.`);
          totalMigrated++;
          totalVerified++;
        } else {
          throw new Error(`Size mismatch after upload: expected ${localBuffer.length}, got ${verifiedMeta.size}`);
        }
      } catch (err: any) {
        console.error(`  [FAIL] Failed to migrate ${key}:`, err.message);
        totalFailed++;
      }
    }
  }

  console.log("\n=======================================================");
  console.log(" Migration Summary");
  console.log("=======================================================");
  console.log(`  Total Files Migrated: ${totalMigrated}`);
  console.log(`  Total Files Verified: ${totalVerified}`);
  console.log(`  Total Files Skipped (already in GCS or not on disk): ${totalSkipped}`);
  console.log(`  Total Failures:       ${totalFailed}`);
  console.log(`  Local files:          Preserved safely (zero deletions).`);
  console.log("=======================================================\n");

  process.exit(totalFailed > 0 ? 1 : 0);
}

runMigration().catch((err) => {
  console.error("Migration fatal error:", err?.message || err);
  process.exit(1);
});
