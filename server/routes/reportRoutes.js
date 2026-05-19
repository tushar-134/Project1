const express = require("express");
const auth = require("../middleware/authMiddleware");
const { adminManager } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/reportController");
const router = express.Router();

// Dashboard stats are shown on the home screen for every signed-in user, with data scoped by role.
router.get("/dashboard-stats", auth, ctrl.dashboardStats);
// The rest of the reports expose broad practice data, so they stay manager/admin only.
router.use(auth, adminManager);
router.get("/login-activity", ctrl.loginActivity);
router.get("/task-activity", ctrl.taskActivity);
router.get("/client-wise", ctrl.clientWise);
router.get("/user-wise", ctrl.userWise);
router.get("/overdue", ctrl.overdue);
router.get("/fta-tracker", ctrl.ftaTrackerReport);

module.exports = router;
