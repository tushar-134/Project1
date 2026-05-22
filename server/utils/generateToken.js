const jwt = require("jsonwebtoken");

function generateToken(user) {
  // Tokens stay lean: the API only needs the user id and role to rebuild request context.
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    // Default to rolling 8h inactivity expiry (refreshed on authenticated requests).
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

module.exports = generateToken;
