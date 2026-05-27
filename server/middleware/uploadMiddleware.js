const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

function isRealCloudinaryConfig() {
  const values = [
    process.env.CLOUDINARY_CLOUD_NAME,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET,
  ].map((value) => String(value || "").trim());

  if (values.some((value) => !value)) return false;
  return values.every((value) => value.toLowerCase() !== "test");
}

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

function createStorage() {
  if (isRealCloudinaryConfig()) {
    return new CloudinaryStorage({
      cloudinary,
      params: { folder: "filing-buddy", resource_type: "auto" },
    });
  }

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
const usingCloudinary = storage instanceof CloudinaryStorage;

if (!usingCloudinary) {
  console.warn("Upload middleware: Cloudinary is not configured. Falling back to local /uploads storage.");
}

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = upload;

