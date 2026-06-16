const express = require("express");
const auth = require("../middleware/authMiddleware");
const { proxyFile } = require("../controllers/fileController");

const router = express.Router();

/**
 * GET /api/files/proxy?url=<encodedCloudinaryUrl>&filename=<optionalFilename>
 *
 * Authenticated server-side proxy for Cloudinary (and local /uploads/) assets.
 * All requests must carry a valid JWT — this prevents public hotlinking and
 * ensures that only authenticated Filing Buddy users can access client files.
 */
router.get("/proxy", auth, proxyFile);

module.exports = router;
