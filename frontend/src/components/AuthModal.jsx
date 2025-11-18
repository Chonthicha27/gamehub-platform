// AuthModal.jsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function AuthModal({ open, defaultTab = "login", onClose, onAuthed }) {
  const [tab, setTab] = useState(defaultTab);
  const emailRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => setTab(defaultTab), [defaultTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) setTimeout(() => emailRef.current?.focus(), 80);
  }, [open, tab]);

  if (!open) return null;

  const submitLogin = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      await api.post("/auth/login", payload, { withCredentials: true });
      onAuthed?.();
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || "Login failed";
      if (status === 403) {
        if (confirm(msg + "\n\nต้องการส่งลิงก์ยืนยันอีกครั้งไหม?")) {
          try {
            await api.post("/auth/resend-verify", { email: payload.email });
            alert("ส่งลิงก์ยืนยันอีกครั้งแล้ว โปรดตรวจสอบอีเมลของคุณ");
          } catch (e2) {
            alert(e2?.response?.data?.message || "ส่งเมลไม่สำเร็จ");
          }
        }
      } else {
        alert(msg);
      }
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (payload.password?.length < 6) return alert("Password needs 6+ characters");
    if (payload.password !== payload.confirm) return alert("Confirm password mismatch");
    try {
      const { data } = await api.post("/auth/register", payload, { withCredentials: true });
      alert(data?.message || "We sent a verification email. Please check your inbox.");
      setTab("login");
    } catch (err) {
      alert(err?.response?.data?.message || "Register failed");
    }
  };

  const base = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
  const oauthGoogle = () => (window.location.href = `${base}/auth/google`);
  const oauthGithub = () => (window.location.href = `${base}/auth/github`);

  const BG_URL = "/img/auth-left.png";

  const handleForgotPassword = () => {
    // ปิด modal ก่อน
    onClose?.();
    // ไปหน้า /forgot-password
    navigate("/forgot-password");
  };

  return createPortal(
    <div className="am2-backdrop" role="dialog" aria-modal="true">
      <style>{CSS}</style>

      <div className="am2-shell">
        {/* LEFT – ภาพ */}
        <section className="am2-left">
          <div className="am2-left__bg" style={{ backgroundImage: `url(${BG_URL})` }} />
          <div className="am2-brand">
            <div className="am2-logo">GPX</div>
            <div className="am2-slogan">Discover, Play & Share</div>
          </div>
        </section>

        {/* RIGHT – ฟอร์ม */}
        <section className="am2-right">
          <div className="am2-topbar">
            <div className="am2-tabs">
              <button
                className={`am2-tab ${tab === "login" ? "is-active" : ""}`}
                onClick={() => setTab("login")}
              >
                Log in
              </button>
              <button
                className={`am2-tab ${tab === "register" ? "is-active" : ""}`}
                onClick={() => setTab("register")}
              >
                Register
              </button>
            </div>
            <button className="am2-close" onClick={() => onClose?.()}>Close</button>
          </div>

          <div className="am2-pane">
            <h2 className="am2-title">{tab === "login" ? "Log in" : "Create account"}</h2>

            <div className="am2-oauth">
              <button className="am2-oauthBtn am2-oauthBtn--google" onClick={oauthGoogle}>
                <GoogleIcon /> <span>Google</span>
              </button>
              <button className="am2-oauthBtn am2-oauthBtn--github" onClick={oauthGithub}>
                <GitHubIcon /> <span>GitHub</span>
              </button>
            </div>

            <div className="am2-sep">
              <span>or use your email and password</span>
            </div>

            {tab === "login" ? (
              <form className="am2-form" onSubmit={submitLogin}>
                <label className="am2-label">Email</label>
                <input
                  ref={emailRef}
                  className="am2-input"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />

                <label className="am2-label">Password</label>
                <input
                  className="am2-input"
                  name="password"
                  type="password"
                  placeholder="your password"
                  required
                />

                <div className="am2-row">
                  <label className="am2-check">
                    <input type="checkbox" /> <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="am2-link"
                    onClick={handleForgotPassword}
                  >
                    Forgot your password?
                  </button>
                </div>

                <button className="am2-btn am2-btn--solid" type="submit">Sign in</button>
              </form>
            ) : (
              <form className="am2-form" onSubmit={submitRegister}>
                <label className="am2-label">Username</label>
                <input
                  ref={emailRef}
                  className="am2-input"
                  name="username"
                  type="text"
                  placeholder="yourname"
                  required
                />

                <label className="am2-label">Email</label>
                <input
                  className="am2-input"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />

                <div className="am2-grid2">
                  <div>
                    <label className="am2-label">Password</label>
                    <input
                      className="am2-input"
                      name="password"
                      type="password"
                      placeholder="min 6 characters"
                      required
                    />
                  </div>
                  <div>
                    <label className="am2-label">Confirm password</label>
                    <input
                      className="am2-input"
                      name="confirm"
                      type="password"
                      placeholder="repeat password"
                      required
                    />
                  </div>
                </div>

                <button className="am2-btn am2-btn--solid" type="submit">
                  Create account
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}

/* ----------- Icons ----------- */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.4 29.3 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10.3 0 18.6-7.3 19.6-17v-6.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.8 16.3 19 14 24 14c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6 29.2 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"/>
      <path fill="#4CAF50" d="M24 44c5.1 0 9.7-1.9 13.2-5.1l-6.1-5c-2 1.3-4.6 2.1-7.1 2.1-5.2 0-9.6-3.6-11.2-8.4l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 3.1-3.3 5.6-6.2 7.1l.1.1 6.1 5C37.5 41.5 44 36.2 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.7.5.9 5.3.9 11.6c0 4.9 3.2 9.1 7.6 10.6.6.1.8-.3.8-.6 0-.3 0-1.1 0-2.2-3.1.7-3.8-1.5-3.8-1.5-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.8 1.4 3.5 1.1.1-.8.4-1.4.8-1.8-2.5-.3-5.2-1.2-5.2-5.5 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.5.1-3.1 0 0 .9-.3 3 .1.9-.3 1.9-.4 2.9-.4s2 .1 2.9.4c2.1-.4 3-.1 3-.1.6 1.6.2 2.8.1 3.1.7.8 1.1 1.8 1.1 3 0 4.3-2.7 5.2-5.2 5.5.5.4.9 1.2.9 2.5 0 1.8 0 3.2 0 3.6 0 .3.2.7.8.6 4.4-1.5 7.6-5.7 7.6-10.6C23.1 5.3 18.3.5 12 .5z"/>
    </svg>
  );
}

/* ---------------- CSS (scoped) ---------------- */
const CSS = `
.am2-backdrop{
  position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.55); z-index:1000; padding:24px;
}
.am2-shell{
  width:min(1080px, 96vw); height:min(680px, 92vh);
  display:grid; grid-template-columns: 1fr 1fr; overflow:hidden;
  border-radius:22px; background:#0b0f14; box-shadow:0 20px 60px rgba(0,0,0,.6);
}

/* LEFT */
.am2-left{ position:relative; background:#000; }
.am2-left__bg{
  position:absolute; inset:0; background-size:cover; background-position:center;
  filter:none;
}
.am2-brand{ position:absolute; left:28px; top:24px; color:#cfe6ff; }
.am2-logo{ font-weight:900; letter-spacing:.5px; font-size:28px; }
.am2-slogan{ font-size:12px; opacity:.75; margin-top:2px; }

/* RIGHT */
.am2-right{ background:#f9fafc; position:relative; display:flex; flex-direction:column; }
.am2-topbar{ display:flex; align-items:center; justify-content:space-between; padding:20px 24px 4px; }
.am2-close{
  background:#0c1116; color:#fff; border:none; border-radius:16px; padding:8px 14px; font-weight:800;
  box-shadow:0 6px 20px rgba(0,0,0,.18); cursor:pointer;
}
.am2-tabs{ display:flex; gap:10px; }
.am2-tab{
  background:#e9edf4; border:none; border-radius:999px; padding:10px 18px; font-weight:800; cursor:pointer;
  color:#0c1116; box-shadow:inset 0 0 0 1px rgba(0,0,0,.05);
}
.am2-tab.is-active{ background:#0c1116; color:#fff; }

.am2-pane{ padding:10px 28px 24px; overflow:auto; }
.am2-title{ font-size:30px; margin:6px 0 18px; color:#0c1116; }

.am2-oauth{ display:flex; gap:12px; margin:8px 0 14px; }
.am2-oauthBtn{
  display:inline-flex; align-items:center; gap:10px; padding:10px 14px; border-radius:14px; font-weight:800;
  border:1px solid rgba(0,0,0,.08); background:#fff; color:#0c1116; cursor:pointer;
  box-shadow:0 6px 18px rgba(0,0,0,.06);
}
.am2-oauthBtn--google:hover{ box-shadow:0 8px 22px rgba(66,133,244,.18); }
.am2-oauthBtn--github:hover{ box-shadow:0 8px 22px rgba(0,0,0,.18); }

.am2-sep{ display:flex; align-items:center; gap:10px; color:#7a889b; margin:8px 0 16px; font-size:12px; }
.am2-sep::before, .am2-sep::after{ content:""; flex:1; height:1px; background:linear-gradient(90deg, transparent, #d9e2f1, transparent); }

.am2-form{ display:flex; flex-direction:column; gap:12px; }
.am2-grid2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.am2-label{ font-weight:800; font-size:12px; color:#334155; }
.am2-input{
  width:100%; border:1px solid #d7e1f1; background:#eef4ff; border-radius:14px; padding:12px 14px;
  outline:none; font-size:14px; color:#0b0f14;
}
.am2-input:focus{ border-color:#6aa8ff; box-shadow:0 0 0 4px rgba(106,168,255,.25); }

.am2-row{ display:flex; align-items:center; justify-content:space-between; margin-top:2px; }
.am2-check{ display:inline-flex; align-items:center; gap:8px; color:#475569; font-size:13px; }
.am2-link{ color:#0a58ff; font-weight:800; cursor:pointer; background:none; border:none; padding:0; }

.am2-btn{ margin-top:6px; width:100%; padding:14px; border-radius:16px; border:none; font-weight:900; cursor:pointer; }
.am2-btn--solid{ color:#fff; background:#0c1116; box-shadow:0 16px 36px rgba(0,0,0,.25); }
.am2-btn--solid:hover{ filter:brightness(1.04); transform: translateY(-1px); }

@media (max-width: 980px){
  .am2-shell{ grid-template-columns:1fr; height:min(680px, 96vh); }
  .am2-left{ display:none; }
}
`;
