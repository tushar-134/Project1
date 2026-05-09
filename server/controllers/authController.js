const { validationResult } = require("express-validator");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, mobile: user.mobile, isActive: user.isActive };
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
    user.lastLogin = new Date();
    await user.save();
    res.json({ token: generateToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
};

exports.logout = (req, res) => res.json({ message: "Logged out" });

exports.me = (req, res) => res.json({ user: publicUser(req.user) });

exports.changePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(req.body.currentPassword))) return res.status(400).json({ message: "Current password is incorrect" });
    user.password = req.body.newPassword;
    await user.save();
    res.json({ message: "Password changed" });
  } catch (error) { next(error); }
};
