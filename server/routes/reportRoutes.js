const express = require("express");
const auth = require("../middleware/authMiddleware");
const { adminManager } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/reportController");
const v2 = require("../controllers/reportV2Controller");
const router = express.Router();

// Dashboard stats are shown on the home screen for every signed-in user, with data scoped by role.
router.get("/dashboard-stats", auth, ctrl.dashboardStats);
router.get("/v2/login-activity", auth, adminManager, v2.loginActivity);
router.get("/v2/task-activity", auth, adminManager, v2.taskActivity);
router.get("/v2/client-wise", auth, adminManager, v2.clientWise);
router.get("/v2/user-wise", auth, adminManager, v2.userWise);
router.get("/v2/overdue", auth, adminManager, v2.overdue);
router.get("/v2/fta-tracker", auth, adminManager, v2.ftaTrackerReport);
router.get("/v2/:report/export", auth, adminManager, v2.exportCsv);
// The rest of the reports expose broad practice data, so they stay manager/admin only.
router.get("/login-activity", auth, adminManager, ctrl.loginActivity);
router.get("/task-activity", auth, adminManager, ctrl.taskActivity);
router.get("/client-wise", auth, adminManager, ctrl.clientWise);
router.get("/user-wise", auth, adminManager, ctrl.userWise);
router.get("/overdue", auth, adminManager, ctrl.overdue);
router.get("/fta-tracker", auth, adminManager, ctrl.ftaTrackerReport);

module.exports = router;
