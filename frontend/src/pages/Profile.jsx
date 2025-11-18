import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";

function Stat({ label, value }) {
  return (
    <div className="pfx-stat">
      <div className="pfx-stat__value">{value ?? 0}</div>
      <div className="pfx-stat__label">{label}</div>
    </div>
  );
}

function GameCardMini({ game, onClick }) {
  return (
    <article className="pfx-game" onClick={onClick} title={game.title}>
      <div
        className="pfx-game__cover"
        style={{ backgroundImage: `url(${cdn(game.coverUrl || "/no-cover.png")})` }}
      />
      <div className="pfx-game__meta">
        <h3 className="pfx-game__title">{game.title}</h3>
        <p className="pfx-game__sub">
          {(game.category || "all")} · by {game?.uploader?.username || "?"}
        </p>
      </div>
    </article>
  );
}

export default function Profile() {
  const nav = useNavigate();

  const [me, setMe] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // load me + all games then filter mine (backendยังไม่มี query uploader)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const { data: meData } = await api.get("/users/me");
        if (!alive) return;
        setMe(meData);

        const { data: list } = await api.get("/games", { params: { all: 1 } });
        if (!alive) return;

        const mine = (list || []).filter(
          (g) => String(g?.uploader?._id || "") === String(meData?._id || "")
        );
        setGames(mine);
      } catch (e) {
        console.error("Profile load failed", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const stats = useMemo(
    () => ({
      games: games.length || 0,
      plays: me?.plays || 0,
      likes: me?.likes || 0,
      followers: me?.followers || 0,
    }),
    [games, me]
  );

  // ===== UI =====
  return (
    <div className="pfx">
      <style>{CSS}</style>

      {/* Banner hero */}
      <section
        className="pfx-hero"
        style={{
          backgroundImage: `url(${cdn(
            me?.bannerUrl || "/profile-banner-fallback.jpg"
          )})`,
        }}
      >
        <div className="pfx-hero__overlay" />
        <div className="pfx-hero__inner container">
          <img
            className="pfx-avatar"
            src={cdn(me?.avatarUrl || "/avatar-default.png")}
            alt={me?.displayName || me?.username || "avatar"}
          />

          <div className="pfx-id">
            <h1 className="pfx-name">{me?.displayName || me?.username || "—"}</h1>
            <div className="pfx-handle">@{me?.username || "unknown"}</div>
            {me?.bio && <p className="pfx-bio">{me.bio}</p>}

            {!!me?.links && (
              <div className="pfx-links">
                {me.links.website && (
                  <a href={me.links.website} target="_blank" rel="noreferrer">Website</a>
                )}
                {me.links.github && (
                  <a href={`https://github.com/${me.links.github}`} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                )}
                {me.links.twitter && (
                  <a href={`https://x.com/${me.links.twitter}`} target="_blank" rel="noreferrer">
                    X/Twitter
                  </a>
                )}
                {me.links.youtube && (
                  <a href={me.links.youtube} target="_blank" rel="noreferrer">YouTube</a>
                )}
              </div>
            )}
          </div>

          <div className="pfx-actions">
            <button className="pfx-chip" onClick={() => nav("/settings/profile")}>Edit profile</button>
            <button className="pfx-chip pfx-chip--primary" onClick={() => nav("/upload")}>Upload game</button>
          </div>

          <div className="pfx-stats">
            <Stat label="Games" value={stats.games} />
            <Stat label="Plays" value={stats.plays} />
            <Stat label="Likes" value={stats.likes} />
            <Stat label="Followers" value={stats.followers} />
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="container pfx-body">
        <div className="pfx-card">
          <div className="pfx-listhead">
            <h2 className="pfx-sec">My Games</h2>
            <button className="pfx-link" onClick={() => nav("/games")}>See all →</button>
          </div>

          {loading ? (
            <div className="pfx-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="pfx-game pfx-game--skel">
                  <div className="pfx-skel cover" />
                  <div className="pfx-skel line" />
                  <div className="pfx-skel line small" />
                </div>
              ))}
            </div>
          ) : games.length ? (
            <div className="pfx-grid">
              {games.map((g) => (
                <GameCardMini key={g._id} game={g} onClick={() => nav(`/games/${g._id}`)} />
              ))}
            </div>
          ) : (
            <div className="pfx-empty">
              <div>ยังไม่มีเกมที่แสดง</div>
              <button className="pfx-chip pfx-chip--primary" onClick={() => nav("/upload")}>
                อัปโหลดเกมแรกของฉัน
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const CSS = `
/* Shell */
.pfx{ background:#0b0f14; min-height:100vh; color:#e8edf2 }

/* HERO */
.pfx-hero{
  position:relative; border-bottom:1px solid rgba(255,255,255,.08);
  background-size:cover; background-position:center; min-height:240px;
}
.pfx-hero__overlay{
  position:absolute; inset:0;
  background:linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.35));
}
.pfx-hero__inner{
  position:relative; z-index:2; padding:26px 0 18px;
  display:grid; grid-template-columns:auto 1fr auto; gap:16px; align-items:end;
}
.pfx-avatar{
  width:108px; height:108px; border-radius:999px; object-fit:cover;
  border:3px solid rgba(255,255,255,.9); box-shadow:0 16px 44px rgba(0,0,0,.45);
  background:#0a0e12;
}
.pfx-id{ display:flex; flex-direction:column; gap:6px }
.pfx-name{ margin:0; font-weight:900; letter-spacing:.3px; font-size:28px }
.pfx-handle{ color:#b7c7d9; font-size:14px }
.pfx-bio{ margin:2px 0 4px; color:#dbe9ff }
.pfx-links{ display:flex; gap:12px; flex-wrap:wrap; }
.pfx-links a{ color:#bfe7ff; text-decoration:none }
.pfx-links a:hover{ color:#eaf7ff }

.pfx-actions{ display:flex; gap:8px; align-items:center; justify-self:end }
.pfx-chip{
  height:36px; padding:0 14px; border-radius:10px;
  border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.06);
  color:#e9f1f7; font-weight:800; cursor:pointer; transition:.15s;
}
.pfx-chip--primary{
  border:none; background:linear-gradient(135deg,#59e0ff,#35c4ff); color:#062028;
  box-shadow:0 10px 24px rgba(0,172,255,.28);
}
.pfx-chip:hover{ transform:translateY(-1px) }

.pfx-stats{ grid-column:1 / -1; display:flex; gap:10px }
.pfx-stat{
  background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
  border:1px solid rgba(255,255,255,.10); border-radius:12px;
  padding:10px 12px; min-width:110px; text-align:center;
}
.pfx-stat__value{ font-weight:900; font-size:20px }
.pfx-stat__label{ color:#a9b1bb; font-size:12px }

/* BODY */
.pfx-body{ padding:18px 0 42px }
.pfx-card{
  background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
  border:1px solid rgba(255,255,255,.10); border-radius:16px; padding:14px;
}
.pfx-sec{ margin:0; font-size:20px; font-weight:900; background:linear-gradient(180deg,#fff,#e6f4ff); -webkit-background-clip:text; background-clip:text; color:transparent }
.pfx-listhead{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px }
.pfx-link{ color:#a9b1bb; background:transparent; border:0; cursor:pointer }
.pfx-link:hover{ color:#e5f1ff }

.pfx-grid{ display:grid; gap:14px; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)) }
.pfx-game{
  cursor:pointer; border:1px solid rgba(255,255,255,.10); border-radius:16px;
  background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
}
.pfx-game:hover{ transform:translateY(-3px); box-shadow:0 14px 36px rgba(0,0,0,.35) }
.pfx-game__cover{ aspect-ratio:16/9; background-size:cover; background-position:center; border-top-left-radius:16px; border-top-right-radius:16px }
.pfx-game__meta{ padding:10px 12px }
.pfx-game__title{ margin:0 0 4px; font-size:16px; font-weight:800 }
.pfx-game__sub{ margin:0; color:#a9b1bb }

.pfx-empty{ display:flex; align-items:center; justify-content:space-between; padding:16px; border-radius:12px; background:rgba(255,255,255,.04) }

/* skeleton */
.pfx-game--skel{ pointer-events:none }
.pfx-skel.cover{
  height:130px; border-top-left-radius:16px; border-top-right-radius:16px;
  background:linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12), rgba(255,255,255,.06));
  background-size:140% 100%; animation:pfx-shimmer 1.2s infinite;
}
.pfx-skel.line{ height:14px; margin:10px 12px; border-radius:6px;
  background:linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12), rgba(255,255,255,.06));
  background-size:140% 100%; animation:pfx-shimmer 1.2s infinite;
}
.pfx-skel.line.small{ width:60% }
@keyframes pfx-shimmer { 0%{background-position:-40% 0} 100%{background-position:140% 0} }

/* responsive */
@media (max-width: 900px){
  .pfx-hero__inner{ grid-template-columns:auto 1fr; align-items:end }
  .pfx-actions{ grid-column:1 / -1; justify-self:start }
  .pfx-stats{ grid-column:1 / -1 }
  .pfx-avatar{ width:92px; height:92px }
  .pfx-name{ font-size:24px }
}
`;
