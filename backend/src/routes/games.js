// backend/src/routes/games.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const multer = require("multer");
const AdmZip = require("adm-zip");
const { v4: uuid } = require("uuid");
const jwt = require("jsonwebtoken");

let Game;
let Review;
let MonthlyVote;

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

const router = express.Router();

/* ===== Supabase Storage config (optional) ===== */
let useSupabase = false;
let supabase = null;

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || ""; // ตั้งชื่อ bucket ใน Supabase
const SUPABASE_KEY_PREFIX = process.env.SUPABASE_KEY_PREFIX || "games"; // prefix เช่น "games"

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_BUCKET) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    useSupabase = true;
    console.log("[games] Supabase storage enabled:", SUPABASE_BUCKET);
  } catch (err) {
    console.warn(
      "[games] Supabase createClient failed, fallback to local uploads:",
      err.message || err
    );
  }
} else {
  console.warn(
    "[games] Supabase not fully configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_BUCKET) – fallback to local uploads"
  );
}

/* ===== auth ===== */
function authRequired(req, res, next) {
  // 1) กรณี login ด้วย session/passport (เช่น GitHub OAuth)
  if (req.isAuthenticated && req.isAuthenticated()) {
    if (req.user?._id) {
      return next();
    }
    // บางที passport เซ็ตเป็น id เฉย ๆ
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
      req.user = { _id: String(payload.id || payload.uid) };
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
      req.user = { _id: String(payload.id || payload.uid) };
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

// เคยใช้ลบสกรีนช็อตใน local folder
async function safeRmDir(dir) {
  try {
    const items = await fsp.readdir(dir);
    await Promise.all(
      items.map((name) => {
        const p = path.join(dir, name);
        if (/^screen-\d+\.(png|jpe?g|webp)$/i.test(name)) return safeUnlink(p);
        return null;
      })
    );
  } catch {}
}

// ลบโฟลเดอร์ local ทั้งก้อน
async function rmrf(dir) {
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch {}
}

/* ===== Supabase helpers ===== */

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html";
  if (ext === ".zip") return "application/zip";
  if (ext === ".js") return "text/javascript";
  if (ext === ".css") return "text/css";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

/** upload local file ขึ้น Supabase แล้วคืน public URL */
async function uploadToSupabase(localPath, key) {
  if (!useSupabase || !supabase) throw new Error("Supabase not enabled");
  const cleanKey = key.replace(/^\/+/, "");

  const fileBuffer = await fsp.readFile(localPath);
  const contentType = guessContentType(localPath);

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(cleanKey, fileBuffer, {
      contentType,
      upsert: true, // ถ้าอัปโหลดทับไฟล์เดิม ให้เขียนทับ
    });

  if (error) {
    console.error("[Supabase upload] error:", error);
    throw new Error(error.message || "Supabase upload failed");
  }

  // เอา public URL
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(cleanKey);
  const publicUrl = data && data.publicUrl ? data.publicUrl : null;

  // ลบไฟล์ temp local ทิ้ง
  await safeUnlink(localPath);

  if (!publicUrl) {
    throw new Error("Supabase public URL not available");
  }

  return publicUrl;
}

/** upload ทั้งโฟลเดอร์ (ใช้ตอนแตก zip เว็บเกม) */
async function uploadDirToSupabase(rootDir, keyPrefix) {
  if (!useSupabase || !supabase) throw new Error("Supabase not enabled");

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
        await uploadToSupabase(fullPath, key);
      }
    }
  }
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
      const category = b.category || "all";
      // เกมใหม่ทุกเกมเป็น review
      const tags = Array.isArray(b["tags[]"])
        ? b["tags[]"]
        : b["tags[]"]
        ? [b["tags[]"]]
        : [];

      const file = req.files?.file?.[0];
      if (!file) return res.status(400).json({ message: "กรุณาแนบไฟล์เกม" });

      const gameId = `${slug}-${uuid().slice(0, 8)}`;
      const gameDir = path.join(uploadsRoot, "games", gameId); // ใช้กรณี local
      const keyPrefix = `${SUPABASE_KEY_PREFIX}/${gameId}`;

      if (!useSupabase) {
        await fsp.mkdir(gameDir, { recursive: true });
      }

      let fileUrl = "";

      if (kind === "html") {
        if (/\.html?$/i.test(file.originalname)) {
          if (useSupabase) {
            const key = `${keyPrefix}/index.html`;
            fileUrl = await uploadToSupabase(file.path, key);
          } else {
            const dest = path.join(gameDir, "index.html");
            await moveFile(file.path, dest);
            fileUrl = `/uploads/games/${gameId}/index.html`;
          }
        } else if (/\.zip$/i.test(file.originalname)) {
          if (useSupabase) {
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

            await uploadDirToSupabase(unzipDir, keyPrefix);
            fileUrl = supabase.storage
              .from(SUPABASE_BUCKET)
              .getPublicUrl(`${keyPrefix}/${idx.rel.replace(/\\/g, "/")}`).data
              .publicUrl;

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
        // downloadable (.rar)
        if (!/\.rar$/i.test(file.originalname)) {
          await safeUnlink(file.path);
          return res
            .status(400)
            .json({ message: "โหมด Downloadable รองรับเฉพาะไฟล์ .rar" });
        }

        if (useSupabase) {
          const fname = path.basename(file.originalname);
          const key = `${keyPrefix}/${fname}`;
          fileUrl = await uploadToSupabase(file.path, key);
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
        if (useSupabase) {
          const key = `${keyPrefix}/cover${ext}`;
          coverUrl = await uploadToSupabase(cover.path, key);
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
        if (useSupabase) {
          const key = `${keyPrefix}/screen-${i + 1}${ext}`;
          const url = await uploadToSupabase(s.path, key);
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
        visibility: "review", // เกมใหม่ = ไปเข้าคิวรีวิวก่อน
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
        visibility: game.visibility, // ไม่ให้ owner เปลี่ยนเอง
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
      };

      // หา gameId จาก URL เดิม (รองรับทั้ง local และ Supabase)
      let gameId =
        extractGameIdFromUrl(game.fileUrl) ||
        extractGameIdFromUrl(game.coverUrl) ||
        `${toUpdate.slug}-${uuid().slice(0, 8)}`;

      const gameDir = path.join(uploadsRoot, "games", gameId);
      const keyPrefix = `${SUPABASE_KEY_PREFIX}/${gameId}`;

      if (!useSupabase) {
        await fsp.mkdir(gameDir, { recursive: true });
      }

      const file = req.files?.file?.[0];
      if (file) {
        if (toUpdate.kind === "html") {
          if (/\.html?$/i.test(file.originalname)) {
            if (useSupabase) {
              const key = `${keyPrefix}/index.html`;
              toUpdate.fileUrl = await uploadToSupabase(file.path, key);
            } else {
              const dest = path.join(gameDir, "index.html");
              await moveFile(file.path, dest);
              toUpdate.fileUrl = `/uploads/games/${gameId}/index.html`;
            }
          } else if (/\.zip$/i.test(file.originalname)) {
            if (useSupabase) {
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
                return res
                  .status(400)
                  .json({ message: "ZIP นี้ไม่มี index.html" });

              await uploadDirToSupabase(unzipDir, keyPrefix);

              toUpdate.fileUrl = supabase.storage
                .from(SUPABASE_BUCKET)
                .getPublicUrl(`${keyPrefix}/${idx.rel.replace(/\\/g, "/")}`)
                .data.publicUrl;

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
                return res
                  .status(400)
                  .json({ message: "ZIP นี้ไม่มี index.html" });
              toUpdate.fileUrl = `/uploads/games/${gameId}/${idx.rel}`;
            }
          } else {
            await safeUnlink(file.path);
            return res.status(400).json({
              message: "โหมด HTML รองรับ .html หรือ .zip เท่านั้น",
            });
          }
        } else {
          // downloadable
          if (!/\.rar$/i.test(file.originalname)) {
            await safeUnlink(file.path);
            return res
              .status(400)
              .json({ message: "โหมด Downloadable รองรับ .rar เท่านั้น" });
          }

          if (useSupabase) {
            const fname = path.basename(file.originalname);
            const key = `${keyPrefix}/${fname}`;
            toUpdate.fileUrl = await uploadToSupabase(file.path, key);
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
        if (useSupabase) {
          const key = `${keyPrefix}/cover${ext}`;
          toUpdate.coverUrl = await uploadToSupabase(cover.path, key);
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
          if (useSupabase) {
            const key = `${keyPrefix}/screen-${i + 1}${ext}`;
            const url = await uploadToSupabase(s.path, key);
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

    // ค้นหาเฉพาะเกมที่เผยแพร่แล้ว
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

router.get("/", async (req, res) => {
  // list ปกติให้เห็นเฉพาะ public
  const q = { visibility: "public" };
  if (req.query.uploader) q.uploader = req.query.uploader;
  if (req.query.kind) q.kind = req.query.kind;

  const list = await Game.find(q)
    .populate("uploader", "username avatarUrl")
    .sort({ createdAt: -1 });

  res.json(list);
});

router.get("/:id", async (req, res) => {
  const g = await Game.findById(req.params.id).populate(
    "uploader",
    "username avatarUrl"
  );
  if (!g) return res.status(404).json({ message: "Not found" });
  res.json(g);
});

/* ====== REVIEWS ====== */

// ดึงรวมคะแนน (summary สำหรับหัวเรื่อง/ดาวเฉลี่ย)
router.get("/:id/ratings", async (req, res) => {
  const g = await Game.findById(req.params.id).lean();
  if (!g) return res.status(404).json({ message: "Not found" });
  res.json({
    count: g.ratingsCount || 0,
    avg: g.ratingsAvg || 0,
    dist: g.ratingsDist || [0, 0, 0, 0, 0],
  });
});

// รายการรีวิว (แบ่งหน้า)
router.get("/:id/reviews", async (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit || "10", 10), 1),
    50
  );

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

// ของฉัน (ใช้เติมค่าตอนเปิด modal)
router.get("/:id/reviews/me", readOptionalUser, async (req, res) => {
  if (!req.user?._id) return res.json({ score: null, text: "" });

  const r = await Review.findOne({
    game: req.params.id,
    user: req.user._id,
  }).lean();

  res.json({ score: r?.score ?? null, text: r?.text ?? "" });
});

// สร้าง/แก้รีวิว + อัปเดตรวมคะแนน
router.put("/:id/reviews", authRequired, async (req, res) => {
  const score = Number(req.body?.score);
  const text = String(req.body?.text || "");
  if (!(score >= 1 && score <= 5))
    return res.status(400).json({ message: "score must be 1..5" });

  const game = await Game.findById(req.params.id);
  if (!game) return res.status(404).json({ message: "Not found" });

  await Review.updateOne(
    { game: game._id, user: req.user._id },
    { $set: { score, text } },
    { upsert: true }
  );

  const sum = await recomputeRatings(game._id);
  res.json({ ok: true, ...sum });
});

// ลบรีวิวของฉัน
router.delete("/:id/reviews/:rid", authRequired, async (req, res) => {
  const r = await Review.findById(req.params.rid);
  if (!r) return res.status(404).json({ message: "Not found" });
  if (String(r.user) !== String(req.user._id))
    return res.status(403).json({ message: "Forbidden" });

  await Review.deleteOne({ _id: r._id });
  const sum = await recomputeRatings(r.game);
  res.json({ ok: true, ...sum });
});

/* ====== MONTHLY VOTE (เกมประจำเดือน) ====== */

/**
 * POST /api/games/:id/monthly-vote
 * โหวตเกมนี้เป็น "เกมประจำเดือน" ของผู้ใช้ (เดือนปัจจุบัน)
 * - 1 user / เดือน โหวตได้ 1 เกม (เปลี่ยนโหวต = อัปเดต record เดิม)
 */
router.post("/:id/monthly-vote", authRequired, async (req, res) => {
  if (!MonthlyVote) {
    return res
      .status(500)
      .json({ message: "Monthly vote feature not configured" });
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
      return res
        .status(400)
        .json({ message: "Cannot vote for non-public game" });
    }

    const doc = await MonthlyVote.findOneAndUpdate(
      { user: userId, monthKey },
      { game: gameId },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
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
    return res
      .status(500)
      .json({ message: "Failed to vote for monthly game" });
  }
});

/**
 * GET /api/games/:id/monthly-vote/me
 * ดูสถานะโหวตประจำเดือนของ user (เดือนปัจจุบัน)
 */
router.get("/:id/monthly-vote/me", authRequired, async (req, res) => {
  if (!MonthlyVote) {
    return res
      .status(500)
      .json({ message: "Monthly vote feature not configured" });
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
    return res
      .status(500)
      .json({ message: "Failed to load monthly vote status" });
  }
});

/**
 * GET /api/games/:id/monthly-vote-count
 * จำนวนโหวตของเกมนี้ในเดือนปัจจุบัน
 */
router.get("/:id/monthly-vote-count", async (req, res) => {
  if (!MonthlyVote) {
    return res
      .status(500)
      .json({ message: "Monthly vote feature not configured" });
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
    return res
      .status(500)
      .json({ message: "Failed to load monthly vote count" });
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

    if (gameId) {
      // ลบไฟล์ local เก่า (ถ้ามี)
      deletes.push(rmrf(path.join(uploadsRoot, "games", gameId)));

      // NOTE: ยังไม่ได้ลบไฟล์ใน Supabase ตาม prefix
      // (ถ้าจะทำจริง ๆ ต้องใช้ supabase.storage.list + remove ตาม key)
      // แต่ไม่กระทบการใช้งานเกม แค่ไฟล์เก่าค้างอยู่ใน storage
    }

    await Promise.all(deletes);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[games.delete]", err);
    return res.status(500).json({ message: err.message || "Delete failed" });
  }
});

module.exports = router;
