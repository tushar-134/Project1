const { validationResult } = require("express-validator");
const User = require("../models/User");
const Client = require("../models/Client");
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

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  const search = String(query.search || "").trim();
  const requested = ["page", "limit", "search"].some((key) => Object.prototype.hasOwnProperty.call(query, key));
  return { page, limit, search, requested };
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
    const { page, limit, search, requested } = parsePagination(req.query);
    const query = search
      ? {
          $or: [
            { name: new RegExp(escapeRegex(search), "i") },
            { email: new RegExp(escapeRegex(search), "i") },
            { mobile: new RegExp(escapeRegex(search), "i") },
          ],
        }
      : {};
    const usersQuery = User.find(query).select("-password").sort({ name: 1 });
    if (requested) usersQuery.skip((page - 1) * limit).limit(limit);
    const [users, total] = await Promise.all([
      usersQuery.lean(),
      requested ? User.countDocuments(query) : User.countDocuments(),
    ]);

    const userIds = users.map((u) => u._id);
    const allClients = userIds.length
      ? await Client.find({ assignedUser: { $in: userIds }, isActive: true }).select("legalName assignedUser").lean()
      : [];

    const clientsByUserId = {};
    allClients.forEach((client) => {
      const uId = String(client.assignedUser);
      if (!clientsByUserId[uId]) clientsByUserId[uId] = [];
      clientsByUserId[uId].push(client);
    });

    const usersWithClients = users.map((user) => ({
      ...user,
      assignedClients: clientsByUserId[String(user._id)] || [],
    }));

    if (!requested) return res.json(usersWithClients);
    res.json({ items: usersWithClients, total, page, limit, pages: Math.ceil(total / limit) });
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
    const user = await User.create({ ...req.body, email, mobile, mobileCountryCode, password: req.body.password });
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const mobileCountryCode = normalizeDialCode(req.body.mobileCountryCode);
    if (!hasValidMobile(mobileCountryCode, req.body.mobile)) {
      return res.status(400).json({ message: "Phone number is invalid." });
    }
    if (await findUserDuplicate({ email: req.body.email, mobile: req.body.mobile, excludeId: req.params.id })) {
      return res.status(409).json({ message: "User already added with this email or phone number." });
    }
    const user = await User.findById(req.params.id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    if ("name" in req.body) user.name = req.body.name;
    if ("email" in req.body) user.email = String(req.body.email || "").trim().toLowerCase();
    if ("mobile" in req.body) user.mobile = normalizeMobile(req.body.mobile);
    if ("mobileCountryCode" in req.body) user.mobileCountryCode = normalizeDialCode(req.body.mobileCountryCode);
    if ("role" in req.body) user.role = req.body.role;
    if (req.body.password) user.password = req.body.password;

    await user.save();

    const safeUser = await User.findById(user._id).select("-password").lean();
    const clients = await Client.find({ assignedUser: user._id, isActive: true }).select("legalName").lean();
    res.json({ ...safeUser, assignedClients: clients });
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
