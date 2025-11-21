// backend/src/config/db.js
const mongoose = require("mongoose");

async function connectDB() {
  // ใช้ค่าจาก ENV เท่านั้น (ไม่ fallback ไป localhost)
  const uri = process.env.MONGO_URI || process.env.MONGO_URL;

  if (!uri) {
    console.error("[db] ❌ MONGO_URI / MONGO_URL is not set");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      autoIndex: true,
    });

    const isAtlas = uri.startsWith("mongodb+srv://");
    console.log(
      `✅ MongoDB connected (${isAtlas ? "Atlas" : "Mongo"})`
    );
  } catch (err) {
    console.error("[db] ❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

module.exports = connectDB;
