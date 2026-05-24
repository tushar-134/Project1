const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const jwt = require("jsonwebtoken");

function resolveStoredProfilePhotoUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith("/uploads/")) return url;
    const filename = path.basename(parsed.pathname);
    const filePath = path.join(__dirname, "..", "uploads", filename);
    return fs.existsSync(filePath) ? url : "";
  } catch {
    return url;
  }
}

function publicUser(user) {
  const profilePhotoUrl = resolveStoredProfilePhotoUrl(user.profilePhotoUrl);
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    mobile: user.mobile,
    mobileCountryCode: user.mobileCountryCode,
    isActive: user.isActive,
    profilePhotoUrl,
  };
}

function applyStoredToken(user, token) {
  const decoded = jwt.decode(token);
  user.authToken = token;
  user.authTokenIssuedAt = new Date();
  user.authTokenExpiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : undefined;
}

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    // Password comparison needs the normally-hidden password field for this one query.
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select("+password");
    if (!user || !user.isActive || !(await user.comparePassword(req.body.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = generateToken(user);
    user.lastLogin = new Date();
    applyStoredToken(user, token);
    await user.save();
    res.json({ token, user: publicUser(user) });
  } catch (error) { next(error); }
};

exports.logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.authToken = undefined;
      user.authTokenIssuedAt = undefined;
      user.authTokenExpiresAt = undefined;
      await user.save({ validateBeforeSave: false });
    }
    res.json({ message: "Logged out" });
  } catch (error) { next(error); }
};

exports.me = (req, res) => res.json({ user: publicUser(req.user) });

exports.changePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+password");
    // Bug #9 Fix: guard against the edge case where the user was deleted between
    // the auth middleware check and this query; avoids a 500 null-dereference.
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!(await user.comparePassword(req.body.currentPassword))) return res.status(400).json({ message: "Current password is incorrect" });
    user.password = req.body.newPassword;
    await user.save();
    res.json({ message: "Password changed" });
  } catch (error) { next(error); }
};
