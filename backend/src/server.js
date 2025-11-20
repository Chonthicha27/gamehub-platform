// backend/src/server.js
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("passport");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const gamesRoutes = require("./routes/games");
const adminRoutes = require("./routes/admin");
const commentsRoutes = require("./routes/comments");
const monthlyVoteRoutes = require("./routes/monthlyVote");

const app = express();
connectDB();

// ===== Env / Config =====
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CLIENT_URL || "http://localhost:5173";
const uploadsDir = path.join(__dirname, "..", "uploads");
const isProd = process.env.NODE_ENV === "production";

/**
 * ต้นทางของ API/CDN ที่จะใช้แทน localhost ในไฟล์เกมเวลา host จริง
 * ปรับค่าได้จาก ENV: CDN_ORIGIN / SERVER_URL / API_ORIGIN
 */
const PUBLIC_ORIGIN =
  process.env.CDN_ORIGIN ||
  process.env.SERVER_URL ||
  process.env.API_ORIGIN ||
  (isProd
    ? process.env.RENDER_EXTERNAL_URL || ""
    : `http://localhost:${PORT}`) ||
  `http://localhost:${PORT}`;

console.log("[server] PUBLIC_ORIGIN =", PUBLIC_ORIGIN);

// ถ้าอยู่หลัง proxy (Render) ให้ trust proxy
app.set("trust proxy", 1);

// ===== Parsers =====
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());

// ===== CORS =====
const corsOptions = {
  origin: ORIGIN, // เช่น https://gamehub-platform-nine.vercel.app
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// preflight ทุก path
app.options("*", cors(corsOptions));

// ===== Session + Passport =====
// สำคัญ: ให้ cookie ข้ามโดเมนได้ ต้อง SameSite: 'none' + secure: true
app.use(
  session({
    secret: process.env.JWT_SECRET || "devsecret",
    resave: false,
    saveUninitialized: false,
    proxy: true, // ให้เคารพค่า trust proxy เวลาเช็ค secure
    cookie: {
      httpOnly: true,
      secure: isProd, // บน Render เป็น https → true, dev local → false
      sameSite: isProd ? "none" : "lax", // โปรดักชันข้ามโดเมน, dev ใช้ lax พอ
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());
require("./config/passport");

/* ============================================================
   🧩 ฟังก์ชันช่วย patch HTML ของ Unity/WebGL
   - เปลี่ยน http://localhost:xxxx เป็น PUBLIC_ORIGIN
   - แก้ path ที่ขึ้นต้นด้วย "/Build" ให้เป็น "Build" เฉย ๆ
   ============================================================ */
function patchUnityHTML(rawHtml) {
  if (!rawHtml) return rawHtml;

  return rawHtml
    // แทน localhost ทุก port ด้วย PUBLIC_ORIGIN
    .replace(/http:\/\/localhost:\d+/g, PUBLIC_ORIGIN)
    .replace(/http:\/\/127\.0\.0\.1:\d+/g, PUBLIC_ORIGIN)
    // กันเคส path เริ่มด้วย /Build ให้กลายเป็น relative path
    .replace(/"\/Build/g, `"Build`)
    .replace(/'\/Build/g, `'Build`);
}

/**
 * เสิร์ฟ index.html ของเกม โดยแก้เนื้อหาให้อัตโนมัติ
 * ต้องมาก่อน app.use("/uploads", express.static(...))
 */
app.get("/uploads/*/index.html", (req, res, next) => {
  try {
    // req.path เช่น /uploads/xxxx/Build/index.html
    const relPath = req.path.replace(/^\/uploads[\\/]/, "");
    const filePath = path.join(uploadsDir, relPath);

    if (!fs.existsSync(filePath)) {
      return next(); // ให้ static ไปจัดการ 404 ต่อ
    }

    let html = fs.readFileSync(filePath, "utf8");
    html = patchUnityHTML(html);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (err) {
    console.error("[unity-html] error:", err);
    return next(err);
  }
});

// ===== Static uploads (Unity/WebGL ฯลฯ) =====
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      const p = filePath.toLowerCase();

      if (p.endsWith(".wasm") || p.endsWith(".wasm.gz") || p.endsWith(".wasm.br")) {
        res.setHeader("Content-Type", "application/wasm");
      } else if (
        p.endsWith(".data") ||
        p.endsWith(".data.gz") ||
        p.endsWith(".data.br") ||
        p.endsWith(".unityweb")
      ) {
        res.setHeader("Content-Type", "application/octet-stream");
      } else if (p.endsWith(".js") || p.endsWith(".js.gz") || p.endsWith(".js.br")) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      } else if (p.endsWith(".json")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      } else if (p.endsWith(".rar")) {
        res.setHeader("Content-Type", "application/x-rar-compressed");
      }

      if (p.endsWith(".gz")) res.setHeader("Content-Encoding", "gzip");
      if (p.endsWith(".br") || p.endsWith(".unityweb")) {
        res.setHeader("Content-Encoding", "br");
      }

      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  })
);

// ===== Routes (public/user/admin) =====
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", commentsRoutes); // comments
app.use("/api", monthlyVoteRoutes); // monthly vote

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ===== Error handler =====
app.use((err, _req, res, next) => {
  if (err && err.code && err.field) {
    console.error("[multer]", err);
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    console.error("[error]", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`API running http://localhost:${PORT}`);
});
