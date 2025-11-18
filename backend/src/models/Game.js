// backend/src/models/Game.js
const mongoose = require("mongoose");

const GameSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    slug:        { type: String, index: true, trim: true },
    tagline:     { type: String, default: "" },
    description: { type: String, default: "" },

    // หมวดหมู่หลักของเกม (Genre แบบ itch.io)
    category: {
      type: String,
      enum: [
        "no-genre",
        "action",
        "adventure",
        "card-game",
        "educational",
        "fighting",
        "interactive-fiction",
        "platformer",
        "puzzle",
        "racing",
        "rhythm",
        "role-playing",
        "shooter",
        "simulation",
        "sports",
        "strategy",
        "survival",
        "visual-novel",
        "other",
      ],
      default: "no-genre",
    },

    tags: [{ type: String }],

    // ไฟล์/รูป
    coverUrl: { type: String, default: "" },
    fileUrl:  { type: String, required: true }, // path ที่เล่น/ดาวน์โหลดจริง
    screens:  [{ type: String, default: [] }],

    // โหมดไฟล์
    kind: { type: String, enum: ["html", "download"], default: "html" },

    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // visibility: review = รออนุมัติ, public = ออนไลน์, suspended = ระงับเพราะละเมิดนโยบาย
    visibility: {
      type: String,
      enum: ["review", "public", "suspended"],
      default: "review",
    },

    // ข้อมูลการระงับเกม (ถ้ามี)
    suspendedReason: { type: String, default: "" },
    suspendedAt: { type: Date },

    // ===== Ratings summary =====
    ratingsCount: { type: Number, default: 0 },
    ratingsAvg:   { type: Number, default: 0 },
    // index 0..4 -> 1..5 ดาว
    ratingsDist:  { type: [Number], default: [0, 0, 0, 0, 0] },
  },
  { timestamps: true }
);

// indexes
GameSchema.index({ createdAt: -1 });
GameSchema.index({ category: 1 });

module.exports = mongoose.model("Game", GameSchema);
