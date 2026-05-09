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
router.get("/export", adminManager, ctrl.exportClients);
router.post("/", adminManager, body("clientType").isIn(["legal", "natural"]), body("legalName").notEmpty(), ctrl.createClient);
router.post("/bulk-upload", adminManager, ctrl.bulkUpload);
router.get("/:id", ctrl.getClient);
router.put("/:id", adminManager, ctrl.updateClient);
router.delete("/:id", adminOnly, ctrl.deleteClient);
router.post("/:id/attachments", upload.single("file"), ctrl.uploadAttachment);
router.delete("/:id/attachments/:attachId", adminManager, ctrl.deleteAttachment);

module.exports = router;
