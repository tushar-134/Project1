const fs = require("fs");
const path = require("path");
const User = require("../models/User");

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

function toUploadedFile(file, req) {
  const url = file.path?.startsWith?.("http")
    ? file.path
    : `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
  return {
    name: file.originalname,
    size: `${Math.round(file.size / 1024)} KB`,
    fileType: file.mimetype,
    url,
  };
}

function publicProfile(user) {
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
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

exports.getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    const cleanUrl = resolveStoredProfilePhotoUrl(user.profilePhotoUrl);
    if (!cleanUrl && user.profilePhotoUrl) {
      user.profilePhotoUrl = undefined;
      await user.save({ validateBeforeSave: false });
    }
    res.json({ user: publicProfile(user) });
  } catch (error) {
    next(error);
  }
};

exports.updateMyProfilePhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Please choose a profile photo to upload." });
    if (!String(req.file.mimetype || "").startsWith("image/")) {
      return res.status(400).json({ message: "Profile photo must be an image file." });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const uploadedFile = toUploadedFile(req.file, req);
    user.profilePhotoUrl = uploadedFile.url;
    await user.save({ validateBeforeSave: false });
    res.json({ user: publicProfile(user) });
  } catch (error) {
    next(error);
  }
};

exports.removeMyProfilePhoto = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.profilePhotoUrl = undefined;
    await user.save({ validateBeforeSave: false });
    res.json({ user: publicProfile(user) });
  } catch (error) {
    next(error);
  }
};
