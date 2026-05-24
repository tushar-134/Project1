const mongoose = require("mongoose");

// Categories carry task-type subdocuments because the UI edits task types inline inside each card.
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  icon: String,
  color: String,
  description: String,
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  taskTypes: [
    {
      name: { type: String, required: true },
      isActive: { type: Boolean, default: true },
      // Field-visibility toggles — default true so existing task types keep all fields visible (backward compatible).
      // New task types should send explicit false values from the frontend modal.
      showPeriod: { type: Boolean, default: true },
      showRecurring: { type: Boolean, default: true },
      showAwaitingFta: { type: Boolean, default: true },
    },
  ],
}, { timestamps: true });

categorySchema.index({ isActive: 1, createdAt: 1 });
categorySchema.index({ name: 1 });

module.exports = mongoose.model("Category", categorySchema);
