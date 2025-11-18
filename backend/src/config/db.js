// backend/src/config/db.js
const mongoose = require("mongoose");

// ถ้าไม่ตั้งค่า env เลย จะ fallback มาใช้ localhost
const DEFAULT_LOCAL_URI = "mongodb://127.0.0.1:27017/gpx";

async function connectDB() {
  // รองรับทั้งชื่อใหม่ MONGO_URI และชื่อเดิม MONGO_URL
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    DEFAULT_LOCAL_URI;

  if (!uri) {
    throw new Error("Missing MONGO_URI / MONGO_URL");
  }

  try {
    await mongoose.connect(uri, {
      autoIndex: true,
    });

    const isAtlas = uri.startsWith("mongodb+srv://");
    console.log(
      `✅ MongoDB connected (${isAtlas ? "Atlas" : "local"})`
    );
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
