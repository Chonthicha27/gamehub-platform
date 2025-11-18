const jwt = require("jsonwebtoken");
const User = require("../models/User");

// อ่าน JWT ถ้ามี (optional)
function readOptionalUser(req, _res, next) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET || "devsecret");
      req.user = { _id: String(payload.id || payload.uid) };
    } catch {}
  }
  next();
}

// ต้องล็อกอิน และห้ามถูกระงับ
async function authRequired(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    try {
      const u = await User.findById(req.user._id).lean();
      if (!u) return res.status(401).json({ message: "Unauthorized" });
      if (u.status === "suspended") {
        return res.status(423).json({ message: "Account suspended", reason: u.suspendedReason, until: u.suspendedUntil });
      }
      req.user.role = u.role;
    } catch {}
    return next();
  }

  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET || "devsecret");
      const u = await User.findById(payload.id || payload.uid).lean();
      if (!u) return res.status(401).json({ message: "Unauthorized" });
      if (u.status === "suspended") {
        return res.status(423).json({ message: "Account suspended", reason: u.suspendedReason, until: u.suspendedUntil });
      }
      req.user = { _id: String(u._id), username: u.username, email: u.email, role: u.role };
      return next();
    } catch {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  return res.status(401).json({ message: "Unauthorized" });
}

function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user?._id) return res.status(401).json({ message: "Unauthorized" });
    const u = await User.findById(req.user._id).lean();
    if (!u) return res.status(401).json({ message: "Unauthorized" });
    if (u.status === "suspended") {
      return res.status(423).json({ message: "Account suspended", reason: u.suspendedReason, until: u.suspendedUntil });
    }
    if (!roles.includes(u.role)) return res.status(403).json({ message: "Forbidden" });
    req.me = u;
    next();
  };
}

const requireAdmin = requireRole("admin");

module.exports = { readOptionalUser, authRequired, requireRole, requireAdmin };
