// frontend/src/api/axios.js
import axios from "axios";

// เลือก base URL จาก env ถ้าไม่มีก็ fallback เป็น localhost
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||   // ใช้ตัวนี้เป็นหลัก (production บน Vercel)
  import.meta.env.VITE_API_BASE ||       // เผื่อเคยตั้งชื่อเก่าไว้ตอน dev
  "http://localhost:4000/api";           // fallback ตอนรัน backend ในเครื่อง

// (ช่วยเช็กเวลาเปิดหน้าเว็บว่าเรียกไปโดเมนไหน)
console.log("[API] baseURL =", API_BASE);

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // ต้องมีเพื่อส่ง cookie / session
});

export default api;
