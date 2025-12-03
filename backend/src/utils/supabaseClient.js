// backend/src/utils/supabaseClient.js
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "games";

let supabase = null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY - storage disabled");
} else {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  console.log("[Supabase] client initialised");
}

// เดา content-type แบบง่าย ๆ จากนามสกุลไฟล์
function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html" || ext === ".htm") return "text/html";
  if (ext === ".zip") return "application/zip";
  if (ext === ".js") return "text/javascript";
  if (ext === ".css") return "text/css";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".rar") return "application/vnd.rar";
  return "application/octet-stream";
}

/**
 * อัปโหลดไฟล์จากดิสก์ขึ้น Supabase Storage แล้วคืน public URL
 * @param {string} localPath - path บนเครื่องเซิร์ฟเวอร์ เช่น "/tmp/xxx.zip"
 * @param {string} key       - path ใน bucket เช่น "games/slug-123/index.html"
 * @param {string} contentType - ถ้าไม่ส่งจะเดาให้
 */
async function uploadLocalFile(localPath, key, contentType) {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }

  const ct = contentType || guessContentType(localPath);
  const fileBuffer = await fs.promises.readFile(localPath);

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(key, fileBuffer, {
      contentType: ct,
      upsert: true,
    });

  if (error) {
    console.error("[Supabase] upload error:", error);
    throw error;
  }

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

/**
 * ลบไฟล์ทั้งหมดที่ขึ้นต้นด้วย prefix ที่กำหนด
 * (ลบแบบง่าย ๆ: สมมติว่าไฟล์ทั้งหมดอยู่ในโฟลเดอร์เดียว ไม่ซ้อนหลายชั้นเยอะ ๆ)
 * @param {string} prefix - เช่น "games/slug-123"
 */
async function deletePrefix(prefix) {
  if (!supabase) return;
  const folder = prefix.replace(/\/$/, ""); // ตัด / ท้ายออกถ้ามี

  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .list(folder, { limit: 1000 });

  if (error) {
    console.warn("[Supabase] list for deletePrefix error:", error.message || error);
    return;
  }

  if (!data || data.length === 0) return;

  const toRemove = data.map((obj) => `${folder}/${obj.name}`);

  const { error: rmErr } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .remove(toRemove);

  if (rmErr) {
    console.warn("[Supabase] remove error in deletePrefix:", rmErr.message || rmErr);
  }
}

module.exports = {
  uploadLocalFile,
  deletePrefix,
};
