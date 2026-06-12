const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminOnly, adminManager, requireRoles } = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploadMiddleware");
const ctrl = require("../controllers/taskController");
const router = express.Router();

// Task routes mix CRUD and workflow-specific patches because the UI edits statuses inline.
router.use(auth);
router.get("/", ctrl.listTasks);
router.get("/export", adminManager, ctrl.exportTasks);
router.get("/fta-tracker", requireRoles("admin", "manager", "task_only"), ctrl.ftaTracker);
router.post("/", adminManager, body("category").notEmpty(), body("taskType").notEmpty(), body("client").notEmpty(), body("dueDate").isISO8601(), ctrl.createTask);
router.get("/:id", ctrl.getTask);
router.put("/:id", adminManager, ctrl.updateTask);
router.delete("/:id", adminOnly, ctrl.deleteTask);
router.patch("/:id/status", requireRoles("admin", "manager", "task_only"), body("status").isIn(["not_started", "wip", "completed", "submitted_to_fta"]), ctrl.updateStatus);
router.patch("/:id/assignee", adminManager, ctrl.updateAssignee);
router.patch("/:id/remarks", requireRoles("admin", "manager", "task_only"), body("remarks").optional().isString(), ctrl.updateRemarks);
router.patch("/:id/fta-status", requireRoles("admin", "manager", "task_only"), body("ftaStatus").isIn(["in_review", "additional_query", "approved"]), ctrl.updateFtaStatus);
router.post("/:id/attachments", adminManager, upload.fields([{ name: "file", maxCount: 10 }, { name: "files", maxCount: 10 }]), ctrl.uploadTaskAttachment);
router.delete("/:id/attachments/:attachId", adminManager, ctrl.deleteTaskAttachment);
router.get("/:id/logs", ctrl.getTaskLogs);

module.exports = router;
