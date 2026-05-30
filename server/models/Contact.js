const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  authorityName: { type: String, trim: true },
  contactPersonName: { type: String, trim: true },
  fullName: { type: String, trim: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
  designation: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  mobile: {
    countryCode: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true },
  },
  type: { type: String, default: "Government Authority" },
  address: { type: String, trim: true },
  location: { type: String, trim: true },
  emirates: { type: String, trim: true },
  city: { type: String, trim: true },
  isPrimary: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

contactSchema.index({ isActive: 1, authorityName: 1, createdAt: -1 });
contactSchema.index({ isActive: 1, client: 1, createdAt: -1 });
contactSchema.index({ isActive: 1, createdAt: -1 });
contactSchema.index({ client: 1 });
contactSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Contact", contactSchema);
