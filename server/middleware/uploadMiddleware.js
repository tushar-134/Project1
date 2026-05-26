const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "filing-buddy", resource_type: "auto" },
});

// Force all uploads to go through Cloudinary; no local server storage fallbacks.
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = upload;

