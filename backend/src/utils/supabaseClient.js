// backend/src/utils/supabaseClient.js
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_BUCKET) {
  console.warn("[Supabase] Missing env - storage will NOT work");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** เดา Content-Type จากนามสกุลไฟล์ */
function guessContentType(key) {
  const ext = path.extname(key).toLowerCase();

  if (ext === ".html" || ext === ".htm") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";

  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";

  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";

  if (ext === ".mp4") return "video/mp4";
  if (ext === ".wasm") return "application/wasm";

  return "application/octet-stream";
}

/**
 * อัปโหลดไฟล์จากดิสก์ขึ้น Supabase แล้วคืน public URL
 * @param {string} localPath - path บนเซิร์ฟเวอร์ (เช่น /tmp/xxx/index.html)
 * @param {string} key - path ใน bucket (เช่น games/slug-123/index.html)
 */
async function uploadLocalFile(localPath, key) {
  if (!SUPABASE_BUCKET) throw new Error("SUPABASE_BUCKET not set");

  const contentType = guessContentType(key);
  const buffer = await fs.promises.readFile(localPath);

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(key, buffer, {
      upsert: true,
      contentType,
    });

  if (error) {
    console.error("[Supabase upload] error:", error);
    throw error;
  }

  const { data } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(key);

  return data.publicUrl;
}

/**
 * ลบไฟล์ทั้งหมดที่ขึ้นต้นด้วย prefix
 * เช่น prefix = "games/slug-123"
 */
async function deletePrefix(prefix) {
  if (!SUPABASE_BUCKET) return;

  // list ไฟล์ใต้ prefix
  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .list(prefix, {
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

  if (error) {
    console.error("[Supabase deletePrefix] list error:", error);
    return;
  }

  if (!data || data.length === 0) return;

  const paths = data.map((item) =>
    `${prefix}/${item.name}`.replace(/\/+/g, "/")
  );

  const { error: delError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .remove(paths);

  if (delError) {
    console.error("[Supabase deletePrefix] remove error:", delError);
  }
}

module.exports = {
  uploadLocalFile,
  deletePrefix,
};
