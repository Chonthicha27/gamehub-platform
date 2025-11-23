// frontend/src/pages/UploadGame.jsx
import { useEffect, useRef, useState } from "react";
import api from "../api/axios";

/** หมวดหมู่หลัก (ใช้ตอนอัปโหลดเกม) */
const CATEGORIES = [
  { id: "no-genre", name: "No genre", emoji: "—", color: "#9ca3af" },
  { id: "action", name: "Action", emoji: "🗡️", color: "#f97373" },
  { id: "adventure", name: "Adventure", emoji: "🧭", color: "#38bdf8" },
  { id: "card-game", name: "Card Game", emoji: "🃏", color: "#fb7185" },
  { id: "educational", name: "Educational", emoji: "📚", color: "#4ade80" },
  { id: "fighting", name: "Fighting", emoji: "⚔️", color: "#f97316" },
  { id: "interactive-fiction", name: "Interactive Fiction", emoji: "📖", color: "#a855f7" },
  { id: "platformer", name: "Platformer", emoji: "🕹️", color: "#22c55e" },
  { id: "puzzle", name: "Puzzle", emoji: "🧩", color: "#60a5fa" },
  { id: "racing", name: "Racing", emoji: "🏎️", color: "#facc15" },
  { id: "rhythm", name: "Rhythm", emoji: "🎵", color: "#f472b6" },
  { id: "role-playing", name: "Role Playing", emoji: "🧙‍♂️", color: "#0ea5e9" },
  { id: "shooter", name: "Shooter", emoji: "🎯", color: "#fb923c" },
  { id: "simulation", name: "Simulation", emoji: "🏡", color: "#34d399" },
  { id: "sports", name: "Sports", emoji: "🏀", color: "#a3e635" },
  { id: "strategy", name: "Strategy", emoji: "♟️", color: "#22d3ee" },
  { id: "survival", name: "Survival", emoji: "🪓", color: "#f97373" },
  { id: "visual-novel", name: "Visual Novel", emoji: "💬", color: "#c4b5fd" },
  { id: "other", name: "Other", emoji: "✨", color: "#9ca3af" },
];

/** ย่อรูปด้วย Canvas (รักษาอัตราส่วน) */
async function resizeImage(
  file,
  maxW = 1200,
  maxH = 675,
  mime = "image/jpeg",
  quality = 0.9
) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(maxW / width, maxH / height, 1);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) =>
        resolve(
          new File([blob], file.name.replace(/\.(png|webp)$/i, ".jpg"), {
            type: mime,
          })
        ),
      mime,
      quality
    );
  });
}

export default function UploadGame() {
  // basic
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");

  // category
  const [category, setCategory] = useState("no-genre");
  const [catOpen, setCatOpen] = useState(false);

  // tags
  const [tags, setTags] = useState([]);
  const [tagDraft, setTagDraft] = useState("");

  // files
  const [gameFile, setGameFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [screens, setScreens] = useState([]);

  // previews
  const [coverPreview, setCoverPreview] = useState("");
  const [screenPreviews, setScreenPreviews] = useState([]);

  // media เพิ่มเติม
  const [trailerUrl, setTrailerUrl] = useState(""); // ลิงก์วิดีโอ (เช่น YouTube)
  const [extraImages, setExtraImages] = useState([]); // รูปภาพเพิ่มเติม
  const [extraPreviews, setExtraPreviews] = useState([]); // พรีวิวรูปเพิ่มเติม

  // options
  const [communityMode, setCommunityMode] = useState("comments"); // off | comments
  const [visibility, setVisibility] = useState("public"); // review | public

  // Kind of project
  const [kind, setKind] = useState("html"); // 'html' | 'download'

  // ui
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");

  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const screensInputRef = useRef(null);
  const extrasInputRef = useRef(null);

  // slug จาก title
  useEffect(() => {
    const s =
      title
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 48) || "";
    setSlug(s);
  }, [title]);

  // preview cover
  useEffect(() => {
    if (!coverFile) return setCoverPreview("");
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  // preview screens
  useEffect(() => {
    if (!screens.length) return setScreenPreviews([]);
    const urls = screens.map((f) => URL.createObjectURL(f));
    setScreenPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [screens]);

  // preview extra images
  useEffect(() => {
    if (!extraImages.length) return setExtraPreviews([]);
    const urls = extraImages.map((f) => URL.createObjectURL(f));
    setExtraPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [extraImages]);

  // tag helpers
  const addTag = () => {
    const t = tagDraft.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) return setTagDraft("");
    setTags((x) => [...x, t].slice(0, 10));
    setTagDraft("");
  };
  const removeTag = (t) => setTags((x) => x.filter((i) => i !== t));

  // reset
  const resetForm = () => {
    setTitle("");
    setSlug("");
    setTagline("");
    setDescription("");
    setCategory("no-genre");
    setTags([]);
    setTagDraft("");
    setGameFile(null);
    setCoverFile(null);
    setScreens([]);
    setCoverPreview("");
    setScreenPreviews([]);
    setTrailerUrl("");
    setExtraImages([]);
    setExtraPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (screensInputRef.current) screensInputRef.current.value = "";
    if (extrasInputRef.current) extrasInputRef.current.value = "";
    setProgress(0);
    setMsg("");
    setKind("html");
    setCommunityMode("comments");
    setVisibility("public");
  };

  /** จัดการเปลี่ยนรูปหน้าปก + ย่อก่อนอัปโหลด */
  const onCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return setCoverFile(null);
    const resized = await resizeImage(file, 1200, 675, "image/jpeg", 0.9);
    setCoverFile(resized);
  };

  /** จัดการสกรีนช็อต + ย่อก่อนอัปโหลด */
  const onScreensChange = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    const resized = [];
    for (const f of files) {
      resized.push(await resizeImage(f, 1600, 900, "image/jpeg", 0.9));
    }
    setScreens(resized);
  };

  /** รูปภาพเพิ่มเติม (เช่น art, UI, poster ฯลฯ) */
  const onExtrasChange = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 10); // สูงสุด 10 รูป
    const resized = [];
    for (const f of files) {
      resized.push(await resizeImage(f, 1600, 900, "image/jpeg", 0.9));
    }
    setExtraImages(resized);
  };

  // accept ชนิดไฟล์ตาม kind
  const acceptForKind = kind === "html" ? ".html,.htm,.zip" : ".rar";

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (busy) return;

    if (!title.trim()) return setMsg("กรุณาใส่ชื่อเกม");
    if (!gameFile) return setMsg("กรุณาแนบไฟล์เกม");

    // ตรวจสอบชนิดไฟล์ตาม kind
    if (kind === "html" && !/\.(html?|zip)$/i.test(gameFile.name)) {
      return setMsg("โหมด HTML รองรับเฉพาะไฟล์ .html หรือ .zip");
    }
    if (kind === "download" && !/\.rar$/i.test(gameFile.name)) {
      return setMsg("โหมด Downloadable รองรับเฉพาะไฟล์ .rar");
    }

    setBusy(true);
    setProgress(0);

    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("slug", slug);
      fd.append("tagline", tagline);
      fd.append("description", description);
      fd.append("category", category);
      fd.append("visibility", visibility);
      fd.append("kind", kind);

      tags.forEach((t) => fd.append("tags[]", t));
      if (coverFile) fd.append("cover", coverFile);
      fd.append("file", gameFile);
      screens.forEach((f) => fd.append("screens[]", f));

      // วิดีโอ & รูปเพิ่มเติม
      if (trailerUrl.trim()) {
        fd.append("trailerUrl", trailerUrl.trim());
      }
      extraImages.forEach((f) => fd.append("extras[]", f));

      const token = localStorage.getItem("token");
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.post("/games", fd, {
        withCredentials: true,
        headers: { ...authHeader },
        onUploadProgress: (ev) => {
          if (ev.total)
            setProgress(Math.round((ev.loaded * 100) / ev.total));
        },
      });

      setMsg("อัปโหลดสำเร็จ! 🎉");
      resetForm();
      console.log("Created:", res.data);
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401)
        setMsg(
          "ยังไม่ได้ล็อกอิน (Unauthorized) — กรุณาเข้าสู่ระบบก่อนอัปโหลด"
        );
      else
        setMsg(
          err?.response?.data?.message ||
            err.message ||
            "อัปโหลดล้มเหลว"
        );
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const currentCat =
    CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];

  const isSuccess = msg.startsWith("อัปโหลดสำเร็จ");

  return (
    <div className="container section">
      <StyleLocal />

      <div className="up-wrap">
        <div className="up-head">
          <div>
            <h1 className="tx-gradient up-title">Upload your game</h1>
            <p className="up-sub">
              อัปโหลดเกมให้ดูดีตั้งแต่แรกเห็น — ใส่หน้าปก
              สกรีนช็อต วิดีโอ แท็ก และรายละเอียดแบบครบ ๆ
            </p>
          </div>
          <div className="up-hints">
            <div className="hint">สูงสุด ~500MB</div>
            <div className="hint">
              {kind === "html"
                ? "HTML mode: รองรับ .html หรือ .zip (มี index.html)"
                : "Downloadable mode: รองรับ .rar สำหรับดาวน์โหลด"}
            </div>
          </div>
        </div>

        <form className="up-grid" onSubmit={onSubmit}>
          {/* LEFT */}
          <section className="up-card">
            <h3 className="up-sec">พื้นฐาน</h3>

            <label className="up-label">ชื่อเกม</label>
            <input
              className="up-input"
              placeholder="e.g., Banana Clicker"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <label className="up-label">URL (slug)</label>
            <div className="up-input-row">
              <span className="muted">https://gpx.gg/</span>
              <input
                className="up-input clean"
                placeholder="your-awesome-game"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>

            <label className="up-label">คำอธิบายหลัก (tagline)</label>
            <input
              className="up-input"
              placeholder="สั้น ๆ ชวนคลิก"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />

            <label className="up-label">รายละเอียด</label>
            <textarea
              className="up-textarea"
              rows={8}
              placeholder="เล่าถึงวิธีเล่น จุดเด่น และข้อมูลเวอร์ชัน ฯลฯ"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {/* tags */}
            <label className="up-label">แท็ก (สูงสุด 10 แท็ก)</label>
            <div className="tag-wrap">
              <input
                className="up-input"
                placeholder="เช่น pixel-art, roguelike, cozy"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button
                type="button"
                className="btn-tag-add"
                onClick={addTag}
              >
                เพิ่มแท็ก
              </button>
            </div>
            {!!tags.length && (
              <div className="chips">
                {tags.map((t) => (
                  <span key={t} className="chip">
                    #{t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      aria-label={`remove ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="up-row">
              <div className="col">
                <label className="up-label">หมวดหมู่</label>
                <div className="cat-select">
                  <button
                    type="button"
                    className="cat-trigger"
                    onClick={() => setCatOpen((v) => !v)}
                    style={{ borderColor: currentCat.color }}
                  >
                    <span
                      className="cat-dot"
                      style={{ background: currentCat.color }}
                    />
                    <span className="cat-emoji">{currentCat.emoji}</span>
                    <span className="cat-name">{currentCat.name}</span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      className={catOpen ? "rot" : ""}
                    >
                      <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
                    </svg>
                  </button>

                  {catOpen && (
                    <div
                      className="cat-menu"
                      onMouseLeave={() => setCatOpen(false)}
                    >
                      {CATEGORIES.map((c) => (
                        <div
                          key={c.id}
                          className={`cat-item ${
                            c.id === category ? "is-active" : ""
                          }`}
                          onClick={() => {
                            setCategory(c.id);
                            setCatOpen(false);
                          }}
                        >
                          <span
                            className="cat-dot"
                            style={{ background: c.color }}
                          />
                          <span className="cat-emoji">{c.emoji}</span>
                          <span className="cat-name">{c.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="col">
                <label className="up-label">ชุมชน</label>
                <div className="pill-row">
                  <label
                    className={`pill ${
                      communityMode === "off" ? "is-on" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="community"
                      value="off"
                      checked={communityMode === "off"}
                      onChange={() => setCommunityMode("off")}
                    />
                    ปิดการมีส่วนร่วม
                  </label>
                  <label
                    className={`pill ${
                      communityMode === "comments" ? "is-on" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="community"
                      value="comments"
                      checked={communityMode === "comments"}
                      onChange={() => setCommunityMode("comments")}
                    />
                    เปิดคอมเมนต์
                  </label>
                </div>
              </div>
            </div>

            {/* การมองเห็น: สาธารณะ / ส่วนตัว */}
            <div className="up-row">
              <div className="col">
                <label className="up-label">การมองเห็น</label>
                <div className="vis-row">
                  <button
                    type="button"
                    className={
                      visibility === "public"
                        ? "vis-pill vis-pill--active"
                        : "vis-pill"
                    }
                    onClick={() => setVisibility("public")}
                  >
                    <span>🌐 สาธารณะ</span>
                    <span className="vis-sub">
                      ทุกคนค้นหาและเข้าเล่นได้
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      visibility === "review"
                        ? "vis-pill vis-pill--active"
                        : "vis-pill"
                    }
                    onClick={() => setVisibility("review")}
                  >
                    <span>🔒 ส่วนตัว</span>
                    <span className="vis-sub">
                      ใช้ทดสอบ / มีลิงก์เท่านั้นที่เข้าเล่นได้
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Kind of project */}
            <label className="up-label">Kind of project</label>
            <select
              className="up-input"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="download">
                Downloadable — You only have files to be downloaded (.rar)
              </option>
              <option value="html">
                HTML — You have a ZIP or HTML file that will be played in the
                browser
              </option>
            </select>
          </section>

          {/* RIGHT */}
          <section className="up-card">
            <h3 className="up-sec">ไฟล์ & สื่อประกอบ</h3>

            <div className="up-field">
              <label className="up-label">
                {kind === "html"
                  ? "ไฟล์เกมหลัก (.html / .zip)"
                  : "ไฟล์เกมหลัก (.rar)"}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptForKind}
                onChange={(e) =>
                  setGameFile(e.target.files?.[0] || null)
                }
              />
              {gameFile && (
                <div className="file-name tiny">
                  📁 {gameFile.name}{" "}
                  <span className="muted">
                    ({(gameFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
              )}
              <div className="muted tiny">
                {kind === "html"
                  ? "แนะนำ .zip ที่แตกแล้วมี index.html เพื่อเล่นบนเว็บ"
                  : "ผู้เล่นจะดาวน์โหลดไฟล์ .rar ไปติดตั้ง/รันเองในเครื่อง"}
              </div>
            </div>

            <div className="up-field">
              <label className="up-label">
                ภาพหน้าปก (แนะนำ 1200×675, ≤2MB)
              </label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={onCoverChange}
              />
              <div className="cover-frame">
                {coverPreview ? (
                  <img src={coverPreview} alt="cover" />
                ) : (
                  <div className="empty">ยังไม่มีภาพหน้าปก</div>
                )}
              </div>
            </div>

            <div className="up-field">
              <label className="up-label">
                สกรีนช็อต (สูงสุด 5 รูป)
              </label>
              <input
                ref={screensInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={onScreensChange}
              />
              {!!screenPreviews.length && (
                <div className="screens">
                  {screenPreviews.map((u, i) => (
                    <figure key={i} className="screen">
                      <img src={u} alt={`s-${i}`} />
                    </figure>
                  ))}
                </div>
              )}
            </div>

            {/* วิดีโอตัวอย่าง */}
            <div className="up-field">
              <label className="up-label">
                วิดีโอตัวอย่าง (ลิงก์ YouTube / Vimeo ฯลฯ)
              </label>
              <input
                className="up-input"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={trailerUrl}
                onChange={(e) => setTrailerUrl(e.target.value)}
              />
              <div className="muted tiny">
                ใช้ลิงก์ฝังจากแพลตฟอร์มวิดีโอ แนะนำ YouTube
                (จะไปใช้แสดงในหน้าเกมภายหลัง)
              </div>
            </div>

            {/* รูปภาพเพิ่มเติม */}
            <div className="up-field">
              <label className="up-label">
                รูปภาพเพิ่มเติม (เช่น Poster / UI / Art, สูงสุด 10 รูป)
              </label>
              <input
                ref={extrasInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={onExtrasChange}
              />
              {!!extraPreviews.length && (
                <div className="screens extras">
                  {extraPreviews.map((u, i) => (
                    <figure key={i} className="screen">
                      <img src={u} alt={`extra-${i}`} />
                    </figure>
                  ))}
                </div>
              )}
            </div>

            {progress > 0 && (
              <div className="progress">
                <div
                  className="bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {msg && <div className="alert">{msg}</div>}

            {/* ปุ่มฉลาดๆ ด้านล่าง */}
            <div className="btn-row">
              <div className="btn-row__left">
                <span className="muted tiny">
                  {busy
                    ? "กำลังอัปโหลดไฟล์ของคุณขึ้น GPX… อย่าปิดหน้านี้จนกว่าจะเสร็จ"
                    : "เมื่อกดอัปโหลด ระบบจะสร้างหน้ารายละเอียดเกมให้ และเกมจะอยู่ตามการมองเห็นที่คุณเลือก"}
                </span>
              </div>
              <div className="btn-row__right">
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={resetForm}
                  disabled={busy}
                >
                  ล้างฟอร์ม
                </button>
                <button
                  className={`btn btn-primary ${
                    !busy && isSuccess ? "btn-primary--success" : ""
                  }`}
                  type="submit"
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <span className="btn-spinner" />
                      <span>
                        กำลังอัปโหลด…
                        {progress > 0 ? ` ${progress}%` : ""}
                      </span>
                    </>
                  ) : isSuccess ? (
                    <>
                      <span>✅</span>
                      <span>อัปโหลดสำเร็จ! อัปโหลดอีกเกม</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>อัปโหลดเกม</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}

/** scoped styles */
function StyleLocal() {
  return (
    <style>{`
.up-wrap{ display:grid; gap:18px }
.up-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px }
.up-title{ margin:0; font-size: clamp(26px, 3.8vw, 44px); line-height:1.05 }
.up-sub{ color:var(--muted) }
.up-hints{ display:flex; gap:10px; flex-wrap:wrap }
.hint{ font-size:12px; padding:6px 10px; border-radius:999px; border:1px solid var(--stroke); color:#dfe7ee; background:rgba(255,255,255,.05) }

.up-grid{ display:grid; grid-template-columns: 1.2fr .9fr; gap:14px }
@media (max-width: 980px){ .up-grid{ grid-template-columns: 1fr } }

.up-card{
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
  border:1px solid var(--stroke); border-radius:16px; padding:16px; box-shadow: var(--shadow);
}
.up-sec{ margin:0 0 12px; font-size:16px; letter-spacing:.2px; color:#eaf4ff }

.up-label{ display:block; font-size:12px; color:#bcd3e8; margin:10px 0 6px }
.up-input, .up-textarea, .up-input.clean{
  width:100%; padding:11px 12px; border-radius:12px; background:rgba(255,255,255,.05);
  border:1px solid var(--stroke); color:var(--text); outline:none; transition:.2s;
}
.up-input:focus, .up-textarea:focus{ border-color:#5cd5ff; box-shadow:0 0 0 4px rgba(72,208,255,.15) }
.up-textarea{ resize:vertical }

.up-row{ display:flex; gap:12px; flex-wrap:wrap }
.up-row .col{ flex:1 1 220px }

.up-input-row{ display:flex; align-items:center; gap:6px }
.up-input.clean{ background:rgba(255,255,255,.02) }

/* Category Select */
.cat-select{ position:relative }
.cat-trigger{
  width:100%; height:42px; display:flex; align-items:center; gap:8px;
  padding:0 12px; border-radius:12px; background:rgba(255,255,255,.05);
  border:2px solid var(--stroke); color:var(--text); transition:.15s; justify-content:space-between;
}
.cat-trigger .cat-name{ flex:1; text-align:left; padding-left:4px }
.cat-trigger .cat-emoji{ opacity:.95 }
.cat-trigger .cat-dot{ width:10px; height:10px; border-radius:999px; box-shadow:0 0 0 2px rgba(255,255,255,.12) inset }
.cat-trigger:hover{ border-color:#6bd9ff; }
.cat-trigger svg{ opacity:.8; transition:.2s }
.cat-trigger svg.rot{ transform:rotate(180deg) }

.cat-menu{
  position:absolute; top:48px; left:0; right:0; z-index:20;
  background:#0d1014; border:1px solid var(--stroke); border-radius:12px;
  box-shadow: var(--shadow); max-height:340px; overflow:auto;
}
.cat-item{
  display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer;
}
.cat-item .cat-dot{ width:10px; height:10px; border-radius:999px }
.cat-item:hover{ background:rgba(255,255,255,.06) }
.cat-item.is-active{ background:rgba(72,208,255,.11); border-left:3px solid #59e0ff }

/* Toggles, chips, buttons */
.pill-row{ display:flex; flex-wrap:wrap; gap:8px; margin-top:4px }
.pill{
  display:inline-flex; align-items:center; gap:6px; cursor:pointer; user-select:none;
  font-size:13px; color:#dfe7ee; padding:8px 12px; border-radius:999px; border:1px solid var(--stroke);
  background:rgba(255,255,255,.05);
}
.pill input{ display:none }
.pill.is-on{ border-color:#6bd9ff; background:rgba(72,208,255,.09) }

/* Visibility pills */
.vis-row{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:4px;
}
.vis-pill{
  flex:1 1 160px;
  min-width:0;
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
.vis-pill:hover{
  border-color:rgba(96,165,250,1);
  box-shadow:0 8px 22px rgba(0,0,0,.6);
}
.vis-pill--active{
  border-color:rgba(59,130,246,1);
  background:radial-gradient(circle at top left,#1d4ed8,#020617);
}
.vis-sub{
  font-size:11px;
  opacity:.8;
}

/* tags */
.tag-wrap{ display:flex; gap:8px; align-items:center; margin-top:4px }
.btn-tag-add{
  white-space:nowrap;
  padding:9px 12px;
  border-radius:999px;
  border:1px dashed var(--stroke);
  background:rgba(15,23,42,.9);
  color:#e5f2ff;
  font-size:13px;
  cursor:pointer;
  transition:.16s ease;
}
.btn-tag-add:hover{
  border-color:#60a5fa;
  background:rgba(37,99,235,.35);
}
.chips{ display:flex; gap:8px; flex-wrap:wrap; margin-top:8px }
.chip{
  display:inline-flex; align-items:center; gap:8px;
  padding:6px 10px; border-radius:999px; border:1px solid var(--stroke);
  background:rgba(255,255,255,.06); color:#dfe7ee; font-size:13px;
}
.chip button{ background:transparent; color:#9bb2c7; border:none; cursor:pointer; font-size:14px }

.up-field{ margin-top:10px }

/* กรอบพรีวิว 16:9 ไม่ล้น */
.cover-frame{
  position:relative; width:100%; aspect-ratio:16/9;
  border:1px dashed var(--stroke); border-radius:12px; overflow:hidden; margin-top:8px;
  display:grid; place-items:center; background:rgba(255,255,255,.03);
}
.cover-frame img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover }
.cover-frame .empty{ color:#9fb4c8; font-size:13px }

/* สกรีนช็อต & รูปเพิ่มเติม */
.screens{ display:grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap:10px; margin-top:8px }
.screen{ aspect-ratio:16/9; overflow:hidden; border-radius:12px; border:1px solid var(--stroke); background:rgba(255,255,255,.05) }
.screen img{ width:100%; height:100%; object-fit:cover }

/* แยก extra นิดหน่อยเผื่ออนาคตอยากสไตล์ต่างกัน */
.screens.extras .screen{
  opacity:.96;
}

/* Progress / Alert / Buttons */
.progress{ height:10px; border-radius:999px; background:rgba(255,255,255,.06); border:1px solid var(--stroke); margin-top:12px; overflow:hidden }
.progress .bar{
  height:100%; width:0%; background: linear-gradient(90deg, #59e0ff, #35c4ff, #8b5cf6);
  transition: width .2s ease;
}

.alert{
  margin-top:10px; padding:10px 12px; border-radius:12px;
  background:rgba(255,255,255,.04); border:1px solid var(--stroke); color:#eaf4ff; font-size:14px;
}

.btn-row{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  align-items:center;
  justify-content:space-between;
  margin-top:14px;
}
.btn-row__left{
  flex:1 1 200px;
  min-width:0;
}
.btn-row__right{
  display:flex;
  gap:8px;
  justify-content:flex-end;
  flex:0 0 auto;
}

.btn{
  appearance:none; border:none; outline:none; cursor:pointer;
  padding:10px 14px; border-radius:12px; background:var(--glass); color:var(--text);
  border:1px solid var(--stroke); transition:.2s ease;
  display:inline-flex;
  align-items:center;
  gap:8px;
  font-size:14px;
}
.btn:hover{ transform:translateY(-1px); box-shadow:0 12px 28px rgba(0,0,0,.35) }
.btn-primary{
  background:linear-gradient(135deg, #59e0ff, #35c4ff); color:#041318; border:none;
}
.btn-primary--success{
  background:linear-gradient(135deg,#22c55e,#4ade80);
}
.btn-ghost{ background:transparent }

.btn[disabled]{
  opacity:.65;
  cursor:default;
  transform:none;
  box-shadow:none;
}

.btn-spinner{
  width:14px;
  height:14px;
  border-radius:999px;
  border:2px solid rgba(15,23,42,.4);
  border-top-color:#e5f4ff;
  display:inline-block;
  animation:spin .7s linear infinite;
}
@keyframes spin{
  to{ transform:rotate(360deg); }
}

.file-name{ margin-top:4px }

/* misc */
.tiny{ font-size:12px }
`}</style>
  );
}
