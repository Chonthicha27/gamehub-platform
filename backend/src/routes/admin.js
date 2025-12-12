// backend/src/routes/admin.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const fsp = fs.promises;
const { authRequired, requireAdmin } = require("../middleware/auth");
const User = require("../models/User");
const Game = require("../models/Game");
const Comment = require("../models/Comment");
const { sendMail } = require("../utils/mailer");

router.use(authRequired, requireAdmin);

/* ===== Users ===== */
router.get("/users", async (_req, res) => {
  const users = await User.find()
    .select("-passwordHash -__v")
    .sort("-createdAt")
    .lean();
  res.json(users);
});

router.patch("/users/:id", async (req, res) => {
  const { role, status, reason, days } = req.body || {};

  if (role) {
    if (!["user", "admin"].includes(role))
      return res.status(400).json({ message: "invalid role" });
    const u = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );
    if (!u) return res.status(404).json({ message: "User not found" });
    return res.json(u);
  }

  if (status === "suspended") {
    const until = new Date(Date.now() + Number(days || 7) * 86400000);
    const u = await User.findByIdAndUpdate(
      req.params.id,
      {
        status: "suspended",
        suspendedReason: reason || "violation",
        suspendedUntil: until,
      },
      { new: true }
    );
    if (!u) return res.status(404).json({ message: "User not found" });
    return res.json(u);
  }

  if (status === "active") {
    const u = await User.findByIdAndUpdate(
      req.params.id,
      { status: "active", suspendedReason: "", suspendedUntil: null },
      { new: true }
    );
    if (!u) return res.status(404).json({ message: "User not found" });
    return res.json(u);
  }

  return res.status(400).json({ message: "no changes" });
});

router.delete("/users/:id", async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: "User not found" });

  const games = await Game.find({ uploader: u._id });
  for (const g of games) {
    const parts = (g.fileUrl || g.coverUrl || "").split("/");
    const gameId = parts.length >= 4 ? parts[3] : null;
    if (gameId) {
      const dir = path.join(__dirname, "../../uploads/games", gameId);
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  await Game.deleteMany({ uploader: u._id });
  await u.deleteOne();
  res.json({ ok: true });
});

/* ===== Games ===== */

/**
 * ✅ PENDING = user ขอ public จริง ๆ เท่านั้น
 */
router.get("/games/pending", async (_req, res) => {
  const games = await Game.find({
    visibility: "review",
    requestedVisibility: "public",
  })
    .sort("-createdAt")
    .populate("uploader", "username email")
    .lean();
  res.json(games);
});

/**
 * ✅ Approve: review → public (FIXED)
 */
router.patch("/games/:id/approve", async (req, res) => {
  const game = await Game.findById(req.params.id).populate(
    "uploader",
    "username email"
  );
  if (!game) return res.status(404).json({ message: "Not found" });

  // อนุมัติเฉพาะกรณีที่อยู่ review และขอ public
  if (game.visibility !== "review" || game.requestedVisibility !== "public") {
    return res.status(400).json({ message: "No public request to approve" });
  }

  game.visibility = "public";
  game.requestedVisibility = "";          // ✅ เคลียร์คำขอ
  game.visibilityRequestedAt = null;      // ✅ เคลียร์เวลา
  game.suspendedReason = "";
  game.suspendedAt = null;
  await game.save();

  const email = game.uploader?.email;
  if (email) {
    await sendMail({
      to: email,
      subject: `เกมของคุณ "${game.title}" ผ่านการอนุมัติแล้ว 🎮`,
      text: `เกมของคุณ "${game.title}" ได้รับการอนุมัติและเผยแพร่แล้ว`,
    }).catch(() => {});
  }

  res.json({ game });
});

/**
 * Admin เห็นเกมทั้งหมด
 */
router.get("/games", async (_req, res) => {
  const games = await Game.find()
    .sort("-createdAt")
    .populate("uploader", "username email")
    .lean();
  res.json(games);
});

/**
 * Suspend
 */
router.patch("/games/:id/suspend", async (req, res) => {
  const game = await Game.findById(req.params.id).populate(
    "uploader",
    "username email"
  );
  if (!game) return res.status(404).json({ message: "Not found" });

  game.visibility = "suspended";
  game.suspendedReason = req.body?.reason || "";
  game.suspendedAt = new Date();
  await game.save();

  res.json({ game });
});

/**
 * ✅ Unsuspend: กลับตาม requestedVisibility
 * - ถ้าเคย public มาก่อน (requestedVisibility="public") ก็กลับ public
 * - ถ้าไม่ใช่ ก็กลับ review เป็นค่าเริ่มต้นปลอดภัย
 */
router.patch("/games/:id/unsuspend", async (req, res) => {
  const game = await Game.findById(req.params.id);
  if (!game) return res.status(404).json({ message: "Not found" });

  game.visibility = game.requestedVisibility === "public" ? "public" : "review";
  game.suspendedReason = "";
  game.suspendedAt = null;
  await game.save();

  res.json({ game });
});

/**
 * DELETE game
 */
router.delete("/games/:id", async (req, res) => {
  const game = await Game.findById(req.params.id).populate(
    "uploader",
    "username email"
  );
  if (!game) return res.status(404).json({ message: "Not found" });

  await game.deleteOne();
  res.json({ ok: true });
});

/* ===== Comments ===== */

router.get("/comments", async (req, res) => {
  const comments = await Comment.find()
    .sort("-createdAt")
    .populate("author", "username email")
    .populate("game", "title slug")
    .lean();
  res.json(comments);
});

router.patch("/comments/:id/hide", async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ message: "Not found" });

  c.status = "hidden";
  c.moderationReason = req.body?.reason || "";
  await c.save();
  res.json(c);
});

router.patch("/comments/:id/restore", async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ message: "Not found" });

  c.status = "visible";
  await c.save();
  res.json(c);
});

router.delete("/comments/:id", async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ message: "Not found" });

  await c.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
