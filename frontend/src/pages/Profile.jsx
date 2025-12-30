import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";

/* =========================
   Home stats pill (Plays/Downloads) เหมือน Home
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
  border:1px solid rgba(255,255,考,.14);
  background:rgba(2,6,23,.65);
  line-height:1;
}
.hc-stat b{
  color:#eaf4ff;
  font-weight:800;
}
`;

/* =========================
   Helpers เหมือน Home
========================= */
const ICON_PLAY = "🎮";
const ICON_DL = "📥";

const isZipFile = (u = "") => /\.zip(\?|$)/i.test(String(u));
const isRarFile = (u = "") => /\.rar(\?|$)/i.test(String(u));
const isHtmlFile = (u = "") => /\.html?(\?|$)/i.test(String(u));

const isPlayableWeb = (g) =>
  g?.kind === "html" || isZipFile(g?.fileUrl) || isHtmlFile(g?.fileUrl);
const isDownloadOnly = (g) => g?.kind === "download" || isRarFile(g?.fileUrl);

// ✅ รองรับหลายชื่อฟิลด์ plays/downloads
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
   UI
========================= */
function Stat({ label, value }) {
  return (
    <div className="pfx-stat">
      <div className="pfx-stat__value">{value ?? 0}</div>
      <div className="pfx-stat__label">{label}</div>
    </div>
  );
}

/** การ์ดเกม “โครง Home” */
function GameCardHome({ g, onClick }) {
  const cover = cdn(
    g.coverUrl || (Array.isArray(g.screens) && g.screens[0]) || "/no-cover.png"
  );
  const uploader = g?.uploader?.username || "?";

  const playableWeb = isPlayableWeb(g);
  const downloadOnly = isDownloadOnly(g);

  const plays = getPlays(g);
  const downloads = getDownloads(g);

  return (
    <article className="card game-card" onClick={onClick} title={g.title}>
      <div className="cover" style={{ backgroundImage: `url(${cover})` }} />
      <div className="meta">
        <div className="hc-title-row">
          <h3 className="title">{g.title}</h3>

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
          {g.category || "all"} · by {uploader}
        </p>
      </div>
    </article>
  );
}

export default function Profile() {
  const nav = useNavigate();
  const params = useParams();

  const [me, setMe] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ✅ total plays รวมทุกเกม
  const [totalPlays, setTotalPlays] = useState(0);

  const viewingUserId = params?.id || null;
  const viewingUsername = params?.username || null;

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setNotFound(false);
        setTotalPlays(0);

        // 1) load profile
        let profile = null;
        if (viewingUsername) {
          const { data } = await api.get(`/users/by-username/${viewingUsername}`);
          profile = data;
        } else if (viewingUserId) {
          const { data } = await api.get(`/users/${viewingUserId}`);
          profile = data;
        } else {
          const { data } = await api.get("/users/me");
          profile = data;
        }

        if (!alive) return;
        setMe(profile);

        // 2) load games
        const token = localStorage.getItem("token");
        const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

        let list = [];
        if (!viewingUsername && !viewingUserId) {
          const { data } = await api.get("/games", {
            params: { mine: 1 },
            withCredentials: true,
            headers: { ...authHeader },
          });
          list = Array.isArray(data) ? data : [];
        } else {
          const uid = profile?._id;
          const { data } = await api.get("/games", {
            params: { uploader: uid },
            withCredentials: true,
            headers: { ...authHeader },
          });
          list = Array.isArray(data) ? data : [];
        }

        if (!alive) return;
        setGames(list);

        // 3) รวม plays จาก list ก่อน
        const sumFromList = (list || []).reduce((sum, g) => sum + getPlays(g), 0);
        setTotalPlays(sumFromList);

        // ✅ ถ้า list ไม่ส่ง plays มา → ดึงรายละเอียดทีละเกม
        if ((list || []).length > 0 && sumFromList === 0) {
          const ids = list.map((g) => g?._id).filter(Boolean);
          const LIMIT = 60;
          const sliceIds = ids.slice(0, LIMIT);

          const results = await Promise.allSettled(
            sliceIds.map((id) =>
              api.get(`/games/${id}`, {
                withCredentials: true,
                headers: { ...authHeader },
              })
            )
          );

          if (!alive) return;

          let sumDetail = 0;
          for (const r of results) {
            if (r.status === "fulfilled") {
              const d = r.value?.data;
              const gameObj = d?.game || d;
              sumDetail += getPlays(gameObj);
            }
          }
          setTotalPlays(sumDetail);
        }
      } catch (e) {
        console.error("Profile load failed", e);
        if (!alive) return;
        setMe(null);
        setGames([]);
        setTotalPlays(0);
        setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [viewingUserId, viewingUsername]);

  const stats = useMemo(
    () => ({
      games: games?.length || 0,
      plays: totalPlays || 0,
    }),
    [games, totalPlays]
  );

  if (notFound && !loading) {
    return (
      <div className="home-page">
        <style>{CSS + HOME_STATS_CSS}</style>
        <div className="container" style={{ padding: 24 }}>
          <h2 style={{ margin: 0, fontWeight: 900, color: "var(--text)" }}>ไม่พบผู้ใช้นี้</h2>
          <p className="muted">ลิงก์อาจผิด หรือผู้ใช้อาจถูกลบ/ปิดการใช้งาน</p>
          <button className="btn btn--primary" onClick={() => nav("/")}>
            กลับหน้าแรก
          </button>
        </div>
      </div>
    );
  }

  const display = me?.username || me?.displayName || "—";
  const githubUser = me?.links?.github ? String(me.links.github).trim() : "";
  const youtubeUrl = me?.links?.youtube ? String(me.links.youtube).trim() : "";

  // ✅ กันกรณี user ใส่ youtube ไม่เป็น url (เช่น @xxx หรือ channel id)
  const safeYoutube =
    youtubeUrl && !/^https?:\/\//i.test(youtubeUrl)
      ? `https://youtube.com/${youtubeUrl.replace(/^@/, "@")}`
      : youtubeUrl;

  return (
    <div className="home-page">
      <style>{CSS + HOME_STATS_CSS}</style>

      <section
        className="pfx-banner"
        style={{
          backgroundImage: `url(${cdn(me?.bannerUrl || "/profile-banner-fallback.jpg")})`,
        }}
      >
        <div className="pfx-banner__overlay" />
        <div className="pfx-banner__divider" />

        <div className="pfx-banner__inner container">
          <div className="pfx-banner__top">
            <div className="pfx-main-id">
              <div className="pfx-avatar-wrap">
                <img
                  className="pfx-avatar"
                  src={cdn(me?.avatarUrl || "/avatar-default.png")}
                  alt={display}
                />
              </div>

              <div className="pfx-id">
                <h1 className="pfx-name">{display}</h1>
                <div className="pfx-handle">@{me?.username || "unknown"}</div>

                {/* ✅ Website ออก + YouTube กลับมา */}
                {!!me?.links && (
                  <div className="pfx-links">
                    {githubUser && (
                      <a href={`https://github.com/${githubUser}`} target="_blank" rel="noreferrer">
                        GitHub
                      </a>
                    )}
                    {safeYoutube && (
                      <a href={safeYoutube} target="_blank" rel="noreferrer">
                        YouTube
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!viewingUsername && !viewingUserId && (
              <div className="pfx-actions">
                <button className="pfx-chip" onClick={() => nav("/settings/profile")}>
                  Edit profile
                </button>
                <button className="pfx-chip pfx-chip--primary" onClick={() => nav("/upload")}>
                  Upload game
                </button>
              </div>
            )}
          </div>

          <div className="pfx-banner__stats">
            <Stat label="Games" value={stats.games} />
            <Stat label="Plays" value={stats.plays} />
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section__head">
          <h2 className="section__title">Games</h2>
          <span className="muted">{stats.games > 0 ? `${stats.games} games` : "ยังไม่มีเกม"}</span>
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
        ) : games.length === 0 ? (
          <div className="empty glass-lg">
            <div>🕹️ No games yet.</div>
            {!viewingUsername && !viewingUserId && (
              <button className="btn btn--primary" onClick={() => nav("/upload")}>
                Upload first game
              </button>
            )}
          </div>
        ) : (
          <div className="grid-cards grid-cards--4">
            {games.map((g) => (
              <GameCardHome key={g._id} g={g} onClick={() => nav(`/games/${g._id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================
   CSS (เหมือนเดิม)
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

.btn{
  height:40px;
  padding:0 16px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.18);
  background:rgba(255,255,255,.06);
  color:var(--text);
  font-weight:900;
  cursor:pointer;
  transition:.12s ease;
}
.btn:hover{ background:rgba(255,255,255,.10); }
.btn--primary{
  border:none;
  background:linear-gradient(135deg, var(--brand), #35c4ff);
  color:#062028;
  box-shadow:0 10px 24px rgba(56,189,248,.22);
}

.pfx-banner{
  position:relative;
  background-size:cover;
  background-position:center;
  border-bottom:none;
}
.pfx-banner__overlay{
  position:absolute;
  inset:0;
  background:
    radial-gradient(120% 120% at 10% -10%, rgba(72,208,255,.10), transparent 55%),
    radial-gradient(120% 120% at 110% 0%, rgba(139,92,246,.08), transparent 55%),
    linear-gradient(180deg, rgba(11,15,20,.40), rgba(11,15,20,.62) 45%, rgba(11,15,20,.78));
  pointer-events:none;
}
.pfx-banner__divider{
  position:absolute;
  left:0; right:0; bottom:-1px;
  height:24px;
  background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.55));
  pointer-events:none;
}

.pfx-banner__inner{ position:relative; z-index:1; padding:26px 0 18px; }
.pfx-banner__top{ display:flex; align-items:flex-end; justify-content:space-between; gap:18px; }
.pfx-main-id{ display:flex; align-items:flex-end; gap:16px; }
.pfx-avatar-wrap{
  padding:3px;
  border-radius:999px;
  background:radial-gradient(circle at 0 0,#48d0ff,#8b5cf6);
  box-shadow:0 18px 50px rgba(0,0,0,.7);
}
.pfx-avatar{ width:96px; height:96px; border-radius:999px; object-fit:cover; display:block; }
.pfx-id{ display:flex; flex-direction:column; gap:4px; }
.pfx-name{ margin:0; font-weight:900; font-size:26px; letter-spacing:.3px; }
.pfx-handle{ font-size:14px; color:#b7c7d9; }

.pfx-links{ display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
.pfx-links a{
  font-size:12px;
  padding:4px 9px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.18);
  background:rgba(255,255,255,.06);
  color:var(--text);
  text-decoration:none;
}
.pfx-links a:hover{ background:rgba(255,255,255,.10); }

.pfx-actions{ display:flex; gap:8px; align-items:center; }
.pfx-chip{
  height:36px;
  padding:0 14px;
  border-radius:10px;
  border:1px solid rgba(255,255,255,.18);
  background:rgba(255,255,255,.06);
  color:var(--text);
  font-weight:800;
  cursor:pointer;
  transition:.15s ease;
}
.pfx-chip--primary{
  border:none;
  background:linear-gradient(135deg, var(--brand), #35c4ff);
  color:#062028;
  box-shadow:0 10px 24px rgba(56,189,248,.22);
}
.pfx-chip:hover{ transform:translateY(-1px); }

.pfx-banner__stats{ margin-top:18px; display:flex; gap:12px; }
.pfx-stat{
  flex:1 1 240px;
  min-width:240px;
  text-align:center;
  padding:12px 12px;
  border-radius:16px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03)),
    var(--panel);
  border:1px solid var(--stroke);
  box-shadow:0 18px 58px rgba(0,0,0,.30);
}
.pfx-stat__value{ font-size:22px; font-weight:900; }
.pfx-stat__label{ font-size:12px; color: var(--muted); }

@media (max-width: 1100px){
  .grid-cards--4{ grid-template-columns:repeat(2, minmax(0, 1fr)); }
  .skeleton-grid{ grid-template-columns:repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px){
  .grid-cards--4{ grid-template-columns:1fr; }
  .skeleton-grid{ grid-template-columns:1fr; }
  .pfx-banner__top{ flex-direction:column; align-items:flex-start; }
  .pfx-actions{ align-self:flex-start; }
  .pfx-banner__stats{ flex-direction:column; }
  .pfx-stat{ min-width:unset; }
}
`;
