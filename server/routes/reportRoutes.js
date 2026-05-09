const express = require("express");
const auth = require("../middleware/authMiddleware");
const { adminManager } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/reportController");
const router = express.Router();

// Reports can expose broad practice data, so they follow the same admin/manager boundary as the prototype.
router.use(auth, adminManager);
router.get("/dashboard-stats", ctrl.dashboardStats);
router.get("/login-activity", ctrl.loginActivity);
router.get("/task-activity", ctrl.taskActivity);
router.get("/client-wise", ctrl.clientWise);
router.get("/user-wise", ctrl.userWise);
router.get("/overdue", ctrl.overdue);
router.get("/fta-tracker", ctrl.ftaTrackerReport);

module.exports = router;
