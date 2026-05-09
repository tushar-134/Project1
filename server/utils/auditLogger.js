const ActivityLog = require("../models/ActivityLog");

async function auditLogger({ task, user, action, previousStatus, newStatus, notes }) {
  // This helper keeps task audit entries consistent wherever controllers record workflow changes.
  if (!task || !user || !action) return null;
  return ActivityLog.create({ task, user, action, previousStatus, newStatus, notes });
}

module.exports = auditLogger;
