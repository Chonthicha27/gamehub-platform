// backend/src/models/MonthlyVote.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const MonthlyVoteSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    game: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
      index: true,
    },
    // YYYY-MM เช่น "2025-11"
    monthKey: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// 1 user โหวตได้ 1 ครั้งต่อเดือน
MonthlyVoteSchema.index({ user: 1, monthKey: 1 }, { unique: true });

// index สำหรับนับ/จัดอันดับเกมในแต่ละเดือน
MonthlyVoteSchema.index({ game: 1, monthKey: 1 });

/**
 * Helper สำหรับดึง leaderboard ของเดือนนั้น ๆ
 * ใช้หรือไม่ใช้ก็ได้ ฝั่ง route สามารถเรียกได้โดยตรง
 */
MonthlyVoteSchema.statics.getLeaderboard = function (monthKey, limit = 50) {
  return this.aggregate([
    { $match: { monthKey } },
    { $group: { _id: "$game", votes: { $sum: 1 } } },
    { $sort: { votes: -1 } },
    { $limit: limit },
  ]);
};

module.exports = mongoose.model("MonthlyVote", MonthlyVoteSchema);
