import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";

/** ใช้ชุดหมวดเดียวกับ UploadGame */
const CATEGORIES = [
  { id: "no-genre",       name: "No genre" },
  { id: "action",         name: "Action" },
  { id: "adventure",      name: "Adventure" },
  { id: "card-game",      name: "Card Game" },
  { id: "educational",    name: "Educational" },
  { id: "fighting",       name: "Fighting" },
  { id: "interactive-fiction", name: "Interactive Fiction" },
  { id: "platformer",     name: "Platformer" },
  { id: "puzzle",         name: "Puzzle" },
  { id: "racing",         name: "Racing" },
  { id: "rhythm",         name: "Rhythm" },
  { id: "role-playing",   name: "Role Playing" },
  { id: "shooter",        name: "Shooter" },
  { id: "simulation",     name: "Simulation" },
  { id: "sports",         name: "Sports" },
  { id: "strategy",       name: "Strategy" },
  { id: "survival",       name: "Survival" },
  { id: "visual-novel",   name: "Visual Novel" },
  { id: "other",          name: "Other" },
];

export default function EditGame() {
  const { id } = useParams();
  const nav = useNavigate();

  // main fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("no-genre");
  const [visibility, setVisibility] = useState("public");
  const [tags, setTags] = useState([]);
  const [coverUrl, setCoverUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [screens, setScreens] = useState([]);

  // upload buffers
  const [newFile, setNewFile] = useState(null);
  const [newCover, setNewCover] = useState(null);
  const [newScreens, setNewScreens] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/games/${id}`);
        const g = r.data;
        setTitle(g.title || "");
        setSlug(g.slug || "");
        setTagline(g.tagline || "");
        setDescription(g.description || "");
        setCategory(g.category || "no-genre");
        setVisibility(g.visibility || "public");
        setTags(Array.isArray(g.tags) ? g.tags : []);
        setCoverUrl(g.coverUrl || "");
        setFileUrl(g.fileUrl || "");
        setScreens(Array.isArray(g.screens) ? g.screens : []);
      } catch (e) {
        setError(e?.response?.data?.message || "Load failed");
      }
    })();
  }, [id]);

  const onTagsKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = e.currentTarget.value.trim();
      if (!v) return;
      if (!tags.includes(v)) setTags((x) => [...x, v]);
      e.currentTarget.value = "";
    }
  };
  const removeTag = (t) => setTags((x) => x.filter((i) => i !== t));
  const onPickScreens = (e) => {
    const files = Array.from(e.target.files || []);
    setNewScreens(files.slice(0, 5));
  };

  const onSave = async () => {
    setError("");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("slug", slug);
      fd.append("tagline", tagline);
      fd.append("description", description);
      fd.append("category", category);
      fd.append("visibility", visibility);
      tags.forEach((t) => fd.append("tags[]", t));

      if (newFile) fd.append("file", newFile);
      if (newCover) fd.append("cover", newCover);
      if (newScreens.length > 0) newScreens.forEach((f) => fd.append("screens[]", f));

      const r = await api.put(`/games/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setNewFile(null);
      setNewCover(null);
      setNewScreens([]);

      const g = r.data;
      setCoverUrl(g.coverUrl || "");
      setFileUrl(g.fileUrl || "");
      setScreens(Array.isArray(g.screens) ? g.screens : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const playable = useMemo(() => /\.html?(\?|$)/i.test(fileUrl || ""), [fileUrl]);

  const categoryLabel =
    CATEGORIES.find((c) => c.id === category)?.name || category || "no-genre";

  return (
    <div className="container section">
      <StyleLocal />

      <div className="page-head">
        <h1>Edit: {title || "game"}</h1>
        <Link className="btn" to={`/games/${id}`}>
          View page
        </Link>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="edit-grid">
        {/* ===== FORM ===== */}
        <section className="card">
          <div className="f">
            <label>ชื่อเกม</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="f">
            <label>Slug</label>
            <div className="row">
              <input value={slug} onChange={(e) => setSlug(e.target.value)} />
              <button
                className="btn"
                type="button"
                onClick={() =>
                  setSlug(
                    (title || "")
                      .toLowerCase()
                      .replace(/[^\w\s-]/g, "")
                      .replace(/\s+/g, "-")
                      .slice(0, 60)
                  )
                }
              >
                Auto
              </button>
            </div>
            <small className="muted">URL: gpx.gg/{slug || "(slug)"}</small>
          </div>

          <div className="f">
            <label>Tagline</label>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>

          <div className="f">
            <label>รายละเอียด</label>
            <textarea
              rows={7}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="row">
            <div className="f">
              <label>หมวดหมู่</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="f">
              <label>การมองเห็น</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="public">public</option>
                <option value="review">review</option>
              </select>
            </div>
          </div>

          <div className="f">
            <label>แท็ก (กด Enter เพื่อเพิ่ม)</label>
            <input placeholder="platformer, roguelike..." onKeyDown={onTagsKey} />
            <div className="tags">
              {tags.map((t) => (
                <span key={t} className="chip" onClick={() => removeTag(t)}>
                  #{t} ×
                </span>
              ))}
            </div>
          </div>

          <div className="f">
            <label>ไฟล์เกมใหม่ (.html/.zip) — เว้นว่างถ้าไม่เปลี่ยน</label>
            <input
              type="file"
              accept=".html,.zip"
              onChange={(e) => setNewFile(e.target.files[0])}
            />
            {newFile && <small className="muted">เลือกไฟล์: {newFile.name}</small>}
          </div>

          <div className="f">
            <label>ภาพหน้าปกใหม่ — เว้นว่างถ้าไม่เปลี่ยน</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewCover(e.target.files[0])}
            />
          </div>

          {/* ✅ สกรีนช็อต */}
          <div className="f">
            <label>สกรีนช็อต (อัปโหลดใหม่จะ “แทนที่ทั้งหมด”) — สูงสุด 5 รูป</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onPickScreens}
            />
            {newScreens.length > 0 && (
              <small className="muted">
                จะอัปโหลดใหม่ {newScreens.length} รูป และแทนที่รูปเดิมทั้งหมด
              </small>
            )}
          </div>

          <div className="f">
            <button className="btn btn-primary" disabled={saving} onClick={onSave}>
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              className="btn"
              style={{ marginLeft: 8 }}
              onClick={() => nav(-1)}
            >
              Cancel
            </button>
          </div>
        </section>

        {/* ===== PREVIEW ===== */}
        <aside className="card">
          <div className="stage">
            {playable ? (
              <iframe className="stage__frame" src={cdn(fileUrl)} title="preview" />
            ) : (
              <img
                className="stage__image"
                src={cdn(coverUrl || "/no-cover.png")}
                alt=""
              />
            )}
          </div>

          <div className="meta">
            <div>
              <b>{title || "Untitled"}</b>
            </div>
            <div className="muted">
              <span className="chip">{categoryLabel}</span>
            </div>
            <a
              className="btn"
              href={cdn(fileUrl)}
              target="_blank"
              rel="noreferrer"
              style={{ marginTop: 8 }}
            >
              Open playable
            </a>
          </div>

          <div className="shots">
            {(newScreens.length > 0
              ? newScreens.map((f) => URL.createObjectURL(f))
              : screens
            ).map((u, i) => (
              <div key={i} className="shot">
                <img
                  src={newScreens.length > 0 ? u : cdn(u)}
                  alt={`shot-${i}`}
                />
              </div>
            ))}
            {screens.length === 0 && newScreens.length === 0 && (
              <div className="muted">ยังไม่มีสกรีนช็อต</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StyleLocal() {
  return (
    <style>{`
.page-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.alert{background:#3a1116;border:1px solid #ff5a6b;color:#ffd4d8;border-radius:10px;padding:10px 12px;margin-bottom:12px}
.card{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03));border:1px solid var(--stroke);border-radius:16px;padding:14px}
.edit-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}
@media (max-width: 980px){ .edit-grid{grid-template-columns:1fr} }

.f{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.f input,.f textarea,.f select{background:rgba(255,255,255,.05);border:1px solid var(--stroke);color:var(--text);border-radius:12px;padding:10px 12px;outline:none}
.row{display:flex;gap:8px}
.btn{appearance:none;border:1px solid var(--stroke);background:var(--glass);color:var(--text);padding:10px 14px;border-radius:12px;cursor:pointer}
.btn-primary{border:none;background:linear-gradient(135deg,#59e0ff,#35c4ff);color:#041318}
.muted{color:#9fb4c8}
.tags{display:flex;gap:8px;flex-wrap:wrap}
.chip{font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid var(--stroke);background:rgba(255,255,255,.05);cursor:pointer}

.stage{position:relative;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#000;margin-bottom:10px}
.stage__frame{position:absolute;inset:0;width:100%;height:100%;border:0}
.stage__image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

.meta{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.shot{aspect-ratio:16/9;border:1px solid var(--stroke);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.05)}
.shot img{width:100%;height:100%;object-fit:cover;display:block}
`}</style>
  );
}
