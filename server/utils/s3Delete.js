const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { createS3Client, getS3Config, hasS3Config, parseS3ObjectUrl } = require("../config/s3");

function getStoredS3Object(file = {}) {
  const configured = getS3Config();
  const parsed = file.url ? parseS3ObjectUrl(file.url) : null;

  // Prefer explicit bucket on the stored doc; fall back to configured bucket
  // so that documents saved before the bucket field was populated still delete correctly.
  const bucket = String(file.bucket || parsed?.bucket || configured.bucket || "").trim();
  const key = String(file.key || parsed?.key || "").trim().replace(/^\/+/, "");

  if (!key) return null;

  // Reject if the resolved bucket is not our configured bucket (security guard).
  if (bucket !== configured.bucket) {
    console.warn(`[s3Delete] Skipping delete — bucket mismatch: stored="${bucket}", configured="${configured.bucket}"`);
    return null;
  }

  // Warn but do NOT skip when the key is outside the expected upload prefix.
  // This handles legacy uploads that pre-date the prefix configuration.
  if (configured.uploadPrefix && !key.startsWith(`${configured.uploadPrefix}/`)) {
    console.warn(`[s3Delete] Key "${key}" is outside the configured upload prefix "${configured.uploadPrefix}" — deleting anyway.`);
  }

  return { bucket, key };
}

async function deleteStoredS3Object(file = {}) {
  if (!hasS3Config()) return false;
  const object = getStoredS3Object(file);
  if (!object) return false;

  try {
    await createS3Client().send(new DeleteObjectCommand({
      Bucket: object.bucket,
      Key: object.key,
    }));
    console.log(`[s3Delete] Deleted s3://${object.bucket}/${object.key}`);
    return true;
  } catch (error) {
    console.warn(`[s3Delete] Failed to delete s3://${object.bucket}/${object.key}: ${error.message}`);
    return false;
  }
}

module.exports = {
  deleteStoredS3Object,
};
