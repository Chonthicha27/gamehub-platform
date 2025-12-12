// backend/src/models/Game.js
const mongoose = require("mongoose");

const GameSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, index: true, trim: true },
    tagline: { type: String, default: "" },
    description: { type: String, default: "" },

    // หมวดหมู่หลักของเกม
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
    fileUrl: { type: String, required: true },
    screens: [{ type: String, default: [] }],

    // โหมดไฟล์
    kind: { type: String, enum: ["html", "download"], default: "html" },

    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /**
     * visibility:
     * - public     = เผยแพร่แล้ว
     * - unlisted   = มีลิงก์เข้าได้
     * - private    = เจ้าของ/แอดมิน
     * - review     = รอแอดมินอนุมัติ
     * - suspended  = ระงับ
     */
    visibility: {
      type: String,
      enum: ["public", "unlisted", "private", "review", "suspended"],
      default: "review", // ✅ FIX: ห้าม default เป็น public
    },

    /**
     * สิ่งที่ user ขอ (ต้องรอแอดมิน)
     * เช่น ขอ public → visibility=review, requestedVisibility=public
     */
    requestedVisibility: {
      type: String,
      enum: ["", "public"],
      default: "",
    },
    visibilityRequestedAt: { type: Date },

    // ระงับ
    suspendedReason: { type: String, default: "" },
    suspendedAt: { type: Date },

    // ===== Stats =====
    playsCount: { type: Number, default: 0 },
    downloadsCount: { type: Number, default: 0 },
    lastPlayedAt: { type: Date },
    lastDownloadedAt: { type: Date },

    // ===== Ratings =====
    ratingsCount: { type: Number, default: 0 },
    ratingsAvg: { type: Number, default: 0 },
    ratingsDist: { type: [Number], default: [0, 0, 0, 0, 0] },
  },
  { timestamps: true }
);

// indexes
GameSchema.index({ createdAt: -1 });
GameSchema.index({ category: 1 });
GameSchema.index({ playsCount: -1 });
GameSchema.index({ downloadsCount: -1 });

module.exports = mongoose.model("Game", GameSchema);
