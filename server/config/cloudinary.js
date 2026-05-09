const cloudinary = require("cloudinary").v2;

// File uploads store only Cloudinary URLs in Mongo; this module keeps vendor config in one place.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
