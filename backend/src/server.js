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

// ✅ เวลาใช้เครื่องตัวเองเป็น Host ให้ตั้ง CLIENT_URL เป็น URL จริงที่คนจะเปิด เช่น
// http://192.168.1.114:5173  (ตั้งในไฟล์ .env)
const ORIGIN = process.env.CLIENT_URL || "http://localhost:5173";
const PORT = process.env.PORT || 4000;
const uploadsDir = path.join(__dirname, "..", "uploads");

app.set("trust proxy", 1); // ถ้า reverse proxy ในอนาคต

// ===== Parsers =====
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());

// ===== CORS =====
const corsOptions = {
  origin: ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// เผื่อ preflight ทุก path
app.options("*", cors(corsOptions));

// ===== Session + Passport =====
const cookieSecure =
  String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true";

app.use(
  session({
    secret: process.env.JWT_SECRET || "devsecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "lax",
      secure: cookieSecure,
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

// ===== Routes (public/user/admin) =====
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", commentsRoutes);       // comments
app.use("/api", monthlyVoteRoutes);    // monthly vote

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

// ✅ ฟังทุก IP (0.0.0.0) ให้เครื่องอื่นในวงแลนยิงเข้ามาได้
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on http://0.0.0.0:${PORT} (PORT=${PORT})`);
  console.log(`CORS origin: ${ORIGIN}`);
});
