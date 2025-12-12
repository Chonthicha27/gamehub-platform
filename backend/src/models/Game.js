// backend/src/models/Game.js
const mongoose = require("mongoose");

const GameSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, index: true, trim: true },
    tagline: { type: String, default: "" },
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
    fileUrl: { type: String, required: true }, // path ที่เล่น/ดาวน์โหลดจริง
    screens: [{ type: String, default: [] }],

    // โหมดไฟล์
    kind: { type: String, enum: ["html", "download"], default: "html" },

    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // visibility:
    // - review = รออนุมัติ
    // - public = ออนไลน์ (ขึ้นหน้า home/search)
    // - unlisted = ไม่ขึ้นหน้า home/search แต่คนมีลิ้งเข้าได้
    // - private = เห็นเฉพาะเจ้าของ/แอดมิน
    // - suspended = ระงับเพราะละเมิดนโยบาย
    visibility: {
      type: String,
      enum: ["review", "public", "unlisted", "private", "suspended"],
      default: "review",
    },

    // ข้อมูลการระงับเกม (ถ้ามี)
    suspendedReason: { type: String, default: "" },
    suspendedAt: { type: Date },

    // ===== Stats (NEW) =====
    playsCount: { type: Number, default: 0 }, // จำนวนครั้งที่กดเล่น (Play)
    downloadsCount: { type: Number, default: 0 }, // จำนวนครั้งที่กดดาวน์โหลด (Download)
    lastPlayedAt: { type: Date }, // เวลาที่มีการเล่นล่าสุด
    lastDownloadedAt: { type: Date }, // เวลาที่มีการดาวน์โหลดล่าสุด

    // ===== Ratings summary =====
    ratingsCount: { type: Number, default: 0 },
    ratingsAvg: { type: Number, default: 0 },
    // index 0..4 -> 1..5 ดาว
    ratingsDist: { type: [Number], default: [0, 0, 0, 0, 0] },
  },
  { timestamps: true }
);

// indexes
GameSchema.index({ createdAt: -1 });
GameSchema.index({ category: 1 });

// (optional) ถ้าคุณจะทำหน้า “ยอดฮิต” บ่อยๆ เพิ่ม index ได้
GameSchema.index({ playsCount: -1 });
GameSchema.index({ downloadsCount: -1 });

module.exports = mongoose.model("Game", GameSchema);
