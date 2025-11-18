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
        {/* glow ด้านหลังการ์ด */}
        <div className="fp2-glow" />

        <section className="fp2-card">
          {/* header / brand */}
          <header className="fp2-header">
            <div className="fp2-logoCircle">GPX</div>
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
            ใส่อีเมลที่ใช้สมัคร GPX แล้วเราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้คุณ
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

            <button
              className="fp2-btnPrimary"
              type="submit"
              disabled={loading}
            >
              {loading ? "SENDING..." : "SEND RESET LINK"}
            </button>
          </form>

          <footer className="fp2-footerRow">
            <button
              type="button"
              className="fp2-link"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
            <button
              type="button"
              className="fp2-link"
              onClick={() => navigate("/")}
            >
              Return to home
            </button>
          </footer>
        </section>
      </main>
    </div>
  );
}

const CSS_FORGOT = `
.fp2-root {
  min-height: 100vh;
  background: radial-gradient(circle at top, #020617 0, #020617 55%);
  display:flex;
  justify-content:center;
  align-items:center;
  padding:40px 16px;
}

.fp2-max{
  width:100%;
  max-width:1180px;
  display:flex;
  justify-content:center;
  position:relative;
}

.fp2-glow{
  position:absolute;
  inset:0;
  margin:auto;
  width:520px;
  height:340px;
  background:
    radial-gradient(circle at top, rgba(148, 163, 255, 0.35), transparent 65%),
    radial-gradient(circle at bottom, rgba(56, 189, 248, 0.35), transparent 65%);
  filter: blur(38px);
  opacity: .95;
  pointer-events:none;
}

/* card */
.fp2-card{
  width:min(560px, 100%);
  position:relative;
  background:linear-gradient(180deg,#fdfefe,#f5f6fb);
  border-radius:20px;                 /* ขอบไม่มนมาก */
  padding:26px 30px 22px;
  border:1px solid rgba(209,213,219,0.9);
  box-shadow:none;                    /* ไม่มีเงาการ์ด */
}

/* header */
.fp2-header{
  display:flex;
  align-items:center;
  gap:14px;
  margin-bottom:10px;
}
.fp2-logoCircle{
  width:44px;
  height:44px;
  border-radius:18px;
  background:#020617;
  display:flex;
  align-items:center;
  justify-content:center;
  color:#f9fafb;
  font-weight:900;
  font-size:18px;
  letter-spacing:.04em;
  box-shadow:none;                    /* ไม่มีเงาโลโก้ */
}
.fp2-headerText{
  display:flex;
  flex-direction:column;
  gap:2px;
}
.fp2-eyebrow{
  font-size:11px;
  letter-spacing:.20em;
  text-transform:uppercase;
  color:#9ca3af;
}
.fp2-subtitle{
  font-size:13px;
  color:#6b7280;
}

.fp2-divider{
  height:1px;
  margin:10px 0 14px;
  background:linear-gradient(90deg,transparent,#d4d7e4,transparent);
}

/* title / desc */
.fp2-title{
  font-size:26px;
  font-weight:800;
  letter-spacing:-0.03em;
  color:#020617;
  margin:0 0 6px;
}
.fp2-desc{
  font-size:13.5px;
  color:#4b5563;
  line-height:1.6;
  margin-bottom:18px;
}

/* form */
.fp2-form{
  display:flex;
  flex-direction:column;
  gap:12px;
}
.fp2-label{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.fp2-labelText{
  font-size:11px;
  letter-spacing:.16em;
  text-transform:uppercase;
  color:#9ca3af;
}
.fp2-input{
  border-radius:16px;
  border:1px solid #d7e1f1;
  background:#eef4ff;
  padding:12px 14px;
  font-size:14px;
  color:#020617;
  outline:none;
}
.fp2-input::placeholder{
  color:#9ca3af;
}
.fp2-input:focus{
  border-color:#6aa8ff;
  box-shadow:0 0 0 1px rgba(106,168,255,0.9),0 0 0 6px rgba(106,168,255,0.20);
}

/* message */
.fp2-message{
  margin-top:2px;
  border-radius:16px;
  padding:10px 12px;
  border:1px solid #dbeafe;
  background:#e0f2fe;
  font-size:12px;
  color:#1e293b;
}

/* primary button */
.fp2-btnPrimary{
  margin-top:8px;
  width:100%;
  border:none;
  border-radius:999px;
  padding:13px 16px;
  font-size:13px;
  font-weight:700;
  letter-spacing:.12em;
  text-transform:uppercase;
  background:#0c1116;
  color:#f9fafb;
  cursor:pointer;
  box-shadow:none;                    /* ไม่มีเงาปุ่ม */
  transition:transform .12s ease, filter .12s ease;
}
.fp2-btnPrimary:hover:not(:disabled){
  filter:brightness(1.03);
  transform:translateY(-1px);
}
.fp2-btnPrimary:disabled{
  opacity:.65;
  cursor:default;
}

/* footer */
.fp2-footerRow{
  display:flex;
  justify-content:space-between;
  margin-top:16px;
}
.fp2-link{
  border:none;
  background:none;
  padding:0;
  font-size:12px;
  color:#9ca3af;
  cursor:pointer;
}
.fp2-link:hover{
  color:#020617;
  text-decoration:underline;
}

/* responsive */
@media (max-width:640px){
  .fp2-card{
    padding:22px 18px 18px;
    border-radius:18px;
  }
  .fp2-title{ font-size:22px; }
}
`;
