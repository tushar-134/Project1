const mongoose = require("mongoose");

const customFieldSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  key: { type: String, required: true, trim: true, unique: true },
  type: { type: String, enum: ["text", "number", "date", "select", "currency"], default: "text" },
  options: [String], // For "select" type
  required: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

module.exports = mongoose.model("CustomField", customFieldSchema);
