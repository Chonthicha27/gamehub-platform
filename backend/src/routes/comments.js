// backend/src/routes/comments.js
const express = require("express");
const router = express.Router();
const { authRequired } = require("../middleware/auth");
const Comment = require("../models/Comment");
const Game = require("../models/Game");

/**
 * GET /api/games/:gameId/comments
 * ดึงคอมเมนต์ของเกมนั้น ๆ (เฉพาะ status = visible)
 */
router.get("/games/:gameId/comments", async (req, res) => {
  try {
    const gameId = req.params.gameId;

    const game = await Game.findById(gameId).select("_id visibility");
    if (!game) return res.status(404).json({ message: "Game not found" });

    // ที่นี่จะอนุญาตเฉพาะ public
    if (game.visibility !== "public") {
      return res.json([]);
    }

    const comments = await Comment.find({
      game: gameId,
      status: "visible",
    })
      .sort("createdAt")
      .populate("author", "username")
      .lean();

    res.json(comments);
  } catch (err) {
    console.error("[comments] list error:", err);
    res.status(500).json({ message: "Failed to load comments" });
  }
});

/**
 * POST /api/games/:gameId/comments
 * สร้างคอมเมนต์ใหม่ (ต้องล็อกอิน)
 * body: { content }
 */
router.post("/games/:gameId/comments", authRequired, async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const { content } = req.body || {};
    const userId = req.user._id;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    const game = await Game.findById(gameId).select("_id visibility");
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (game.visibility !== "public") {
      return res
        .status(400)
        .json({ message: "Cannot comment on non-public game" });
    }

    const comment = await Comment.create({
      game: gameId,
      author: userId,
      content: content.trim(),
    });

    const populated = await comment
      .populate("author", "username")
      .then((c) => c.toObject());

    res.status(201).json(populated);
  } catch (err) {
    console.error("[comments] create error:", err);
    res.status(500).json({ message: "Failed to create comment" });
  }
});

/**
 * POST /api/comments/:id/report
 * ผู้ใช้ report คอมเมนต์ว่าไม่เหมาะสม
 * body: { reason }
 */
router.post("/comments/:id/report", authRequired, async (req, res) => {
  try {
    const commentId = req.params.id;
    const { reason = "" } = req.body || {};
    const userId = req.user._id;

    const comment = await Comment.findById(commentId).populate(
      "author",
      "username"
    );
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // ไม่ให้ report คอมเมนต์ตัวเอง
    if (String(comment.author?._id) === String(userId)) {
      return res
        .status(400)
        .json({ message: "You cannot report your own comment" });
    }

    // เช็คว่า user นี้เคย report คอมเมนต์นี้แล้วหรือยัง
    const already = comment.reports?.some(
      (r) => String(r.reporter) === String(userId)
    );
    if (already) {
      return res.status(400).json({ message: "You already reported this" });
    }

    // ✅ ให้แน่ใจก่อนว่า reports เป็น array
    if (!Array.isArray(comment.reports)) {
      comment.reports = [];
    }

    comment.reports.push({
      reporter: userId,
      reason: reason || "",
      createdAt: new Date(),
    });
    comment.reportsCount = (comment.reportsCount || 0) + 1;

    await comment.save();

    res.json({
      message: "Report submitted",
      commentId: comment._id,
      reportsCount: comment.reportsCount,
    });
  } catch (err) {
    console.error("[comments] report error:", err);
    res.status(500).json({ message: "Failed to report comment" });
  }
});

module.exports = router;
