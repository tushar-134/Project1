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
  body("authorityName").notEmpty().withMessage("Authority name is required."),
  body("contactPersonName").notEmpty().withMessage("Contact person name is required."),
  body("address").optional().trim(),
  body("location").optional().trim(),
  body("mobile.countryCode")
    .customSanitizer((value) => {
      return normalizeDialCode(value);
    })
    .notEmpty()
    .withMessage("Country code is required.")
    .bail()
    .matches(/^\+\d{1,4}$/)
    .withMessage("Country code must look like +971."),
  body("mobile.number")
    .customSanitizer((value) => normalizePhoneNumber(value))
    .notEmpty()
    .withMessage("Mobile number is required."),
  ctrl.createContact
);
router.put(
  "/:id",
  adminManager,
  body("authorityName").optional().notEmpty(),
  body("contactPersonName").optional().notEmpty(),
  body("address").optional().trim(),
  body("location").optional().trim(),
  body("mobile.countryCode")
    .optional()
    .customSanitizer((value) => {
      return normalizeDialCode(value);
    })
    .notEmpty()
    .withMessage("Country code is required.")
    .bail()
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
