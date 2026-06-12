const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminOnly, requireRoles } = require("../middleware/roleMiddleware");
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
    const { min, max } = getPhoneNumberSpec(req.body.mobileCountryCode);
    if (digits.length < min || digits.length > max) {
      throw new Error(`Mobile number must be between ${min} and ${max} digits.`);
    }
    return true;
  });

// Managers need read access to the user directory for task assignment, while mutations stay admin-only.
router.get("/", auth, requireRoles("admin", "manager"), ctrl.listUsers);
router.get("/:id", auth, requireRoles("admin", "manager"), ctrl.getUser);
router.use(auth, adminOnly);
router.post("/", body("name").notEmpty(), body("email").isEmail(), body("password").isLength({ min: 8 }), dialCodeValidator, mobileValidator, body("role").isIn(["admin", "manager", "associate"]), ctrl.createUser);
router.put(
  "/:id",
  body("name").optional().notEmpty(),
  body("email").optional().isEmail(),
  body("password").optional({ values: "falsy" }).isLength({ min: 8 }),
  body("role").optional().isIn(["admin", "manager", "associate"]),
  dialCodeValidator,
  mobileValidator,
  ctrl.updateUser
);
router.patch("/:id/role", body("role").isIn(["admin", "manager", "associate"]), ctrl.updateRole);
router.patch("/:id/status", body("isActive").isBoolean(), ctrl.updateStatus);
router.delete("/:id", ctrl.deleteUser);

module.exports = router;
