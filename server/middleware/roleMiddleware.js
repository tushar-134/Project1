function requireRoles(...roles) {
  // Role checks stay declarative at the route level, which keeps controllers focused on business rules.
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

const adminOnly = requireRoles("admin");
const adminManager = requireRoles("admin", "manager");

module.exports = { requireRoles, adminOnly, adminManager };
