const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminOnly, adminManager } = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploadMiddleware");
const ctrl = require("../controllers/clientController");
const router = express.Router();

// All client routes are protected; finer-grained create/delete rules are layered with role middleware.
router.use(auth);
router.get("/", ctrl.listClients);
router.get("/expiry-alerts", ctrl.expiryAlerts);
router.get("/export", adminManager, ctrl.exportClients);
router.post("/", adminManager, body("clientType").isIn(["legal", "natural"]), body("legalName").trim().notEmpty().withMessage("Legal name is required."), ctrl.createClient);
router.post("/bulk-upload", adminOnly, ctrl.bulkUpload);
router.get("/:id", ctrl.getClient);
router.put("/:id", adminManager, ctrl.updateClient);
router.delete("/:id", adminOnly, ctrl.deleteClient);
router.patch("/:id/restore", adminOnly, ctrl.restoreClient);
// Bug #5 Fix: add adminManager guard so task_only users cannot upload attachments.
router.post("/:id/documents", adminManager, upload.fields([{ name: "file", maxCount: 10 }, { name: "files", maxCount: 10 }]), ctrl.uploadClientDocument);
router.delete("/:id/documents/:section/:index/:documentId", adminOnly, ctrl.deleteClientDocument);
router.post("/:id/attachments", adminManager, upload.fields([{ name: "file", maxCount: 10 }, { name: "files", maxCount: 10 }]), ctrl.uploadAttachment);
router.delete("/:id/attachments/:attachId", adminOnly, ctrl.deleteAttachment);

module.exports = router;
