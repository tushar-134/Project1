const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/categoryController");
const router = express.Router();

// Category reads are open to any authenticated user; mutations stay admin-only.
router.use(auth);
router.get("/", ctrl.listCategories);
router.post("/", adminOnly, body("name").notEmpty(), ctrl.createCategory);
router.put("/:id", adminOnly, ctrl.updateCategory);
router.delete("/:id", adminOnly, ctrl.deleteCategory);
router.post("/:id/task-types", adminOnly, body("name").notEmpty(), ctrl.addTaskType);
router.patch("/:id/task-types/:typeId/status", adminOnly, body("isActive").isBoolean(), ctrl.updateTaskTypeStatus);
router.delete("/:id/task-types/:typeId", adminOnly, ctrl.deleteTaskType);

module.exports = router;
