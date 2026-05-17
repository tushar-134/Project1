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

module.exports = mongoose.model("Contact", contactSchema);
