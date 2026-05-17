const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminManager } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/contactController");

const router = express.Router();

router.use(auth);
router.get("/", ctrl.listContacts);
router.post(
  "/",
  adminManager,
  body("fullName").notEmpty(),
  body("client").notEmpty(),
  body("mobile.countryCode")
    .customSanitizer((value) => {
      const trimmed = String(value || "").trim();
      if (!trimmed) return "";
      const digits = trimmed.replace(/[^\d]/g, "");
      return digits ? `+${digits}` : "";
    })
    .notEmpty()
    .matches(/^\+\d{1,4}$/)
    .withMessage("Country code must look like +971."),
  body("mobile.number")
    .customSanitizer((value) => String(value || "").replace(/\D+/g, ""))
    .notEmpty()
    .isLength({ min: 10, max: 10 })
    .withMessage("Mobile number must be exactly 10 digits."),
  ctrl.createContact
);
router.put("/:id", adminManager, ctrl.updateContact);
router.delete("/:id", adminManager, ctrl.deleteContact);

module.exports = router;
