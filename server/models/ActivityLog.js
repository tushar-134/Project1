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

activityLogSchema.index({ task: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1 });
activityLogSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
