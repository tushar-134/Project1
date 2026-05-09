const mongoose = require("mongoose");

// Categories carry task-type subdocuments because the UI edits task types inline inside each card.
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  icon: String,
  color: String,
  description: String,
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  taskTypes: [{ name: { type: String, required: true }, isActive: { type: Boolean, default: true } }],
}, { timestamps: true });

module.exports = mongoose.model("Category", categorySchema);
