const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const ctrl = require("../controllers/authController");
const router = express.Router();

// Validation lives at the route edge so controllers can assume the basic request shape is sane.
router.post("/login", body("email").isEmail(), body("password").notEmpty(), ctrl.login);
router.post("/logout", auth, ctrl.logout);
router.get("/me", auth, ctrl.me);
router.put("/change-password", auth, body("currentPassword").notEmpty(), body("newPassword").isLength({ min: 8 }), ctrl.changePassword);

module.exports = router;
