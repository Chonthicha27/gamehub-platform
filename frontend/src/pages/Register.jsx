// frontend/src/pages/Register.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { API_BASE_URL } from "../api/axios";

function AuthShell({ initialMode = "signup" }) {
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");

  const nav = useNavigate();
  useEffect(() => setMode(initialMode), [initialMode]);
  const toggle = () => { setErr(""); setMode(m => (m === "signin" ? "signup" : "signin")); };

  const oauth = (provider) => {
    const base = API_BASE_URL?.replace(/\/api$/, "") || "";
    window.location.href = `${base}/auth/${provider}`;
  };

  const submitSignin = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password: pass });
      if (data?.token) localStorage.setItem("token", data.token);
      nav("/");
    } catch (ex) {
      setErr(ex?.response?.data?.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally { setLoading(false); }
  };

  const submitSignup = async (e) => {
    e.preventDefault();
    setErr("");
    if (pass.length < 6) return setErr("Password ต้องยาวอย่างน้อย 6 ตัวอักษร");
    if (pass !== pass2)   return setErr("รหัสผ่านไม่ตรงกัน");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", { username: name, email, password: pass });
      if (data?.token) localStorage.setItem("token", data.token);
      nav("/");
    } catch (ex) {
      setErr(ex?.response?.data?.message || "สมัครสมาชิกไม่สำเร็จ");
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      {/* scoped CSS เดิม (เท่ากับใน Login.jsx) */}
      <style>{`
        :root{ --bg:#0b0f16; --panel:#101727; --text:#ecf0ff; --muted:#a7b4d8; --border:rgba(255,255,255,.08);
               --pri1:#7c4dff; --pri2:#00d4ff; --ok:#22c55e; --danger:#ef4444; }
        .auth-page{min-height:100dvh;display:grid;place-items:center;background:
          radial-gradient(1200px 600px at 10% -10%, #19254a 0%, transparent 60%),
          radial-gradient(900px 500px at 90% 110%, #0f2838 0%, transparent 55%), var(--bg);
          padding:24px;color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai",sans-serif;}
        .auth-card{width:min(980px,96vw);height:560px;position:relative;border-radius:24px;overflow:hidden;background:#0f1528;
          box-shadow:0 30px 80px rgba(0,0,0,.55);isolation:isolate;transition:transform .5s cubic-bezier(.2,.8,.2,1);}
        .promo-panel{position:absolute;inset:0;width:50%;display:grid;place-items:center;color:#fff;z-index:1;}
        .promo-panel .promo-inner{text-align:center;max-width:320px;}
        .promo-panel .promo-inner h3{font-size:28px;margin:0 0 8px;font-weight:900;}
        .promo-panel .promo-inner p{margin:0 0 18px;color:#e8f3ff;opacity:.9;}
        .promo-panel.left{left:0;} .promo-panel.right{right:0;}
        .promo-panel::before{content:"";position:absolute;inset:auto 0 auto auto;width:120%;height:120%;}
        .promo-panel.left::before{left:-15%;top:-10%;
          background:radial-gradient(800px 800px at 100% 50%, #1b2060 0%, #241070 40%, #2b0f65 60%, transparent 60%),
                     linear-gradient(135deg,var(--pri1),var(--pri2));
          border-bottom-right-radius:220px;}
        .promo-panel.right::before{right:-15%;top:-10%;
          background:radial-gradient(800px 800px at 0% 50%, #0c4866 0%, #173e6a 40%, #0a2a55 60%, transparent 60%),
                     linear-gradient(135deg,var(--pri1),var(--pri2));
          border-bottom-left-radius:220px;}
        .promo-panel .btn.outline{border:2px solid rgba(255,255,255,.9);color:#fff;background:transparent;}
        .promo-panel .btn.outline:hover{background:rgba(255,255,255,.1);}
        .form-panel{position:absolute;inset:0;width:50%;z-index:2;display:grid;place-items:center;
          background:linear-gradient(180deg,#0d1326 0%, #0c1222 100%);}
        .form-panel.left{left:0;} .form-panel.right{right:0;}
        .title{font-size:32px;font-weight:900;margin:0 0 16px;}
        .muted{color:var(--muted);font-size:13px;} .center{text-align:center;}
        .form{display:grid;gap:10px;width:min(360px,84%);}
        .input{padding:12px 14px;border-radius:12px;background:#0b1120;color:var(--text);border:1px solid #1f2a48;outline:none;}
        .input:focus{border-color:#5ea7ff;box-shadow:0 0 0 3px rgba(94,167,255,.18);}
        .error{color:#ffd1d1;background:#3c121b;border:1px solid #6e2531;padding:8px 10px;border-radius:10px;font-size:13px;}
        .socials{display:flex;gap:10px;justify-content:center;margin:6px 0 10px;}
        .social{width:36px;height:36px;border-radius:10px;background:#0b1120;color:#cfe2ff;border:1px solid #203057;font-weight:900;}
        .social:disabled{opacity:.4;cursor:not-allowed;}
        .btn{padding:10px 14px;border-radius:12px;cursor:pointer;border:1px solid #2a3a66;color:#e6edff;background:#0e172b;
          font-weight:900;transition:.2s;letter-spacing:.2px;}
        .btn.wide{width:100%;} .btn.primary{border:none;color:#081018;background:linear-gradient(135deg,var(--pri1),var(--pri2));}
        .btn.ghost{background:#0f1627;} .btn.sm{font-size:13px;padding:8px 10px;} .btn:hover{filter:brightness(1.08);transform:translateY(-1px);}
        .switch{margin-top:10px;}
        .auth-card.flip .form-panel.left{transform:translateX(-100%);opacity:0;pointer-events:none;}
        .auth-card.flip .promo-panel.left{opacity:0;pointer-events:none;}
        .auth-card.flip .form-panel.right{transform:translateX(0);opacity:1;pointer-events:auto;}
        .auth-card.flip .promo-panel.right{opacity:1;pointer-events:auto;}
        .form-panel.right{transform:translateX(100%);opacity:0;transition:all .5s cubic-bezier(.2,.8,.2,1);}
        .form-panel.left{transition:all .5s cubic-bezier(.2,.8,.2,1);} .promo-panel{transition:opacity .5s ease;}
        @media (max-width:900px){
          .auth-card{height:auto;}
          .promo-panel{display:none;}
          .form-panel{position:relative;width:100%;transform:none!important;opacity:1!important;}
          .auth-card.flip .form-panel{display:none;}
          .auth-card.flip .form-panel.right{display:grid;}
        }
      `}</style>

      <div className={`auth-card ${mode === "signup" ? "flip" : ""}`}>
        {/* Sign In */}
        <div className="panel form-panel left">
          <h2 className="title">Sign In</h2>

          <div className="socials">
            <button className="social" onClick={() => oauth("github")} aria-label="GitHub">GH</button>
            <button className="social" onClick={() => oauth("google")} aria-label="Google">G</button>
            <button className="social" disabled aria-label="LinkedIn">in</button>
          </div>

          <div className="muted center">หรือใช้ email ของคุณ</div>

          <form className="form" onSubmit={submitSignin}>
            <input className="input" type="email" placeholder="Email" value={email}
                   onChange={e=>setEmail(e.target.value)} required autoComplete="email" />
            <input className="input" type="password" placeholder="Password" value={pass}
                   onChange={e=>setPass(e.target.value)} required autoComplete="current-password" />
            {err && mode === "signin" && <div className="error">{err}</div>}
            <button className="btn primary wide" disabled={loading}>
              {loading && mode === "signin" ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <button className="btn ghost sm switch" type="button" onClick={toggle}>
            ยังไม่มีบัญชี? <b>สร้างบัญชี</b>
          </button>

          <div className="center" style={{marginTop:8}}>
            <Link className="btn sm" to="/">Back to Home</Link>
          </div>
        </div>

        <div className="panel promo-panel right">
          <div className="promo-inner">
            <h3>Hello, Friend!</h3>
            <p>สมัครสมาชิกเพื่อใช้งานครบทุกฟีเจอร์ของ GameHub</p>
            <button className="btn outline" onClick={toggle}>Sign Up</button>
          </div>
        </div>

        {/* Sign Up */}
        <div className="panel form-panel right">
          <h2 className="title">Create account</h2>

          <div className="socials">
            <button className="social" onClick={() => oauth("github")} aria-label="GitHub">GH</button>
            <button className="social" onClick={() => oauth("google")} aria-label="Google">G</button>
            <button className="social" disabled aria-label="LinkedIn">in</button>
          </div>

          <div className="muted center">หรือใช้ email ของคุณ</div>

          <form className="form" onSubmit={submitSignup}>
            <input className="input" type="text" placeholder="Name" value={name}
                   onChange={e=>setName(e.target.value)} required />
            <input className="input" type="email" placeholder="Email" value={email}
                   onChange={e=>setEmail(e.target.value)} required />
            <input className="input" type="password" placeholder="Password (>= 6 ตัว)"
                   value={pass} onChange={e=>setPass(e.target.value)} required />
            <input className="input" type="password" placeholder="Confirm password"
                   value={pass2} onChange={e=>setPass2(e.target.value)} required />
            {err && mode === "signup" && <div className="error">{err}</div>}
            <button className="btn primary wide" disabled={loading}>
              {loading && mode === "signup" ? "Creating…" : "Sign Up"}
            </button>
          </form>

          <button className="btn ghost sm switch" type="button" onClick={toggle}>
            มีบัญชีอยู่แล้ว? <b>เข้าสู่ระบบ</b>
          </button>
        </div>

        <div className="panel promo-panel left">
          <div className="promo-inner">
            <h3>Welcome Back!</h3>
            <p>เข้าสู่ระบบเพื่อจัดการ/อัปโหลดเกมของคุณ</p>
            <button className="btn outline" onClick={toggle}>Sign In</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  // โหมดเริ่มต้นเป็น Sign Up
  return <AuthShell initialMode="signup" />;
}
