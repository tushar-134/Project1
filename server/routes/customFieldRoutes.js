const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/customFieldController");
const router = express.Router();

router.use(auth);
router.get("/", ctrl.getCustomFields);
router.post("/", adminOnly, [
  body("label").notEmpty().withMessage("Label is required"),
  body("key").notEmpty().withMessage("Key is required"),
  body("type").isIn(["text", "number", "date", "select"]).withMessage("Invalid type")
], ctrl.createCustomField);
router.put("/:id", adminOnly, ctrl.updateCustomField);
router.delete("/:id", adminOnly, ctrl.deleteCustomField);

module.exports = router;
