// backend/src/utils/requireAuth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, "").trim();
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

exports.requireAuth = async (req, res, next) => {
  try {
    // A) session/passport
    if (req.isAuthenticated && req.isAuthenticated()) return next();
    if (req.user) return next();

    // B) JWT
    const raw = getToken(req);
    if (!raw) return res.status(401).json({ message: "Unauthorized" });

    const payload = jwt.verify(raw, process.env.JWT_SECRET || "devsecret");
    if (!payload?.id) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(payload.id).select("_id username email avatarUrl");
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
};
