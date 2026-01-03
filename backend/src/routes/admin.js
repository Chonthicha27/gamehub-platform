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
    const u = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
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

router.patch("/games/:id/approve", async (req, res) => {
  const game = await Game.findById(req.params.id).populate("uploader", "username email");
  if (!game) return res.status(404).json({ message: "Not found" });

  if (game.visibility !== "review" || game.requestedVisibility !== "public") {
    return res.status(400).json({ message: "No public request to approve" });
  }

  game.visibility = "public";
  game.requestedVisibility = "";
  game.visibilityRequestedAt = null;
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

router.get("/games", async (_req, res) => {
  const games = await Game.find()
    .sort("-createdAt")
    .populate("uploader", "username email")
    .lean();
  res.json(games);
});

router.patch("/games/:id/suspend", async (req, res) => {
  const game = await Game.findById(req.params.id).populate("uploader", "username email");
  if (!game) return res.status(404).json({ message: "Not found" });

  game.visibility = "suspended";
  game.suspendedReason = req.body?.reason || "";
  game.suspendedAt = new Date();
  await game.save();

  res.json({ game });
});

router.patch("/games/:id/unsuspend", async (req, res) => {
  const game = await Game.findById(req.params.id);
  if (!game) return res.status(404).json({ message: "Not found" });

  game.visibility = game.requestedVisibility === "public" ? "public" : "review";
  game.suspendedReason = "";
  game.suspendedAt = null;
  await game.save();

  res.json({ game });
});

router.delete("/games/:id", async (req, res) => {
  const game = await Game.findById(req.params.id).populate("uploader", "username email");
  if (!game) return res.status(404).json({ message: "Not found" });

  await game.deleteOne();
  res.json({ ok: true });
});

/* ===== Comments ===== */

// ✅ Admin ไม่เห็นคอมเมนต์ที่ hidden (เหมือน role อื่นๆ)
router.get("/comments", async (_req, res) => {
  const comments = await Comment.find({
    status: { $ne: "deleted" },          // ไม่เอา deleted
    reportsCount: { $gt: 0 },            // เอาเฉพาะที่มี report
  })
    .sort("-createdAt")
    .populate("author", "username email")
    .populate("game", "title slug")
    .populate("reports.reporter", "username email")
    .lean();

  res.json(comments);
});


// ✅ FIX: hide ต้อง save จริง + ซ่อน replies ด้วย + เก็บคนซ่อน/เวลา
router.patch("/comments/:id/hide", async (req, res) => {
  const reason = (req.body?.reason || "").trim();
  const adminId = req.user?._id;

  const updated = await Comment.findByIdAndUpdate(
    req.params.id,
    {
      status: "hidden",
      moderationReason: reason,
      moderatedBy: adminId || null,
      moderatedAt: new Date(),
    },
    { new: true, runValidators: true }
  )
    .populate("author", "username email")
    .populate("game", "title slug")
    .populate("reports.reporter", "username email")
    .lean();

  if (!updated) return res.status(404).json({ message: "Not found" });

  // ซ่อน replies ของคอมเมนต์นี้ด้วย
  await Comment.updateMany(
    { parentId: updated._id },
    {
      $set: {
        status: "hidden",
        moderationReason: reason,
        moderatedBy: adminId || null,
        moderatedAt: new Date(),
      },
    }
  );

  res.json(updated);
});

// ✅ restore ก็ restore replies ด้วย
router.patch("/comments/:id/restore", async (req, res) => {
  const adminId = req.user?._id;

  const updated = await Comment.findByIdAndUpdate(
    req.params.id,
    {
      status: "visible",
      moderationReason: "",
      moderatedBy: adminId || null,
      moderatedAt: new Date(),
    },
    { new: true, runValidators: true }
  )
    .populate("author", "username email")
    .populate("game", "title slug")
    .populate("reports.reporter", "username email")
    .lean();

  if (!updated) return res.status(404).json({ message: "Not found" });

  // restore replies ของคอมเมนต์นี้ด้วย
  await Comment.updateMany(
    { parentId: updated._id },
    { $set: { status: "visible" } }
  );

  res.json(updated);
});

router.delete("/comments/:id", async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) return res.status(404).json({ message: "Not found" });

  await c.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
