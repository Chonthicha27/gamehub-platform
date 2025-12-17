// frontend/src/pages/SettingsProfile.jsx
import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { cdn } from "../api/cdn";

export default function SettingsProfile() {
  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // form fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState({
    website: "",
    twitter: "",
    youtube: "",
    github: "",
  });

  const pickAvatarRef = useRef(null);
  const pickBannerRef = useRef(null);

  // ✅ sync me -> localStorage + dispatch event (ให้ NavBar/ส่วนอื่นอัปเดตตาม)
  const syncMeEverywhere = (u) => {
    try {
      // บางที่อ่าน key "me"
      localStorage.setItem("me", JSON.stringify(u));

      // บางที่อ่าน key "user"
      // (คงค่าที่มีอยู่ แล้วอัปเดต displayName/avatar/banner ให้ตรง)
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

      // broadcast ให้ component อื่น ๆ ที่ฟังอยู่รีเฟรช
      window.dispatchEvent(new CustomEvent("me:updated", { detail: u }));
    } catch {
      // ไม่ให้หน้าแตก ถ้า storage ใช้ไม่ได้
    }
  };

  const refreshMe = async () => {
    const u = (await api.get("/users/me")).data;
    setMe(u);

    // เติมค่าใส่ form ให้ตรง (กันค่าค้าง)
    setDisplayName(u.displayName || "");
    setBio(u.bio || "");
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

  const onSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        displayName: (displayName || "").trim(), // ✅ กันช่องว่างล้วน ๆ
        bio: bio || "",
        links,
      };

      await api.put("/users/me", payload);

      // ✅ สำคัญ: รีโหลด me ใหม่ + sync ไปส่วนอื่น
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

    // ✅ รีโหลด me ใหม่ + sync
    await refreshMe();
    setMsg("Avatar updated!");
  };

  const uploadBanner = async (file) => {
    const fd = new FormData();
    fd.append("banner", file);

    await api.post("/users/me/banner", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // ✅ รีโหลด me ใหม่ + sync
    await refreshMe();
    setMsg("Banner updated!");
  };

  if (!me) return <div className="container section">Loading…</div>;

  const username = me.username || "unknown";

  return (
    <div className="sp-page">
      <StyleLocal />

      <div className="container section sp-inner">
        {/* ===== Header ===== */}
        <header className="sp-head-row">
          <div>
            <h1 className="sp-title">Edit profile</h1>
            <p className="sp-sub">
              Update your avatar, banner, bio and social links. Changes will be
              visible on your public profile.
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

        {/* ===== Main grid ===== */}
        <div className="sp-grid">
          {/* --- Left: Visual preview + basics --- */}
          <section className="sp-panel sp-panel--main">
            {/* Banner preview */}
            <div
              className="sp-banner"
              onClick={() => pickBannerRef.current?.click()}
              role="button"
              tabIndex={0}
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

            {/* Avatar + name */}
            <div className="sp-main-row">
              <div className="sp-avatar-wrap">
                <img
                  className="sp-avatar"
                  src={cdn(me.avatarUrl || "/avatar-default.png")}
                  alt=""
                />
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
                <label className="sp-label">Display name</label>
                <input
                  className="sp-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How should we call you?"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="sp-bio-block">
              <label className="sp-label">Bio</label>
              <textarea
                className="sp-textarea"
                rows={4}
                maxLength={240}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell players a little bit about yourself, your games, or what you’re working on."
              />
              <div className="sp-bio-meta">
                <span>{bio.length}/240</span>
              </div>
            </div>
          </section>

          {/* --- Right: Links / socials --- */}
          <aside className="sp-panel sp-panel--side">
            <h2 className="sp-side-title">Links & socials</h2>
            <p className="sp-side-sub">
              These links will appear on your public profile so players can find
              you elsewhere.
            </p>

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
              Changes to links, avatar, or banner will be saved when you click{" "}
              <b>Save changes</b> in the top right.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function StyleLocal() {
  return (
    <style>{`
.sp-page{
  background:#05070b;
  min-height:100vh;
}

/* Header */
.sp-inner{padding-top:32px;padding-bottom:40px}
.sp-head-row{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px;
  margin-bottom:18px;
}
.sp-title{
  margin:0;
  font-size:26px;
  font-weight:900;
  letter-spacing:.02em;
}
.sp-sub{
  margin:4px 0 0;
  color:#9ca3af;
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
}

/* Buttons */
.sp-btn{
  appearance:none;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);
  color:#e5f2ff;
  padding:9px 18px;
  font-weight:800;
  cursor:pointer;
  font-size:14px;
  transition:.16s ease;
}
.sp-btn--primary{
  border:none;
  background:linear-gradient(135deg,#59e0ff,#35c4ff);
  color:#031723;
  box-shadow:0 12px 28px rgba(169, 181, 187, 0.3);
}
.sp-btn--primary:disabled{
  opacity:.6;
  cursor:default;
  box-shadow:none;
}
.sp-btn--primary:not(:disabled):hover{
  transform:translateY(-1px);
}

/* Grid layout */
.sp-grid{
  display:grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, .9fr);
  gap:18px;
}
@media (max-width: 960px){
  .sp-grid{ grid-template-columns:1fr; }
  .sp-head-row{ flex-direction:column; align-items:flex-start; }
}

/* Panels */
.sp-panel{
  border-radius:18px;
  padding:16px;
  background:
    radial-gradient(circle at 0 0, rgba(72,208,255,.12), transparent 55%),
    radial-gradient(circle at 100% 0, rgba(139,92,246,.1), transparent 55%),
    rgba(15,23,42,.98);
  border:1px solid rgba(148,163,184,.35);
  box-shadow:0 22px 60px rgba(0,0,0,.75);
}
.sp-panel--main{
  display:flex;
  flex-direction:column;
  gap:14px;
}
.sp-panel--side{
  align-self:flex-start;
}

/* Banner preview */
.sp-banner{
  position:relative;
  height:190px;
  border-radius:14px;
  overflow:hidden;
  border:1px solid rgba(148,163,184,.55);
  cursor:pointer;
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
  background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.55));
}
.sp-banner__hint{
  position:absolute;
  right:12px;
  bottom:10px;
  padding:6px 10px;
  border-radius:999px;
  background:rgba(15,23,42,.85);
  border:1px solid rgba(148,163,184,.7);
  font-size:11px;
  color:#e5f3ff;
  pointer-events:none;
}

/* Avatar + name */
.sp-main-row{
  display:flex;
  gap:14px;
  align-items:center;
}
.sp-avatar-wrap{
  position:relative;
  width:96px;
  flex-shrink:0;
}
.sp-avatar{
  width:96px;
  height:96px;
  border-radius:999px;
  object-fit:cover;
  border:3px solid rgba(255,255,255,.9);
  box-shadow:0 16px 40px rgba(0,0,0,.65);
  background:#020617;
}
.sp-avatar-change{
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  bottom:-10px;
  padding:6px 12px;
  font-size:11px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.7);
  background:rgba(15,23,42,.95);
  color:#e5f2ff;
  cursor:pointer;
}
.sp-main-fields{ flex:1; min-width:0; }
.sp-label{
  display:block;
  margin-bottom:4px;
  font-size:13px;
  color:#d1d9e6;
}
.sp-input,
.sp-textarea{
  width:100%;
  border-radius:12px;
  border:1px solid rgba(148,163,184,.45);
  background:rgba(15,23,42,.9);
  color:#e5f2ff;
  padding:9px 12px;
  font-size:14px;
  outline:none;
}
.sp-input:focus,
.sp-textarea:focus{
  border-color:#59e0ff;
  box-shadow:0 0 0 1px rgba(89,224,255,.6);
}
.sp-username{
  margin-top:4px;
  font-size:13px;
  color:#9ca3af;
}
.sp-username-hint{
  font-size:12px;
  color:#6b7280;
}

/* Bio */
.sp-bio-block{ margin-top:4px; }
.sp-textarea{
  min-height:90px;
  resize:vertical;
}
.sp-bio-meta{
  display:flex;
  justify-content:flex-end;
  margin-top:4px;
  font-size:11px;
  color:#9ca3af;
}

/* Side panel */
.sp-side-title{
  margin:0 0 2px;
  font-size:18px;
  font-weight:800;
}
.sp-side-sub{
  margin:0 0 10px;
  font-size:13px;
  color:#a0aec0;
}
.sp-field{ margin-top:10px; }
.sp-input-wrap{
  position:relative;
}
.sp-prefix{
  position:absolute;
  left:10px;
  top:50%;
  transform:translateY(-50%);
  font-size:13px;
  color:#9ca3af;
}
.sp-input--with-prefix{
  padding-left:24px;
}
.sp-tip{
  margin-top:12px;
  font-size:12px;
  color:#9fb4c8;
}
`}</style>
  );
}
