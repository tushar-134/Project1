const { S3Client } = require("@aws-sdk/client-s3");

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

module.exports = {
  buildS3ObjectUrl,
  createS3Client,
  getS3Config,
  hasS3Config,
};
