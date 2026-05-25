const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { requireRoles } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/clientVisitController");

const router = express.Router();

function validateTime(field) {
  return body(field)
    .optional({ nullable: true })
    .custom((value) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value).trim()))
    .withMessage("Time must be in HH:mm format.");
}

router.use(auth);
router.get("/", requireRoles("admin", "manager", "task_only"), ctrl.listVisits);
router.post(
  "/",
  requireRoles("admin", "manager", "task_only"),
  body("visitDate").notEmpty().withMessage("Visit date is required.").isISO8601().withMessage("Visit date must be valid."),
  body("client").notEmpty().withMessage("Client is required."),
  body("visitors").isArray({ min: 1 }).withMessage("Select at least one visiting user."),
  body("visitors.*.user").notEmpty().withMessage("Each visitor must have a user."),
  ctrl.createVisit
);
router.patch(
  "/:id/visitors/:visitorId",
  requireRoles("admin", "manager", "task_only"),
  validateTime("checkInTime"),
  validateTime("checkOutTime"),
  ctrl.updateVisitorTimes
);

module.exports = router;
