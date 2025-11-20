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
const isProd = process.env.NODE_ENV === "production";

// ใช้ SERVER_URL เป็น origin จริงของ backend (เช่น https://gpx-api-h6r0.onrender.com)
const SERVER_ORIGIN =
  (process.env.SERVER_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");

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

/**
 * ===== Rewrite "localhost" URL ในทุก res.json =====
 * ใช้ในกรณีที่ในฐานข้อมูลยังเก็บ URL เป็น http://localhost:4000/...
 * เราจะแปลงให้เป็น SERVER_ORIGIN ก่อนส่งให้ frontend เสมอ
 */
const LOCAL_HOST_RE = /https?:\/\/localhost(?::\d+)?/gi;

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    try {
      if (body && typeof body === "object") {
        let str = JSON.stringify(body);
        LOCAL_HOST_RE.lastIndex = 0;
        if (LOCAL_HOST_RE.test(str)) {
          str = str.replace(LOCAL_HOST_RE, SERVER_ORIGIN);
          return originalJson(JSON.parse(str));
        }
      }
    } catch (err) {
      console.error("[rewriteOrigin] error:", err);
    }
    return originalJson(body);
  };

  next();
});

// ===== Session + Passport =====
// สำคัญ: cookie ข้ามโดเมนได้ ต้อง SameSite: 'none' + secure: true
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
