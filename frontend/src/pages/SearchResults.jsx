// frontend/src/pages/SearchResults.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";

/* -----------------------------
  Helpers: query string
------------------------------ */
function useQS() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

/* -----------------------------
  CATEGORIES (เหมือนที่ใช้อยู่ + มี all)
------------------------------ */
const CATEGORIES = [
  { id: "all", name: "All genres", emoji: "🎮", color: "#7dd3fc" },

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

/* -----------------------------
  Home-card helpers (เหมือนหน้าโปรไฟล์)
------------------------------ */
const ICON_PLAY = "🎮";
const ICON_DL = "📥";

const isZipFile = (u = "") => /\.zip(\?|$)/i.test(String(u));
const isRarFile = (u = "") => /\.rar(\?|$)/i.test(String(u));
const isHtmlFile = (u = "") => /\.html?(\?|$)/i.test(String(u));

const isPlayableWeb = (g) =>
  g?.kind === "html" || isZipFile(g?.fileUrl) || isHtmlFile(g?.fileUrl);
const isDownloadOnly = (g) => g?.kind === "download" || isRarFile(g?.fileUrl);

const getPlays = (g) => {
  const raw =
    g?.playsCount ??
    g?.plays ??
    g?.stats?.plays ??
    g?.gameStats?.plays ??
    g?.game_stats?.plays ??
    g?.analytics?.plays ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};
const getDownloads = (g) => {
  const raw = g?.downloadsCount ?? g?.downloads ?? g?.stats?.downloads ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

const renderTagline = (g) =>
  g?.tagline && String(g.tagline).trim().length > 0
    ? g.tagline
    : "No short description yet.";

/* -----------------------------
  FancyCategorySelect (เหมือนโค้ดที่ส่งมา)
------------------------------ */
function FancyCategorySelect({ value = "all", onChange, label = "Genre", width = 240 }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const current = useMemo(
    () => CATEGORIES.find((c) => c.id === value) || CATEGORIES[0],
    [value]
  );

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="fancy-cat" ref={wrapRef} style={{ width }}>
      <FCStyle />

      {label && <div className="fc-label">{label}</div>}

      <button
        type="button"
        className={`fc-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ borderColor: current.color }}
      >
        <span className="fc-dot" style={{ background: current.color }} />
        <span className="fc-emoji">{current.emoji}</span>
        <span className="fc-name">{current.name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" className="fc-caret" aria-hidden="true">
          <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>

      {open && (
        <div className="fc-pop" role="listbox" tabIndex={-1}>
          {CATEGORIES.map((c) => (
            <div
              key={c.id}
              role="option"
              aria-selected={c.id === value}
              className={`fc-item ${c.id === value ? "is-active" : ""}`}
              onClick={() => {
                onChange?.(c.id);
                setOpen(false);
              }}
            >
              <span className="fc-dot" style={{ background: c.color }} />
              <span className="fc-emoji">{c.emoji}</span>
              <span className="fc-name">{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FCStyle() {
  return (
    <style>{`
.fancy-cat{ position:relative; z-index: 60; }
.fc-label{ font-size:12px; color:#bcd3e8; margin:0 0 6px 2px }

.fc-trigger{
  width:100%;
  height:var(--filterH, 44px);
  display:flex; align-items:center; gap:8px;
  padding:0 12px;
  border-radius:999px;
  background:rgba(255,255,255,.05);
  border:2px solid var(--stroke);
  color:var(--text);
  transition:.15s;
  justify-content:space-between;
  position:relative;
  z-index: 61;
}
.fc-trigger:hover{ border-color:#6bd9ff; }
.fc-name{ flex:1; text-align:left; padding-left:4px }
.fc-emoji{ opacity:.95 }
.fc-dot{ width:10px; height:10px; border-radius:999px; box-shadow:0 0 0 2px rgba(255,255,255,.12) inset }
.fc-caret{ opacity:.8; transition:.2s }
.fc-trigger.is-open .fc-caret{ transform: rotate(180deg) }

.fc-pop{
  position:absolute; z-index: 9999;
  top: calc(100% + 6px); left:0; right:0;
  background:#0d1014;
  border:1px solid var(--stroke);
  border-radius:14px;
  box-shadow: var(--shadow);
  max-height:340px;
  overflow:auto;
}
.fc-item{
  display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer;
}
.fc-item:hover{ background:rgba(255,255,255,.06) }
.fc-item.is-active{ background:rgba(72,208,255,.11); border-left:3px solid #59e0ff }
`}</style>
  );
}

/* -----------------------------
  Game card (ให้เหมือนหน้าโปรไฟล์: card game-card + stats pills)
------------------------------ */
function GameCardHome({ g, onClick }) {
  const cover = cdn(
    g?.coverUrl || (Array.isArray(g?.screens) && g.screens[0]) || "/no-cover.png"
  );
  const uploader = g?.uploader?.username || "?";

  const playableWeb = isPlayableWeb(g);
  const downloadOnly = isDownloadOnly(g);

  const plays = getPlays(g);
  const downloads = getDownloads(g);

  return (
    <article className="card game-card" onClick={onClick} title={g?.title || ""}>
      <div className="cover" style={{ backgroundImage: `url(${cover})` }} />
      <div className="meta">
        <div className="hc-title-row">
          <h3 className="title">{g?.title || "Untitled"}</h3>

          <div className="hc-stats">
            {playableWeb && !downloadOnly && (
              <span className="hc-stat" title="Plays">
                {ICON_PLAY} <b>{plays}</b>
              </span>
            )}
            {downloadOnly && (
              <span className="hc-stat" title="Downloads">
                {ICON_DL} <b>{downloads}</b>
              </span>
            )}
          </div>
        </div>

        <p className="muted" style={{ fontSize: 13 }}>
          {renderTagline(g)}
        </p>
        <p className="muted" style={{ fontSize: 12 }}>
          {g?.category || "all"} · by {uploader}
        </p>
      </div>
    </article>
  );
}

/* -----------------------------
  Page
------------------------------ */
export default function SearchResults() {
  const qs = useQS();
  const nav = useNavigate();

  const q = qs.get("q") || "";
  const category = qs.get("category") || "all";
  const page = Math.max(parseInt(qs.get("page") || "1", 10), 1);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const limit = 24;

  const buildSearchUrl = (next = {}) => {
    const p = new URLSearchParams();

    const nq = (next.q ?? q ?? "").trim();
    const nc = next.category ?? category ?? "all";
    const np = String(next.page ?? page ?? 1);

    if (nq) p.set("q", nq);
    if (nc && nc !== "all") p.set("category", nc);
    p.set("page", np);

    return `/search?${p.toString()}`;
  };

  const setParam = (key, val) => {
    const p = new URLSearchParams(qs);
    if (!val || val === "all") p.delete(key);
    else p.set(key, val);
    p.set("page", "1");
    nav(`/search?${p.toString()}`);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/games/search", {
          params: { q, category, page, limit },
        });
        if (!alive) return;
        setItems(data?.items || []);
        setTotal(data?.total || 0);
      } catch (e) {
        console.error("search failed", e);
        if (!alive) return;
        setItems([]);
        setTotal(0);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [q, category, page]);

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return (
    <div className="search-page">
      <style>{CSS + HOME_STATS_CSS}</style>

      <div className="container section">
        <div className="s-head">
          <h1>Search results</h1>
          <div className="s-sub">
            {loading ? "Searching…" : `${total} result${total === 1 ? "" : "s"}`}
            {q && (
              <>
                {" "}
                for <b>“{q}”</b>
              </>
            )}
          </div>
        </div>

        {/* แถวค้นหา + genre ให้สูงเท่ากัน */}
        <div className="s-filters">
          {/* ช่องค้นหาให้สูงเท่า genre */}
          <div className="s-searchwrap">
            <div className="s-visuallabel">Search</div>
            <input
              className="s-input"
              placeholder="Search games, creators, tags..."
              defaultValue={q}
              onKeyDown={(e) =>
                e.key === "Enter" && setParam("q", e.currentTarget.value.trim())
              }
            />
          </div>

          <FancyCategorySelect
            value={category}
            onChange={(id) => setParam("category", id)}
            label="Genre"
            width={260}
          />
        </div>

        {/* เนื้อหา */}
        {loading ? (
          <div className="skeleton-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card game-card game-card--skel">
                <div className="cover skel" />
                <div className="meta">
                  <div className="skel skel-line" />
                  <div className="skel skel-line small" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length ? (
          <>
            <div className="grid-cards grid-cards--4">
              {items.map((g) => (
                <GameCardHome key={g._id} g={g} onClick={() => nav(`/games/${g._id}`)} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pager">
                <button
                  disabled={page <= 1}
                  onClick={() => nav(buildSearchUrl({ page: page - 1 }))}
                >
                  Prev
                </button>

                <div className="pg">
                  {page} / {totalPages}
                </div>

                <button
                  disabled={page >= totalPages}
                  onClick={() => nav(buildSearchUrl({ page: page + 1 }))}
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty glass-lg">ไม่พบผลลัพธ์</div>
        )}
      </div>
    </div>
  );
}

/* -----------------------------
  CSS: ปรับให้
  - ความสูง input = genre (ใช้ --filterH)
  - การ์ดเกม = เหมือนหน้าโปรไฟล์
------------------------------ */
const HOME_STATS_CSS = `
.hc-title-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.hc-title-row .title{
  margin:0;
  flex:1 1 auto;
  min-width:0;
}
.hc-stats{
  flex:0 0 auto;
  display:flex;
  align-items:center;
  gap:6px;
  font-size:12px;
  color:#a7b8c9;
}
.hc-stat{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:3px 8px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(2,6,23,.65);
  line-height:1;
}
.hc-stat b{
  color:#eaf4ff;
  font-weight:800;
}
`;

const CSS = `
:root{
  --filterH: 44px;
}

.search-page{
  min-height:100vh;
  background: var(--bg);
  color: var(--text);
}
.container{ width:min(1180px, calc(100% - 40px)); margin:0 auto; }
.section{ padding:24px 0 44px; }

.s-head h1{
  margin:0;
  font-size:26px;
  font-weight:900;
}
.s-sub{
  color:var(--muted);
  margin-top:4px;
}

/* filters */
.s-filters{
  margin:14px 0 18px;
  display:flex;
  align-items:flex-end;   /* ให้ฐานเดียวกัน */
  justify-content:space-between;
  gap:12px;
}

.s-searchwrap{ flex:1; min-width: 240px; }
.s-visuallabel{
  font-size:12px;
  color:transparent;      /* ทำให้สูงเท่ากับ label ของ Genre แต่ไม่โชว์ */
  margin:0 0 6px 2px;
  user-select:none;
}

.s-input{
  width:100%;
  height:var(--filterH);
  padding:0 14px;
  border-radius:999px;
  border:2px solid var(--stroke);      /* ให้หนาเท่า genre */
  background:rgba(255,255,255,.05);
  color:var(--text);
  outline:none;
}
.s-input::placeholder{
  color:rgba(148,163,184,.9);
}
.s-input:focus{
  border-color:#5cd5ff;
  box-shadow:0 0 0 4px rgba(72,208,255,.16);
}

/* cards (เหมือนโปรไฟล์) */
.grid-cards{ display:grid; gap:14px; }
.grid-cards--4{ grid-template-columns: repeat(4, minmax(0, 1fr)); }

.card{
  background:
    linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03)),
    var(--panel);
  border:1px solid var(--stroke);
  border-radius:16px;
  box-shadow: var(--shadow);
  overflow:hidden;
  cursor:pointer;
  transition:.15s ease;
}
.card:hover{ transform:translateY(-4px); box-shadow:0 18px 48px rgba(0,0,0,.35); }

.game-card .cover{
  aspect-ratio:16/9;
  background-size:cover;
  background-position:center;
}
.game-card .meta{ padding:10px 12px; }
.game-card .title{
  margin:0;
  font-size:16px;
  font-weight:900;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.muted{ color: var(--muted); }

/* skeleton (เหมือนโปรไฟล์) */
.skeleton-grid{
  display:grid;
  gap:14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.game-card--skel{ pointer-events:none; }
.skel{
  background:linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12), rgba(255,255,255,.06));
  background-size:140% 100%;
  animation:shimmer 1.2s infinite;
}
.skel-line{ height:14px; border-radius:6px; margin-top:10px; }
.skel-line.small{ width:60%; }
@keyframes shimmer{ 0%{ background-position:-40% 0; } 100%{ background-position:140% 0; } }

.glass-lg{
  border-radius:14px;
  background:rgba(255,255,255,.05);
  border:1px solid var(--stroke);
  box-shadow:0 18px 58px rgba(0,0,0,.35);
}
.empty{
  padding:20px;
  margin-top:12px;
}

/* pager */
.pager{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  margin:18px 0 6px;
}
.pager button{
  padding:8px 12px;
  border-radius:10px;
  border:1px solid rgba(255,255,255,.18);
  background:rgba(255,255,255,.06);
  color:#e9f1f7;
  cursor:pointer;
}
.pager button:disabled{
  opacity:.4;
  cursor:default;
}
.pg{ color:var(--muted); }

/* responsive */
@media (max-width: 1100px){
  .grid-cards--4{ grid-template-columns:repeat(2, minmax(0, 1fr)); }
  .skeleton-grid{ grid-template-columns:repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px){
  .grid-cards--4{ grid-template-columns:1fr; }
  .skeleton-grid{ grid-template-columns:1fr; }
}
@media (max-width: 640px){
  .s-filters{
    flex-direction:column;
    align-items:stretch;
  }
  .s-visuallabel{ display:none; } /* มือถือไม่ต้องกินพื้นที่ */
  .fancy-cat{ width:100% !important; }
}
`;
