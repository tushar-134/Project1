const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/userController");
const router = express.Router();

// User management is intentionally admin-only in one place instead of repeated across handlers.
router.use(auth, adminOnly);
router.get("/", ctrl.listUsers);
router.post("/", body("name").notEmpty(), body("email").isEmail(), body("role").isIn(["admin", "manager", "task_only"]), ctrl.createUser);
router.get("/:id", ctrl.getUser);
router.put("/:id", ctrl.updateUser);
router.patch("/:id/role", body("role").isIn(["admin", "manager", "task_only"]), ctrl.updateRole);
router.patch("/:id/status", body("isActive").isBoolean(), ctrl.updateStatus);
router.delete("/:id", ctrl.deleteUser);

module.exports = router;
