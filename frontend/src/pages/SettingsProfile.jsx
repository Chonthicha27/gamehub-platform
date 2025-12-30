// frontend/src/pages/SettingsProfile.jsx
import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { cdn } from "../api/cdn";

export default function SettingsProfile() {
  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // ✅ แบบที่ 1: ใช้ username เป็นชื่อโชว์ด้วย
  const [username, setUsername] = useState("");

  // ✅ เอา Website กลับมา + มี YouTube
  const [links, setLinks] = useState({
    website: "",
    twitter: "",
    youtube: "",
    github: "",
  });

  const pickAvatarRef = useRef(null);
  const pickBannerRef = useRef(null);

  const syncMeEverywhere = (u) => {
    try {
      localStorage.setItem("me", JSON.stringify(u));

      const prevUser = (() => {
        try {
          return JSON.parse(localStorage.getItem("user") || "null");
        } catch {
          return null;
        }
      })();

      const nextUser = prevUser
        ? {
            ...prevUser,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
            bannerUrl: u.bannerUrl,
            username: u.username,
            email: u.email,
            role: u.role,
          }
        : u;

      localStorage.setItem("user", JSON.stringify(nextUser));
      window.dispatchEvent(new CustomEvent("me:updated", { detail: u }));
    } catch {
      // ignore
    }
  };

  const refreshMe = async () => {
    const u = (await api.get("/users/me")).data;
    setMe(u);

    setUsername(u.username || "");
    setLinks({
      website: u.links?.website || "",
      twitter: u.links?.twitter || "",
      youtube: u.links?.youtube || "",
      github: u.links?.github || "",
    });

    syncMeEverywhere(u);
    return u;
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshMe();
      } catch (e) {
        console.error(e);
        setMe(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sanitizeUsername = (v) =>
    String(v || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._]/g, "");

  const normalizeWebsite = (v) => {
    const s = String(v || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    // ให้ user พิมพ์โดเมนเฉยๆ ก็ได้ → เติม https ให้
    return `https://${s}`;
  };

  const onSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const cleanUsername = sanitizeUsername(username);

      if (!cleanUsername || cleanUsername.length < 3) {
        setMsg("Username must be at least 3 characters.");
        setSaving(false);
        return;
      }
      if (cleanUsername.length > 20) {
        setMsg("Username is too long (max 20).");
        setSaving(false);
        return;
      }

      const payload = {
        username: cleanUsername,
        displayName: cleanUsername, // ✅ displayName ตาม username
        links: {
          website: normalizeWebsite(links.website),
          twitter: links.twitter || "",
          youtube: links.youtube || "",
          github: links.github || "",
        },
      };

      await api.put("/users/me", payload);
      await refreshMe();
      setMsg("Saved!");
    } catch (e) {
      setMsg(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file) => {
    const fd = new FormData();
    fd.append("avatar", file);

    await api.post("/users/me/avatar", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    await refreshMe();
    setMsg("Avatar updated!");
  };

  const uploadBanner = async (file) => {
    const fd = new FormData();
    fd.append("banner", file);

    await api.post("/users/me/banner", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    await refreshMe();
    setMsg("Banner updated!");
  };

  if (!me) return <div className="container section">Loading…</div>;

  const isSameUsername = sanitizeUsername(username) === (me.username || "");

  return (
    <div className="sp-page">
      <StyleLocal />

      <div className="container section sp-inner">
        {/* ===== Header ===== */}
        <header className="sp-head-row">
          <div>
            <h1 className="sp-title">Edit profile</h1>
            <p className="sp-sub">
              Update your avatar, banner, username and social links. Your display name will follow your username.
            </p>
          </div>
          <div className="sp-head-actions">
            {msg && <span className="sp-msg">{msg}</span>}
            <button
              className="sp-btn sp-btn--primary"
              onClick={onSave}
              disabled={saving}
              type="button"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </header>

        {/* ✅ กล่องเดียว ครอบทั้งหมด */}
        <div className="sp-card">
          <div className="sp-card-grid">
            {/* ===== Left ===== */}
            <section className="sp-left">
              <div
                className="sp-banner"
                onClick={() => pickBannerRef.current?.click()}
                role="button"
                tabIndex={0}
                title="Click to upload banner"
              >
                <img src={cdn(me.bannerUrl || "/profile-banner-fallback.jpg")} alt="" />
                <div className="sp-banner__overlay" />
                <div className="sp-banner__hint">Click to upload banner (1600×400)</div>
                <input
                  ref={pickBannerRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => e.target.files?.[0] && uploadBanner(e.target.files[0])}
                />
              </div>

              <div className="sp-main-row">
                <div className="sp-avatar-wrap">
                  <img className="sp-avatar" src={cdn(me.avatarUrl || "/avatar-default.png")} alt="" />
                  <button
                    type="button"
                    className="sp-avatar-change"
                    onClick={() => pickAvatarRef.current?.click()}
                  >
                    Change
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    ref={pickAvatarRef}
                    onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
                  />
                </div>

                <div className="sp-main-fields">
                  <div className="sp-field">
                    <label className="sp-label">Username (also your display name)</label>

                    <div className="sp-input-wrap">
                      <span className="sp-prefix">@</span>
                      <input
                        className="sp-input sp-input--with-prefix"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="yourname"
                        spellCheck={false}
                        inputMode="text"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                    </div>

                    <div className="sp-hint">
                      Allowed: <b>a-z</b>, <b>0-9</b>, <b>.</b>, <b>_</b> · 3–20 chars{" "}
                      {!isSameUsername && (
                        <span className="sp-hint__warn">· will change your profile URL</span>
                      )}
                    </div>
                  </div>

                  <div className="sp-preview">
                    <div className="sp-preview__label">Preview</div>
                    <div className="sp-preview__value">{sanitizeUsername(username) || "—"}</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Divider */}
            <div className="sp-divider" aria-hidden="true" />

            {/* ===== Right ===== */}
            <aside className="sp-right">
              <h2 className="sp-side-title">Links & socials</h2>
              <p className="sp-side-sub">
                These links will appear on your public profile so players can find you elsewhere.
              </p>

              {/* ✅ Website กลับมา */}
              <div className="sp-field">
                <label className="sp-label">Website (https://…)</label>
                <input
                  className="sp-input"
                  placeholder="https://example.com"
                  value={links.website}
                  onChange={(e) => setLinks({ ...links, website: e.target.value })}
                />
              </div>

              <div className="sp-field">
                <label className="sp-label">Twitter/X (username)</label>
                <div className="sp-input-wrap">
                  <span className="sp-prefix">@</span>
                  <input
                    className="sp-input sp-input--with-prefix"
                    placeholder="yourname"
                    value={links.twitter}
                    onChange={(e) => setLinks({ ...links, twitter: e.target.value })}
                  />
                </div>
              </div>

              <div className="sp-field">
                <label className="sp-label">YouTube (channel / URL)</label>
                <input
                  className="sp-input"
                  placeholder="https://youtube.com/@yourchannel"
                  value={links.youtube}
                  onChange={(e) => setLinks({ ...links, youtube: e.target.value })}
                />
              </div>

              <div className="sp-field">
                <label className="sp-label">GitHub (username)</label>
                <div className="sp-input-wrap">
                  <span className="sp-prefix">@</span>
                  <input
                    className="sp-input sp-input--with-prefix"
                    placeholder="yourgithub"
                    value={links.github}
                    onChange={(e) => setLinks({ ...links, github: e.target.value })}
                  />
                </div>
              </div>

              <div className="sp-tip">
                Avatar and banner upload will update immediately. Other changes are saved when you click{" "}
                <b>Save changes</b>.
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function StyleLocal() {
  return (
    <style>{`
.sp-page{
  background: var(--bg);
  min-height: 100vh;
  color: var(--text);
}

.sp-inner{ padding-top:32px; padding-bottom:40px }
.sp-head-row{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px;
  margin-bottom:18px;
}
.sp-title{
  margin:0;
  font-size: clamp(22px, 2.6vw, 28px);
  font-weight:900;
  letter-spacing:.02em;
  background:linear-gradient(180deg,#fff,#e8f3ff);
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
}
.sp-sub{
  margin:4px 0 0;
  color: var(--muted);
  font-size:13px;
}
.sp-head-actions{
  display:flex;
  align-items:center;
  gap:10px;
}
.sp-msg{
  font-size:13px;
  color:#bbf7d0;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid rgba(187,247,208,.25);
  background: rgba(187,247,208,.06);
}

/* Buttons */
.sp-btn{
  appearance:none;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.06);
  color: var(--text);
  padding:9px 18px;
  font-weight:800;
  cursor:pointer;
  font-size:14px;
  transition:.16s ease;
}
.sp-btn:hover{ background: rgba(255,255,255,.10); transform: translateY(-1px); }
.sp-btn--primary{
  border:none;
  background: linear-gradient(135deg, var(--brand), #35c4ff);
  color:#062028;
  box-shadow: 0 10px 24px rgba(56,189,248,.22);
}
.sp-btn--primary:disabled{
  opacity:.6;
  cursor:default;
  transform:none;
  box-shadow:none;
}

/* ✅ กล่องเดียว */
.sp-card{
  border-radius:16px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03)),
    var(--panel);
  border:1px solid var(--stroke);
  box-shadow: var(--shadow);
  overflow:hidden;
}

.sp-card-grid{
  display:grid;
  grid-template-columns: minmax(0, 1.35fr) 1px minmax(0, .85fr);
  gap:0;
}

/* Divider แบบเฟด ไม่คม */
.sp-divider{
  background: linear-gradient(180deg,
    rgba(255,255,255,0),
    rgba(255,255,255,.10),
    rgba(255,255,255,.10),
    rgba(255,255,255,0)
  );
}

.sp-left, .sp-right{ padding:16px; }
.sp-right{ display:flex; flex-direction:column; }

/* Responsive -> ซ้อน */
@media (max-width: 960px){
  .sp-card-grid{ grid-template-columns: 1fr; }
  .sp-divider{ display:none; }
  .sp-right{ border-top:1px solid rgba(255,255,255,.08); }
}

/* Banner */
.sp-banner{
  position:relative;
  height:190px;
  border-radius:14px;
  overflow:hidden;
  border:1px solid var(--stroke);
  cursor:pointer;
  background: rgba(255,255,255,.03);
}
.sp-banner img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}
.sp-banner__overlay{
  position:absolute;
  inset:0;
  background: linear-gradient(180deg, rgba(11,15,20,.10), rgba(11,15,20,.55) 55%, rgba(11,15,20,.72));
}
.sp-banner__hint{
  position:absolute;
  right:12px;
  bottom:10px;
  padding:6px 10px;
  border-radius:999px;
  background: rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.14);
  font-size:11px;
  color: var(--text);
  pointer-events:none;
}

/* Avatar + fields */
.sp-main-row{ display:flex; gap:14px; align-items:flex-start; margin-top:14px; }
.sp-avatar-wrap{ position:relative; width:96px; flex-shrink:0; margin-top:2px; }
.sp-avatar{
  width:96px;
  height:96px;
  border-radius:999px;
  object-fit:cover;
  border:2px solid rgba(255,255,255,.14);
  box-shadow: 0 18px 42px rgba(0,0,0,.55);
  background:#0c1016;
}
.sp-avatar-change{
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  bottom:-10px;
  padding:6px 12px;
  font-size:11px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.06);
  color: var(--text);
  cursor:pointer;
}
.sp-avatar-change:hover{ background: rgba(255,255,255,.10); }

.sp-main-fields{ flex:1; min-width:0; }

.sp-label{
  display:block;
  margin-bottom:4px;
  font-size:13px;
  color: rgba(234,242,255,.80);
}

.sp-input{
  width:100%;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: var(--text);
  padding:9px 12px;
  font-size:14px;
  outline:none;
}
.sp-input::placeholder{ color: rgba(234,242,255,.45); }
.sp-input:focus{
  border-color: rgba(56,189,248,.85);
  box-shadow: 0 0 0 4px rgba(72,208,255,.14);
}

.sp-input-wrap{ position:relative; }
.sp-prefix{
  position:absolute;
  left:10px;
  top:50%;
  transform:translateY(-50%);
  font-size:13px;
  color: rgba(234,242,255,.55);
}
.sp-input--with-prefix{ padding-left:24px; }

.sp-hint{
  margin-top:6px;
  font-size:12px;
  color: var(--muted);
}
.sp-hint b{ color: rgba(234,242,255,.85); font-weight:800; }
.sp-hint__warn{ color: rgba(255,255,255,.75); }

.sp-preview{
  margin-top:12px;
  padding:10px 12px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
}
.sp-preview__label{ font-size:12px; color: var(--muted); }
.sp-preview__value{ margin-top:4px; font-weight:900; letter-spacing:.2px; color: var(--text); }

/* Right side */
.sp-side-title{
  margin:0 0 2px;
  font-size:18px;
  font-weight:900;
  background:linear-gradient(180deg,#fff,#e8f3ff);
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
}
.sp-side-sub{
  margin:0 0 10px;
  font-size:13px;
  color: var(--muted);
}

.sp-field{ margin-top:10px; }

.sp-tip{
  margin-top:auto;
  font-size:12px;
  color: var(--muted);
  padding:10px 12px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
}

@media (max-width: 640px){
  .sp-avatar-wrap{ width:84px; }
  .sp-avatar{ width:84px; height:84px; }
}
`}</style>
  );
}
