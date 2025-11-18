const jwt = require("jsonwebtoken");

module.exports = function requireAuth(req, res, next) {
  // รับได้ทั้ง Authorization: Bearer xxx และ httpOnly cookie ชื่อ token
  const hdr = req.headers.authorization || "";
  const token =
    (hdr.startsWith("Bearer ") ? hdr.slice(7) : null) || req.cookies?.token;

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    req.user = { _id: payload.id, username: payload.username };
    next();
  } catch (e) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
