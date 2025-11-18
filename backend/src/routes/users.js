// backend/src/routes/users.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const User = require("../models/User");

// ---------------- helpers ----------------
function readJwt(req) {
  const hdr = req.headers.authorization || "";
  const bearer = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  return req.cookies?.token || bearer;
}
function getAuthedUserId(req) {
  if (req.user?._id) return String(req.user._id);
  const token = readJwt(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    return payload?.uid ? String(payload.uid) : payload?.id ? String(payload.id) : null;
  } catch {
    return null;
  }
}
const USER_SAFE_PROJECTION =
  "_id username email githubId displayName bio avatarUrl bannerUrl links favorites createdAt updatedAt";

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
const avatarsDir = path.join(process.cwd(), "uploads", "avatars");
const bannersDir = path.join(process.cwd(), "uploads", "banners");
ensureDir(avatarsDir); ensureDir(bannersDir);

const multerOpts = { limits: { fileSize: 6 * 1024 * 1024 } };
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const uid = getAuthedUserId(req) || "anon";
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${uid}_${Date.now()}${ext}`);
  },
});
const bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, bannersDir),
  filename: (req, file, cb) => {
    const uid = getAuthedUserId(req) || "anon";
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${uid}_${Date.now()}${ext}`);
  },
});
const uploadAvatar = multer({ storage: avatarStorage, ...multerOpts });
const uploadBanner = multer({ storage: bannerStorage, ...multerOpts });

function filePathToUrl(fp) {
  const rel = fp.replace(process.cwd(), "").replace(/\\/g, "/");
  return rel.startsWith("/") ? rel : `/${rel}`; // => /uploads/avatars/xxx.jpg
}

// ---------------- routes ----------------
router.get("/me", async (req, res) => {
  try {
    const uid = getAuthedUserId(req);
    if (!uid) return res.status(401).json({ message: "unauthenticated" });

    const u = await User.findById(uid).select(USER_SAFE_PROJECTION);
    if (!u) return res.status(404).json({ message: "user not found" });
    return res.json(u.toJSON ? u.toJSON() : u);
  } catch (e) {
    console.error("GET /users/me", e);
    return res.status(401).json({ message: "unauthenticated" });
  }
});

router.put("/me", async (req, res) => {
  try {
    const uid = getAuthedUserId(req);
    if (!uid) return res.status(401).json({ message: "unauthenticated" });

    const { displayName, bio, username } = req.body;
    const u = await User.findById(uid);
    if (!u) return res.status(404).json({ message: "user not found" });

    if (typeof username === "string" && username.trim()) u.username = username.trim();
    if (typeof displayName === "string") u.displayName = displayName.trim();
    if (typeof bio === "string") u.bio = bio.trim();

    const links = {
      website: req.body.website ?? req.body?.links?.website ?? u.links?.website ?? "",
      twitter: req.body.twitter ?? req.body?.links?.twitter ?? u.links?.twitter ?? "",
      youtube: req.body.youtube ?? req.body?.links?.youtube ?? u.links?.youtube ?? "",
      github: req.body.github ?? req.body?.links?.github ?? u.links?.github ?? "",
    };
    u.links = links;

    await u.save();
    const fresh = await User.findById(uid).select(USER_SAFE_PROJECTION);
    return res.json(fresh);
  } catch (e) {
    if (e?.code === 11000 && e?.keyPattern?.username) {
      return res.status(409).json({ message: "username already taken" });
    }
    console.error("PUT /users/me", e);
    return res.status(400).json({ message: "update failed" });
  }
});

router.post("/me/avatar", uploadAvatar.single("avatar"), async (req, res) => {
  try {
    const uid = getAuthedUserId(req);
    if (!uid) return res.status(401).json({ message: "unauthenticated" });
    if (!req.file) return res.status(400).json({ message: "no file" });

    const u = await User.findById(uid);
    if (!u) return res.status(404).json({ message: "user not found" });

    u.avatarUrl = filePathToUrl(req.file.path);
    await u.save();
    return res.json({ avatarUrl: u.avatarUrl });
  } catch (e) {
    console.error("POST /users/me/avatar", e);
    return res.status(400).json({ message: "upload failed" });
  }
});

router.post("/me/banner", uploadBanner.single("banner"), async (req, res) => {
  try {
    const uid = getAuthedUserId(req);
    if (!uid) return res.status(401).json({ message: "unauthenticated" });
    if (!req.file) return res.status(400).json({ message: "no file" });

    const u = await User.findById(uid);
    if (!u) return res.status(404).json({ message: "user not found" });

    u.bannerUrl = filePathToUrl(req.file.path);
    await u.save();
    return res.json({ bannerUrl: u.bannerUrl });
  } catch (e) {
    console.error("POST /users/me/banner", e);
    return res.status(400).json({ message: "upload failed" });
  }
});

/* ===== FAVORITES ===== */

// GET รายการเกมโปรด (populate เกม)
router.get("/me/favorites", async (req, res) => {
  try {
    const uid = getAuthedUserId(req);
    if (!uid) return res.status(401).json({ message: "unauthenticated" });
    const u = await User.findById(uid).populate({
      path: "favorites",
      populate: { path: "uploader", select: "username avatarUrl" },
      options: { sort: { createdAt: -1 } },
    });
    if (!u) return res.status(404).json({ message: "user not found" });
    return res.json(u.favorites || []);
  } catch (e) {
    console.error("GET /users/me/favorites", e);
    return res.status(500).json({ message: "failed" });
  }
});

// POST เพิ่มเกมเข้า favorites
router.post("/me/favorites/:gameId", async (req, res) => {
  try {
    const uid = getAuthedUserId(req);
    if (!uid) return res.status(401).json({ message: "unauthenticated" });
    const { gameId } = req.params;
    const u = await User.findById(uid);
    if (!u) return res.status(404).json({ message: "user not found" });

    const already = (u.favorites || []).some(id => String(id) === String(gameId));
    if (!already) {
      u.favorites = [...(u.favorites || []), gameId];
      await u.save();
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /users/me/favorites/:gameId", e);
    return res.status(500).json({ message: "failed" });
  }
});

// DELETE เอาเกมออกจาก favorites
router.delete("/me/favorites/:gameId", async (req, res) => {
  try {
    const uid = getAuthedUserId(req);
    if (!uid) return res.status(401).json({ message: "unauthenticated" });
    const { gameId } = req.params;
    const u = await User.findById(uid);
    if (!u) return res.status(404).json({ message: "user not found" });

    u.favorites = (u.favorites || []).filter(id => String(id) !== String(gameId));
    await u.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /users/me/favorites/:gameId", e);
    return res.status(500).json({ message: "failed" });
  }
});

module.exports = router;
