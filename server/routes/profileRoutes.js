const express = require("express");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const ctrl = require("../controllers/profileController");

const router = express.Router();

router.use(auth);
router.get("/me", ctrl.getMyProfile);
router.patch("/me/photo", upload.single("file"), ctrl.updateMyProfilePhoto);
router.delete("/me/photo", ctrl.removeMyProfilePhoto);

module.exports = router;
