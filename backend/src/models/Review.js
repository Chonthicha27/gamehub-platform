const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    game:  { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true, index: true },
    user:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    score: { type: Number, min: 1, max: 5, required: true },
    text:  { type: String, default: "" }, // เก็บเป็น markdown/ข้อความธรรมดา
  },
  { timestamps: true }
);

// จำกัด 1 ผู้ใช้รีวิว 1 เกม (แก้ทับได้)
ReviewSchema.index({ game: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Review", ReviewSchema);
