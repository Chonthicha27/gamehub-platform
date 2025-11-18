// backend/src/models/User.js
const mongoose = require("mongoose");

const LinksSchema = new mongoose.Schema(
  {
    website: { type: String, trim: true },
    twitter: { type: String, trim: true },
    youtube: { type: String, trim: true },
    github: { type: String, trim: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // ===== บัญชี/การล็อกอิน =====
    username: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 40,
      required: true,
      index: true,
      unique: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      unique: true,
      sparse: true,
    },
    githubId: { type: String, index: true, unique: true, sparse: true },
    googleId: { type: String, index: true, unique: true, sparse: true }, // เพิ่มเพื่อรองรับ Google
    passwordHash: { type: String }, // local account เท่านั้น

    // ===== บทบาท =====
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },

    // ===== สถานะการใช้งาน =====
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    suspendedReason: { type: String, default: "" },
    suspendedUntil: { type: Date, default: null },

    // ===== โปรไฟล์ =====
    displayName: { type: String, trim: true, maxlength: 80 },
    bio: { type: String, trim: true, maxlength: 1000 },

    avatarUrl: { type: String, alias: "avatar", default: "" },
    bannerUrl: { type: String, default: "" },

    links: { type: LinksSchema, default: {} },

    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Game" }],

    // ===== Email Verification =====
    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String },
    emailVerifyExpires: { type: Date },

    // ===== Password Reset =====
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        // ไม่ส่งข้อมูลสำคัญออกไป
        delete ret.passwordHash;
        delete ret.__v;
        delete ret.emailVerifyToken;
        delete ret.emailVerifyExpires;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("User", userSchema);
