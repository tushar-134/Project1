const mongoose = require("mongoose");

const uploadedFileSchema = new mongoose.Schema({
  name: String,
  size: String,
  fileType: String,
  description: String,
  url: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

// Task shape mirrors the original practice-management workflow, including recurring and FTA-specific fields.
const taskSchema = new mongoose.Schema({
  taskId: { type: String, unique: true },
  category: { type: String, required: true },
  taskType: { type: String, required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  dueDate: { type: Date, required: true },
  // Structured period fields (new) — both optional and independent.
  // period (legacy) is kept so existing free-text values still read correctly.
  period: String,
  periodFY: String,      // e.g. "FY 2025-26"  or "FY 2025" for calendar year
  periodQuarter: String, // e.g. "Jan-Mar", "Apr-Jun", "Jul-Sep", "Oct-Dec"
  description: String,
  remarks: String,
  status: { type: String, enum: ["not_started", "wip", "completed", "submitted_to_fta"], default: "not_started" },
  isRecurring: { type: Boolean, default: false },
  recurringConfig: {
    frequency: { type: String, enum: ["weekly", "monthly", "quarterly", "semi_annual", "annual", "custom"] },
    dayOfWeek: { type: String }, // kept for backward compatibility
    dateOfMonth: { type: Number }, // kept for backward compatibility
    monthOfYear: { type: Number }, // kept for backward compatibility
    daysBeforeDue: { type: Number, min: 1, max: 99, default: 15 },
    nextDueDate: Date,
    endDate: Date,
  },
  recurringGeneratedTask: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
  isAwaitingFta: { type: Boolean, default: false },
  ftaStatus: { type: String, enum: ["in_review", "additional_query", "approved"], default: "in_review" },
  ftaSubmittedDate: Date,
  attachments: [uploadedFileSchema],
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
taskSchema.index({
  isRecurring: 1,
  recurringGeneratedTask: 1,
  "recurringConfig.nextDueDate": 1
});

module.exports = mongoose.model("Task", taskSchema);
