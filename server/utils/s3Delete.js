const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { createS3Client, getS3Config, hasS3Config, parseS3ObjectUrl } = require("../config/s3");

function getStoredS3Object(file = {}) {
  const configured = getS3Config();
  const parsed = file.url ? parseS3ObjectUrl(file.url) : null;
  const bucket = String(file.bucket || parsed?.bucket || configured.bucket || "").trim();
  const key = String(file.key || parsed?.key || "").trim().replace(/^\/+/, "");

  if (!key || bucket !== configured.bucket) return null;
  if (configured.uploadPrefix && !key.startsWith(`${configured.uploadPrefix}/`)) return null;
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
    return true;
  } catch (error) {
    console.warn(`[s3Delete] Failed to delete ${object.key}: ${error.message}`);
    return false;
  }
}

module.exports = {
  deleteStoredS3Object,
};
