// frontend/src/pages/ResetPassword.jsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function ResetPassword() {
  const query = useQuery();
  const token = query.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setMessage("ลิงก์ไม่ถูกต้อง หรือหมดอายุแล้ว");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 6) {
      return setMessage("รหัสผ่านอย่างน้อย 6 ตัวอักษร");
    }
    if (password !== confirm) {
      return setMessage("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    }

    setLoading(true);
    setMessage("");

    try {
      await api.post("/auth/reset-password", { token, password });
      setMessage("ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กำลังพาไปหน้าเข้าสู่ระบบ...");
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.message ||
          "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอใหม่อีกครั้ง"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rp2-root">
      <style>{CSS_RESET}</style>

      <main className="rp2-max">
        <div className="rp2-glow" />

        <section className="rp2-card">
          <header className="rp2-header">
            <div className="rp2-logoCircle">GPX</div>
            <div className="rp2-headerText">
              <p className="rp2-eyebrow">SECURITY UPDATE</p>
              <p className="rp2-subtitle">
                Set a fresh password for your account
              </p>
            </div>
          </header>

          <div className="rp2-divider" />

          <h1 className="rp2-title">Set a new password</h1>
          <p className="rp2-desc">
            ตั้งรหัสผ่านใหม่สำหรับบัญชี GPX ของคุณ
            แนะนำให้ใช้รหัสผ่านที่ไม่ซ้ำกับที่อื่นเพื่อความปลอดภัย
          </p>

          <form onSubmit={handleSubmit} className="rp2-form">
            <label className="rp2-label">
              <span className="rp2-labelText">New password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="rp2-input"
              />
            </label>

            <label className="rp2-label">
              <span className="rp2-labelText">Confirm password</span>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                className="rp2-input"
              />
            </label>

            {message && <div className="rp2-message">{message}</div>}

            <button
              className="rp2-btnPrimary"
              type="submit"
              disabled={loading || !token}
            >
              {loading ? "SAVING..." : "RESET PASSWORD"}
            </button>
          </form>

          <footer className="rp2-footerRow">
            <button
              type="button"
              className="rp2-link"
              onClick={() => navigate("/")}
            >
              ← Back to home
            </button>
            <button
              type="button"
              className="rp2-link"
              onClick={() => navigate("/")}
            >
              Go to sign in
            </button>
          </footer>
        </section>
      </main>
    </div>
  );
}

const CSS_RESET = `
.rp2-root{
  min-height:100vh;
  background:radial-gradient(circle at top,#020617 0,#020617 55%);
  display:flex;
  justify-content:center;
  align-items:center;
  padding:40px 16px;
}
.rp2-max{
  width:100%;
  max-width:1180px;
  display:flex;
  justify-content:center;
  position:relative;
}
.rp2-glow{
  position:absolute;
  inset:0;
  margin:auto;
  width:520px;
  height:340px;
  background:
    radial-gradient(circle at top, rgba(52,211,153,0.35), transparent 65%),
    radial-gradient(circle at bottom, rgba(96,165,250,0.35), transparent 65%);
  filter:blur(38px);
  opacity:.95;
  pointer-events:none;
}
.rp2-card{
  width:min(560px,100%);
  position:relative;
  background:linear-gradient(180deg,#fdfefe,#f5f6fb);
  border-radius:20px;                 /* ลดความมน */
  padding:26px 30px 22px;
  border:1px solid rgba(209,213,219,0.9);
  box-shadow:none;                    /* ไม่มีเงาการ์ด */
}

.rp2-header{
  display:flex;
  align-items:center;
  gap:14px;
  margin-bottom:10px;
}
.rp2-logoCircle{
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
.rp2-headerText{
  display:flex;
  flex-direction:column;
  gap:2px;
}
.rp2-eyebrow{
  font-size:11px;
  letter-spacing:.20em;
  text-transform:uppercase;
  color:#9ca3af;
}
.rp2-subtitle{
  font-size:13px;
  color:#6b7280;
}
.rp2-divider{
  height:1px;
  margin:10px 0 14px;
  background:linear-gradient(90deg,transparent,#d4d7e4,transparent);
}

/* text */
.rp2-title{
  font-size:26px;
  font-weight:800;
  letter-spacing:-0.03em;
  color:#020617;
  margin:0 0 6px;
}
.rp2-desc{
  font-size:13.5px;
  color:#4b5563;
  line-height:1.6;
  margin-bottom:18px;
}

/* form */
.rp2-form{
  display:flex;
  flex-direction:column;
  gap:12px;
}
.rp2-label{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.rp2-labelText{
  font-size:11px;
  letter-spacing:.16em;
  text-transform:uppercase;
  color:#9ca3af;
}
.rp2-input{
  border-radius:16px;
  border:1px solid #d7e1f1;
  background:#eef4ff;
  padding:12px 14px;
  font-size:14px;
  color:#020617;
  outline:none;
}
.rp2-input::placeholder{
  color:#9ca3af;
}
.rp2-input:focus{
  border-color:#22c55e;
  box-shadow:0 0 0 1px rgba(34,197,94,0.9),0 0 0 6px rgba(34,197,94,0.20);
}

/* message */
.rp2-message{
  margin-top:2px;
  border-radius:16px;
  padding:10px 12px;
  border:1px solid #bbf7d0;
  background:#dcfce7;
  font-size:12px;
  color:#14532d;
}

/* button */
.rp2-btnPrimary{
  margin-top:8px;
  width:100%;
  border:none;
  border-radius:999px;
  padding:13px 16px;
  font-size:13px;
  font-weight:700;
  letter-spacing:.12em;
  text-transform:uppercase;
  background:#16a34a;
  color:#f9fafb;
  cursor:pointer;
  box-shadow:none;                   /* ไม่มีเงาปุ่ม */
  transition:transform .12s ease, filter .12s ease;
}
.rp2-btnPrimary:hover:not(:disabled){
  filter:brightness(1.03);
  transform:translateY(-1px);
}
.rp2-btnPrimary:disabled{
  opacity:.65;
  cursor:default;
}

/* footer */
.rp2-footerRow{
  display:flex;
  justify-content:space-between;
  margin-top:16px;
}
.rp2-link{
  border:none;
  background:none;
  padding:0;
  font-size:12px;
  color:#9ca3af;
  cursor:pointer;
}
.rp2-link:hover{
  color:#020617;
  text-decoration:underline;
}

@media (max-width:640px){
  .rp2-card{
    padding:22px 18px 18px;
    border-radius:18px;
  }
  .rp2-title{ font-size:22px; }
}
`;
