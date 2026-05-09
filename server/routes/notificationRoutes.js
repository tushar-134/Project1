const express = require("express");
const auth = require("../middleware/authMiddleware");
const ctrl = require("../controllers/notificationController");
const router = express.Router();

// Notifications are always scoped to the authenticated user inside the controller layer.
router.use(auth);
router.get("/", ctrl.listNotifications);
router.patch("/mark-all-read", ctrl.markAllRead);
router.patch("/:id/read", ctrl.markRead);

module.exports = router;
