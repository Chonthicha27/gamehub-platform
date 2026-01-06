// frontend/src/pages/EditGame.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";

/** Main categories (match UploadGame UI) */
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

const isHtmlFile = (u = "") => /\.html?(\?|$)/i.test(String(u || ""));
const isZipFile = (u = "") => /\.zip(\?|$)/i.test(String(u || ""));
const isRarFile = (u = "") => /\.rar(\?|$)/i.test(String(u || ""));

// ✅ must match Preview page draft key
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

export default function EditGame() {
  const { id } = useParams();
  const nav = useNavigate();

  // me (role)
  const [me, setMe] = useState(null);

  // ===== Basics (sent to backend) =====
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
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

  // community UI state (backend uses commentsEnabled)
  const [communityMode, setCommunityMode] = useState("comments"); // off | comments

  // visibility (source of truth from backend)
  const [visibility, setVisibility] = useState("review"); // public | review | private | unlisted | suspended
  const [requestedVisibility, setRequestedVisibility] = useState("");
  // choice user selects (send to backend)
  const [visibilityChoice, setVisibilityChoice] = useState("review");

  // media
  const [videoUrl, setVideoUrl] = useState("");

  // existing assets
  const [coverUrl, setCoverUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [screens, setScreens] = useState([]);

  // upload buffers
  const [newFile, setNewFile] = useState(null);
  const [newCover, setNewCover] = useState(null);
  const [newScreens, setNewScreens] = useState([]);

  // previews (blob)
  const [coverPreview, setCoverPreview] = useState("");
  const [screenPreviews, setScreenPreviews] = useState([]);

  // ✅ keep blob urls alive across navigation to /preview
  const coverPreviewRef = useRef("");
  const screenPreviewRefs = useRef([]);

  // ui
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");

  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const screensInputRef = useRef(null);

  const isAdmin = me?.role === "admin";

  // ===== load me =====
  useEffect(() => {
    (async () => {
      try {
        const u = await api.get("/users/me");
        setMe(u.data);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  // ===== load game =====
  useEffect(() => {
    (async () => {
      try {
        setMsg("");
        setProgress(0);

        const r = await api.get(`/games/${id}`);
        const g = r.data || {};

        setTitle(g.title || "");
        setSlug(g.slug || "");
        setTagline(g.tagline || "");
        setDescription(g.description || "");

        setCategory(g.category || "no-genre");

        setVisibility(g.visibility || "review");
        setRequestedVisibility(g.requestedVisibility || "");

        const initialChoice =
          g.visibility === "review" && g.requestedVisibility === "public" ? "public" : g.visibility || "review";
        setVisibilityChoice(initialChoice);

        // kind
        const inferredKind = g.kind || (isRarFile(g.fileUrl) ? "download" : "html");
        setKind(inferredKind);

        setTags(Array.isArray(g.tags) ? g.tags : []);
        setCoverUrl(g.coverUrl || "");
        setFileUrl(g.fileUrl || "");
        setScreens(Array.isArray(g.screens) ? g.screens : []);

        setVideoUrl(g.videoUrl || "");

        // ✅ commentsEnabled from backend is truth
        const enabled = g.commentsEnabled !== false;
        setCommunityMode(enabled ? "comments" : "off");
      } catch (e) {
        setMsg(e?.response?.data?.message || "Load failed.");
      }
    })();
  }, [id]);

  // ✅ when kind changes: clear selected upload file to avoid wrong extension
  useEffect(() => {
    setNewFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [kind]);

  // ===== preview cover (new) =====
  // ✅ DO NOT revoke on unmount (so /preview can use blob url)
  useEffect(() => {
    if (!newCover) {
      if (coverPreviewRef.current) {
        try {
          URL.revokeObjectURL(coverPreviewRef.current);
        } catch {}
        coverPreviewRef.current = "";
      }
      setCoverPreview("");
      return;
    }

    if (coverPreviewRef.current) {
      try {
        URL.revokeObjectURL(coverPreviewRef.current);
      } catch {}
      coverPreviewRef.current = "";
    }

    const url = URL.createObjectURL(newCover);
    coverPreviewRef.current = url;
    setCoverPreview(url);
  }, [newCover]);

  // ===== preview screenshots (new) =====
  // ✅ DO NOT revoke on unmount (so /preview can use blob url)
  useEffect(() => {
    if (!newScreens.length) {
      if (screenPreviewRefs.current?.length) {
        screenPreviewRefs.current.forEach((u) => {
          try {
            URL.revokeObjectURL(u);
          } catch {}
        });
      }
      screenPreviewRefs.current = [];
      setScreenPreviews([]);
      return;
    }

    if (screenPreviewRefs.current?.length) {
      screenPreviewRefs.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    }

    const urls = newScreens.map((f) => URL.createObjectURL(f));
    screenPreviewRefs.current = urls;
    setScreenPreviews(urls);
  }, [newScreens]);

  const currentCat = useMemo(() => CATEGORIES.find((c) => c.id === category) || CATEGORIES[0], [category]);

  // tag helpers
  const addTag = () => {
    const t = tagDraft.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) return setTagDraft("");
    setTags((x) => [...x, t].slice(0, 10));
    setTagDraft("");
  };
  const removeTag = (t) => setTags((x) => x.filter((i) => i !== t));

  // cover resize before upload
  const onCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return setNewCover(null);
    try {
      const resized = await resizeImage(file, 1200, 675, "image/jpeg", 0.9);
      setNewCover(resized);
    } catch (err) {
      console.error(err);
      setNewCover(null);
      setMsg("Cover image could not be processed. Please try another image.");
    }
  };

  // screenshots resize before upload
  const onScreensChange = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    const resized = [];
    try {
      for (const f of files) resized.push(await resizeImage(f, 1600, 900, "image/jpeg", 0.9));
      setNewScreens(resized);
    } catch (err) {
      console.error(err);
      setNewScreens([]);
      setMsg("Screenshots could not be processed. Please try different images.");
    }
  };

  // accept by kind
  const acceptForKind = kind === "html" ? ".html,.htm,.zip" : ".rar";

  const openViewPage = () => nav(`/games/${id}`);

  // ✅ build draft compatible with /preview page
  const buildDraft = () => {
    const cover = newCover ? coverPreview : coverUrl ? cdn(coverUrl) : "";
    const shots = newScreens.length
      ? screenPreviews
      : (Array.isArray(screens) ? screens : []).slice(0, 5).map((u) => cdn(u));

    return {
      // text fields
      title: title.trim(),
      slug: slug || "",
      tagline: tagline || "",
      description: description || "",

      // meta
      category,
      kind,
      tags,
      visibility: visibilityChoice, // keep consistent with upload draft
      communityMode,
      videoUrl: String(videoUrl || "").trim(),

      // media previews
      coverPreview: cover || "",
      screenPreviews: Array.isArray(shots) ? shots : [],

      // optional info (harmless)
      gameId: id,
      gameFileName: newFile?.name || "",
      fromEdit: true,
    };
  };

  // ✅ Preview without saving
const openPreview = () => {
  const draft = buildDraft();
  if (!draft.title) {
    setMsg("Please enter a title before previewing.");
    return;
  }

  const backTo = `/games/${id}/edit`;

  // ✅ ใส่ backTo ลง draft ด้วย (กัน state หาย)
  const nextDraft = { ...draft, backTo };

  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
  } catch {}

  // ✅ ส่ง backTo ไปด้วย
  nav("/preview", { state: { draft: nextDraft, backTo } });
};


  const resetUploads = () => {
    // revoke old blobs explicitly
    if (coverPreviewRef.current) {
      try {
        URL.revokeObjectURL(coverPreviewRef.current);
      } catch {}
      coverPreviewRef.current = "";
    }
    if (screenPreviewRefs.current?.length) {
      screenPreviewRefs.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    }
    screenPreviewRefs.current = [];

    setNewFile(null);
    setNewCover(null);
    setNewScreens([]);
    setCoverPreview("");
    setScreenPreviews([]);
    setProgress(0);

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (screensInputRef.current) screensInputRef.current.value = "";
  };

  // itch-like visibility radio mapping
  const visChoice = useMemo(() => {
    if (visibilityChoice === "unlisted") return "unlisted";
    if (visibilityChoice === "review") return "draft";
    if (visibilityChoice === "private") return "restricted";
    if (visibilityChoice === "public") return "public";
    return "restricted";
  }, [visibilityChoice]);

  const setVisByChoice = (choice) => {
    if (choice === "draft") return setVisibilityChoice("review");
    if (choice === "public") return setVisibilityChoice("public");
    if (choice === "unlisted") return setVisibilityChoice("unlisted");
    return setVisibilityChoice("private");
  };

  const pendingPublic = !isAdmin && visibility === "review" && requestedVisibility === "public";

  const statusLabel = useMemo(() => {
    if (visibility === "public") return "public";
    if (visibility === "unlisted") return "unlisted";
    if (visibility === "private") return "private";
    if (visibility === "review") return pendingPublic ? "review (requested public)" : "review";
    if (visibility === "suspended") return "suspended";
    return String(visibility || "review");
  }, [visibility, pendingPublic]);

  // quick preview
  const fileSrc = cdn(fileUrl);
  const downloadOnly = useMemo(() => kind === "download" || isRarFile(fileUrl), [kind, fileUrl]);
  const playable = useMemo(() => {
    if (downloadOnly) return false;
    if (kind === "html") return true;
    return isHtmlFile(fileUrl) || isZipFile(fileUrl);
  }, [downloadOnly, kind, fileUrl]);

  // label for kind dropdown
  const kindLabel =
    kind === "html"
      ? "HTML — played in the browser (.html / .zip)"
      : "Downloadable — files to be downloaded (.rar)";

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (busy) return;

    if (!title.trim()) return setMsg("Please enter a game title.");

    // validate new file (if user selected one)
    if (newFile) {
      if (kind === "html" && !/\.(html?|zip)$/i.test(newFile.name)) {
        return setMsg("HTML mode supports only .html or .zip files.");
      }
      if (kind === "download" && !/\.rar$/i.test(newFile.name)) {
        return setMsg("Downloadable mode supports only .rar files.");
      }
    }

    setBusy(true);
    setProgress(0);

    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("slug", slug || "");
      fd.append("tagline", tagline || "");
      fd.append("description", description || "");
      fd.append("category", category);
      fd.append("kind", kind);

      // send visibility that user chose
      fd.append("visibility", visibilityChoice);

      // commentsEnabled
      fd.append("commentsEnabled", communityMode === "comments" ? "true" : "false");

      // videoUrl
      fd.append("videoUrl", String(videoUrl || "").trim());

      tags.forEach((t) => fd.append("tags[]", t));

      // optional replacements
      if (newCover) fd.append("cover", newCover);
      if (newFile) fd.append("file", newFile);
      if (newScreens.length) newScreens.forEach((f) => fd.append("screens[]", f));

      const token = localStorage.getItem("token");
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      const r = await api.put(`/games/${id}`, fd, {
        withCredentials: true,
        headers: { ...authHeader },
        onUploadProgress: (ev) => {
          if (ev.total) setProgress(Math.round((ev.loaded * 100) / ev.total));
        },
      });

      const g = r?.data || {};

      // sync from backend
      setCoverUrl(g.coverUrl || "");
      setFileUrl(g.fileUrl || "");
      setScreens(Array.isArray(g.screens) ? g.screens : []);

      setVisibility(g.visibility || "review");
      setRequestedVisibility(g.requestedVisibility || "");

      const newChoice =
        g.visibility === "review" && g.requestedVisibility === "public" ? "public" : g.visibility || "review";
      setVisibilityChoice(newChoice);

      setVideoUrl(g.videoUrl || videoUrl || "");

      // sync community from backend
      const enabled = g.commentsEnabled !== false;
      setCommunityMode(enabled ? "comments" : "off");

      resetUploads();

      setMsg(
        !isAdmin && g.visibility === "review" && g.requestedVisibility === "public"
          ? "Submitted as Public ✅ Now pending admin approval (still in review)."
          : "Saved successfully! ✅"
      );
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401) setMsg("You are not logged in (Unauthorized). Please sign in first.");
      else setMsg(err?.response?.data?.message || err.message || "Save failed.");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  return (
    <div className="container section">
      <StyleLocal />

      <div className="itch-wrap">
        <div className="itch-top">
          <div>
            <h1 className="itch-title">Edit project</h1>
            <div className="itch-sub">
              Update your game page: title, cover, files, screenshots, trailer, tags, and details.
              <div className="status-line">
                Current status: <b>{statusLabel}</b>
                {pendingPublic ? <span className="pending"> · pending public</span> : null}
              </div>
            </div>
          </div>

          <div className="itch-meta">
            <button type="button" className="btn" onClick={openPreview} title="Preview changes without saving">
              Preview
            </button>

            <button type="button" className="btn btn-outline-on" onClick={openViewPage}>
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
                  <span className="url-prefix muted">https://bu.ghub.gg/</span>
                  <input className="input input-clean" placeholder="your-awesome-game" value={slug} onChange={(e) => setSlug(e.target.value)} />
                </div>
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

                  {/* Custom dropdown */}
                  <div className="kind-select">
                    <button
                      type="button"
                      className="kind-trigger"
                      onClick={() => setKindOpen((v) => !v)}
                      aria-haspopup="listbox"
                      aria-expanded={kindOpen ? "true" : "false"}
                    >
                      <span className="kind-name" title={kindLabel}>{kindLabel}</span>
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
                          title="Downloadable — files to be downloaded (.rar)"
                        >
                          <span className="kind-item-text">Downloadable — files to be downloaded (.rar)</span>
                        </div>

                        <div
                          role="option"
                          aria-selected={kind === "html" ? "true" : "false"}
                          className={`kind-item ${kind === "html" ? "is-active" : ""}`}
                          onClick={() => {
                            setKind("html");
                            setKindOpen(false);
                          }}
                          title="HTML — played in the browser (.html / .zip)"
                        >
                          <span className="kind-item-text">HTML — played in the browser (.html / .zip)</span>
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
                <div className="box-desc muted">Replace your main game file (optional). If you don’t pick a file, the old one stays.</div>
              </div>

              <div className="field">
                <div className="upload-row">
                  <label className="btn btn-primary" htmlFor="edit-gamefile">
                    Upload files
                  </label>
                  <input
                    id="edit-gamefile"
                    ref={fileInputRef}
                    type="file"
                    accept={acceptForKind}
                    onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                    style={{ display: "none" }}
                  />

                  <div className="help muted">
                    {kind === "html"
                      ? "Supported: .html or .zip (recommended: zip contains index.html)"
                      : "Supported: .rar for download"}
                  </div>
                </div>

                {newFile ? (
                  <div className="file-line">
                    <span>📁 {newFile.name}</span>
                    <span className="muted">({(newFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </div>
                ) : fileUrl ? (
                  <div className="file-line">
                    <span className="muted">Current file:</span>
                    <a className="link" href={fileSrc} target="_blank" rel="noreferrer">
                      open
                    </a>
                    {playable ? <span className="muted"> · playable</span> : null}
                    {downloadOnly ? <span className="muted"> · download-only</span> : null}
                  </div>
                ) : null}
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
                  <input
                    type="radio"
                    name="community"
                    checked={communityMode === "comments"}
                    onChange={() => setCommunityMode("comments")}
                  />
                  <span>Comments — Add a comment thread to the page</span>
                </label>
              </div>
            </section>

            {/* Visibility */}
            <section className="box">
              <div className="box-head">
                <div className="box-title">Visibility & access</div>
                <div className="box-desc muted">
                  Choosing Public will submit for admin review (for non-admin). It will not appear on Home/Search until approved.
                </div>
              </div>

              <div className="radio-col">
                <label className="radio">
                  <input type="radio" name="vis" checked={visChoice === "restricted"} onChange={() => setVisByChoice("restricted")} />
                  <span>Restricted — Only owners & authorized people can view the page</span>
                </label>

                <label className="radio">
                  <input type="radio" name="vis" checked={visChoice === "public"} onChange={() => setVisByChoice("public")} />
                  <span>Public — Submit for review (system value: <b>public</b>)</span>
                </label>
              </div>

              {!isAdmin && visibilityChoice === "public" ? (
                <div className="help muted">* After save, status will be <b>review</b> until admin approves.</div>
              ) : null}
            </section>

            {msg && <div className="banner">{msg}</div>}

            <div className="actions">
              <button type="button" className="btn" onClick={resetUploads} disabled={busy}>
                Reset uploads
              </button>

              <button type="button" className="btn" onClick={openPreview} disabled={busy} title="Preview changes without saving">
                Preview
              </button>

              <button type="button" className="btn btn-outline-on" onClick={openViewPage} disabled={busy}>
                View page
              </button>

              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner" /> Saving…{progress > 0 ? ` ${progress}%` : ""}
                  </>
                ) : (
                  <>Save</>
                )}
              </button>

              <button type="button" className="btn" onClick={() => nav(-1)} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>

          {/* RIGHT */}
          <aside className="itch-side">
            <section className="box">
              <div className="box-head">
                <div className="box-title">Cover image</div>
                <div className="box-desc muted">Recommended 16:9 (1200×675). Upload to replace (optional).</div>
              </div>

              <div className="cover-drop">
                <div className="cover-inner">
                  {coverPreview ? (
                    <img src={coverPreview} alt="cover" />
                  ) : coverUrl ? (
                    <img src={cdn(coverUrl)} alt="cover" />
                  ) : (
                    <div className="cover-empty muted">No cover uploaded</div>
                  )}
                </div>

                <label className="btn btn-primary cover-btn" htmlFor="edit-coverfile">
                  Upload Cover Image
                </label>
                <input
                  id="edit-coverfile"
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
                <div className="box-desc muted">Recommended: 3–5 images (max 5). Uploading new screenshots will replace all.</div>
              </div>

              <label className="btn btn-primary" htmlFor="edit-screenfile">
                Add screenshots
              </label>
              <input
                id="edit-screenfile"
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

              {!screenPreviews.length && !!screens.length && (
                <div className="screens">
                  {screens.slice(0, 5).map((u, i) => (
                    <figure key={i} className="screen">
                      <img src={cdn(u)} alt={`s-old-${i}`} />
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
.status-line{ margin-top:6px; font-size:12px; color:#9fb4c8; }
.pending{ color:#facc15; }
.itch-meta{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

/* banner */
.banner{
  padding:10px 12px; border-radius:10px;
  border:1px solid var(--stroke); background:rgba(255,255,255,.04);
  color:#eaf4ff;
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
.link{ color:#7dd3fc; text-decoration:none; }
.link:hover{ text-decoration:underline; }

/* kind dropdown */
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
.kind-name{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
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
.kind-item-text{
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
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
  text-decoration:none;
}
.btn:hover{ transform:translateY(-1px); box-shadow:0 12px 28px rgba(0,0,0,.35); }
.btn[disabled]{ opacity:.65; cursor:default; transform:none; box-shadow:none; }
.btn-primary{
  border:none;
  background: linear-gradient(135deg, #59e0ff, #35c4ff);
  color:#041318;
  font-weight:700;
}
.btn-outline-on{ border-color:#6bd9ff; background: rgba(72,208,255,.10); }
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
