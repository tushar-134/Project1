const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminOnly, adminManager, requireRoles } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/taskController");
const router = express.Router();

// Task routes mix CRUD and workflow-specific patches because the UI edits statuses inline.
router.use(auth);
router.get("/", ctrl.listTasks);
router.get("/export", adminManager, ctrl.exportTasks);
router.get("/fta-tracker", adminManager, ctrl.ftaTracker);
router.post("/", adminManager, body("category").notEmpty(), body("taskType").notEmpty(), body("client").notEmpty(), body("dueDate").isISO8601(), ctrl.createTask);
router.get("/:id", ctrl.getTask);
router.put("/:id", adminManager, ctrl.updateTask);
router.delete("/:id", adminOnly, ctrl.deleteTask);
router.patch("/:id/status", requireRoles("admin", "manager", "task_only"), body("status").isIn(["not_started", "wip", "completed", "submitted_to_fta"]), ctrl.updateStatus);
router.patch("/:id/fta-status", adminManager, body("ftaStatus").isIn(["in_review", "additional_query", "approved"]), ctrl.updateFtaStatus);

module.exports = router;
