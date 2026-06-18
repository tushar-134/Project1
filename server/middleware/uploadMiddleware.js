const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { buildS3ObjectUrl, createS3Client, getS3Config, hasS3Config } = require("../config/s3");

function ensureUploadsDir() {
  const uploadsDir = path.join(__dirname, "..", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}

function sanitizeBaseName(file) {
  const original = String(file?.originalname || "upload").trim();
  const extension = path.extname(original);
  const base = path.basename(original, extension).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${base || "upload"}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extension}`;
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function buildS3Key(file) {
  const { uploadPrefix } = getS3Config();
  const safeName = sanitizeBaseName(file);
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return [uploadPrefix, yyyy, mm, dd, safeName].filter(Boolean).join("/");
}

function isPdfFile(file) {
  return file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname || "");
}

function assertValidUploadBody(file, body) {
  if (!isPdfFile(file)) return;

  const headerWindow = body.subarray(0, Math.min(body.length, 1024)).toString("latin1");
  if (!headerWindow.includes("%PDF-")) {
    const error = new Error("The selected PDF file is invalid or corrupted. Please open it locally and upload a valid PDF.");
    error.statusCode = 400;
    throw error;
  }
}

class S3Storage {
  constructor() {
    this.client = createS3Client();
  }

  async _handleFile(req, file, cb) {
    try {
      const { bucket, region } = getS3Config();
      const key = buildS3Key(file);
      const body = await streamToBuffer(file.stream);
      assertValidUploadBody(file, body);
      const location = buildS3ObjectUrl(bucket, region, key);

      await this.client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: file.mimetype || "application/octet-stream",
        Metadata: {
          originalname: String(file.originalname || "upload"),
        },
      }));

      cb(null, {
        bucket,
        key,
        filename: path.basename(key),
        path: location,
        location,
        size: body.length,
      });
    } catch (error) {
      cb(error);
    }
  }

  _removeFile(req, file, cb) {
    cb(null);
  }
}

function createStorage() {
  if (hasS3Config()) return new S3Storage();

  const destination = ensureUploadsDir();
  return multer.diskStorage({
    destination(req, file, cb) {
      cb(null, destination);
    },
    filename(req, file, cb) {
      cb(null, sanitizeBaseName(file));
    },
  });
}

const storage = createStorage();
const usingS3 = storage instanceof S3Storage;

if (!usingS3) {
  console.warn("Upload middleware: S3 is not configured. Falling back to local /uploads storage.");
}

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = upload;

