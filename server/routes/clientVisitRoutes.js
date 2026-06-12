const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/authMiddleware");
const { requireRoles } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/clientVisitController");

const router = express.Router();

const canAccess = requireRoles("admin", "manager", "associate");
const canManage = requireRoles("admin", "manager");

const visitTimeValidator = body("visitTime")
  .optional({ nullable: true })
  .custom((value) => !value || /^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(String(value).trim()))
  .withMessage("Visit time must be in 12-hour format, for example 10:00 AM.");

router.use(auth);

router.get("/", canAccess, ctrl.listVisits);
router.get("/export", canAccess, ctrl.exportVisits);
router.get("/:id", canAccess, ctrl.getVisit);

router.post(
  "/",
  canAccess,
  body("clientType").optional().isIn(["existing", "new"]).withMessage("Client Type must be Existing or New."),
  body("visitDate").notEmpty().withMessage("Visit Date is required.").isISO8601().withMessage("Visit Date must be valid."),
  visitTimeValidator,
  body("visitType").optional().isString().withMessage("Visit Type must be valid."),
  body("location").optional().isString().withMessage("Location must be valid."),
  body("remarks").optional().isString().withMessage("Remarks must be valid."),
  body("client")
    .if(body("clientType").custom((value) => !value || value === "existing"))
    .notEmpty().withMessage("Existing Client is required."),
  body("newClient.authorityName")
    .if(body("clientType").equals("new"))
    .notEmpty().withMessage("Name is required."),
  body("newClient.mobileNumber")
    .if(body("clientType").equals("new"))
    .notEmpty().withMessage("Mobile Number is required."),
  body("newClient.location")
    .if(body("clientType").equals("new"))
    .notEmpty().withMessage("Location is required."),
  body("assignedUsers").optional().isArray().withMessage("Assigned Users must be a list."),
  body("assignedUsers.*.user").optional().notEmpty().withMessage("Each assigned user must include a user id."),
  ctrl.createVisit
);

router.put(
  "/:id",
  canManage,
  body("clientType").optional().isIn(["existing", "new"]).withMessage("Client Type must be Existing or New."),
  body("visitDate").optional().isISO8601().withMessage("Visit Date must be valid."),
  visitTimeValidator,
  body("status").optional().isIn(["planned", "in_progress", "completed", "cancelled"]).withMessage("Status is invalid."),
  body("assignedUsers").optional().isArray().withMessage("Assigned Users must be a list."),
  body("assignedUsers.*.user").optional().notEmpty().withMessage("Each assigned user must include a user id."),
  ctrl.updateVisit
);

router.post(
  "/:id/checkin",
  canAccess,
  body("userId").optional().isString().withMessage("User is invalid."),
  body("gpsLocation").optional().isString().withMessage("GPS Location must be valid."),
  body("notes").optional().isString().withMessage("Notes must be valid."),
  ctrl.checkIn
);

router.post(
  "/:id/checkout",
  canAccess,
  body("userId").optional().isString().withMessage("User is invalid."),
  body("visitSummary").optional().isString().withMessage("Visit Summary must be valid."),
  body("followUpRequired").optional().isBoolean().withMessage("Follow-up Required must be Yes or No."),
  body("notes").optional().isString().withMessage("Notes must be valid."),
  ctrl.checkOut
);

router.patch(
  "/:id/attendance",
  canAccess,
  body("checkInTime").notEmpty().withMessage("Check-in time is required."),
  body("checkOutTime").optional({ values: "falsy" }),
  body("visitSummary").optional().isString().withMessage("Visit Remark must be valid."),
  ctrl.updateAttendance
);

router.patch(
  "/:id/status",
  canManage,
  body("status").isIn(["planned", "in_progress", "completed", "cancelled"]).withMessage("Status is invalid."),
  ctrl.updateStatus
);

router.patch(
  "/:id/remarks",
  canAccess,
  body("remarks").notEmpty().withMessage("Remarks string is required."),
  ctrl.updateRemarks
);

module.exports = router;
