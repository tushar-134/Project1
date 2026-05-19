const express = require("express");
const auth = require("../middleware/authMiddleware");
const { adminManager } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/reportController");
const router = express.Router();

// Dashboard stats are shown on the home screen for every signed-in user, with data scoped by role.
router.get("/dashboard-stats", auth, ctrl.dashboardStats);
// The rest of the reports expose broad practice data, so they stay manager/admin only.
router.get("/login-activity", auth, adminManager, ctrl.loginActivity);
router.get("/task-activity", auth, adminManager, ctrl.taskActivity);
router.get("/client-wise", auth, adminManager, ctrl.clientWise);
router.get("/user-wise", auth, adminManager, ctrl.userWise);
router.get("/overdue", auth, adminManager, ctrl.overdue);
router.get("/fta-tracker", auth, adminManager, ctrl.ftaTrackerReport);

module.exports = router;
