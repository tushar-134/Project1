const express = require("express");
const auth = require("../middleware/authMiddleware");
const { createSignedUrl, createUploadUrl, proxyFile } = require("../controllers/fileController");

const router = express.Router();

/**
 * GET /api/files/proxy?url=<encodedStorageUrl>&filename=<optionalFilename>
 *
 * Authenticated fallback proxy for legacy Cloudinary and local /uploads/ assets.
 * New S3 documents should use GET /api/files/signed-url so the browser opens
 * a short-lived AWS pre-signed URL instead of routing bytes through the API.
 */
router.get("/proxy", auth, proxyFile);
router.get("/signed-url", auth, createSignedUrl);
router.post("/upload-url", auth, createUploadUrl);

module.exports = router;
