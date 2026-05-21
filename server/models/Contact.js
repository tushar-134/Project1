const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  designation: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  mobile: {
    countryCode: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true },
  },
  type: { type: String, default: "Client Contact" },
  city: { type: String, trim: true },
  isPrimary: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

contactSchema.index({ isActive: 1, client: 1, createdAt: -1 });
contactSchema.index({ isActive: 1, createdAt: -1 });
contactSchema.index({ client: 1 });
contactSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Contact", contactSchema);
