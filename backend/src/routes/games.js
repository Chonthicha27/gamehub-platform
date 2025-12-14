// backend/src/routes/games.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const multer = require("multer");
const AdmZip = require("adm-zip");
const { v4: uuid } = require("uuid");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const { getStorage } = require("firebase-admin/storage");

let Game;
let Review;
let MonthlyVote;
let Comment;

try {
  Game = require("../models/Game");
} catch (e) {
  console.error("models/Game not found");
  process.exit(1);
}
try {
  Review = require("../models/Review");
} catch (e) {
  console.error("models/Review not found");
  process.exit(1);
}
try {
  MonthlyVote = require("../models/MonthlyVote");
} catch (e) {
  console.error("models/MonthlyVote not found (monthly vote feature disabled)");
}
try {
  Comment = require("../models/Comment");
} catch (e) {
  console.error("models/Comment not found (comments feature disabled)");
}

const router = express.Router();

/* ===== Firebase Storage config (optional) ===== */
let useFirebase = false;
let firebaseBucket = null;

const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT || "";
const FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "";
const FIREBASE_KEY_PREFIX = process.env.FIREBASE_KEY_PREFIX || "games"; // prefix เช่น "games"

function initFirebaseBucket() {
  if (firebaseBucket) return firebaseBucket;

  if (!FIREBASE_SERVICE_ACCOUNT || !FIREBASE_STORAGE_BUCKET) {
    console.warn(
      "[games] Firebase not fully configured (FIREBASE_SERVICE_ACCOUNT / FIREBASE_STORAGE_BUCKET) – fallback to local uploads"
    );
    return null;
  }

  let serviceAccountObj;
  try {
    serviceAccountObj = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error("[games] parse FIREBASE_SERVICE_ACCOUNT failed:", err.message || err);
    return null;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountObj),
        storageBucket: FIREBASE_STORAGE_BUCKET,
      });
    }
    const storage = getStorage();
    firebaseBucket = storage.bucket(FIREBASE_STORAGE_BUCKET);
    useFirebase = true;
    console.log("[games] Firebase Storage enabled:", FIREBASE_STORAGE_BUCKET);
  } catch (err) {
    console.error(
      "[games] Firebase admin init failed, fallback to local uploads:",
      err.message || err
    );
    firebaseBucket = null;
    useFirebase = false;
  }

  return firebaseBucket;
}

initFirebaseBucket();

/* ===== auth ===== */
function authRequired(req, res, next) {
  // 1) กรณี login ด้วย session/passport (เช่น GitHub OAuth)
  if (req.isAuthenticated && req.isAuthenticated()) {
    if (req.user?._id) return next();
    if (req.user?.id) {
      req.user._id = String(req.user.id);
      return next();
    }
  }

  // 2) กรณีส่ง Bearer JWT มา (เช่น login แบบ token)
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET || "devsecret");
      req.user = { _id: String(payload.id || payload.uid), role: payload.role };
      return next();
    } catch {}
  }

  return res.status(401).json({ message: "Unauthorized" });
}

function readOptionalUser(req, _res, next) {
  // ถ้ามี session อยู่แล้ว ก็ใช้เลย
  if (req.isAuthenticated && req.isAuthenticated()) {
    if (req.user?._id) return next();
    if (req.user?.id) {
      req.user._id = String(req.user.id);
      return next();
    }
  }

  // ถ้าไม่มี session ลองอ่านจาก Bearer token
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET || "devsecret");
      req.user = { _id: String(payload.id || payload.uid), role: payload.role };
    } catch {}
  }
  next();
}

/* ===== uploads (local temp) ===== */
const tmpDir = path.join(__dirname, "../../tmp");
fs.mkdirSync(tmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tmpDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${uuid()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

// root เดิมสำหรับเก็บไฟล์ local (ยังเก็บไว้เป็น fallback)
const uploadsRoot = path.join(__dirname, "../../uploads");

/* ===== helpers ===== */

async function findIndexHtml(rootDir) {
  const stack = [""];
  while (stack.length) {
    const rel = stack.pop();
    const full = path.join(rootDir, rel);
    const entries = await fsp.readdir(full, { withFileTypes: true });
    for (const e of entries) {
      const relPath = path.join(rel, e.name);
      const fullPath = path.join(rootDir, relPath);
      if (e.isDirectory()) stack.push(relPath);
      else if (/^index\.html?$/i.test(e.name))
        return { rel: relPath.replace(/\\/g, "/"), full: fullPath };
    }
  }
  return null;
}

async function moveFile(src, dest) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fsp.rename(src, dest);
  } catch {
    await fsp.copyFile(src, dest);
    await fsp.unlink(src).catch(() => {});
  }
}

async function safeUnlink(p) {
  try {
    await fsp.unlink(p);
  } catch {}
}

// ลบโฟลเดอร์ local ทั้งก้อน
async function rmrf(dir) {
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch {}
}

/* ===== Firebase helpers ===== */

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html";
  if (ext === ".zip") return "application/zip";
  if (ext === ".js") return "text/javascript";
  if (ext === ".css") return "text/css";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".rar") return "application/x-rar-compressed";
  if (ext === ".wasm") return "application/wasm";
  return "application/octet-stream";
}

function getFirebasePublicUrl(key) {
  const cleanKey = key.replace(/^\/+/, "");
  if (!FIREBASE_STORAGE_BUCKET) return null;
  return `https://storage.googleapis.com/${FIREBASE_STORAGE_BUCKET}/${encodeURI(cleanKey)}`;
}

/**
 * เลือก metadata ให้เหมาะกับ Unity WebGL + ไฟล์ที่ถูกบีบอัด (.br / .gz)
 */
function buildFirebaseMetadata(localPath, explicitContentType) {
  const fileName = path.basename(localPath);
  let contentType = explicitContentType || guessContentType(localPath);
  let contentEncoding;

  if (fileName.endsWith(".js.br")) {
    contentType = "application/javascript";
    contentEncoding = "br";
  } else if (fileName.endsWith(".wasm.br")) {
    contentType = "application/wasm";
    contentEncoding = "br";
  } else if (fileName.endsWith(".data.br")) {
    contentType = "application/octet-stream";
    contentEncoding = "br";
  } else if (fileName.endsWith(".js.gz")) {
    contentType = "application/javascript";
    contentEncoding = "gzip";
  } else if (fileName.endsWith(".wasm.gz")) {
    contentType = "application/wasm";
    contentEncoding = "gzip";
  } else if (fileName.endsWith(".data.gz")) {
    contentType = "application/octet-stream";
    contentEncoding = "gzip";
  } else if (fileName.endsWith(".br")) {
    contentEncoding = "br";
  } else if (fileName.endsWith(".gz")) {
    contentEncoding = "gzip";
  }

  const metadata = {};
  if (contentType) metadata.contentType = contentType;
  if (contentEncoding) metadata.contentEncoding = contentEncoding;
  return metadata;
}

/** upload local file ขึ้น Firebase แล้วคืน public URL */
async function uploadToFirebase(localPath, key, explicitContentType) {
  const bucket = initFirebaseBucket();
  if (!bucket || !useFirebase) throw new Error("Firebase not enabled");

  const cleanKey = key.replace(/^\/+/, "");
  const metadata = buildFirebaseMetadata(localPath, explicitContentType);

  const options = {
    destination: cleanKey,
    metadata,
  };

  await bucket.upload(localPath, options);
  await bucket.file(cleanKey).makePublic();

  await safeUnlink(localPath);

  const url = getFirebasePublicUrl(cleanKey);
  if (!url) throw new Error("Firebase public URL not available");
  return url;
}

/** upload ทั้งโฟลเดอร์ (ใช้ตอนแตก zip เว็บเกม) */
async function uploadDirToFirebase(rootDir, keyPrefix) {
  const bucket = initFirebaseBucket();
  if (!bucket || !useFirebase) throw new Error("Firebase not enabled");

  const stack = [""];
  while (stack.length) {
    const rel = stack.pop();
    const full = path.join(rootDir, rel);
    const entries = await fsp.readdir(full, { withFileTypes: true });
    for (const e of entries) {
      const relPath = path.join(rel, e.name);
      const fullPath = path.join(rootDir, relPath);
      if (e.isDirectory()) {
        stack.push(relPath);
      } else if (e.isFile()) {
        const key = `${keyPrefix}/${relPath.replace(/\\/g, "/")}`;
        const contentType = guessContentType(fullPath);
        await uploadToFirebase(fullPath, key, contentType);
      }
    }
  }
}

async function deletePrefixFromFirebase(prefix) {
  const bucket = initFirebaseBucket();
  if (!bucket || !useFirebase) return;
  const cleanPrefix = prefix.replace(/^\/+/, "");
  await bucket.deleteFiles({ prefix: cleanPrefix });
}

/** ดึง gameId จาก URL ไม่ว่าจะเป็น /uploads/games/... หรือ https://.../games/... */
function extractGameIdFromUrl(url) {
  if (!url) return null;
  const m = url.match(/\/games\/([^/]+)/);
  return m ? m[1] : null;
}

/* รวมคะแนนจากรีวิวแล้วอัปเดต Game */
async function recomputeRatings(gameId) {
  const agg = await Review.aggregate([
    { $match: { game: new (require("mongoose").Types.ObjectId)(gameId) } },
    { $group: { _id: "$score", c: { $sum: 1 } } },
  ]);

  const dist = [0, 0, 0, 0, 0];
  let total = 0,
    sum = 0;
  for (const a of agg) {
    const idx = Math.min(Math.max(a._id, 1), 5) - 1;
    dist[idx] = a.c;
    total += a.c;
    sum += a._id * a.c;
  }
  const avg = total ? +(sum / total).toFixed(2) : 0;

  await Game.updateOne(
    { _id: gameId },
    {
      $set: {
        ratingsCount: total,
        ratingsAvg: avg,
        ratingsDist: dist,
      },
    }
  );

  return { count: total, avg, dist };
}

// คืนค่า key สำหรับเดือนปัจจุบัน "YYYY-MM"
function getCurrentMonthKey() {
  const now = new Date();
  return now.toISOString().slice(0, 7); // "2025-11"
}

/* ===== Access Control (NEW) ===== */

function isAdminUser(req) {
  return String(req.user?.role || "").toLowerCase() === "admin";
}

/**
 * โหลดเกม + เช็คสิทธิ์:
 * - public: ใครก็อ่านได้
 * - unlisted: ใครก็อ่านได้ (แต่ไม่ขึ้น list/search)
 * - private: owner/admin เท่านั้น (คนอื่น 404)
 * - review: owner/admin เท่านั้น (คนอื่น 404)
 * - suspended: owner/admin เท่านั้น (คนอื่น 404)
 */
async function loadGameForRead(req, gameId) {
  const g = await Game.findById(gameId).populate("uploader", "username avatarUrl role");
  if (!g) return { game: null, allowed: false };

  const meId = req.user?._id ? String(req.user._id) : null;
  const ownerId = g.uploader?._id ? String(g.uploader._id) : String(g.uploader);
  const isOwner = !!meId && meId === ownerId;
  const admin = isAdminUser(req);

  const vis = g.visibility;

  if (vis === "public" || vis === "unlisted") {
    return { game: g, allowed: true, isOwner, isAdmin: admin };
  }

  // private / review / suspended
  if (isOwner || admin) {
    return { game: g, allowed: true, isOwner, isAdmin: admin };
  }

  return { game: g, allowed: false, isOwner, isAdmin: admin };
}

/**
 * ✅ helper: normalize visibility ตาม rule ใหม่ (FIXED)
 */
function normalizeVisibilityForSave(req, visInRaw) {
  const visIn = String(visInRaw || "").trim().toLowerCase();

  if (visIn === "review" || visIn === "draft" || visIn === "") {
    return {
      visibility: "review",
      requestedVisibility: "",
      visibilityRequestedAt: null,
    };
  }

  if (visIn === "private") {
    return {
      visibility: "private",
      requestedVisibility: "",
      visibilityRequestedAt: null,
    };
  }

  if (visIn === "unlisted") {
    return {
      visibility: "unlisted",
      requestedVisibility: "",
      visibilityRequestedAt: null,
    };
  }

  if (visIn === "public") {
    if (isAdminUser(req)) {
      return {
        visibility: "public",
        requestedVisibility: "",
        visibilityRequestedAt: null,
      };
    }
    return {
      visibility: "review",
      requestedVisibility: "public",
      visibilityRequestedAt: new Date(),
    };
  }

  return {
    visibility: "review",
    requestedVisibility: "",
    visibilityRequestedAt: null,
  };
}

/* ===== Stats ===== */
const _hit = new Map(); // key -> { t, c }
function tooMany(key, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const rec = _hit.get(key);
  if (!rec) {
    _hit.set(key, { t: now, c: 1 });
    return false;
  }
  if (now - rec.t > windowMs) {
    _hit.set(key, { t: now, c: 1 });
    return false;
  }
  rec.c += 1;
  _hit.set(key, rec);
  return rec.c > limit;
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "unknown";
}

/**
 * POST /api/games/:id/track-play
 */
router.post("/:id/track-play", readOptionalUser, async (req, res) => {
  try {
    const { game, allowed } = await loadGameForRead(req, req.params.id);
    if (!game || !allowed) return res.status(404).json({ message: "Not found" });

    const ip = getClientIp(req);
    const key = `play:${req.params.id}:${ip}`;
    if (tooMany(key, 20, 60_000)) {
      return res.status(429).json({ message: "Too many requests" });
    }

    const g = await Game.findByIdAndUpdate(
      req.params.id,
      { $inc: { playsCount: 1 }, $set: { lastPlayedAt: new Date() } },
      { new: true }
    ).lean();

    if (!g) return res.status(404).json({ message: "Not found" });

    return res.json({
      ok: true,
      playsCount: g.playsCount || 0,
      lastPlayedAt: g.lastPlayedAt || null,
    });
  } catch (err) {
    console.error("[track-play]", err);
    return res.status(500).json({ message: "track-play failed" });
  }
});

/**
 * POST /api/games/:id/track-download
 */
router.post("/:id/track-download", readOptionalUser, async (req, res) => {
  try {
    const { game, allowed } = await loadGameForRead(req, req.params.id);
    if (!game || !allowed) return res.status(404).json({ message: "Not found" });

    const ip = getClientIp(req);
    const key = `dl:${req.params.id}:${ip}`;
    if (tooMany(key, 20, 60_000)) {
      return res.status(429).json({ message: "Too many requests" });
    }

    const g = await Game.findByIdAndUpdate(
      req.params.id,
      { $inc: { downloadsCount: 1 }, $set: { lastDownloadedAt: new Date() } },
      { new: true }
    ).lean();

    if (!g) return res.status(404).json({ message: "Not found" });

    return res.json({
      ok: true,
      downloadsCount: g.downloadsCount || 0,
      lastDownloadedAt: g.lastDownloadedAt || null,
    });
  } catch (err) {
    console.error("[track-download]", err);
    return res.status(500).json({ message: "track-download failed" });
  }
});

/**
 * GET /api/games/:id/stats
 */
router.get("/:id/stats", readOptionalUser, async (req, res) => {
  try {
    const { game, allowed } = await loadGameForRead(req, req.params.id);
    if (!game || !allowed) return res.status(404).json({ message: "Not found" });

    const g = await Game.findById(req.params.id)
      .select("playsCount downloadsCount lastPlayedAt lastDownloadedAt")
      .lean();

    if (!g) return res.status(404).json({ message: "Not found" });

    return res.json({
      playsCount: g.playsCount || 0,
      downloadsCount: g.downloadsCount || 0,
      lastPlayedAt: g.lastPlayedAt || null,
      lastDownloadedAt: g.lastDownloadedAt || null,
    });
  } catch (err) {
    console.error("[stats]", err);
    return res.status(500).json({ message: "stats failed" });
  }
});

/* ===== CREATE ===== */
router.post(
  "/",
  authRequired,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "screens[]", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const b = req.body || {};
      const title = (b.title || "").trim();
      if (!title) return res.status(400).json({ message: "ชื่อเกมห้ามว่าง" });

      const slug =
        (
          b.slug ||
          title
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
        ).slice(0, 60) || uuid();

      const kind = b.kind === "download" ? "download" : "html";
      const tagline = b.tagline || "";
      const description = b.description || "";

      const category = b.category || "no-genre";

      const visPack = normalizeVisibilityForSave(req, b.visibility);

      const tags = Array.isArray(b["tags[]"])
        ? b["tags[]"]
        : b["tags[]"]
        ? [b["tags[]"]]
        : [];

      const file = req.files?.file?.[0];
      if (!file) return res.status(400).json({ message: "กรุณาแนบไฟล์เกม" });

      const gameId = `${slug}-${uuid().slice(0, 8)}`;
      const gameDir = path.join(uploadsRoot, "games", gameId); // local
      const keyPrefix = `${FIREBASE_KEY_PREFIX}/${gameId}`;

      if (!useFirebase) {
        await fsp.mkdir(gameDir, { recursive: true });
      }

      let fileUrl = "";

      if (kind === "html") {
        if (/\.html?$/i.test(file.originalname)) {
          if (useFirebase) {
            const key = `${keyPrefix}/index.html`;
            fileUrl = await uploadToFirebase(file.path, key, "text/html");
          } else {
            const dest = path.join(gameDir, "index.html");
            await moveFile(file.path, dest);
            fileUrl = `/uploads/games/${gameId}/index.html`;
          }
        } else if (/\.zip$/i.test(file.originalname)) {
          if (useFirebase) {
            const unzipDir = path.join(tmpDir, `unzip-${gameId}-${Date.now()}`);
            await fsp.mkdir(unzipDir, { recursive: true });

            const zip = new AdmZip(file.path);
            try {
              zip.extractAllTo(unzipDir, true);
            } finally {
              await safeUnlink(file.path);
            }

            const idx = await findIndexHtml(unzipDir);
            if (!idx)
              return res.status(400).json({ message: "ZIP นี้ไม่มี index.html" });

            await uploadDirToFirebase(unzipDir, keyPrefix);

            const indexKey = `${keyPrefix}/${idx.rel.replace(/\\/g, "/")}`;
            fileUrl = getFirebasePublicUrl(indexKey);

            await rmrf(unzipDir);
          } else {
            const zip = new AdmZip(file.path);
            try {
              zip.extractAllTo(gameDir, true);
            } finally {
              await safeUnlink(file.path);
            }
            const idx = await findIndexHtml(gameDir);
            if (!idx)
              return res.status(400).json({ message: "ZIP นี้ไม่มี index.html" });
            fileUrl = `/uploads/games/${gameId}/${idx.rel}`;
          }
        } else {
          await safeUnlink(file.path);
          return res
            .status(400)
            .json({ message: "โหมด HTML รองรับเฉพาะ .html หรือ .zip" });
        }
      } else {
        if (!/\.rar$/i.test(file.originalname)) {
          await safeUnlink(file.path);
          return res
            .status(400)
            .json({ message: "โหมด Downloadable รองรับเฉพาะไฟล์ .rar" });
        }

        if (useFirebase) {
          const fname = path.basename(file.originalname);
          const key = `${keyPrefix}/${fname}`;
          fileUrl = await uploadToFirebase(
            file.path,
            key,
            "application/x-rar-compressed"
          );
        } else {
          const dest = path.join(gameDir, path.basename(file.originalname));
          await moveFile(file.path, dest);
          fileUrl = `/uploads/games/${gameId}/${path.basename(dest)}`;
        }
      }

      // cover
      let coverUrl = "";
      const cover = req.files?.cover?.[0];
      if (cover) {
        const ext = path.extname(cover.originalname).toLowerCase() || ".jpg";
        if (useFirebase) {
          const key = `${keyPrefix}/cover${ext}`;
          coverUrl = await uploadToFirebase(
            cover.path,
            key,
            guessContentType(`cover${ext}`)
          );
        } else {
          const dest = path.join(gameDir, `cover${ext}`);
          await moveFile(cover.path, dest);
          coverUrl = `/uploads/games/${gameId}/cover${ext}`;
        }
      }

      // screens
      const screens = [];
      const screenFiles = req.files?.["screens[]"] || [];
      for (let i = 0; i < Math.min(screenFiles.length, 5); i++) {
        const s = screenFiles[i];
        const ext = path.extname(s.originalname).toLowerCase() || ".jpg";
        if (useFirebase) {
          const key = `${keyPrefix}/screen-${i + 1}${ext}`;
          const url = await uploadToFirebase(
            s.path,
            key,
            guessContentType(`screen-${i + 1}${ext}`)
          );
          screens.push(url);
        } else {
          const dest = path.join(gameDir, `screen-${i + 1}${ext}`);
          await moveFile(s.path, dest);
          screens.push(`/uploads/games/${gameId}/screen-${i + 1}${ext}`);
        }
      }

      const doc = await Game.create({
        title,
        slug,
        tagline,
        description,
        category,
        visibility: visPack.visibility,
        requestedVisibility: visPack.requestedVisibility,
        visibilityRequestedAt: visPack.visibilityRequestedAt,
        tags,
        fileUrl,
        coverUrl,
        screens,
        kind,
        uploader: req.user?._id,
      });

      return res.json(doc);
    } catch (err) {
      console.error("[games.create]", err);
      if (err?.code === 11000)
        return res.status(400).json({ message: "Slug นี้ถูกใช้แล้ว เลือกคำอื่นนะ" });
      return res.status(500).json({ message: err.message || "Upload failed" });
    }
  }
);

/* ===== UPDATE ===== */
router.put(
  "/:id",
  authRequired,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "screens[]", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const game = await Game.findById(req.params.id);
      if (!game) return res.status(404).json({ message: "Not found" });
      if (String(game.uploader) !== String(req.user?._id))
        return res.status(403).json({ message: "Forbidden" });

      const b = req.body || {};

      const toUpdate = {
        title: (b.title ?? game.title).trim(),
        slug: (
          b.slug ??
          game.slug ??
          (b.title || game.title)
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
        )
          .toString()
          .slice(0, 60),
        tagline: b.tagline ?? game.tagline,
        description: b.description ?? game.description,
        category: b.category ?? game.category,

        tags: Array.isArray(b["tags[]"])
          ? b["tags[]"]
          : b["tags[]"]
          ? [b["tags[]"]]
          : Array.isArray(game.tags)
          ? game.tags
          : [],

        kind:
          b.kind === "download"
            ? "download"
            : b.kind === "html"
            ? "html"
            : game.kind || "html",

        visibility: game.visibility,
        requestedVisibility: game.requestedVisibility || "",
        visibilityRequestedAt: game.visibilityRequestedAt || null,
      };

      if (typeof b.visibility !== "undefined") {
        const visPack = normalizeVisibilityForSave(req, b.visibility);
        toUpdate.visibility = visPack.visibility;
        toUpdate.requestedVisibility = visPack.requestedVisibility;
        toUpdate.visibilityRequestedAt = visPack.visibilityRequestedAt;
      }

      let gameId =
        extractGameIdFromUrl(game.fileUrl) ||
        extractGameIdFromUrl(game.coverUrl) ||
        `${toUpdate.slug}-${uuid().slice(0, 8)}`;

      const gameDir = path.join(uploadsRoot, "games", gameId);
      const keyPrefix = `${FIREBASE_KEY_PREFIX}/${gameId}`;

      if (!useFirebase) {
        await fsp.mkdir(gameDir, { recursive: true });
      }

      const file = req.files?.file?.[0];
      if (file) {
        if (toUpdate.kind === "html") {
          if (/\.html?$/i.test(file.originalname)) {
            if (useFirebase) {
              const key = `${keyPrefix}/index.html`;
              toUpdate.fileUrl = await uploadToFirebase(file.path, key, "text/html");
            } else {
              const dest = path.join(gameDir, "index.html");
              await moveFile(file.path, dest);
              toUpdate.fileUrl = `/uploads/games/${gameId}/index.html`;
            }
          } else if (/\.zip$/i.test(file.originalname)) {
            if (useFirebase) {
              const unzipDir = path.join(tmpDir, `unzip-${gameId}-${Date.now()}`);
              await fsp.mkdir(unzipDir, { recursive: true });

              const zip = new AdmZip(file.path);
              try {
                zip.extractAllTo(unzipDir, true);
              } finally {
                await safeUnlink(file.path);
              }

              const idx = await findIndexHtml(unzipDir);
              if (!idx)
                return res.status(400).json({ message: "ZIP นี้ไม่มี index.html" });

              await uploadDirToFirebase(unzipDir, keyPrefix);

              const indexKey = `${keyPrefix}/${idx.rel.replace(/\\/g, "/")}`;
              toUpdate.fileUrl = getFirebasePublicUrl(indexKey);

              await rmrf(unzipDir);
            } else {
              const zip = new AdmZip(file.path);
              try {
                zip.extractAllTo(gameDir, true);
              } finally {
                await safeUnlink(file.path);
              }
              const idx = await findIndexHtml(gameDir);
              if (!idx)
                return res.status(400).json({ message: "ZIP นี้ไม่มี index.html" });
              toUpdate.fileUrl = `/uploads/games/${gameId}/${idx.rel}`;
            }
          } else {
            await safeUnlink(file.path);
            return res.status(400).json({
              message: "โหมด HTML รองรับ .html หรือ .zip เท่านั้น",
            });
          }
        } else {
          if (!/\.rar$/i.test(file.originalname)) {
            await safeUnlink(file.path);
            return res.status(400).json({ message: "โหมด Downloadable รองรับ .rar เท่านั้น" });
          }

          if (useFirebase) {
            const fname = path.basename(file.originalname);
            const key = `${keyPrefix}/${fname}`;
            toUpdate.fileUrl = await uploadToFirebase(
              file.path,
              key,
              "application/x-rar-compressed"
            );
          } else {
            const dest = path.join(gameDir, path.basename(file.originalname));
            await moveFile(file.path, dest);
            toUpdate.fileUrl = `/uploads/games/${gameId}/${path.basename(dest)}`;
          }
        }
      }

      const cover = req.files?.cover?.[0];
      if (cover) {
        const ext = path.extname(cover.originalname).toLowerCase() || ".jpg";
        if (useFirebase) {
          const key = `${keyPrefix}/cover${ext}`;
          toUpdate.coverUrl = await uploadToFirebase(
            cover.path,
            key,
            guessContentType(`cover${ext}`)
          );
        } else {
          const dest = path.join(gameDir, `cover${ext}`);
          await moveFile(cover.path, dest);
          toUpdate.coverUrl = `/uploads/games/${gameId}/cover${ext}`;
        }
      }

      const screenFiles = req.files?.["screens[]"] || [];
      if (screenFiles.length > 0) {
        const newShots = [];
        for (let i = 0; i < Math.min(screenFiles.length, 5); i++) {
          const s = screenFiles[i];
          const ext = path.extname(s.originalname).toLowerCase() || ".jpg";
          if (useFirebase) {
            const key = `${keyPrefix}/screen-${i + 1}${ext}`;
            const url = await uploadToFirebase(
              s.path,
              key,
              guessContentType(`screen-${i + 1}${ext}`)
            );
            newShots.push(url);
          } else {
            const dest = path.join(gameDir, `screen-${i + 1}${ext}`);
            await moveFile(s.path, dest);
            newShots.push(`/uploads/games/${gameId}/screen-${i + 1}${ext}`);
          }
        }
        toUpdate.screens = newShots;
      }

      await Game.updateOne({ _id: game._id }, { $set: toUpdate });
      const refreshed = await Game.findById(game._id);
      return res.json(refreshed);
    } catch (err) {
      console.error("[games.update]", err);
      if (err?.code === 11000)
        return res.status(400).json({ message: "Slug นี้ถูกใช้แล้ว เลือกคำอื่นนะ" });
      return res.status(500).json({ message: err.message || "Save failed" });
    }
  }
);

/* ===== READ ===== */

router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const category = String(req.query.category || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "24", 10), 1), 60);

    const cond = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      cond.$or = [{ title: rx }, { description: rx }];
    }
    if (category && category !== "all") cond.category = category;

    cond.visibility = "public";

    const total = await Game.countDocuments(cond);
    const items = await Game.find(cond)
      .populate("uploader", "username avatarUrl")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ items, total, page, limit });
  } catch (e) {
    console.error("GET /games/search", e);
    res.status(500).json({ message: "search failed" });
  }
});

router.get("/", readOptionalUser, async (req, res) => {
  try {
    const mine = String(req.query.mine || "") === "1";

    if (mine) {
      if (!req.user?._id) return res.status(401).json({ message: "Unauthorized" });

      const q = { uploader: req.user._id };
      if (req.query.kind) q.kind = req.query.kind;

      const list = await Game.find(q)
        .populate("uploader", "username avatarUrl")
        .sort({ createdAt: -1 });

      return res.json(list);
    }

    const q = { visibility: "public" };
    if (req.query.uploader) q.uploader = req.query.uploader;
    if (req.query.kind) q.kind = req.query.kind;

    const list = await Game.find(q)
      .populate("uploader", "username avatarUrl")
      .sort({ createdAt: -1 });

    return res.json(list);
  } catch (e) {
    console.error("GET /games", e);
    return res.status(500).json({ message: "list failed" });
  }
});

/* ✅ COMMENTS (NEW): ต้องมาก่อน router.get("/:id") */

// GET comments ของเกม (รวม replies)
router.get("/:id/comments", readOptionalUser, async (req, res) => {
  try {
    if (!Comment) return res.status(500).json({ message: "Comments feature not configured" });

    const { game, allowed, isAdmin } = await loadGameForRead(req, req.params.id);
    if (!game || !allowed) return res.status(404).json({ message: "Not found" });

    // คนทั่วไปเห็นเฉพาะ visible
    // แอดมินเห็น visible + hidden (แต่ไม่เอา deleted)
    const cond = {
      game: req.params.id,
      status: isAdmin ? { $in: ["visible", "hidden"] } : "visible",
    };

    const items = await Comment.find(cond)
      .populate("author", "username avatar avatarUrl")
      .sort({ createdAt: 1 })
      .lean();

    res.json(items);
  } catch (e) {
    console.error("[games.comments.get]", e);
    res.status(500).json({ message: "load comments failed" });
  }
});

// POST comment / reply (ทุกคนตอบได้ แค่ต้อง login)
router.post("/:id/comments", authRequired, async (req, res) => {
  try {
    if (!Comment) return res.status(500).json({ message: "Comments feature not configured" });

    const { game, allowed } = await loadGameForRead(req, req.params.id);
    if (!game || !allowed) return res.status(404).json({ message: "Not found" });

    const content = String(req.body?.content || "").trim();
    const parentIdRaw = req.body?.parentId || null;

    if (!content) return res.status(400).json({ message: "content required" });

    // ถ้ามี parentId ต้องเป็นคอมเมนต์ของเกมเดียวกัน + ต้องไม่ใช่ deleted
    let parentId = null;
    if (parentIdRaw) {
      const parent = await Comment.findOne({
        _id: parentIdRaw,
        game: req.params.id,
        status: { $ne: "deleted" },
      }).select("_id").lean();

      if (!parent) return res.status(400).json({ message: "parent comment not found" });
      parentId = parent._id;
    }

    const created = await Comment.create({
      game: req.params.id,
      author: req.user?._id,
      content,
      parentId,
      status: "visible",
    });

    const populated = await Comment.findById(created._id)
      .populate("author", "username avatar avatarUrl")
      .lean();

    res.json(populated);
  } catch (e) {
    console.error("[games.comments.post]", e);
    res.status(500).json({ message: "create comment failed" });
  }
});

// ✅ Detail: private/review/suspended กันคนอื่น (404)
router.get("/:id", readOptionalUser, async (req, res) => {
  const { game, allowed } = await loadGameForRead(req, req.params.id);
  if (!game || !allowed) return res.status(404).json({ message: "Not found" });
  return res.json(game);
});

/* ====== REVIEWS ====== */

router.get("/:id/ratings", readOptionalUser, async (req, res) => {
  const { game, allowed } = await loadGameForRead(req, req.params.id);
  if (!game || !allowed) return res.status(404).json({ message: "Not found" });

  const g = await Game.findById(req.params.id).lean();
  if (!g) return res.status(404).json({ message: "Not found" });

  res.json({
    count: g.ratingsCount || 0,
    avg: g.ratingsAvg || 0,
    dist: g.ratingsDist || [0, 0, 0, 0, 0],
  });
});

router.get("/:id/reviews", readOptionalUser, async (req, res) => {
  const { game, allowed } = await loadGameForRead(req, req.params.id);
  if (!game || !allowed) return res.status(404).json({ message: "Not found" });

  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 50);

  const [items, total] = await Promise.all([
    Review.find({ game: req.params.id })
      .populate("user", "username avatarUrl")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments({ game: req.params.id }),
  ]);

  res.json({ items, total, page, limit });
});

router.get("/:id/reviews/me", readOptionalUser, async (req, res) => {
  if (!req.user?._id) return res.json({ score: null, text: "" });

  const { game, allowed } = await loadGameForRead(req, req.params.id);
  if (!game || !allowed) return res.status(404).json({ message: "Not found" });

  const r = await Review.findOne({
    game: req.params.id,
    user: req.user._id,
  }).lean();

  res.json({ score: r?.score ?? null, text: r?.text ?? "" });
});

router.put("/:id/reviews", authRequired, async (req, res) => {
  const { game, allowed } = await loadGameForRead(req, req.params.id);
  if (!game || !allowed) return res.status(404).json({ message: "Not found" });

  const score = Number(req.body?.score);
  const text = String(req.body?.text || "");
  if (!(score >= 1 && score <= 5))
    return res.status(400).json({ message: "score must be 1..5" });

  await Review.updateOne(
    { game: game._id, user: req.user._id },
    { $set: { score, text } },
    { upsert: true }
  );

  const sum = await recomputeRatings(game._id);
  res.json({ ok: true, ...sum });
});

router.delete("/:id/reviews/:rid", authRequired, async (req, res) => {
  const { game, allowed } = await loadGameForRead(req, req.params.id);
  if (!game || !allowed) return res.status(404).json({ message: "Not found" });

  const r = await Review.findById(req.params.rid);
  if (!r) return res.status(404).json({ message: "Not found" });
  if (String(r.user) !== String(req.user._id))
    return res.status(403).json({ message: "Forbidden" });

  await Review.deleteOne({ _id: r._id });
  const sum = await recomputeRatings(r.game);
  res.json({ ok: true, ...sum });
});

/* ====== MONTHLY VOTE (เกมประจำเดือน) ====== */

router.post("/:id/monthly-vote", authRequired, async (req, res) => {
  if (!MonthlyVote) {
    return res.status(500).json({ message: "Monthly vote feature not configured" });
  }

  try {
    const gameId = req.params.id;
    const userId = req.user._id;
    const monthKey = getCurrentMonthKey();

    const game = await Game.findById(gameId).select("_id visibility title");
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    if (game.visibility !== "public") {
      return res.status(400).json({ message: "Cannot vote for non-public game" });
    }

    const doc = await MonthlyVote.findOneAndUpdate(
      { user: userId, monthKey },
      { game: gameId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const count = await MonthlyVote.countDocuments({
      game: gameId,
      monthKey,
    });

    return res.json({
      message: "Voted for monthly game successfully",
      monthKey,
      game: doc.game,
      count,
    });
  } catch (err) {
    console.error("[monthly-vote] vote error:", err);
    return res.status(500).json({ message: "Failed to vote for monthly game" });
  }
});

router.get("/:id/monthly-vote/me", authRequired, async (req, res) => {
  if (!MonthlyVote) {
    return res.status(500).json({ message: "Monthly vote feature not configured" });
  }

  try {
    const gameId = req.params.id;
    const userId = req.user._id;
    const monthKey = getCurrentMonthKey();

    const doc = await MonthlyVote.findOne({ user: userId, monthKey });
    if (!doc) {
      return res.json({
        voted: false,
        gameVoted: null,
        isThisGame: false,
        monthKey,
      });
    }

    return res.json({
      voted: true,
      gameVoted: doc.game,
      isThisGame: String(doc.game) === String(gameId),
      monthKey,
    });
  } catch (err) {
    console.error("[monthly-vote] me error:", err);
    return res.status(500).json({ message: "Failed to load monthly vote status" });
  }
});

router.get("/:id/monthly-vote-count", async (req, res) => {
  if (!MonthlyVote) {
    return res.status(500).json({ message: "Monthly vote feature not configured" });
  }

  try {
    const gameId = req.params.id;
    const monthKey = getCurrentMonthKey();

    const count = await MonthlyVote.countDocuments({
      game: gameId,
      monthKey,
    });

    return res.json({ monthKey, count });
  } catch (err) {
    console.error("[monthly-vote] count error:", err);
    return res.status(500).json({ message: "Failed to load monthly vote count" });
  }
});

/* ===== DELETE GAME ===== */
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: "Not found" });
    if (String(game.uploader) !== String(req.user?._id))
      return res.status(403).json({ message: "Forbidden" });

    const gameId =
      extractGameIdFromUrl(game.fileUrl) ||
      extractGameIdFromUrl(game.coverUrl) ||
      null;

    const deletes = [
      Game.deleteOne({ _id: game._id }),
      Review.deleteMany({ game: game._id }),
    ];

    if (MonthlyVote) {
      deletes.push(MonthlyVote.deleteMany({ game: game._id }));
    }

    // ✅ ลบคอมเมนต์ด้วย
    if (Comment) {
      deletes.push(Comment.deleteMany({ game: game._id }));
    }

    if (gameId) {
      deletes.push(rmrf(path.join(uploadsRoot, "games", gameId)));

      if (useFirebase) {
        const prefix = `${FIREBASE_KEY_PREFIX}/${gameId}/`;
        deletes.push(
          deletePrefixFromFirebase(prefix).catch((e) =>
            console.warn("[games.delete] Firebase deletePrefix failed:", e.message || e)
          )
        );
      }
    }

    await Promise.all(deletes);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[games.delete]", err);
    return res.status(500).json({ message: err.message || "Delete failed" });
  }
});

module.exports = router;
