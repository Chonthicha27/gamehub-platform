// backend/src/routes/monthlyVote.js
const express = require("express");
const router = express.Router();
const { authRequired } = require("../middleware/auth");

const MonthlyVote = require("../models/MonthlyVote");
const Game = require("../models/Game");
const { getMonthKey } = require("../utils/date");

/**
 * POST /api/games/:id/monthly-vote
 * ผู้ใช้โหวตเกมประจำเดือน:
 *  - 1 user โหวตได้ 1 เกมต่อเดือน (ถ้าเปลี่ยนใจก็เปลี่ยนเกมได้)
 *  - ใช้ monthKey จาก getMonthKey() เช่น "2025-11"
 */
router.post("/games/:id/monthly-vote", authRequired, async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user._id;
    const monthKey = getMonthKey();

    const game = await Game.findById(gameId);
    if (!game || game.visibility !== "public") {
      return res
        .status(404)
        .json({ message: "Game not found or not public" });
    }

    // upsert: ถ้าเคยโหวตเดือนนี้ → อัปเดตเป็นเกมใหม่
    const vote = await MonthlyVote.findOneAndUpdate(
      { user: userId, monthKey },
      { user: userId, game: gameId, monthKey },
      { new: true, upsert: true }
    );

    res.json({ ok: true, vote });
  } catch (err) {
    console.error("[monthly-vote error]", err);
    res.status(500).json({ message: "Failed to vote" });
  }
});

/**
 * GET /api/games/:id/monthly-vote/me
 * เช็คว่าผู้ใช้คนนี้โหวตอะไรในเดือนปัจจุบัน
 */
router.get("/games/:id/monthly-vote/me", authRequired, async (req, res) => {
  try {
    const userId = req.user._id;
    const gameId = req.params.id;
    const monthKey = getMonthKey();

    const vote = await MonthlyVote.findOne({ user: userId, monthKey });

    res.json({
      voted: !!vote && String(vote.game) === gameId,
      gameVoted: vote?.game || null,
    });
  } catch (err) {
    console.error("[monthly-vote me error]", err);
    res.status(500).json({ message: "Failed" });
  }
});

/**
 * GET /api/monthly-vote/leaderboard?month=2025-11
 * ดึง leaderboard ของเดือนนั้น ๆ (ใช้ได้ทั้งหน้า user และหน้า admin)
 * รูปแบบผลลัพธ์:
 * [
 *   { _id: <Game>, votes: <number> },
 *   ...
 * ]
 */
router.get("/monthly-vote/leaderboard", async (req, res) => {
  try {
    const month = req.query.month || getMonthKey();

    const agg = await MonthlyVote.aggregate([
      { $match: { monthKey: month } },
      { $group: { _id: "$game", votes: { $sum: 1 } } },
      { $sort: { votes: -1 } },
      { $limit: 50 },
    ]);

    const results = await Game.populate(agg, {
      path: "_id",
      select: "title coverUrl uploader slug visibility",
    });

    res.json(results);
  } catch (err) {
    console.error("[monthly-vote leaderboard error]", err);
    res.status(500).json({ message: "Failed to load leaderboard" });
  }
});

module.exports = router;
