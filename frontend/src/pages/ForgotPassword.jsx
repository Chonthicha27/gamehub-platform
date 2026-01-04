// frontend/src/pages/ForgotPassword.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await api.post("/auth/forgot-password", { email });
      setMessage(
        "ถ้าอีเมลนี้มีในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว โปรดตรวจสอบกล่องจดหมายของคุณ"
      );
    } catch (err) {
      console.error(err);
      setMessage("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fp2-root">
      <style>{CSS_FORGOT}</style>

      <main className="fp2-max">
        {/* glow ด้านหลังการ์ด (ตอนนี้เป็นโทนเทา ไม่อมฟ้า) */}
        <div className="fp2-glow" />

        <section className="fp2-card">
          {/* header / brand */}
          <header className="fp2-header">
            <div className="fp2-logoCircle">BU</div>
            <div className="fp2-headerText">
              <p className="fp2-eyebrow">ACCOUNT SECURITY</p>
              <p className="fp2-subtitle">
                Reset your access to Discover, Play &amp; Share
              </p>
            </div>
          </header>

          <div className="fp2-divider" />

          <h1 className="fp2-title">Forgot your password?</h1>
          <p className="fp2-desc">
            ใส่อีเมลที่ใช้สมัคร BU GHub แล้วเราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้คุณ
            เพื่อให้บัญชีของคุณปลอดภัยอยู่เสมอ
          </p>

          <form onSubmit={handleSubmit} className="fp2-form">
            <label className="fp2-label">
              <span className="fp2-labelText">Email address</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="fp2-input"
              />
            </label>

            {message && <div className="fp2-message">{message}</div>}

            <button className="fp2-btnPrimary" type="submit" disabled={loading}>
              {loading ? "SENDING..." : "SEND RESET LINK"}
            </button>
          </form>

          <footer className="fp2-footerRow">
            <button type="button" className="fp2-link" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <button type="button" className="fp2-link" onClick={() => navigate("/")}>
              Return to home
            </button>
          </footer>
        </section>
      </main>
    </div>
  );
}

const CSS_FORGOT = `
/* ===== Background (neutral gray, no blue tone) ===== */
.fp2-root{
  min-height:100vh;
  /* เทาเข้มแบบ neutral (ไม่อมฟ้า) */
  background:
    radial-gradient(circle at 25% 15%, #1a1c21 0%, transparent 55%),
    radial-gradient(circle at 80% 85%, #16181d 0%, transparent 60%),
    linear-gradient(180deg, #0f1013 0%, #0b0c0f 100%);
  display:flex;
  justify-content:center;
  align-items:center;
  padding:44px 16px;
}

.fp2-max{
  width:100%;
  max-width:1180px;
  display:flex;
  justify-content:center;
  position:relative;
}

/* glow โทนเทา (ถ้าไม่อยากได้เลย -> ใส่ display:none;) */
.fp2-glow{
  position:absolute;
  inset:0;
  margin:auto;
  width:560px;
  height:360px;
  background:
    radial-gradient(circle at 30% 35%, rgba(255,255,255,.14), transparent 60%),
    radial-gradient(circle at 70% 75%, rgba(255,255,255,.09), transparent 62%);
  filter: blur(42px);
  opacity:.85;
  pointer-events:none;
}

/* ===== Card ===== */
.fp2-card{
  width:min(560px, 100%);
  position:relative;
  background:linear-gradient(180deg,#ffffff,#f6f7fb);
  border-radius:22px;
  padding:28px 32px 22px;
  border:1px solid rgba(209,213,219,.95);
  /* เพิ่มเงาเบาๆ ให้แยกจากพื้นหลังเทา */
  box-shadow:0 18px 50px rgba(0,0,0,.25);
}

/* ===== Header ===== */
.fp2-header{
  display:flex;
  align-items:center;
  gap:14px;
  margin-bottom:10px;
}

.fp2-logoCircle{
  width:44px;
  height:44px;
  border-radius:14px;
  background:#0b0c0f;
  display:flex;
  align-items:center;
  justify-content:center;
  color:#f9fafb;
  font-weight:800;
  font-size:16px;
  letter-spacing:.06em;
}

.fp2-headerText{
  display:flex;
  flex-direction:column;
  gap:2px;
}

.fp2-eyebrow{
  font-size:11px;
  letter-spacing:.18em;
  text-transform:uppercase;
  color:#9aa1ab;
  margin:0;
}

.fp2-subtitle{
  font-size:13px;
  color:#6b7280;
  margin:0;
}

.fp2-divider{
  height:1px;
  margin:12px 0 16px;
  background:linear-gradient(90deg, transparent, #d6d9e6, transparent);
}

/* ===== Title / Desc ===== */
.fp2-title{
  font-size:26px;
  font-weight:800;
  letter-spacing:-0.03em;
  color:#0b0c0f;
  margin:0 0 8px;
}

.fp2-desc{
  font-size:13.5px;
  color:#4b5563;
  line-height:1.65;
  margin:0 0 18px;
}

/* ===== Form ===== */
.fp2-form{
  display:flex;
  flex-direction:column;
  gap:12px;
}

.fp2-label{
  display:flex;
  flex-direction:column;
  gap:7px;
}

.fp2-labelText{
  font-size:11px;
  letter-spacing:.16em;
  text-transform:uppercase;
  color:#9aa1ab;
}

.fp2-input{
  border-radius:14px;
  border:1px solid #d7dbe6;
  background:#f1f3f7; /* เปลี่ยนจากฟ้าเป็นเทาอ่อน */
  padding:12px 14px;
  font-size:14px;
  color:#0b0c0f;
  outline:none;
}

.fp2-input::placeholder{ color:#9aa1ab; }

.fp2-input:focus{
  border-color:#111318;
  box-shadow:0 0 0 1px rgba(17,19,24,.55), 0 0 0 6px rgba(17,19,24,.12);
}

/* message */
.fp2-message{
  margin-top:2px;
  border-radius:14px;
  padding:10px 12px;
  border:1px solid #e5e7eb;
  background:#f3f4f6;  /* เทาอ่อน (ไม่อมฟ้า) */
  font-size:12px;
  color:#111827;
}

/* ===== Primary Button ===== */
.fp2-btnPrimary{
  margin-top:10px;
  width:100%;
  border:none;
  border-radius:999px;
  padding:13px 16px;
  font-size:13px;
  font-weight:750;
  letter-spacing:.12em;
  text-transform:uppercase;
  background:#0b0c0f;
  color:#f9fafb;
  cursor:pointer;
  transition:transform .12s ease, filter .12s ease, opacity .12s ease;
}

.fp2-btnPrimary:hover:not(:disabled){
  filter:brightness(1.05);
  transform:translateY(-1px);
}

.fp2-btnPrimary:disabled{
  opacity:.65;
  cursor:default;
}

/* ===== Footer ===== */
.fp2-footerRow{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-top:16px;
  padding-top:10px;
  border-top:1px solid rgba(209,213,219,.6);
}

.fp2-link{
  border:none;
  background:none;
  padding:6px 0;
  font-size:12px;
  color:#8b93a0;
  cursor:pointer;
}

.fp2-link:hover{
  color:#0b0c0f;
  text-decoration:underline;
}

/* responsive */
@media (max-width:640px){
  .fp2-card{
    padding:22px 18px 18px;
    border-radius:18px;
  }
  .fp2-title{ font-size:22px; }
  .fp2-glow{
    width:480px;
    height:320px;
    filter:blur(40px);
    opacity:.75;
  }
}
`;
