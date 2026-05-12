const crypto = require("crypto");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

exports.listUsers = async (req, res, next) => {
  try { res.json(await User.find().select("-password").sort({ name: 1 })); } catch (error) { next(error); }
};
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) { next(error); }
};
exports.createUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    // New users are seeded with a temporary password because invite email and first login are separate concerns.
    const tempPassword = crypto.randomBytes(6).toString("base64url");
    const user = await User.create({ ...req.body, password: tempPassword });
    await sendEmail({ to: user.email, subject: "Filing Buddy invite", text: `Your temporary password is ${tempPassword}` });
    res.status(201).json(await User.findById(user._id).select("-password"));
  } catch (error) { next(error); }
};
exports.updateUser = async (req, res, next) => {
  try {
    // Bug #8 Fix: findByIdAndUpdate returns null for a missing id; return 404 instead of 200 null.
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) { next(error); }
};
exports.updateRole = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot change your own role." });
    }
    res.json(await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true }).select("-password"));
  } catch (error) { next(error); }
};
exports.updateStatus = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id) && req.body.isActive === false) {
      return res.status(400).json({ message: "You cannot deactivate your own account." });
    }
    res.json(await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true }).select("-password"));
  } catch (error) { next(error); }
};
exports.deleteUser = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id)) return res.status(400).json({ message: "Cannot delete self" });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (error) { next(error); }
};
