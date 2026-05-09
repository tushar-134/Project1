const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "filing-buddy", resource_type: "auto" },
});

// Multer writes directly to Cloudinary so local server storage never becomes a dependency.
module.exports = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
