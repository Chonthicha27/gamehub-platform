// backend/src/middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function pickSuspendUntil(user) {
  return (
    user?.suspendedUntil ||
    user?.suspensionEndsAt ||
    user?.suspendedUntilAt ||
    user?.suspendUntil ||
    null
  );
}

function suspendedResponse(res, user) {
  const until = pickSuspendUntil(user);
  let untilISO = null;

  if (until) {
    const d = new Date(until);
    if (!Number.isNaN(d.getTime())) untilISO = d.toISOString();
  }

  // ถ้าไม่มี until = suspend ถาวร
  // ถ้ามี until แต่ parse ไม่ได้ ก็ถือว่าถาวร (กันพลาด)
  return res.status(403).json({
    message: "Account suspended",
    code: "SUSPENDED",
    reason: user?.suspendedReason || "",
    suspendedUntil: untilISO,
  });
}

function isSuspendedNow(user) {
  if (!user) return false;
  if (String(user.status || "").toLowerCase() !== "suspended") return false;

  const until = pickSuspendUntil(user);
  if (!until) return true;

  const d = new Date(until);
  if (Number.isNaN(d.getTime())) return true;

  return d > new Date();
}

// อ่าน JWT ถ้ามี (optional)
function readOptionalUser(req, _res, next) {
  const h = req.headers.authorization || "";
  const hdrToken = h.startsWith("Bearer ") ? h.slice(7) : null;
  const token = hdrToken || req.cookies?.token || null;

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
      req.user = { _id: String(payload.id || payload.uid) };
    } catch {}
  }
  next();
}

// ต้องล็อกอิน และห้ามถูกระงับ
async function authRequired(req, res, next) {
  // --- Case 1: Session (passport) ---
  if (req.isAuthenticated && req.isAuthenticated()) {
    try {
      const u = await User.findById(req.user._id).lean();
      if (!u) return res.status(401).json({ message: "Unauthorized" });

      if (isSuspendedNow(u)) return suspendedResponse(res, u);

      // attach role
      req.user.role = u.role;
    } catch (e) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return next();
  }

  // --- Case 2: Bearer token ---
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET || "devsecret");
      const u = await User.findById(payload.id || payload.uid).lean();
      if (!u) return res.status(401).json({ message: "Unauthorized" });

      if (isSuspendedNow(u)) return suspendedResponse(res, u);

      req.user = { _id: String(u._id), username: u.username, email: u.email, role: u.role, status: u.status };
      return next();
    } catch {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  // --- Case 3: Cookie token (ถ้าใช้ httpOnly cookie token) ---
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    try {
      const payload = jwt.verify(cookieToken, process.env.JWT_SECRET || "devsecret");
      const u = await User.findById(payload.id || payload.uid).lean();
      if (!u) return res.status(401).json({ message: "Unauthorized" });

      if (isSuspendedNow(u)) return suspendedResponse(res, u);

      req.user = { _id: String(u._id), username: u.username, email: u.email, role: u.role, status: u.status };
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

    if (isSuspendedNow(u)) return suspendedResponse(res, u);

    if (!roles.includes(u.role)) return res.status(403).json({ message: "Forbidden" });

    req.me = u;
    next();
  };
}

const requireAdmin = requireRole("admin");

module.exports = { readOptionalUser, authRequired, requireRole, requireAdmin };
