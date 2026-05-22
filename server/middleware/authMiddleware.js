const jwt = require("jsonwebtoken");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const REFRESH_TOKEN_IF_REMAINING_SECONDS = 60 * 60; // 1h

async function authMiddleware(req, res, next) {
  try {
    // Tokens are expected in the standard Bearer header so browser and API tools behave the same way.
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Not authorized" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user || !user.isActive) return res.status(401).json({ message: "User inactive or not found" });
    req.user = user;

    // Sliding session: when the user is active, refresh the JWT so it always expires
    // 8 hours after the most recent authenticated request.
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (decoded?.exp && decoded.exp - nowSeconds <= REFRESH_TOKEN_IF_REMAINING_SECONDS) {
      res.setHeader("x-auth-token", generateToken(user));
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = authMiddleware;
