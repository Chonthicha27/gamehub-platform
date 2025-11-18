// backend/src/models/Comment.js
const mongoose = require("mongoose");

const { Schema } = mongoose;

const ReportSchema = new Schema(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CommentSchema = new Schema(
  {
    game: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
      index: true,
    },

    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    content: { type: String, required: true, trim: true },

    // visible   = แสดงผลปกติ
    // hidden    = แอดมินซ่อนเพราะไม่เหมาะสม
    // deleted   = ลบถาวร (จริง ๆ แล้วเราจะ delete ออกจาก DB ไปเลยในบางกรณี)
    status: {
      type: String,
      enum: ["visible", "hidden", "deleted"],
      default: "visible",
      index: true,
    },

    // เหตุผลที่แอดมินซ่อน/ปรับสถานะ
    moderationReason: { type: String, default: "" },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    moderatedAt: { type: Date },

    // การรายงานจากผู้ใช้
    reports: { type: [ReportSchema], default: [] },
    reportsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// index เพื่อให้ query admin / เกม เร็วขึ้น
CommentSchema.index({ createdAt: -1 });
CommentSchema.index({ game: 1, createdAt: -1 });
CommentSchema.index({ reportsCount: -1 });

module.exports = mongoose.model("Comment", CommentSchema);
