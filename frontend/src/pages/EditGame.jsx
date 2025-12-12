// frontend/src/pages/EditGame.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";

/** ใช้ชุดหมวดเดียวกับ UploadGame */
const CATEGORIES = [
  { id: "no-genre", name: "No genre" },
  { id: "action", name: "Action" },
  { id: "adventure", name: "Adventure" },
  { id: "card-game", name: "Card Game" },
  { id: "educational", name: "Educational" },
  { id: "fighting", name: "Fighting" },
  { id: "interactive-fiction", name: "Interactive Fiction" },
  { id: "platformer", name: "Platformer" },
  { id: "puzzle", name: "Puzzle" },
  { id: "racing", name: "Racing" },
  { id: "rhythm", name: "Rhythm" },
  { id: "role-playing", name: "Role Playing" },
  { id: "shooter", name: "Shooter" },
  { id: "simulation", name: "Simulation" },
  { id: "sports", name: "Sports" },
  { id: "strategy", name: "Strategy" },
  { id: "survival", name: "Survival" },
  { id: "visual-novel", name: "Visual Novel" },
  { id: "other", name: "Other" },
];

const isHtmlFile = (u = "") => /\.html?(\?|$)/i.test(String(u || ""));
const isZipFile = (u = "") => /\.zip(\?|$)/i.test(String(u || ""));
const isRarFile = (u = "") => /\.rar(\?|$)/i.test(String(u || ""));

export default function EditGame() {
  const { id } = useParams();
  const nav = useNavigate();

  // me (ไว้ดู role)
  const [me, setMe] = useState(null);

  // main fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("no-genre");

  // ✅ visibility workflow
  // visibility = สถานะจริงที่ระบบเซฟ (review/public)
  // requestedVisibility = สิ่งที่ผู้ใช้ “ขอ” (review/public) เพื่อทำ pending
  const [visibility, setVisibility] = useState("review");
  const [requestedVisibility, setRequestedVisibility] = useState("review");

  // ✅ kind เหมือน UploadGame
  const [kind, setKind] = useState("html"); // "html" | "download"

  const [tags, setTags] = useState([]);
  const [coverUrl, setCoverUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [screens, setScreens] = useState([]);

  // upload buffers
  const [newFile, setNewFile] = useState(null);
  const [newCover, setNewCover] = useState(null);
  const [newScreens, setNewScreens] = useState([]);

  // previews for newScreens (กัน memory leak)
  const [newScreenPreviews, setNewScreenPreviews] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  // refs (optional)
  const screensInputRef = useRef(null);

  useEffect(() => {
    // load me
    (async () => {
      try {
        const u = await api.get("/users/me");
        setMe(u.data);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  useEffect(() => {
    // load game
    (async () => {
      try {
        setError("");
        setNote("");

        const r = await api.get(`/games/${id}`);
        const g = r.data;

        setTitle(g.title || "");
        setSlug(g.slug || "");
        setTagline(g.tagline || "");
        setDescription(g.description || "");
        setCategory(g.category || "no-genre");

        // ✅ รองรับทั้งระบบใหม่/เก่า
        setVisibility(g.visibility || "review");
        setRequestedVisibility(g.requestedVisibility || g.visibility || "review");

        // ✅ kind
        const inferredKind =
          g.kind ||
          (isRarFile(g.fileUrl) ? "download" : "html");
        setKind(inferredKind);

        setTags(Array.isArray(g.tags) ? g.tags : []);
        setCoverUrl(g.coverUrl || "");
        setFileUrl(g.fileUrl || "");
        setScreens(Array.isArray(g.screens) ? g.screens : []);
      } catch (e) {
        setError(e?.response?.data?.message || "Load failed");
      }
    })();
  }, [id]);

  // preview newScreens
  useEffect(() => {
    if (!newScreens.length) {
      setNewScreenPreviews([]);
      return;
    }
    const urls = newScreens.map((f) => URL.createObjectURL(f));
    setNewScreenPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [newScreens]);

  const isAdmin = me?.role === "admin";

  // accept ชนิดไฟล์ตาม kind (เหมือน UploadGame)
  const acceptForKind = kind === "html" ? ".html,.htm,.zip" : ".rar";

  const onTagsKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = e.currentTarget.value.trim().toLowerCase();
      if (!v) return;
      if (!tags.includes(v)) setTags((x) => [...x, v].slice(0, 10));
      e.currentTarget.value = "";
    }
  };
  const removeTag = (t) => setTags((x) => x.filter((i) => i !== t));

  const onPickScreens = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setNewScreens(files);
  };

  // ✅ เลือก visibility แบบ “ขอ public แต่ต้องรออนุมัติ”
  const onSelectVisibility = (v) => {
    setRequestedVisibility(v);

    // ถ้าเป็น admin เลือก public ได้จริง
    if (isAdmin) {
      setVisibility(v);
      return;
    }

    // user ทั่วไป: ขอ public => สถานะจริงยังเป็น review (pending)
    if (v === "public") {
      setVisibility("review");
    } else {
      setVisibility("review");
    }
  };

  // ✅ playable / downloadOnly แบบเดียวกับหน้า GameDetail/Home
  const downloadOnly = useMemo(
    () => kind === "download" || isRarFile(fileUrl),
    [kind, fileUrl]
  );

  const playable = useMemo(() => {
    if (downloadOnly) return false;
    if (kind === "html") return true;
    return isHtmlFile(fileUrl) || isZipFile(fileUrl);
  }, [downloadOnly, kind, fileUrl]);

  const categoryLabel =
    CATEGORIES.find((c) => c.id === category)?.name || category || "no-genre";

  const pendingPublic =
    !isAdmin &&
    visibility === "review" &&
    requestedVisibility === "public";

  const onSave = async () => {
    setError("");
    setNote("");
    setSaving(true);

    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("slug", slug);
      fd.append("tagline", tagline);
      fd.append("description", description);
      fd.append("category", category);

      // ✅ ส่ง “สิ่งที่ผู้ใช้เลือก” ไปเลย
      // backend จะบังคับเอง: user เลือก public => visibility จริง = review + requestedVisibility=public
      fd.append("visibility", requestedVisibility);

      // ✅ kind
      fd.append("kind", kind);

      tags.forEach((t) => fd.append("tags[]", t));

      if (newFile) fd.append("file", newFile);
      if (newCover) fd.append("cover", newCover);
      if (newScreens.length > 0) newScreens.forEach((f) => fd.append("screens[]", f));

      const r = await api.put(`/games/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const g = r.data;

      setNewFile(null);
      setNewCover(null);
      setNewScreens([]);
      if (screensInputRef.current) screensInputRef.current.value = "";

      setCoverUrl(g.coverUrl || "");
      setFileUrl(g.fileUrl || "");
      setScreens(Array.isArray(g.screens) ? g.screens : []);

      // ✅ sync visibility จากค่าจริงที่ backend ส่งกลับ
      setVisibility(g.visibility || visibility);
      setRequestedVisibility(g.requestedVisibility || requestedVisibility);

      // note
      if (!isAdmin && (g.requestedVisibility === "public" || requestedVisibility === "public")) {
        setNote("ส่งคำขอเป็นสาธารณะแล้ว ✅ ตอนนี้เกมยังอยู่ในสถานะรอตรวจ (review) จนกว่าแอดมินจะอนุมัติ");
      } else {
        setNote("บันทึกสำเร็จ ✅");
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const fileSrc = cdn(fileUrl);

  return (
    <div className="container section">
      <StyleLocal />

      <div className="page-head">
        <div>
          <h1 className="h1">Edit: {title || "game"}</h1>
          <div className="sub">
            สถานะตอนนี้:{" "}
            <b>{visibility === "public" ? "สาธารณะ" : "รอตรวจ / ส่วนตัว"}</b>
            {pendingPublic ? <span className="pending"> · pending public</span> : null}
          </div>
        </div>

        <div className="head-actions">
          <Link className="btn" to={`/games/${id}`}>
            View page
          </Link>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {note && <div className="note">{note}</div>}

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
                      .trim()
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
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="f">
              <label>Kind of project</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="download">Downloadable — .rar</option>
                <option value="html">HTML — .html / .zip (index.html)</option>
              </select>
              <small className="muted">
                {kind === "html"
                  ? "โหมดเล่นบนเว็บ (HTML/Zip)"
                  : "โหมดดาวน์โหลด (RAR)"}
              </small>
            </div>
          </div>

          {/* ✅ Visibility แบบ UploadGame + pending */}
          <div className="f">
            <label>การมองเห็น</label>
            <div className="vis-row">
              <button
                type="button"
                className={requestedVisibility === "review" ? "vis-pill vis-pill--active" : "vis-pill"}
                onClick={() => onSelectVisibility("review")}
              >
                <span>🔒 ส่วนตัว / รอตรวจ</span>
                <span className="vis-sub">ใช้ทดสอบ / มีลิงก์เท่านั้นที่เข้าเล่นได้</span>
              </button>

              <button
                type="button"
                className={requestedVisibility === "public" ? "vis-pill vis-pill--active" : "vis-pill"}
                onClick={() => onSelectVisibility("public")}
              >
                <span>🌐 สาธารณะ</span>
                <span className="vis-sub">
                  {isAdmin
                    ? "แอดมินสามารถเผยแพร่ได้ทันที"
                    : "เมื่อกดบันทึก จะส่งให้แอดมินอนุมัติก่อน"}
                </span>
              </button>
            </div>

            {!isAdmin && requestedVisibility === "public" && (
              <small className="muted">
                * คุณเลือก “สาธารณะ” แล้ว — หลังบันทึก เกมจะอยู่สถานะ <b>review</b> จนกว่าแอดมินอนุมัติ
              </small>
            )}
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
            <label>
              ไฟล์เกมใหม่ {kind === "html" ? "(.html/.zip)" : "(.rar)"} — เว้นว่างถ้าไม่เปลี่ยน
            </label>
            <input
              type="file"
              accept={acceptForKind}
              onChange={(e) => setNewFile(e.target.files?.[0] || null)}
            />
            {newFile && <small className="muted">เลือกไฟล์: {newFile.name}</small>}
          </div>

          <div className="f">
            <label>ภาพหน้าปกใหม่ — เว้นว่างถ้าไม่เปลี่ยน</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewCover(e.target.files?.[0] || null)}
            />
          </div>

          <div className="f">
            <label>สกรีนช็อต (อัปโหลดใหม่จะ “แทนที่ทั้งหมด”) — สูงสุด 5 รูป</label>
            <input
              ref={screensInputRef}
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

          <div className="f actions">
            <button className="btn btn-primary" disabled={saving} onClick={onSave}>
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button className="btn" onClick={() => nav(-1)} disabled={saving}>
              Cancel
            </button>
          </div>
        </section>

        {/* ===== PREVIEW ===== */}
        <aside className="card">
          <div className="stage">
            {playable ? (
              <iframe className="stage__frame" src={fileSrc} title="preview" />
            ) : (
              <img
                className="stage__image"
                src={cdn(coverUrl || "/no-cover.png")}
                alt=""
              />
            )}
          </div>

          <div className="meta">
            <div className="meta__title"><b>{title || "Untitled"}</b></div>
            <div className="meta__chips">
              <span className="chip">{categoryLabel}</span>
              <span className="chip">{downloadOnly ? "Download" : "HTML / Web"}</span>
              <span className={`chip ${visibility === "public" ? "chip-ok" : "chip-warn"}`}>
                {visibility === "public" ? "public" : "review"}
              </span>
              {pendingPublic ? <span className="chip chip-pending">pending public</span> : null}
            </div>

            <div className="meta__btns">
              {downloadOnly ? (
                <a className="btn" href={fileSrc} target="_blank" rel="noreferrer">
                  📥 Open download
                </a>
              ) : (
                <a className="btn" href={fileSrc} target="_blank" rel="noreferrer">
                  🎮 Open playable
                </a>
              )}
            </div>
          </div>

          <div className="shots">
            {(newScreenPreviews.length > 0 ? newScreenPreviews : screens).map((u, i) => (
              <div key={i} className="shot">
                <img
                  src={newScreenPreviews.length > 0 ? u : cdn(u)}
                  alt={`shot-${i}`}
                />
              </div>
            ))}
            {screens.length === 0 && newScreenPreviews.length === 0 && (
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
.page-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;gap:12px}
.h1{margin:0}
.sub{margin-top:2px;color:#9fb4c8;font-size:12px}
.pending{color:#facc15}
.head-actions{display:flex;gap:8px}

.alert{background:#3a1116;border:1px solid #ff5a6b;color:#ffd4d8;border-radius:10px;padding:10px 12px;margin-bottom:12px}
.note{background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.4);color:#d1fae5;border-radius:10px;padding:10px 12px;margin-bottom:12px}

.card{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03));border:1px solid var(--stroke);border-radius:16px;padding:14px}
.edit-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}
@media (max-width: 980px){ .edit-grid{grid-template-columns:1fr} }

.f{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.f input,.f textarea,.f select{background:rgba(255,255,255,.05);border:1px solid var(--stroke);color:var(--text);border-radius:12px;padding:10px 12px;outline:none}
.row{display:flex;gap:8px}
.btn{appearance:none;border:1px solid var(--stroke);background:var(--glass);color:var(--text);padding:10px 14px;border-radius:12px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.btn-primary{border:none;background:linear-gradient(135deg,#59e0ff,#35c4ff);color:#041318;font-weight:800}
.muted{color:#9fb4c8;font-size:12px}
.tags{display:flex;gap:8px;flex-wrap:wrap}
.chip{font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid var(--stroke);background:rgba(255,255,255,.05);cursor:pointer}
.actions{display:flex;flex-direction:row;gap:8px;align-items:center;margin-top:2px}

/* visibility pills (เหมือน UploadGame) */
.vis-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.vis-pill{
  flex:1 1 160px;
  padding:8px 12px;
  border-radius:16px;
  border:1px solid var(--stroke);
  background:rgba(255,255,255,.05);
  color:#e5e7eb;
  font-size:13px;
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  text-align:left;
  cursor:pointer;
  transition:.16s ease;
}
.vis-pill:hover{border-color:rgba(96,165,250,1);box-shadow:0 8px 22px rgba(0,0,0,.6)}
.vis-pill--active{border-color:rgba(59,130,246,1);background:radial-gradient(circle at top left,#1d4ed8,#020617)}
.vis-sub{font-size:11px;opacity:.8}

/* preview */
.stage{position:relative;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#000;margin-bottom:10px}
.stage__frame{position:absolute;inset:0;width:100%;height:100%;border:0}
.stage__image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.meta{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.meta__chips{display:flex;flex-wrap:wrap;gap:6px}
.meta__btns{margin-top:6px;display:flex;gap:8px}

.chip-ok{border-color:rgba(34,197,94,.6);background:rgba(34,197,94,.12)}
.chip-warn{border-color:rgba(250,204,21,.6);background:rgba(250,204,21,.10)}
.chip-pending{border-color:rgba(250,204,21,.8);background:rgba(250,204,21,.14);color:#facc15}

.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.shot{aspect-ratio:16/9;border:1px solid var(--stroke);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.05)}
.shot img{width:100%;height:100%;object-fit:cover;display:block}
`}</style>
  );
}
