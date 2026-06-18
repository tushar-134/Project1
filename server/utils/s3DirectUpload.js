const path = require("path");
const { GetObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { buildS3ObjectUrl, createS3Client, getS3Config, hasS3Config, parseS3ObjectUrl } = require("../config/s3");

function makeHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function formatSize(bytes) {
  const size = Number(bytes) || 0;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2).replace(/\.?0+$/, "")} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function parseDirectUploadedFiles(body = {}) {
  const raw = body.uploadedFiles || body.files || body.file;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }
  return [raw];
}

function isPdfFile(file = {}) {
  return file.fileType === "application/pdf" || /\.pdf$/i.test(file.name || file.url || file.key || "");
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function assertValidUploadedPdf(client, { bucket, key, name, fileType }) {
  if (!isPdfFile({ name, fileType, key })) return;

  const response = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    Range: "bytes=0-1023",
  }));
  const headerWindow = (await streamToBuffer(response.Body)).toString("latin1");
  if (!headerWindow.includes("%PDF-")) {
    throw makeHttpError(400, "The selected PDF file is invalid or corrupted. Please open it locally and upload a valid PDF.");
  }
}

async function verifyDirectUploadedFile(file = {}) {
  if (!hasS3Config()) throw makeHttpError(500, "S3 upload is not configured");

  const configured = getS3Config();
  const parsedFromUrl = file.url ? parseS3ObjectUrl(file.url) : null;
  const bucket = String(file.bucket || parsedFromUrl?.bucket || configured.bucket || "").trim();
  const key = String(file.key || parsedFromUrl?.key || "").trim().replace(/^\/+/, "");
  const name = String(file.name || path.basename(key) || "File").trim();
  const requestedSize = Number(file.size || file.bytes || file.sizeBytes || 0);

  if (!key || bucket !== configured.bucket) throw makeHttpError(400, "A valid uploaded S3 file is required");
  if (configured.uploadPrefix && !key.startsWith(`${configured.uploadPrefix}/`)) {
    throw makeHttpError(400, "Invalid uploaded file key");
  }

  const client = createS3Client();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (head.ContentLength > 10 * 1024 * 1024) throw makeHttpError(400, "File size exceeds the 10 MB limit");
  if (requestedSize && Number(head.ContentLength) !== requestedSize) throw makeHttpError(400, "Uploaded file size does not match");

  const fileType = String(file.fileType || file.contentType || head.ContentType || "application/octet-stream");
  await assertValidUploadedPdf(client, { bucket, key, name, fileType });

  return {
    name,
    size: formatSize(head.ContentLength),
    fileType,
    url: file.url || buildS3ObjectUrl(bucket, configured.region, key),
    storageProvider: "s3",
    bucket,
    key,
  };
}

async function buildDirectUploadedFiles(body = {}) {
  const files = parseDirectUploadedFiles(body);
  return Promise.all(files.map(verifyDirectUploadedFile));
}

module.exports = {
  buildDirectUploadedFiles,
  formatSize,
};
