// storage.js - Google Cloud Storage client instance
// Adheres directly to the hackathon GCS integration guide.
const { Storage } = require('@google-cloud/storage');

const BUCKET_NAME = process.env.GCS_BUCKET || 'hackathon2026teamshadow';

// No keys, no region, no password. Credentials are detected automatically
// via Application Default Credentials (ADC) locally or service account on Cloud Run.
const storage = new Storage(
  process.env.GCS_PROJECT_ID ? { projectId: process.env.GCS_PROJECT_ID } : {}
);

const bucket = storage.bucket(BUCKET_NAME);

module.exports = { storage, bucket, BUCKET_NAME };
