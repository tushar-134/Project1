const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

function isConfiguredValue(value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "your_cloud_name"
    && normalized !== "your_api_key"
    && normalized !== "your_api_secret"
    && normalized !== "test"
    && normalized !== "demo"
    && normalized !== "undefined"
    && normalized !== "null";
}

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const hasCloudinaryConfig = isConfiguredValue(cloudName)
  && isConfiguredValue(apiKey)
  && isConfiguredValue(apiSecret)
  && /^\d+$/.test(String(apiKey).trim())
  && String(apiSecret).trim().length >= 8;

const storage = hasCloudinaryConfig
  ? new CloudinaryStorage({
      cloudinary,
      params: { folder: "filing-buddy", resource_type: "auto" },
    })
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "..", "uploads");
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${Date.now()}-${safeName}`);
      },
    });

// Uses Cloudinary when configured; otherwise stores files locally for development.
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Separate multer instance for ZIP-based bulk uploads.
// Writes to a temp directory so the file can be extracted server-side before cleanup.
const zipUploadDir = path.join(__dirname, "..", "tmp-uploads");
fs.mkdirSync(zipUploadDir, { recursive: true });

const zipStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, zipUploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const zipUpload = multer({
  storage: zipStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".zip" || file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed") {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files are accepted."), false);
    }
  },
}).single("zipFile");

module.exports = upload;
module.exports.zipUpload = zipUpload;
