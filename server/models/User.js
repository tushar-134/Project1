const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// User auth uses a model hook so any create/save path gets consistent password hashing.
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  mobileCountryCode: { type: String, trim: true },
  mobile: String,
  role: { type: String, enum: ["admin", "manager", "user", "task_only"], default: "user" },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
}, { timestamps: true });

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ name: 1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ mobile: 1 });

module.exports = mongoose.model("User", userSchema);
