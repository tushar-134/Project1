const crypto = require("crypto");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const Client = require("../models/Client");
const sendEmail = require("../utils/sendEmail");
const { isValidPhone, normalizeDialCode, normalizePhoneNumber } = require("../utils/phoneUtils");

function normalize(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeMobile(value) {
  return normalizePhoneNumber(value);
}

function hasValidMobile(countryCode, value) {
  return isValidPhone(countryCode, value);
}

async function findUserDuplicate({ email, mobile, excludeId }) {
  const normalizedEmail = normalize(email);
  const normalizedMobile = normalizeMobile(mobile);
  const query = {
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [
      { email: normalizedEmail },
      ...(normalizedMobile ? [{ mobile: { $exists: true } }] : []),
    ],
  };
  const users = await User.find(query).select("email mobile mobileCountryCode");
  return users.find((user) =>
    normalize(user.email) === normalizedEmail ||
    (normalizedMobile && normalizeMobile(user.mobile) === normalizedMobile)
  );
}

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password").sort({ name: 1 }).lean();
    const usersWithClients = await Promise.all(users.map(async (user) => {
      const clients = await Client.find({ assignedUser: user._id, isActive: true }).select("legalName").lean();
      return { ...user, assignedClients: clients };
    }));
    res.json(usersWithClients);
  } catch (error) { next(error); }
};


exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const clients = await Client.find({ assignedUser: user._id, isActive: true }).select("legalName").lean();
    res.json({ ...user, assignedClients: clients });
  } catch (error) { next(error); }
};


exports.createUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const email = normalize(req.body.email);
    const mobile = normalizeMobile(req.body.mobile);
    const mobileCountryCode = normalizeDialCode(req.body.mobileCountryCode);
    if (!hasValidMobile(mobileCountryCode, req.body.mobile)) {
      return res.status(400).json({ message: "Phone number is invalid." });
    }
    if (await findUserDuplicate({ email: req.body.email, mobile: req.body.mobile })) {
      return res.status(409).json({ message: "User already added with this email or phone number." });
    }
    // New users are seeded with a temporary password because invite email and first login are separate concerns.
    const tempPassword = crypto.randomBytes(6).toString("base64url");
    const user = await User.create({ ...req.body, email, mobile, mobileCountryCode, password: tempPassword });
    await sendEmail({ to: user.email, subject: "Filing Buddy invite", text: `Your temporary password is ${tempPassword}` });
    res.status(201).json(await User.findById(user._id).select("-password"));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "User already added with this email or phone number." });
    }
    next(error);
  }
};


exports.updateUser = async (req, res, next) => {
  try {
    const mobileCountryCode = normalizeDialCode(req.body.mobileCountryCode);
    if (!hasValidMobile(mobileCountryCode, req.body.mobile)) {
      return res.status(400).json({ message: "Phone number is invalid." });
    }
    if (await findUserDuplicate({ email: req.body.email, mobile: req.body.mobile, excludeId: req.params.id })) {
      return res.status(409).json({ message: "User already added with this email or phone number." });
    }
    // Bug #8 Fix: findByIdAndUpdate returns null for a missing id; return 404 instead of 200 null.
    const payload = { ...req.body };
    if ("email" in payload) payload.email = String(payload.email || "").trim().toLowerCase();
    if ("mobile" in payload) payload.mobile = normalizeMobile(payload.mobile);
    if ("mobileCountryCode" in payload) payload.mobileCountryCode = normalizeDialCode(payload.mobileCountryCode);
    const user = await User.findByIdAndUpdate(req.params.id, payload, { new: true }).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const clients = await Client.find({ assignedUser: user._id, isActive: true }).select("legalName").lean();
    res.json({ ...user, assignedClients: clients });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "User already added with this email or phone number." });
    }
    next(error);
  }
};


exports.updateRole = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot change your own role." });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true }).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const clients = await Client.find({ assignedUser: user._id, isActive: true }).select("legalName").lean();
    res.json({ ...user, assignedClients: clients });
  } catch (error) { next(error); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id) && req.body.isActive === false) {
      return res.status(400).json({ message: "You cannot deactivate your own account." });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true }).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const clients = await Client.find({ assignedUser: user._id, isActive: true }).select("legalName").lean();
    res.json({ ...user, assignedClients: clients });
  } catch (error) { next(error); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id)) return res.status(400).json({ message: "Cannot delete self" });
    const target = await User.findById(req.params.id).select("role");
    if (!target) return res.status(404).json({ message: "User not found" });
    if (target.role === "admin") {
      return res.status(403).json({ message: "Cannot delete an admin user." });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (error) { next(error); }
};
