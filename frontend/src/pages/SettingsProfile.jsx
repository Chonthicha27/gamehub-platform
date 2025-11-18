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
  const [links, setLinks] = useState({ website: "", twitter: "", youtube: "", github: "" });

  const pickAvatarRef = useRef(null);

  useEffect(() => {
    (async () => {
      const u = (await api.get("/users/me")).data;
      setMe(u);
      setDisplayName(u.displayName || "");
      setBio(u.bio || "");
      setLinks({
        website: u.links?.website || "",
        twitter: u.links?.twitter || "",
        youtube: u.links?.youtube || "",
        github: u.links?.github || "",
      });
    })();
  }, []);

  const onSave = async () => {
    setSaving(true); setMsg("");
    try {
      await api.put("/users/me", { displayName, bio, links });
      const u = (await api.get("/users/me")).data;
      setMe(u);
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
    await api.post("/users/me/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
    const u = (await api.get("/users/me")).data;
    setMe(u);
  };

  const uploadBanner = async (file) => {
    const fd = new FormData();
    fd.append("banner", file);
    await api.post("/users/me/banner", fd, { headers: { "Content-Type": "multipart/form-data" } });
    const u = (await api.get("/users/me")).data;
    setMe(u);
  };

  if (!me) return <div className="container section">Loading…</div>;

  return (
    <div className="container section">
      <StyleLocal />

      <div className="head-row">
        <h1>Edit profile</h1>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="edit-grid">
        {/* ==== Left: Visuals & Basics ==== */}
        <section className="card">
          <div className="banner" onClick={() => document.getElementById("pick-banner").click()}>
            <img
              src={
                cdn(
                  me.bannerUrl ||
                    "/profile-banner-fallback.jpg"
                )
              }
              alt=""
            />
            <div className="banner-hint">Click to upload banner (1600×400)</div>
            <input
              id="pick-banner"
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files[0] && uploadBanner(e.target.files[0])}
            />
          </div>

          <div className="row mt8">
            <div className="avatar-wrap">
              <img
                className="avatar"
                src={cdn(me.avatarUrl || "/avatar-default.png")}
                alt=""
              />
              <button className="change" onClick={() => pickAvatarRef.current.click()}>
                Change
              </button>
              <input
                type="file"
                accept="image/*"
                hidden
                ref={pickAvatarRef}
                onChange={(e) => e.target.files[0] && uploadAvatar(e.target.files[0])}
              />
            </div>

            <div className="grow">
              <label>Display name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          </div>

          <div className="mt8">
            <label>Bio</label>
            <textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>

          {msg && <div className="note">{msg}</div>}
        </section>

        {/* ==== Right: Links ==== */}
        <aside className="card">
          <h3>Links</h3>
          <label>Website (https://…)</label>
          <input
            placeholder="https://example.com"
            value={links.website}
            onChange={(e) => setLinks({ ...links, website: e.target.value })}
          />
          <label>Twitter/X (username)</label>
          <input
            placeholder="yourname"
            value={links.twitter}
            onChange={(e) => setLinks({ ...links, twitter: e.target.value })}
          />
          <label>YouTube (channel / URL)</label>
          <input
            placeholder="https://youtube.com/@yourchannel"
            value={links.youtube}
            onChange={(e) => setLinks({ ...links, youtube: e.target.value })}
          />
          <label>GitHub (username)</label>
          <input
            placeholder="yourgithub"
            value={links.github}
            onChange={(e) => setLinks({ ...links, github: e.target.value })}
          />

          <div className="tip">
            การเปลี่ยนลิงก์/รูปภาพจะถูกบันทึกเมื่อกดปุ่ม <b>Save changes</b> ด้านบนขวา
          </div>
        </aside>
      </div>
    </div>
  );
}

function StyleLocal() {
  return (
    <style>{`
.head-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.btn{appearance:none;border:1px solid var(--stroke);background:var(--glass);color:var(--text);padding:10px 14px;border-radius:12px;cursor:pointer}
.btn-primary{border:none;background:linear-gradient(135deg,#59e0ff,#35c4ff);color:#041318}
.card{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03));border:1px solid var(--stroke);border-radius:16px;padding:14px}
label{display:block;margin:8px 0 6px;color:#cfe3f6;font-size:14px}
input,textarea{width:100%;background:rgba(255,255,255,.05);border:1px solid var(--stroke);color:var(--text);border-radius:12px;padding:10px 12px;outline:none}
.mt8{margin-top:8px}
.note{margin-top:8px;color:#b7ffb5}

.edit-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}
@media (max-width: 980px){ .edit-grid{grid-template-columns:1fr} }

.banner{position:relative;height:180px;border-radius:12px;overflow:hidden;border:1px solid var(--stroke);cursor:pointer}
.banner img{width:100%;height:100%;object-fit:cover;display:block}
.banner-hint{position:absolute;right:10px;bottom:10px;font-size:12px;background:rgba(0,0,0,.38);padding:6px 8px;border-radius:10px}

.row{display:flex;gap:12px;align-items:center}
.grow{flex:1}
.avatar-wrap{position:relative;width:96px}
.avatar{width:96px;height:96px;border-radius:999px;border:3px solid rgba(255,255,255,.2);object-fit:cover;background:#0a0e12}
.change{position:absolute;left:50%;transform:translateX(-50%);bottom:-8px;font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid var(--stroke);background:rgba(255,255,255,.04);cursor:pointer}
.tip{margin-top:10px;color:#9fb4c8;font-size:13px}
`}</style>
  );
}
