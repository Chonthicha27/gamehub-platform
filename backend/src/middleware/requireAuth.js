// backend/src/middleware/requireAuth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function pickSuspendUntil(user) {
  // รองรับหลายชื่อ field เผื่อโปรเจกต์คุณตั้งไม่เหมือนกัน
  return (
    user?.suspendedUntil ||
    user?.suspensionEndsAt ||
    user?.suspendedUntilAt ||
    user?.suspendUntil ||
    null
  );
}

module.exports = async function requireAuth(req, res, next) {
  // รับได้ทั้ง Authorization: Bearer xxx และ httpOnly cookie ชื่อ token
  const hdr = req.headers.authorization || "";
  const token =
    (hdr.startsWith("Bearer ") ? hdr.slice(7) : null) || req.cookies?.token;

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "devsecret");

    // ✅ ดึง user จริงจาก DB (สำคัญมาก)
    const user = await User.findById(payload.id).select("_id username email role status suspendedUntil suspensionEndsAt").lean();
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // ✅ ENFORCE SUSPEND
    if (String(user.status || "").toLowerCase() === "suspended") {
      const until = pickSuspendUntil(user);
      // ถ้าไม่มีวันหมดอายุ ให้ถือว่า suspend อยู่เสมอ
      if (!until) {
        return res.status(403).json({
          message: "Account suspended",
          code: "SUSPENDED",
        });
      }
      const untilDate = new Date(until);
      if (!Number.isNaN(untilDate.getTime()) && untilDate > new Date()) {
        return res.status(403).json({
          message: "Account suspended",
          code: "SUSPENDED",
          suspendedUntil: untilDate.toISOString(),
        });
      }
      // ถ้าหมดอายุแล้ว ก็ปล่อยผ่านได้ (หรือจะให้ backend auto-activate ก็อีกเรื่อง)
    }

    // ✅ attach user to req
    req.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (e) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
