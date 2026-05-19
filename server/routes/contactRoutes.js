const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminManager } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/contactController");
const { getPhoneNumberSpec, normalizeDialCode, normalizePhoneNumber } = require("../utils/phoneUtils");

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
    .notEmpty()
    .custom((value, { req }) => {
      const digits = normalizePhoneNumber(value);
      const { min } = getPhoneNumberSpec(req.body?.mobile?.countryCode);
      if (digits.length !== min) {
        throw new Error(`Mobile number must be exactly ${min} digits.`);
      }
      return true;
    }),
  ctrl.createContact
);
router.put("/:id", adminManager, ctrl.updateContact);
router.delete("/:id", adminManager, ctrl.deleteContact);

module.exports = router;
