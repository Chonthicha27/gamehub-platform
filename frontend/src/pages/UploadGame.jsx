// frontend/src/pages/UploadGame.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";

/** Main categories (used for uploading games) */
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

const DRAFT_KEY = "gpx_upload_draft";

/** Resize image with Canvas (keeps aspect ratio) */
async function resizeImage(file, maxW = 1200, maxH = 675, mime = "image/jpeg", quality = 0.9) {
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

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Image convert failed (toBlob returned null)."));
        resolve(
          new File([blob], file.name.replace(/\.(png|webp)$/i, ".jpg"), {
            type: mime,
          })
        );
      },
      mime,
      quality
    );
  });
}

/** Helpers */
const firstNonEmpty = (...xs) => xs.find((x) => String(x || "").trim()) || "";
const toSafeSlug = (s = "") =>
  String(s || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48);

export default function UploadGame() {
  const nav = useNavigate();
  const location = useLocation();

  // ===== Basics (sent to backend) =====
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");

  // category (sent to backend)
  const [category, setCategory] = useState("no-genre");
  const [catOpen, setCatOpen] = useState(false);

  // tags (sent to backend)
  const [tags, setTags] = useState([]);
  const [tagDraft, setTagDraft] = useState("");

  // kind (sent to backend)
  const [kind, setKind] = useState("html"); // 'html' | 'download'
  const [kindOpen, setKindOpen] = useState(false);

  // community (sent to backend now)
  const [communityMode, setCommunityMode] = useState("comments"); // off | comments

  // visibility (sent to backend)
  const [visibility, setVisibility] = useState("review"); // public | review | private

  // files (sent to backend)
  const [gameFile, setGameFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [screens, setScreens] = useState([]);

  // previews
  const [coverPreview, setCoverPreview] = useState("");
  const [screenPreviews, setScreenPreviews] = useState([]);

  // ✅ keep object URLs alive across route changes (don’t revoke on unmount)
  const coverUrlRef = useRef("");
  const screensUrlRef = useRef([]);

  // media (sent to backend)
  const [videoUrl, setVideoUrl] = useState("");

  // ui
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");

  // ✅ after upload: enable View page button
  const [createdPath, setCreatedPath] = useState("");

  // ✅ success modal
  const [showSuccess, setShowSuccess] = useState(false);
  const [successNote, setSuccessNote] = useState("");

  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const screensInputRef = useRef(null);

  // ✅ slug from title (ONLY if user hasn't edited slug)
  useEffect(() => {
    if (slugTouched) return;
    setSlug(toSafeSlug(title));
  }, [title, slugTouched]);

  const currentCat = useMemo(
    () => CATEGORIES.find((c) => c.id === category) || CATEGORIES[0],
    [category]
  );

  // tag helpers
  const addTag = () => {
    const t = tagDraft.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) return setTagDraft("");
    setTags((x) => [...x, t].slice(0, 10));
    setTagDraft("");
  };
  const removeTag = (t) => setTags((x) => x.filter((i) => i !== t));

  // accept by kind
  const acceptForKind = kind === "html" ? ".html,.htm,.zip" : ".rar";

  // ✅ PREVIEW DRAFT (works before upload)
  const buildDraft = () => ({
    title: title.trim(),
    slug: slug || "",
    tagline: tagline || "",
    description: description || "",
    category,
    kind,
    tags,
    visibility,
    communityMode,
    videoUrl: videoUrl || "",
    coverPreview: coverPreview || "",
    screenPreviews: screenPreviews || [],
    gameFileName: gameFile?.name || "",
  });

  // ✅ Restore draft -> fill form (text fields)
  const applyDraftToForm = (d) => {
    const draft = d || {};
    setTitle(draft.title || "");
    setTagline(draft.tagline || "");
    setDescription(draft.description || "");

    setCategory(draft.category || "no-genre");
    setKind(draft.kind === "download" ? "download" : "html");
    setTags(Array.isArray(draft.tags) ? draft.tags : []);
    setCommunityMode(draft.communityMode === "off" ? "off" : "comments");

    // visibility mapping keep backend values
    setVisibility(draft.visibility || "review");

    setVideoUrl(draft.videoUrl || "");

    // slug logic: ถ้ามี slug จาก draft ให้ถือว่า user เคยแก้เอง
    if (String(draft.slug || "").trim()) {
      setSlug(draft.slug);
      setSlugTouched(true);
    } else {
      setSlug("");
      setSlugTouched(false);
    }

    // ✅ preview urls (อาจใช้ได้เฉพาะ session เดิม/ก่อน refresh)
    if (draft.coverPreview) setCoverPreview(draft.coverPreview);
    if (Array.isArray(draft.screenPreviews)) setScreenPreviews(draft.screenPreviews);

    // ไฟล์จริง restore ไม่ได้ (browser security)
    setGameFile(null);
    setCoverFile(null);
    setScreens([]);

    // แนะนำ user ให้เลือกไฟล์ใหม่ถ้าจำเป็น
    setMsg((prev) => prev || "Draft restored. Please re-attach files before uploading.");
  };

  // ✅ On mount: load draft from nav state OR sessionStorage
  useEffect(() => {
    const fromState = location?.state?.draft;
    if (fromState) {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(fromState));
      } catch {}
      applyDraftToForm(fromState);
      return;
    }

    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") applyDraftToForm(parsed);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Auto-save draft while editing (text fields only)
  useEffect(() => {
    // ไม่ต้องเซฟตอนกำลัง upload
    if (busy) return;

    const t = setTimeout(() => {
      try {
        const d = buildDraft();
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      } catch {}
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    slug,
    tagline,
    description,
    category,
    kind,
    tags,
    visibility,
    communityMode,
    videoUrl,
    coverPreview,
    screenPreviews,
    busy,
  ]);

  const openPreview = () => {
    const draft = buildDraft();

    if (!draft.title) {
      setMsg("Please enter a title before previewing.");
      return;
    }

    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}

    nav("/preview", { state: { draft } });
  };

  // ✅ View page after upload (real page)
  const openViewPage = () => {
    if (!createdPath) return;
    nav(createdPath);
  };

  // reset
  const resetForm = () => {
    // ✅ revoke previews (avoid memory leak)
    if (coverUrlRef.current) {
      try {
        URL.revokeObjectURL(coverUrlRef.current);
      } catch {}
      coverUrlRef.current = "";
    }
    if (Array.isArray(screensUrlRef.current)) {
      screensUrlRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
      screensUrlRef.current = [];
    }

    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setTagline("");
    setDescription("");
    setCategory("no-genre");
    setCatOpen(false);
    setTags([]);
    setTagDraft("");
    setKind("html");
    setKindOpen(false);
    setCommunityMode("comments");
    setVisibility("review");
    setGameFile(null);
    setCoverFile(null);
    setScreens([]);
    setCoverPreview("");
    setScreenPreviews([]);
    setVideoUrl("");
    setProgress(0);
    setMsg("");
    setCreatedPath("");
    setShowSuccess(false);
    setSuccessNote("");

    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {}

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (screensInputRef.current) screensInputRef.current.value = "";
  };

  /** ✅ cover + resize before upload (KEEP preview alive across route changes) */
  const onCoverChange = async (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      // revoke old
      if (coverUrlRef.current) {
        try {
          URL.revokeObjectURL(coverUrlRef.current);
        } catch {}
      }
      coverUrlRef.current = "";
      setCoverFile(null);
      setCoverPreview("");
      return;
    }

    try {
      const resized = await resizeImage(file, 1200, 675, "image/jpeg", 0.9);
      setCoverFile(resized);

      // ✅ create preview url + revoke old
      const nextUrl = URL.createObjectURL(resized);
      if (coverUrlRef.current) {
        try {
          URL.revokeObjectURL(coverUrlRef.current);
        } catch {}
      }
      coverUrlRef.current = nextUrl;
      setCoverPreview(nextUrl);
    } catch (err) {
      console.error(err);
      setCoverFile(null);

      if (coverUrlRef.current) {
        try {
          URL.revokeObjectURL(coverUrlRef.current);
        } catch {}
      }
      coverUrlRef.current = "";
      setCoverPreview("");

      setMsg("Cover image could not be processed. Please try another image.");
    }
  };

  /** ✅ screenshots + resize before upload (KEEP preview alive across route changes) */
  const onScreensChange = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);

    // revoke old previews
    if (Array.isArray(screensUrlRef.current)) {
      screensUrlRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    }
    screensUrlRef.current = [];
    setScreenPreviews([]);

    if (files.length === 0) {
      setScreens([]);
      return;
    }

    const resized = [];
    try {
      for (const f of files) resized.push(await resizeImage(f, 1600, 900, "image/jpeg", 0.9));
      setScreens(resized);

      // ✅ create preview urls from resized
      const urls = resized.map((f) => URL.createObjectURL(f));
      screensUrlRef.current = urls;
      setScreenPreviews(urls);
    } catch (err) {
      console.error(err);
      setScreens([]);
      setMsg("Screenshots could not be processed. Please try different images.");
    }
  };

  /**
   * ✅ ENGLISH success note that matches what the system ACTUALLY saved
   * - Use created.visibility + created.requestedVisibility from backend response
   */
  const buildSuccessNote = (created, selectedVisibility) => {
    const savedVis = String(created?.visibility || "").toLowerCase();
    const requested = String(created?.requestedVisibility || "").toLowerCase();
    const selected = String(selectedVisibility || "").toLowerCase();

    if (requested === "public" && savedVis === "review") {
      return (
        "Upload successful ✅\n" +
        "Your project has been submitted for admin review.\n" +
        "It will not appear on Home/Search until it is approved.\n" +
        "For now, only you and admins can view this page."
      );
    }

    if (savedVis === "public") {
      return "Upload successful ✅\n" + "Your project is now Public.\n" + "It can appear on Home/Search.";
    }

    if (savedVis === "review") {
      return "Upload successful ✅\n" + "Saved as Draft.\n" + "Only you and admins can view this page.";
    }

    if (savedVis === "private") {
      return "Upload successful ✅\n" + "Saved as Restricted (Private).\n" + "Only you and admins can view this page.";
    }

    return "Upload successful ✅\n" + `Saved visibility: ${savedVis || selected || "unknown"}`;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (busy) return;

    if (!title.trim()) return setMsg("Please enter a game title.");
    if (!gameFile) return setMsg("Please attach your game file.");

    // validate file by kind
    if (kind === "html" && !/\.(html?|zip)$/i.test(gameFile.name)) {
      return setMsg("HTML mode supports only .html or .zip files.");
    }
    if (kind === "download" && !/\.rar$/i.test(gameFile.name)) {
      return setMsg("Downloadable mode supports only .rar files.");
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

      // ✅ ส่งค่าเปิด/ปิดคอมเมนต์ให้ backend (ตรงกับ backend: commentsEnabled)
      fd.append("commentsEnabled", communityMode === "comments" ? "true" : "false");

      tags.forEach((t) => fd.append("tags[]", t));
      if (coverFile) fd.append("cover", coverFile);
      fd.append("file", gameFile);
      screens.forEach((f) => fd.append("screens[]", f));
      if (videoUrl.trim()) fd.append("videoUrl", videoUrl.trim());

      const token = localStorage.getItem("token");
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.post("/games", fd, {
        withCredentials: true,
        headers: { ...authHeader },
        onUploadProgress: (ev) => {
          if (ev.total) setProgress(Math.round((ev.loaded * 100) / ev.total));
        },
      });

      // ✅ normalize response
      const payload = res?.data || {};
      const created = payload?.game || payload?.data || payload?.result || payload?.created || payload || {};
      const id = firstNonEmpty(created?._id, created?.id, created?.gameId);

      if (!id) {
        console.log("POST /games response (missing id):", payload);
        setCreatedPath("");
        setSuccessNote(
          buildSuccessNote(created, visibility) +
            "\n\nNote: The system did not return a game id, so “View page” cannot be opened. (Check Console logs.)"
        );
        setShowSuccess(true);
        setMsg("Uploaded, but cannot open “View page” (missing id).");
        return;
      }

      const path = `/games/${id}`;
      setCreatedPath(path);

      setSuccessNote(buildSuccessNote(created, visibility));
      setShowSuccess(true);

      setMsg("Uploaded successfully! 🎉");

      // optional: clear draft because now it's real
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}

      console.log("POST /games payload:", payload);
      console.log("normalized created:", created);
      console.log("createdPath:", path);
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401) {
        setMsg("You are not logged in (Unauthorized). Please sign in first.");
      } else {
        setMsg(err?.response?.data?.message || err.message || "Upload failed.");
      }
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  // itch-like visibility radio mapping (keeps backend values)
  const visChoice = useMemo(() => {
    if (visibility === "review") return "draft";
    if (visibility === "private") return "restricted";
    if (visibility === "public") return "public";
    return "restricted";
  }, [visibility]);

  const setVisByChoice = (choice) => {
    if (choice === "draft") return setVisibility("review");
    if (choice === "public") return setVisibility("public");
    return setVisibility("private");
  };

  const resetSlugFromTitle = () => {
    setSlugTouched(false);
    setSlug(toSafeSlug(title));
  };

  const kindLabel =
    kind === "html"
      ? "HTML — played in the browser (.html / .zip)"
      : "Downloadable — files to be downloaded (.rar)";

  return (
    <div className="container section">
      <StyleLocal />

      {/* ✅ Success Modal */}
      {showSuccess && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-head">
              <div className="modal-title">Upload complete ✅</div>
              <button className="modal-x" onClick={() => setShowSuccess(false)} aria-label="Close" type="button">
                ×
              </button>
            </div>

            <div className="modal-body">
              <pre className="modal-note">{successNote}</pre>

              {createdPath ? (
                <div className="modal-hint muted">
                  You can now click <b>View page</b> to open your game page.
                </div>
              ) : (
                <div className="modal-hint muted">
                  Tip: You can use <b>Preview</b> anytime to see the draft before uploading.
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowSuccess(false)}>
                Close
              </button>

              <button type="button" className="btn" onClick={openPreview} title="Preview draft page">
                Preview
              </button>

              <button
                type="button"
                className={`btn ${createdPath ? "btn-outline-on" : ""}`}
                onClick={() => {
                  setShowSuccess(false);
                  openViewPage();
                }}
                disabled={!createdPath}
                title={createdPath ? "View your game page" : "Upload first to enable View page"}
              >
                View page
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="itch-wrap">
        <div className="itch-top">
          <div>
            <h1 className="itch-title">Create a new project</h1>
            <div className="itch-sub">
              Set up your game page: title, cover, files, screenshots, trailer, tags, and details.
            </div>
          </div>

          <div className="itch-meta">
            <button type="button" className="btn" onClick={openPreview} title="Preview draft page">
              Preview
            </button>

            <button
              type="button"
              className={`btn ${createdPath ? "btn-outline-on" : ""}`}
              onClick={openViewPage}
              disabled={!createdPath}
              title={createdPath ? "View your game page" : "Upload first to enable View page"}
            >
              View page
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="itch-grid">
          {/* LEFT */}
          <div className="itch-col">
            {/* Basics */}
            <section className="box">
              <div className="box-head">
                <div className="box-title">Make sure everyone can find your page</div>
                <div className="box-desc muted">
                  Use a clear title and tagline, then choose the right genre and tags to improve search visibility.
                </div>
              </div>

              <div className="field">
                <label className="label">Title</label>
                <input className="input" placeholder="e.g., Banana Clicker" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="field">
                <label className="label">Project URL</label>
                <div className="url-row">
                  <span className="url-prefix muted">https://gpx.gg/</span>
                  <input
                    className="input input-clean"
                    placeholder="your-awesome-game"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                  />
                  <button type="button" className="btn btn-small" onClick={resetSlugFromTitle} title="Reset slug from title">
                    Reset
                  </button>
                </div>
                {slugTouched ? <div className="help muted">Slug is manually edited (title will not overwrite it).</div> : null}
              </div>

              <div className="field">
                <label className="label">Short description or tagline</label>
                <input
                  className="input"
                  placeholder="A short line that makes people want to click"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </div>

              <div className="two">
                <div className="field">
                  <label className="label">Kind of project</label>

                  <div className="kind-select">
                    <button
                      type="button"
                      className="kind-trigger"
                      onClick={() => setKindOpen((v) => !v)}
                      aria-haspopup="listbox"
                      aria-expanded={kindOpen ? "true" : "false"}
                    >
                      <span className="kind-name">{kindLabel}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" className={kindOpen ? "rot" : ""}>
                        <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
                      </svg>
                    </button>

                    {kindOpen && (
                      <div className="kind-menu" role="listbox" onMouseLeave={() => setKindOpen(false)}>
                        <div
                          role="option"
                          aria-selected={kind === "download" ? "true" : "false"}
                          className={`kind-item ${kind === "download" ? "is-active" : ""}`}
                          onClick={() => {
                            setKind("download");
                            setKindOpen(false);
                          }}
                        >
                          Downloadable — files to be downloaded (.rar)
                        </div>

                        <div
                          role="option"
                          aria-selected={kind === "html" ? "true" : "false"}
                          className={`kind-item ${kind === "html" ? "is-active" : ""}`}
                          onClick={() => {
                            setKind("html");
                            setKindOpen(false);
                          }}
                        >
                          HTML — played in the browser (.html / .zip)
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="field">
                  <label className="label">Genre</label>
                  <div className="cat-select">
                    <button
                      type="button"
                      className="cat-trigger"
                      onClick={() => setCatOpen((v) => !v)}
                      style={{ borderColor: currentCat.color }}
                    >
                      <span className="cat-left">
                        <span className="cat-dot" style={{ background: currentCat.color }} />
                        <span className="cat-emoji">{currentCat.emoji}</span>
                        <span className="cat-name">{currentCat.name}</span>
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" className={catOpen ? "rot" : ""}>
                        <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
                      </svg>
                    </button>

                    {catOpen && (
                      <div className="cat-menu" onMouseLeave={() => setCatOpen(false)}>
                        {CATEGORIES.map((c) => (
                          <div
                            key={c.id}
                            className={`cat-item ${c.id === category ? "is-active" : ""}`}
                            onClick={() => {
                              setCategory(c.id);
                              setCatOpen(false);
                            }}
                          >
                            <span className="cat-dot" style={{ background: c.color }} />
                            <span className="cat-emoji">{c.emoji}</span>
                            <span className="cat-name">{c.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="field">
                <label className="label">Tags (max 10)</label>
                <div className="tag-row">
                  <input
                    className="input"
                    placeholder="e.g., pixel-art, roguelike, cozy"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <button type="button" className="btn" onClick={addTag}>
                    Add tag
                  </button>
                </div>

                {!!tags.length && (
                  <div className="chips">
                    {tags.map((t) => (
                      <span key={t} className="chip">
                        #{t}
                        <button type="button" onClick={() => removeTag(t)} aria-label={`remove ${t}`}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Uploads */}
            <section className="box">
              <div className="box-head">
                <div className="box-title">Uploads</div>
                <div className="box-desc muted">Upload your main game file (based on the mode you selected).</div>
              </div>

              <div className="field">
                <div className="upload-row">
                  <label className="btn btn-primary" htmlFor="gamefile">
                    Upload files
                  </label>
                  <input
                    id="gamefile"
                    ref={fileInputRef}
                    type="file"
                    accept={acceptForKind}
                    onChange={(e) => setGameFile(e.target.files?.[0] || null)}
                    style={{ display: "none" }}
                  />

                  <div className="help muted">
                    {kind === "html"
                      ? "Supported: .html or .zip (recommended: zip contains index.html)"
                      : "Supported: .rar for download"}
                  </div>
                </div>

                {gameFile && (
                  <div className="file-line">
                    <span>📁 {gameFile.name}</span>
                    <span className="muted">({(gameFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </div>
                )}
              </div>

              {progress > 0 && (
                <div className="progress">
                  <div className="bar" style={{ width: `${progress}%` }} />
                </div>
              )}
            </section>

            {/* Details */}
            <section className="box">
              <div className="box-head">
                <div className="box-title">Details</div>
                <div className="box-desc muted">Write what players need: how to play, features, credits, and version notes.</div>
              </div>

              <textarea
                className="textarea"
                rows={10}
                placeholder="Write your game description…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </section>

            {/* Community */}
            <section className="box">
              <div className="box-head">
                <div className="box-title">Community</div>
                <div className="box-desc muted">Choose whether to enable comments under your game page.</div>
              </div>

              <div className="radio-col">
                <label className="radio">
                  <input type="radio" name="community" checked={communityMode === "off"} onChange={() => setCommunityMode("off")} />
                  <span>Disabled</span>
                </label>
                <label className="radio">
                  <input type="radio" name="community" checked={communityMode === "comments"} onChange={() => setCommunityMode("comments")} />
                  <span>Comments — Add a comment thread to the page</span>
                </label>
              </div>
            </section>

            {/* Visibility */}
            <section className="box">
              <div className="box-head">
                <div className="box-title">Visibility & access</div>
                <div className="box-desc muted">
                  Public on GPX means “submit for admin review” — it won’t appear on Home/Search until approved.
                </div>
              </div>

              <div className="radio-col">
                <label className="radio">
                  <input type="radio" name="vis" checked={visChoice === "restricted"} onChange={() => setVisByChoice("restricted")} />
                  <span>Restricted — Only owners & authorized people can view the page</span>
                </label>

                <label className="radio">
                  <input type="radio" name="vis" checked={visChoice === "public"} onChange={() => setVisByChoice("public")} />
                  <span>Public — Submit for admin review. The page will be public after approval</span>
                </label>
              </div>
            </section>

            {/* Bottom actions */}
            {msg && <div className="banner">{msg}</div>}

            <div className="actions">
              <button type="button" className="btn" onClick={resetForm} disabled={busy}>
                Reset
              </button>

              <button type="button" className="btn" onClick={openPreview} disabled={busy}>
                Preview
              </button>

              <button
                type="button"
                className={`btn ${createdPath ? "btn-outline-on" : ""}`}
                onClick={openViewPage}
                disabled={!createdPath}
              >
                View page
              </button>

              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner" /> Uploading…{progress > 0 ? ` ${progress}%` : ""}
                  </>
                ) : (
                  <>Upload</>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT */}
          <aside className="itch-side">
            <section className="box">
              <div className="box-head">
                <div className="box-title">Cover image</div>
                <div className="box-desc muted">Recommended 16:9 (1200×675). A good cover increases clicks.</div>
              </div>

              <div className="cover-drop">
                <div className="cover-inner">
                  {coverPreview ? <img src={coverPreview} alt="cover" /> : <div className="cover-empty muted">No cover uploaded</div>}
                </div>

                <label className="btn btn-primary cover-btn" htmlFor="coverfile">
                  Upload Cover Image
                </label>
                <input
                  id="coverfile"
                  ref={coverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={onCoverChange}
                  style={{ display: "none" }}
                />
              </div>

              <div className="help muted">This image is used for link previews and game cards on the Home page.</div>
            </section>

            <section className="box">
              <div className="box-head">
                <div className="box-title">Gameplay video or trailer</div>
                <div className="box-desc muted">Paste a YouTube / Vimeo link.</div>
              </div>

              <input
                className="input"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />

              <div className="help muted">The video will be shown on your game detail page.</div>
            </section>

            <section className="box">
              <div className="box-head">
                <div className="box-title">Screenshots</div>
                <div className="box-desc muted">Recommended: 3–5 images (max 5) to help people decide quickly.</div>
              </div>

              <label className="btn btn-primary" htmlFor="screenfile">
                Add screenshots
              </label>
              <input
                id="screenfile"
                ref={screensInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={onScreensChange}
                style={{ display: "none" }}
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
            </section>
          </aside>
        </form>
      </div>
    </div>
  );
}

/** scoped styles */
function StyleLocal() {
  return (
    <style>{`
/* layout */
.itch-wrap{ display:grid; gap:14px; }
.itch-top{ display:flex; align-items:flex-end; justify-content:space-between; gap:14px; }
.itch-title{ margin:0; font-size:28px; color:var(--text); letter-spacing:.2px; }
.itch-sub{ margin-top:6px; color:var(--muted); max-width:70ch; }
.itch-meta{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

.pill-small{
  font-size:12px; padding:6px 10px; border-radius:999px;
  border:1px solid var(--stroke); background:rgba(255,255,255,.04); color:#dbe7f3;
}

/* banner */
.banner{
  padding:10px 12px; border-radius:10px;
  border:1px solid var(--stroke); background:rgba(255,255,255,.04);
  color:#eaf4ff;
}

/* ✅ modal */
.modal-backdrop{
  position:fixed; inset:0; z-index:9999;
  background:rgba(0,0,0,.55);
  display:grid; place-items:center;
  padding:18px;
}
.modal{
  width:min(560px, 100%);
  border-radius:16px;
  border:1px solid var(--stroke);
  background: #0b0f14;
  box-shadow: var(--shadow);
  overflow:hidden;
}
.modal-head{
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 14px;
  border-bottom:1px solid var(--stroke);
  background: rgba(255,255,255,.03);
}
.modal-title{ color:var(--text); font-weight:800; letter-spacing:.2px; }
.modal-x{
  width:34px; height:34px;
  display:grid; place-items:center;
  border-radius:10px;
  border:1px solid var(--stroke);
  background: rgba(255,255,255,.04);
  color:var(--text);
  cursor:pointer;
}
.modal-x:hover{ transform:translateY(-1px); }
.modal-body{ padding:14px; }
.modal-note{
  margin:0;
  white-space:pre-wrap;
  color:#eaf4ff;
  background: rgba(255,255,255,.04);
  border:1px solid var(--stroke);
  border-radius:12px;
  padding:12px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
  font-size:14px;
}
.modal-hint{ margin-top:10px; font-size:13px; }
.modal-actions{
  display:flex; gap:10px; justify-content:flex-end;
  padding:12px 14px;
  border-top:1px solid var(--stroke);
  background: rgba(255,255,255,.02);
}

/* grid */
.itch-grid{
  display:grid;
  grid-template-columns: 1.35fr .85fr;
  gap:14px;
  align-items:start;
}
@media (max-width: 980px){
  .itch-grid{ grid-template-columns: 1fr; }
}

/* boxes */
.box{
  border:1px solid var(--stroke);
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
  border-radius:12px;
  padding:14px;
  box-shadow: var(--shadow);
}
.itch-col{ display:grid; gap:12px; }
.itch-side{ display:grid; gap:12px; position:sticky; top:14px; }
@media (max-width: 980px){ .itch-side{ position:static; } }

.box-head{ margin-bottom:10px; }
.box-title{ font-weight:700; color:var(--text); }
.box-desc{ margin-top:4px; font-size:13px; }

.field{ margin-top:10px; min-width:0; }
.label{ display:block; font-size:12px; color:#bcd3e8; margin-bottom:6px; }
.help{ margin-top:6px; font-size:12px; }
.muted{ color:var(--muted); }

.two{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
@media (max-width: 680px){ .two{ grid-template-columns:1fr; } }

/* inputs */
.input, .textarea{
  width:100%;
  border-radius:10px;
  border:1px solid var(--stroke);
  background: rgba(255,255,255,.05);
  color: var(--text);
  padding:10px 12px;
  outline:none;
  transition:.15s ease;
}
.input:focus, .textarea:focus{
  border-color:#5cd5ff;
  box-shadow:0 0 0 4px rgba(72,208,255,.14);
}
.input-clean{ background: rgba(255,255,255,.02); }
.textarea{ resize:vertical; min-height:160px; }

.url-row{ display:flex; align-items:center; gap:8px; }
.url-prefix{ font-size:13px; white-space:nowrap; opacity:.9; }

/* Kind dropdown */
.kind-select{ position:relative; }
.kind-trigger{
  width:100%;
  display:flex; align-items:center; justify-content:space-between;
  height:42px;
  padding:0 12px;
  border-radius:10px;
  border:2px solid var(--stroke);
  background: rgba(255,255,255,.05);
  color: var(--text);
  cursor:pointer;
  transition:.15s ease;
  text-align:left;
}
.kind-name{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.kind-trigger:hover{ border-color:#6bd9ff; }
.kind-trigger svg{ opacity:.85; transition:.2s; }
.kind-trigger svg.rot{ transform:rotate(180deg); }
.kind-menu{
  position:absolute; top:48px; left:0; right:0; z-index:30;
  border-radius:12px;
  border:1px solid var(--stroke);
  background:#0d1014;
  box-shadow: var(--shadow);
  overflow:hidden;
}
.kind-item{
  padding:10px 12px;
  cursor:pointer;
  color:var(--text);
}
.kind-item:hover{ background: rgba(255,255,255,.06); }
.kind-item.is-active{ background: rgba(72,208,255,.10); border-left:3px solid #59e0ff; }

/* category dropdown */
.cat-select{ position:relative; }
.cat-trigger{
  width:100%;
  display:flex; align-items:center; justify-content:space-between;
  height:42px;
  padding:0 12px;
  border-radius:10px;
  border:2px solid var(--stroke);
  background: rgba(255,255,255,.05);
  color: var(--text);
  cursor:pointer;
  transition:.15s ease;
}
.cat-left{ display:flex; align-items:center; gap:8px; }
.cat-dot{ width:10px; height:10px; border-radius:999px; box-shadow:0 0 0 2px rgba(255,255,255,.12) inset; }
.cat-emoji{ opacity:.95; }
.cat-trigger:hover{ border-color:#6bd9ff; }
.cat-trigger svg{ opacity:.85; transition:.2s; }
.cat-trigger svg.rot{ transform:rotate(180deg); }

.cat-menu{
  position:absolute; top:48px; left:0; right:0; z-index:30;
  border-radius:12px;
  border:1px solid var(--stroke);
  background:#0d1014;
  box-shadow: var(--shadow);
  max-height:340px;
  overflow:auto;
}
.cat-item{
  display:flex; align-items:center; gap:10px;
  padding:10px 12px;
  cursor:pointer;
}
.cat-item:hover{ background: rgba(255,255,255,.06); }
.cat-item.is-active{ background: rgba(72,208,255,.10); border-left:3px solid #59e0ff; }

/* tags */
.tag-row{ display:flex; gap:10px; align-items:center; }
.tag-row .input{ padding:8px 10px; font-size:13px; height:40px; }
.tag-row .btn{ padding:8px 12px; font-size:13px; height:40px; white-space:nowrap; }

.chips{ display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
.chip{
  display:inline-flex; align-items:center; gap:8px;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid var(--stroke);
  background: rgba(255,255,255,.06);
  color:#dfe7ee;
  font-size:13px;
}
.chip button{ background:transparent; border:none; color:#9bb2c7; cursor:pointer; font-size:14px; }

/* radios */
.radio-col{ display:grid; gap:10px; margin-top:8px; }
.radio{
  display:flex; gap:10px; align-items:flex-start;
  padding:10px 10px;
  border-radius:10px;
  border:1px solid var(--stroke);
  background: rgba(255,255,255,.04);
  cursor:pointer;
}
.radio input{ margin-top:3px; }

/* upload row */
.upload-row{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.file-line{ margin-top:8px; display:flex; gap:8px; align-items:center; }

/* buttons */
.btn{
  border:1px solid var(--stroke);
  background: rgba(255,255,255,.05);
  color: var(--text);
  padding:10px 12px;
  border-radius:10px;
  cursor:pointer;
  transition:.15s ease;
  display:inline-flex;
  align-items:center;
  gap:8px;
}
.btn:hover{ transform:translateY(-1px); box-shadow:0 12px 28px rgba(0,0,0,.35); }
.btn[disabled]{ opacity:.65; cursor:default; transform:none; box-shadow:none; }
.btn-primary{
  border:none;
  background: linear-gradient(135deg, #59e0ff, #35c4ff);
  color:#041318;
  font-weight:700;
}
.btn-outline-on{
  border-color:#6bd9ff;
  background: rgba(72,208,255,.10);
}
.btn-small{ padding:8px 10px; font-size:12px; height:40px; }
.actions{ display:flex; gap:10px; justify-content:flex-end; margin-top:12px; flex-wrap:wrap; }
.spinner{
  width:14px; height:14px; border-radius:999px;
  border:2px solid rgba(15,23,42,.35);
  border-top-color:#eaf4ff;
  display:inline-block;
  animation:spin .7s linear infinite;
}
@keyframes spin{ to{ transform:rotate(360deg); } }

/* progress */
.progress{
  height:10px;
  border-radius:999px;
  background: rgba(255,255,255,.06);
  border:1px solid var(--stroke);
  overflow:hidden;
  margin-top:10px;
}
.progress .bar{
  height:100%;
  width:0%;
  background: linear-gradient(90deg, #59e0ff, #35c4ff, #8b5cf6);
  transition: width .2s ease;
}

/* right side cover/screen */
.cover-drop{
  border:1px dashed var(--stroke);
  border-radius:12px;
  padding:10px;
  background: rgba(255,255,255,.03);
}
.cover-inner{
  position:relative;
  width:100%;
  aspect-ratio:16/9;
  border-radius:10px;
  overflow:hidden;
  background: rgba(0,0,0,.18);
  display:grid;
  place-items:center;
}
.cover-inner img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.cover-btn{ width:100%; justify-content:center; margin-top:10px; }
.cover-empty{ font-size:13px; }

.screens{ margin-top:10px; display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; }
.screen{ aspect-ratio:16/9; border-radius:10px; overflow:hidden; border:1px solid var(--stroke); background: rgba(255,255,255,.04); }
.screen img{ width:100%; height:100%; object-fit:cover; }
`}</style>
  );
}
