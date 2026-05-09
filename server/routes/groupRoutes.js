const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { adminManager } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/groupController");
const router = express.Router();

// Groups are limited to manager/admin because they affect many client records at once.
router.use(auth, adminManager);
router.get("/", ctrl.listGroups);
router.post("/", body("name").notEmpty(), ctrl.createGroup);
router.put("/:id", body("name").notEmpty(), ctrl.updateGroup);
router.patch("/:id/clients", ctrl.updateGroupClients);
router.delete("/:id", ctrl.deleteGroup);

module.exports = router;
