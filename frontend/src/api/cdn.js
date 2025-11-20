// frontend/src/api/cdn.js

// -------------------------------------------------------------------
// BASE URL สำหรับโหลดไฟล์เกมจาก backend (Render)
// ลำดับความสำคัญ:
// 1) VITE_CDN_BASE_URL   ← ให้ตั้งใน Vercel = https://gpx-api-h6r0.onrender.com
// 2) VITE_API_BASE_URL   ← เผื่อมีใช้ที่อื่น
// 3) VITE_API_BASE       ← ค่า fallback เดิม
// 4) http://localhost:4000 ← fallback สำหรับ dev
// -------------------------------------------------------------------
const CDN_BASE =
  import.meta.env.VITE_CDN_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:4000";

/**
 * รับ path เช่น:
 *   "/uploads/xxxx/index.html"
 *   "uploads/xxxx/index.html"
 *
 * คืนค่าเป็น URL เต็ม เช่น:
 *   "https://gpx-api-h6r0.onrender.com/uploads/xxxx/index.html"
 */
export function buildUploadUrl(path = "") {
  if (!path) return "";

  let p = String(path).trim();

  // ถ้าเป็น URL เต็มอยู่แล้ว
  if (/^https?:\/\//i.test(p)) return p;

  // normalize slash
  p = p.replace(/\\/g, "/");

  // บังคับให้ขึ้นต้นด้วย "/"
  if (!p.startsWith("/")) p = "/" + p;

  return `${CDN_BASE}${p}`;
}

export default buildUploadUrl;
