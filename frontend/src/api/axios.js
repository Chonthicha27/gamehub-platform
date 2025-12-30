// frontend/src/api/axios.js
import axios from "axios";

// อ่าน baseURL จาก env ถ้าไม่มีให้ fallback เป็น localhost
const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

const api = axios.create({
  baseURL,
  withCredentials: true, // ต้องมีเพื่อให้ cookie / session ทำงานข้ามโดเมน
});

// ✅ Auto attach Bearer token for ALL requests (สำคัญมากสำหรับ /users/me, /games/:id)
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

export default api;
