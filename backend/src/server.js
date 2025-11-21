// backend/src/server.js
require("dotenv").config();
const path = require("path");
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
const ORIGIN = process.env.CLIENT_URL || "http://localhost:5173";
const PORT = process.env.PORT || 4000;
const uploadsDir = path.join(__dirname, "..", "uploads");

// 🔴 เดิม: path.join(__dirname, "..", "frontend", "dist")
// แต่ตอนนี้โครงคือ root/frontend/dist (เป็นพี่น้องกับ backend)
// backend/src/server.js → ขึ้นไปสองขั้นถึง root → frontend/dist
const clientDir = path.join(__dirname, "..", "..", "frontend", "dist");

const isProd = process.env.NODE_ENV === "production";

// ถ้าอยู่หลัง proxy (Replit/อื่น ๆ) ให้ trust proxy
app.set("trust proxy", 1);

// ===== Parsers =====
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());

// ===== CORS =====
const corsOptions = {
  origin: ORIGIN, // บน Replit ให้ตั้ง CLIENT_URL เป็น URL ของ Repl ถ้าใช้ cross-domain
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// เผื่อ preflight ทุก path
app.options("*", cors(corsOptions));

// ===== Session + Passport =====
// ใช้ cookie แบบให้ข้ามโดเมนได้ในโหมด production
app.use(
  session({
    secret: process.env.JWT_SECRET || "devsecret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isProd, // prod → https
      sameSite: isProd ? "none" : "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());
require("./config/passport");

// ===== Static uploads (สำหรับไฟล์เกม Unity/WebGL ฯลฯ) =====
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

// ===== API Routes (public/user/admin) =====
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", commentsRoutes); // comments
app.use("/api", monthlyVoteRoutes); // monthly vote

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ===== Serve frontend (React build) =====

// เสิร์ฟไฟล์ static จาก frontend/dist
app.use(express.static(clientDir));

// SPA fallback: ถ้าไม่ใช่ /api หรือ /uploads ให้ส่ง index.html
app.get("*", (req, res) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return res.status(404).json({ message: "Not found" });
  }
  res.sendFile(path.join(clientDir, "index.html"));
});

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
