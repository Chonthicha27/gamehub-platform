const path = require("path");
const multer = require("multer");
const fs = require("fs");

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

const root = path.join(process.cwd(), "uploads");
ensureDir(root);
ensureDir(path.join(root, "avatars"));
ensureDir(path.join(root, "banners"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isAvatar = file.fieldname === "avatar";
    cb(null, path.join(root, isAvatar ? "avatars" : "banners"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(png|jpe?g|webp)/i.test(file.mimetype);
    cb(ok ? null : new Error("Invalid image type"), ok);
  },
});

module.exports = upload;
