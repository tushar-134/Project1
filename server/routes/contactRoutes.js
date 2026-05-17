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
  body("mobile.countryCode").notEmpty(),
  body("mobile.number").notEmpty(),
  ctrl.createContact
);
router.put("/:id", adminManager, ctrl.updateContact);
router.delete("/:id", adminManager, ctrl.deleteContact);

module.exports = router;
