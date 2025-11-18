// frontend/src/api/cdn.js
const API_BASE = (
  import.meta.env.VITE_CDN_ORIGIN ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:4000"
).replace(/\/+$/, ""); // ตัด "/" ท้าย

export function cdn(u = "") {
  if (!u) return "";
  const s = String(u).replace(/\\/g, "/"); // normalize backslash -> slash (กัน path จาก Windows)
  if (/^https?:\/\//i.test(s)) return s;   // เป็น URL เต็มอยู่แล้ว
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return `${API_BASE}/${s}`;               // กรณี "uploads/..."
}

export const API_ORIGIN = API_BASE;
