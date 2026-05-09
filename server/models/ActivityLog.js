const mongoose = require("mongoose");

// Activity logs are task-centric because most audit views in Filing Buddy pivot around task workflows.
const activityLogSchema = new mongoose.Schema({
  task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true },
  previousStatus: String,
  newStatus: String,
  notes: String,
}, { timestamps: true });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
