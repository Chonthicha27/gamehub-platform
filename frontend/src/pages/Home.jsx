// frontend/src/pages/Home.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import FancyCategorySelect from "../components/FancyCategorySelect";
import { cdn } from "../api/cdn";

// ===== CSS สำหรับ Monthly Winner =====
const MW_CSS = `
.mw-card{
  position:relative;
  display:flex;
  gap:24px;
  padding:18px 20px;
  border-radius:20px;
  background:
    radial-gradient(circle at 0 0, rgba(72,208,255,.12), transparent 55%),
    radial-gradient(circle at 100% 0, rgba(139,92,246,.12), transparent 55%),
    #020617;
  border:1px solid rgba(148,163,184,.35);
  box-shadow:0 24px 60px rgba(0,0,0,.7);
  cursor:pointer;
  overflow:hidden;
}
.mw-card:hover{ transform:translateY(-2px); }

.mw-cover{
  flex:0 0 40%;
  max-width:40%;
  aspect-ratio:16/9;
  border-radius:16px;
  background-size:cover;
  background-position:center;
  box-shadow:0 18px 42px rgba(0,0,0,.7);
}
.mw-main{
  flex:1;
  min-width:0;
  display:flex;
  flex-direction:column;
  justify-content:center;
  gap:8px;
}
.mw-badge{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:4px 10px;
  border-radius:999px;
  background:rgba(15,23,42,.95);
  border:1px solid rgba(148,163,184,.6);
  font-size:12px;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:#e5f2ff;
}
.mw-badge span{opacity:.9}
.mw-title{ margin:4px 0 2px; font-size:22px; font-weight:900; }
.mw-tagline{ font-size:14px; color:#cbd5f5; max-width:520px; }
.mw-meta{ font-size:12px; color:#9ca3af; }
.mw-btn{
  margin-top:14px;
  align-self:flex-start;
  padding:9px 20px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.9);
  background:#0b1120;
  color:#e5f3ff;
  font-weight:700;
  font-size:14px;
  cursor:pointer;
  transition:.12s ease;
  box-shadow:none;
}
.mw-btn:hover{ background:#020617; }

@media (max-width: 960px){
  .mw-card{ flex-direction:column; }
  .mw-cover{ flex:0 0 auto; max-width:100%; width:100%; }
}
`;

// ===== CSS เพิ่มสำหรับ plays/downloads ในการ์ด Home =====
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

const ICON_PLAY = "🎮";
const ICON_DL = "📥";

// ✅ helper: รองรับทั้งชื่อใหม่ (playsCount/downloadsCount) + fallback ชื่อเก่า (plays/downloads)
const getPlays = (g) => Number(g?.playsCount ?? g?.plays ?? 0) || 0;
const getDownloads = (g) => Number(g?.downloadsCount ?? g?.downloads ?? 0) || 0;

export default function Home({ onLoginClick, onRegisterClick }) {
  const nav = useNavigate();

  // search bar
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  // featured list
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // ⭐ Monthly winner
  const [monthlyWinner, setMonthlyWinner] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(true);

  // ✅ helpers: แยกประเภทเกมจากไฟล์/ชนิด
  const isZipFile = (u = "") => /\.zip(\?|$)/i.test(String(u || ""));
  const isRarFile = (u = "") => /\.rar(\?|$)/i.test(String(u || ""));
  const isHtmlFile = (u = "") => /\.html?(\?|$)/i.test(String(u || ""));

  // zip เล่นบนเว็บได้, html ก็เล่นบนเว็บได้
  const isPlayableWeb = (g) =>
    g?.kind === "html" || isZipFile(g?.fileUrl) || isHtmlFile(g?.fileUrl);

  // rar คือดาวน์โหลด, หรือ kind=download คือดาวน์โหลด
  const isDownloadOnly = (g) => g?.kind === "download" || isRarFile(g?.fileUrl);

  // โหลด Featured & Latest
  const fetchFeatured = async () => {
    try {
      setLoading(true);
      const params = { all: 1 };
      if (category !== "all") params.category = category;
      const { data } = await api.get(`/games`, { params });

      // ✅ FIX: กันหลุดจาก backend/แคช/ดีพลอยไม่ตรงกัน -> หน้า Home ต้องโชว์เฉพาะ public เท่านั้น
      setGames((Array.isArray(data) ? data : []).filter((g) => g?.visibility === "public"));
    } finally {
      setLoading(false);
    }
  };

  // โหลดอันดับ 1 โหวตประจำเดือน
  const fetchMonthlyWinner = async () => {
    try {
      setMonthlyLoading(true);
      const { data } = await api.get("/monthly-vote/leaderboard", {
        params: { limit: 1 },
      });

      if (Array.isArray(data) && data.length > 0) {
        const row = data[0];
        const game = row._id || row.game || null;
        if (game) setMonthlyWinner({ ...game, votes: row.votes ?? 0 });
        else setMonthlyWinner(null);
      } else {
        setMonthlyWinner(null);
      }
    } catch (err) {
      console.error("Failed to fetch monthly winner:", err);
      setMonthlyWinner(null);
    } finally {
      setMonthlyLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatured();
    fetchMonthlyWinner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ไปหน้า search
  const goSearch = (kw = q, cat = category) => {
    const sp = new URLSearchParams();
    if (kw && kw.trim()) sp.set("q", kw.trim());
    if (cat && cat !== "all") sp.set("category", cat);
    nav(`/search?${sp.toString()}`);
  };

  const monthLabel = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  // helper: tagline แบบมี fallback
  const renderTagline = (g) =>
    g?.tagline && g.tagline.trim().length > 0
      ? g.tagline
      : "No short description yet.";

  // ✅ รวมข้อมูล monthlyWinner กับ games ถ้าเจอ id เดียวกัน
  const getFullMonthlyWinner = () => {
    if (!monthlyWinner) return null;
    const fromGames = games.find((x) => x._id === monthlyWinner._id);
    return fromGames ? { ...monthlyWinner, ...fromGames } : monthlyWinner;
  };

  const fullMonthlyWinner = getFullMonthlyWinner();

  return (
    <>
      <style>{MW_CSS + HOME_STATS_CSS}</style>

      {/* HERO SEARCH */}
      <section className="hero-neo">
        <div className="container hero-neo__inner">
          <div className="hero-neo__badge">🎮 Welcome to GPX</div>
          <h1 className="hero-neo__title">
            Discover, Play, and{" "}
            <span className="tx-gradient">Share Indie Games</span>
          </h1>
          <p className="hero-neo__sub">
            ค้นหาเกมอินดี้เจ๋ง ๆ หรืออัปโหลดผลงานของคุณให้ชุมชนได้ลองเล่น
          </p>

          <div className="cmdbar">
            <div className="cmdseg cmd-input">
              <input
                className="cmd-input-el"
                placeholder="Search games, creators, tags…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goSearch()}
              />
            </div>
            <span className="cmd-divider" />
            <div className="cmdseg cmd-cat">
              <FancyCategorySelect value={category} onChange={setCategory} label="" />
            </div>
            <button className="cmdseg cmd-btn cmd-btn--primary" onClick={() => goSearch()}>
              Search
            </button>
            <button className="cmdseg cmd-btn cmd-btn--outline" onClick={() => nav("/upload")}>
              Upload
            </button>
          </div>
        </div>
      </section>

      {/* ⭐ MONTHLY WINNER HERO */}
      {(fullMonthlyWinner || monthlyLoading) && (
        <section className="section container">
          <div className="section__head">
            <h2 className="section__title">Monthly Winner</h2>
            <span className="muted">{monthLabel}</span>
          </div>

          {monthlyLoading ? (
            <div className="card game-card game-card--skel">
              <div className="cover skel" />
              <div className="meta">
                <div className="skel skel-line" />
                <div className="skel skel-line small" />
              </div>
            </div>
          ) : !fullMonthlyWinner ? (
            <div className="empty glass-lg">ยังไม่มีเกมที่ชนะโหวตในเดือนนี้</div>
          ) : (
            (() => {
              const g = fullMonthlyWinner;
              const cover = cdn(
                g.coverUrl || (Array.isArray(g.screens) && g.screens[0]) || "/no-cover.png"
              );
              const uploader = g?.uploader?.username || "?";
              const votes = g.votes ?? 0;

              return (
                <article className="mw-card" onClick={() => nav(`/games/${g._id}`)}>
                  <div className="mw-cover" style={{ backgroundImage: `url(${cover})` }} />
                  <div className="mw-main">
                    <div className="mw-badge">
                      🏆 <span>Monthly vote winner</span>
                    </div>
                    <h3 className="mw-title">{g.title}</h3>

                    <p className="mw-tagline">{renderTagline(g)}</p>

                    <p className="mw-meta">
                      #1 this month · {g.category || "all"} · {votes || 0}{" "}
                      {votes === 1 ? "vote" : "votes"} · by {uploader}
                    </p>

                    <button
                      type="button"
                      className="mw-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        nav(`/games/${g._id}`);
                      }}
                    >
                      Play now
                    </button>
                  </div>
                </article>
              );
            })()
          )}
        </section>
      )}

      {/* FEATURED & LATEST */}
      <section className="section container">
        <div className="section__head">
          <h2 className="section__title">Featured &amp; Latest</h2>

          {games.length > 0 && (
            <a
              href="/search"
              className="link-muted"
              onClick={(e) => {
                e.preventDefault();
                nav("/search");
              }}
            >
              See all →
            </a>
          )}
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
            <button className="btn btn--primary" onClick={() => onRegisterClick?.()}>
              Be the first creator
            </button>
          </div>
        ) : (
          <div className="grid-cards">
            {games.map((g) => {
              const cover = cdn(
                g.coverUrl || (Array.isArray(g.screens) && g.screens[0]) || "/no-cover.png"
              );
              const uploader = g?.uploader?.username || "?";

              const playableWeb = isPlayableWeb(g);
              const downloadOnly = isDownloadOnly(g);

              const plays = getPlays(g);
              const downloads = getDownloads(g);

              return (
                <article
                  key={g._id}
                  className="card game-card"
                  onClick={() => nav(`/games/${g._id}`)}
                >
                  <div className="cover" style={{ backgroundImage: `url(${cover})` }} />

                  <div className="meta">
                    <div className="hc-title-row">
                      <h3 className="title">{g.title}</h3>

                      {/* ✅ แยกโชว์: เล่นบนเว็บ = Plays อย่างเดียว, ดาวน์โหลด = Downloads อย่างเดียว */}
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
            })}
          </div>
        )}
      </section>

      <footer className="footer-neo">
        <div className="container footer-neo__inner">
          <div className="brandmark">GPX</div>
          <div className="muted">© {new Date().getFullYear()} Game Platform X</div>
          <div className="links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </>
  );
}
