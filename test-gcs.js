// test-gcs.js - GCS Connection & Permissions Verification
// Directly from Section 3.6 of the hack.docx integration guide.
const { bucket, BUCKET_NAME } = require('./storage');

(async () => {
  console.log(`\n========================================`);
  console.log(`Testing connection to GCS Bucket: gs://${BUCKET_NAME}`);
  console.log(`========================================\n`);

  const testKey = `test/hello-${Date.now()}.txt`;
  try {
    console.log(`1. Testing write access (saving '${testKey}')...`);
    await bucket.file(testKey).save('Hello from WorkMate AI local verification!', {
      contentType: 'text/plain',
      resumable: false,
    });
    console.log(`   [PASS] Object uploaded successfully.`);

    console.log(`2. Testing read access (downloading '${testKey}')...`);
    const [data] = await bucket.file(testKey).download();
    console.log(`   [PASS] Read back: "${data.toString()}"`);

    console.log(`3. Testing delete access (deleting '${testKey}')...`);
    await bucket.file(testKey).delete();
    console.log(`   [PASS] Object deleted successfully.`);

    console.log(`\n>>> SUCCESS: Full read/write/delete access to gs://${BUCKET_NAME} is VERIFIED! <<<\n`);
  } catch (err) {
    console.error(`\n>>> FAILED: ${err.message} <<<\n`);
    if (err.code === 403) {
      console.error(`[Troubleshooting - 403 Forbidden]`);
      console.error(`The authenticated Google account lacks the 'Storage Object User' role on bucket gs://${BUCKET_NAME}.`);
      console.error(`Action: Ask the project administrator to run:`);
      console.error(`gcloud storage buckets add-iam-policy-binding gs://${BUCKET_NAME} --member="user:kfkfckckcmndnc@gmail.com" --role="roles/storage.objectUser"\n`);
    } else if (err.code === 404) {
      console.error(`[Troubleshooting - 404 Not Found]`);
      console.error(`Bucket gs://${BUCKET_NAME} does not exist or project billing is not active.`);
    } else if (err.message && (err.message.includes('Could not load the default credentials') || err.message.includes('credential'))) {
      console.error(`[Troubleshooting - Credentials Missing]`);
      console.error(`Run: gcloud auth application-default login`);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
})();
