const { GetObjectCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

function clean(value) {
  return String(value || "").trim();
}

function getS3Config() {
  return {
    region: clean(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION),
    bucket: clean(process.env.AWS_S3_BUCKET || process.env.S3_BUCKET),
    uploadPrefix: clean(process.env.AWS_S3_UPLOAD_PREFIX || "filing-buddy").replace(/^\/+|\/+$/g, ""),
  };
}

function hasS3Config() {
  const { region, bucket } = getS3Config();
  return Boolean(region && bucket);
}

function createS3Client() {
  const { region } = getS3Config();
  const accessKeyId = clean(process.env.AWS_ACCESS_KEY_ID);
  const secretAccessKey = clean(process.env.AWS_SECRET_ACCESS_KEY);
  const credentials = accessKeyId && secretAccessKey
    ? {
      accessKeyId: clean(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: clean(process.env.AWS_SECRET_ACCESS_KEY),
    }
    : undefined;

  return new S3Client({ region, credentials });
}

function buildS3ObjectUrl(bucket, region, key) {
  const configuredBaseUrl = clean(process.env.AWS_S3_PUBLIC_URL);
  const encodedKey = String(key || "").split("/").map(encodeURIComponent).join("/");

  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/+$/, "")}/${encodedKey}`;
  }

  if (region === "us-east-1") return `https://${bucket}.s3.amazonaws.com/${encodedKey}`;
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

function parseS3ObjectUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || "").trim());
    const { bucket, region } = getS3Config();
    if (!bucket) return null;

    const host = parsed.hostname;
    const pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    if (host === `${bucket}.s3.amazonaws.com` || host === `${bucket}.s3.${region}.amazonaws.com`) {
      return { bucket, key: pathname };
    }

    const pathStylePrefix = `${bucket}/`;
    if ((host === "s3.amazonaws.com" || host === `s3.${region}.amazonaws.com`) && pathname.startsWith(pathStylePrefix)) {
      return { bucket, key: pathname.slice(pathStylePrefix.length) };
    }

    const publicBaseUrl = clean(process.env.AWS_S3_PUBLIC_URL);
    if (publicBaseUrl && String(rawUrl).startsWith(publicBaseUrl.replace(/\/+$/, ""))) {
      return { bucket, key: pathname };
    }

    return null;
  } catch {
    return null;
  }
}

async function createS3SignedReadUrl({ bucket, key, filename, contentType, expiresIn = 300 }) {
  const command = new GetObjectCommand({
    Bucket: bucket || getS3Config().bucket,
    Key: key,
    ResponseContentDisposition: filename ? `inline; filename="${String(filename).replace(/"/g, "")}"` : undefined,
    ResponseContentType: contentType || undefined,
  });
  return getSignedUrl(createS3Client(), command, { expiresIn });
}

async function createS3SignedUploadUrl({ bucket, key, contentType, expiresIn = 300 }) {
  const command = new PutObjectCommand({
    Bucket: bucket || getS3Config().bucket,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });
  return getSignedUrl(createS3Client(), command, { expiresIn });
}

module.exports = {
  buildS3ObjectUrl,
  createS3Client,
  createS3SignedReadUrl,
  createS3SignedUploadUrl,
  getS3Config,
  hasS3Config,
  parseS3ObjectUrl,
};
