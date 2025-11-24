// frontend/src/api/cdn.js

// เอา origin สำหรับไฟล์จาก 2 ที่:
// 1) VITE_CDN_ORIGIN  (ถ้าอยาก override)
// 2) VITE_API_BASE_URL แล้วตัด /api ทิ้ง ให้เหลือแค่ origin ของ backend
const API_BASE = (
  import.meta.env.VITE_CDN_ORIGIN ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:4000/api"
)
  .replace(/\/+$/, "")      // ตัด / ท้าย
  .replace(/\/api$/, "");   // ถ้าเป็น .../api ให้ตัด /api ออก → เหลือแค่ origin

export function cdn(u = "") {
  if (!u) return "";
  const s = String(u).replace(/\\/g, "/"); // กัน backslash จาก Windows
  if (/^https?:\/\//i.test(s)) return s;   // ถ้าเป็น URL เต็มอยู่แล้วก็ใช้เลย
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return `${API_BASE}/${s}`;               // กรณี "uploads/..."
}

export const API_ORIGIN = API_BASE;
