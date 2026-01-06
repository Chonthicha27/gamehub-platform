// frontend/src/api/axios.js
import axios from "axios";

// อ่าน baseURL จาก env ถ้าไม่มีให้ fallback เป็น localhost
const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

const api = axios.create({
  baseURL,
  withCredentials: true, // ต้องมีเพื่อให้ cookie / session ทำงานข้ามโดเมน
});

// ✅ Auto attach Bearer token for ALL requests
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

function formatUntil(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

async function bestEffortLogout() {
  // พยายามล้าง session cookie (passport) ด้วย
  try {
    await api.get("/auth/logout", { withCredentials: true });
  } catch {}
}

function goHomeLoggedOut() {
  // ถ้าเว็บคุณเป็น SPA ที่หน้า login เป็น modal บนหน้า home
  // ให้กลับ / เพื่อเห็นหน้า home แบบไม่ล็อกอิน
  if (window.location.pathname !== "/") {
    window.location.href = "/";
  } else {
    // อยู่หน้า home อยู่แล้ว -> รีเฟรชสถานะ
    window.location.reload();
  }
}

// ✅ Auto handle suspended user (1 popup only)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    const data = err?.response?.data || {};
    const code = data?.code;

    if (status === 403 && code === "SUSPENDED") {
      const reason = (data.reason || "").toString().trim();
      const untilTxt = formatUntil(data.suspendedUntil);

      let msg = "บัญชีถูกระงับการใช้งาน";
      if (reason) msg += `\nเหตุผล: ${reason}`;
      if (untilTxt) msg += `\nถึง: ${untilTxt}`;

      // ล้าง token ฝั่ง client
      try {
        localStorage.removeItem("token");
      } catch {}

      // ล้าง session cookie ฝั่ง server (กันกรณีใช้ passport session)
      await bestEffortLogout();

      alert(msg);
      goHomeLoggedOut();

      // ✅ กันไม่ให้ error นี้ไปถึง caller แล้วเด้งซ้อน
      return new Promise(() => {});
    }

    return Promise.reject(err);
  }
);

export default api;
