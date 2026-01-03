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

    // ✅ ADD
    description: { type: String, default: "", trim: true },

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

    // ✅ reply support
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },

    // visible = แสดง
    // hidden  = ซ่อนโดยแอดมิน
    // deleted = ลบ
    status: {
      type: String,
      enum: ["visible", "hidden", "deleted"],
      default: "visible",
      index: true,
    },

    moderationReason: { type: String, default: "", trim: true },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    moderatedAt: { type: Date, default: null },

    reports: { type: [ReportSchema], default: [] },
    reportsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// indexes
CommentSchema.index({ createdAt: -1 });
CommentSchema.index({ game: 1, createdAt: -1 });
CommentSchema.index({ reportsCount: -1 });
CommentSchema.index({ game: 1, parentId: 1, createdAt: 1 });

module.exports = mongoose.model("Comment", CommentSchema);
