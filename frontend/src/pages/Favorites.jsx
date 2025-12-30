// frontend/src/pages/Favorites.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";

/* =========================
   Home stats pill (Plays/Downloads) เหมือน Profile/Home
========================= */
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

/* =========================
   Helpers เหมือน Profile/Home
========================= */
const ICON_PLAY = "🎮";
const ICON_DL = "📥";

const isZipFile = (u = "") => /\.zip(\?|$)/i.test(String(u));
const isRarFile = (u = "") => /\.rar(\?|$)/i.test(String(u));
const isHtmlFile = (u = "") => /\.html?(\?|$)/i.test(String(u));

const isPlayableWeb = (g) =>
  g?.kind === "html" || isZipFile(g?.fileUrl) || isHtmlFile(g?.fileUrl);
const isDownloadOnly = (g) => g?.kind === "download" || isRarFile(g?.fileUrl);

// ✅ รองรับหลายชื่อฟิลด์ plays/downloads (กัน backend ส่งไม่เหมือนกัน)
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

/* =========================
   Card แบบเดียวกับหน้าโปรไฟล์ (GameCardHome)
========================= */
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

export default function Favorites() {
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/users/me/favorites");
        if (!alive) return;
        setList(data || []);
      } catch (e) {
        console.error("load favorites failed", e);
        if (!alive) return;
        setList([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="home-page">
      <style>{CSS + HOME_STATS_CSS}</style>

      <section className="section container">
        <div className="section__head">
          <h1 className="section__title">My Favorites</h1>
          <span className="muted">
            {loading ? "Loading…" : `${(list || []).length} game${(list || []).length === 1 ? "" : "s"}`}
          </span>
        </div>

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
        ) : (list || []).length === 0 ? (
          <div className="empty glass-lg">ยังไม่มีเกมที่บันทึก</div>
        ) : (
          <div className="grid-cards grid-cards--4">
            {(list || []).map((g) => (
              <GameCardHome key={g._id} g={g} onClick={() => nav(`/games/${g._id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================
   CSS: ยกชุดเดียวกับ Profile ให้เหมือนกัน
========================= */
const CSS = `
.home-page{
  min-height:100vh;
  background: var(--bg);
  color: var(--text);
}
.container{ width:min(1180px, calc(100% - 40px)); margin:0 auto; }
.section{ padding:24px 0 44px; }
.section__head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:14px;
}
.section__title{
  margin:0;
  font-size:clamp(20px,2.6vw,28px);
  font-weight:900;
  background:linear-gradient(180deg,#fff,#e8f3ff);
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
}
.muted{ color: var(--muted); }

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
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  margin-top:12px;
}

@media (max-width: 1100px){
  .grid-cards--4{ grid-template-columns:repeat(2, minmax(0, 1fr)); }
  .skeleton-grid{ grid-template-columns:repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px){
  .grid-cards--4{ grid-template-columns:1fr; }
  .skeleton-grid{ grid-template-columns:1fr; }
}
`;
