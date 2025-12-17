// frontend/src/api/cdn.js

const API_ORIGIN = (
  import.meta.env.VITE_CDN_ORIGIN ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:4000/api"
)
  .replace(/\/+$/, "")
  .replace(/\/api$/, ""); // เหลือแค่ origin ของ backend

export function cdn(u = "") {
  if (!u) return "";
  const s = String(u).trim().replace(/\\/g, "/");
  if (!s) return "";

  // already absolute / special
  if (
    /^https?:\/\//i.test(s) ||
    s.startsWith("data:") ||
    s.startsWith("blob:")
  ) {
    return s;
  }

  // normalize path
  const path = s.startsWith("/") ? s : `/${s}`;

  // ✅ only these should be served from backend
  if (
    path.startsWith("/uploads/") ||
    path.startsWith("/files/") ||
    path.startsWith("/covers/") ||
    path.startsWith("/avatars/") ||
    path.startsWith("/banners/")
  ) {
    return `${API_ORIGIN}${path}`;
  }

  // ✅ otherwise treat as frontend public asset
  // ex: /avatar-default.png, /no-cover.png, /profile-banner-fallback.jpg
  return path;
}

export { API_ORIGIN };
