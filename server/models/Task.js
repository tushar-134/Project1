const mongoose = require("mongoose");

// Task shape mirrors the original practice-management workflow, including recurring and FTA-specific fields.
const taskSchema = new mongoose.Schema({
  taskId: { type: String, unique: true },
  category: { type: String, required: true },
  taskType: { type: String, required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  dueDate: { type: Date, required: true },
  period: String,
  description: String,
  status: { type: String, enum: ["not_started", "wip", "completed", "submitted_to_fta"], default: "not_started" },
  isRecurring: { type: Boolean, default: false },
  recurringConfig: {
    frequency: { type: String, enum: ["weekly", "monthly", "quarterly", "semi_annual", "annual", "custom"] },
    nextDueDate: Date,
    endDate: Date,
  },
  recurringGeneratedTask: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
  isAwaitingFta: { type: Boolean, default: false },
  ftaStatus: { type: String, enum: ["in_review", "additional_query", "approved"], default: "in_review" },
  ftaSubmittedDate: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

taskSchema.virtual("isOverdue").get(function isOverdue() {
  return this.dueDate && this.dueDate < new Date() && this.status !== "completed";
});

taskSchema.index({ assignedTo: 1, dueDate: 1, status: 1 });
taskSchema.index({ dueDate: 1, status: 1 });
taskSchema.index({ category: 1, status: 1, dueDate: 1 });
taskSchema.index({ client: 1 });
taskSchema.index({ isAwaitingFta: 1, category: 1, ftaSubmittedDate: -1, createdAt: -1 });

module.exports = mongoose.model("Task", taskSchema);
