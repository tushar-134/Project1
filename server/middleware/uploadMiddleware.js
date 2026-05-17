const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const hasCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET,
);

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
module.exports = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
