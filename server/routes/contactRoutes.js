const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminManager } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/contactController");
const { normalizeDialCode, normalizePhoneNumber } = require("../utils/phoneUtils");

const router = express.Router();

router.use(auth);
router.get("/", adminManager, ctrl.listContacts);
router.post(
  "/",
  adminManager,
  body("fullName").notEmpty(),
  body("client").notEmpty(),
  body("mobile.countryCode")
    .customSanitizer((value) => {
      return normalizeDialCode(value);
    })
    .notEmpty()
    .matches(/^\+\d{1,4}$/)
    .withMessage("Country code must look like +971."),
  body("mobile.number")
    .customSanitizer((value) => normalizePhoneNumber(value))
    .notEmpty(),
  ctrl.createContact
);
router.put(
  "/:id",
  adminManager,
  body("fullName").optional().notEmpty(),
  body("client").optional().notEmpty(),
  body("mobile.countryCode")
    .optional()
    .customSanitizer((value) => {
      return normalizeDialCode(value);
    })
    .matches(/^\+\d{1,4}$/)
    .withMessage("Country code must look like +971."),
  body("mobile.number")
    .optional()
    .customSanitizer((value) => normalizePhoneNumber(value))
    .custom((value, { req }) => {
      const digits = normalizePhoneNumber(value);
      if (!digits) return true;
      const countryCode = req.body?.mobile?.countryCode;
      if (!countryCode) {
        throw new Error("Country code is required when updating the mobile number.");
      }
      return true;
    }),
  ctrl.updateContact
);
router.delete("/:id", adminManager, ctrl.deleteContact);

module.exports = router;
