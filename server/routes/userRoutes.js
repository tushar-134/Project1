const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/userController");
const router = express.Router();
const { getPhoneNumberSpec, normalizeDialCode, normalizePhoneNumber } = require("../utils/phoneUtils");

const dialCodeValidator = body("mobileCountryCode")
  .optional({ values: "falsy" })
  .customSanitizer((value) => normalizeDialCode(value))
  .matches(/^\+\d{1,4}$/)
  .withMessage("Country code must look like +971.");

const mobileValidator = body("mobile")
  .optional({ values: "falsy" })
  .customSanitizer((value) => normalizePhoneNumber(value))
  .custom((value, { req }) => {
    const digits = normalizePhoneNumber(value);
    if (!digits) return true;
    const { min } = getPhoneNumberSpec(req.body.mobileCountryCode);
    if (digits.length !== min) {
      throw new Error(`Mobile number must be exactly ${min} digits.`);
    }
    return true;
  });

// User management is intentionally admin-only in one place instead of repeated across handlers.
router.use(auth, adminOnly);
router.get("/", ctrl.listUsers);
router.post("/", body("name").notEmpty(), body("email").isEmail(), dialCodeValidator, mobileValidator, body("role").isIn(["admin", "manager", "task_only"]), ctrl.createUser);
router.get("/:id", ctrl.getUser);
router.put("/:id", body("name").optional().notEmpty(), body("email").optional().isEmail(), dialCodeValidator, mobileValidator, ctrl.updateUser);
router.patch("/:id/role", body("role").isIn(["admin", "manager", "task_only"]), ctrl.updateRole);
router.patch("/:id/status", body("isActive").isBoolean(), ctrl.updateStatus);
router.delete("/:id", ctrl.deleteUser);

module.exports = router;
