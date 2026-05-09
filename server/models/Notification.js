const mongoose = require("mongoose");

// Notifications are intentionally generic so cron jobs and interactive actions can share the same model.
const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ["task_due", "task_overdue", "client_added", "fta_query", "task_update"], required: true },
  relatedTask: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
  relatedClient: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);
