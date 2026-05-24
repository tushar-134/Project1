const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminOnly, requireRoles } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/userController");
const router = express.Router();
const { normalizeDialCode, normalizePhoneNumber } = require("../utils/phoneUtils");

const dialCodeValidator = body("mobileCountryCode")
  .optional({ values: "falsy" })
  .customSanitizer((value) => normalizeDialCode(value))
  .matches(/^\+\d{1,4}$/)
  .withMessage("Country code must look like +971.");

const mobileValidator = body("mobile")
  .optional({ values: "falsy" })
  .customSanitizer((value) => normalizePhoneNumber(value));

// Managers need read access to the user directory for task assignment, while mutations stay admin-only.
router.get("/", auth, requireRoles("admin", "manager"), ctrl.listUsers);
router.get("/:id", auth, requireRoles("admin", "manager"), ctrl.getUser);
router.use(auth, adminOnly);
router.post("/", body("name").notEmpty(), body("email").isEmail(), dialCodeValidator, mobileValidator, body("role").isIn(["admin", "manager", "task_only"]), ctrl.createUser);
router.put("/:id", body("name").optional().notEmpty(), body("email").optional().isEmail(), dialCodeValidator, mobileValidator, ctrl.updateUser);
router.patch("/:id/role", body("role").isIn(["admin", "manager", "task_only"]), ctrl.updateRole);
router.patch("/:id/status", body("isActive").isBoolean(), ctrl.updateStatus);
router.delete("/:id", ctrl.deleteUser);

module.exports = router;
