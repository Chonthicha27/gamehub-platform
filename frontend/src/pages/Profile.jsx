// frontend/src/pages/Profile.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
        style={{
          backgroundImage: `url(${cdn(game.coverUrl || "/no-cover.png")})`,
        }}
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
  const params = useParams(); // { id } หรือ { username } ตาม route

  const [me, setMe] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const viewingUserId = params?.id || null;
  const viewingUsername = params?.username || null;

  // ✅ load profile + games
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setNotFound(false);

        // 1) โหลด user ตามหน้า
        let profile = null;

        if (viewingUsername) {
          // /@:username
          const { data } = await api.get(`/users/by-username/${viewingUsername}`);
          profile = data;
        } else if (viewingUserId) {
          // /users/:id
          const { data } = await api.get(`/users/${viewingUserId}`);
          profile = data;
        } else {
          // /profile
          const { data } = await api.get("/users/me");
          profile = data;
        }

        if (!alive) return;
        setMe(profile);

        // 2) โหลดเกมของ user นั้น
        const token = localStorage.getItem("token");
        const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

        let list = [];

        // ถ้าเป็นหน้าของฉัน (ไม่มี params) ใช้ mine=1
        if (!viewingUsername && !viewingUserId) {
          const { data } = await api.get("/games", {
            params: { mine: 1 },
            withCredentials: true,
            headers: { ...authHeader },
          });
          list = Array.isArray(data) ? data : [];
        } else {
          // โปรไฟล์สาธารณะ: ใช้ uploader=<id>
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
      } catch (e) {
        console.error("Profile load failed", e);
        if (!alive) return;
        setMe(null);
        setGames([]);
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
      games: games.length || 0,
      plays: me?.plays || 0,
      likes: me?.likes || 0,
      followers: me?.followers || 0,
    }),
    [games, me]
  );

  const aboutText =
    me?.bio ||
    "ยังไม่ได้เขียนแนะนำตัว ลองเล่าเกี่ยวกับตัวคุณสั้น ๆ ว่าชอบทำเกมแนวไหน หรือกำลังพัฒนาโปรเจกต์อะไรอยู่ 😊";

  // ✅ หน้า public ถ้าไม่พบผู้ใช้
  if (notFound && !loading) {
    return (
      <div className="pfx-page" style={{ minHeight: "100vh", padding: 24, color: "#e8edf2" }}>
        <style>{CSS}</style>
        <div className="container">
          <h2 style={{ margin: 0, fontWeight: 900 }}>ไม่พบผู้ใช้นี้</h2>
          <p style={{ color: "#9aa4b8" }}>ลิงก์อาจผิด หรือผู้ใช้อาจถูกลบ/ปิดการใช้งาน</p>
          <button className="pfx-chip pfx-chip--primary" onClick={() => nav("/")}>
            กลับหน้าแรก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pfx-page">
      <style>{CSS}</style>

      <section
        className="pfx-banner"
        style={{
          backgroundImage: `url(${cdn(me?.bannerUrl || "/profile-banner-fallback.jpg")})`,
        }}
      >
        <div className="pfx-banner__overlay" />
        <div className="pfx-banner__inner container">
          <div className="pfx-banner__top">
            <div className="pfx-main-id">
              <div className="pfx-avatar-wrap">
                <img
                  className="pfx-avatar"
                  src={cdn(me?.avatarUrl || "/avatar-default.png")}
                  alt={me?.displayName || me?.username || "avatar"}
                />
              </div>
              <div className="pfx-id">
                <h1 className="pfx-name">{me?.displayName || me?.username || "—"}</h1>
                <div className="pfx-handle">@{me?.username || "unknown"}</div>
                <div className="pfx-tagline">Indie game creator on GPX</div>

                {!!me?.links && (
                  <div className="pfx-links">
                    {me.links.website && (
                      <a href={me.links.website} target="_blank" rel="noreferrer">
                        Website
                      </a>
                    )}
                    {me.links.github && (
                      <a href={`https://github.com/${me.links.github}`} target="_blank" rel="noreferrer">
                        GitHub
                      </a>
                    )}
                    {me.links.twitter && (
                      <a href={`https://x.com/${me.links.twitter}`} target="_blank" rel="noreferrer">
                        X / Twitter
                      </a>
                    )}
                    {me.links.youtube && (
                      <a href={me.links.youtube} target="_blank" rel="noreferrer">
                        YouTube
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ปุ่มแก้ไข/อัปโหลด แสดงเฉพาะหน้า /profile (ของฉัน) */}
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
            <Stat label="Likes" value={stats.likes} />
            <Stat label="Followers" value={stats.followers} />
          </div>
        </div>
      </section>

      <section className="container pfx-layout">
        <main className="pfx-main">
          <header className="pfx-section-head">
            <div>
              <h2 className="pfx-sec">Games</h2>
              <p className="pfx-section-sub">
                {stats.games > 0 ? `${stats.games} game${stats.games > 1 ? "s" : ""}` : "ยังไม่มีเกม"}
              </p>
            </div>
          </header>

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
              <div>
                <div className="pfx-empty__title">ยังไม่มีเกม</div>
                <p className="pfx-empty__text">ถ้าเป็นโปรไฟล์ของคุณ ลองอัปโหลดเกมแรกได้เลย</p>
              </div>
              {!viewingUsername && !viewingUserId && (
                <button className="pfx-chip pfx-chip--primary" onClick={() => nav("/upload")}>
                  อัปโหลดเกมแรกของฉัน
                </button>
              )}
            </div>
          )}
        </main>

        <aside className="pfx-side">
          <div className="pfx-sidecard">
            <h3 className="pfx-side-title">About</h3>
            <p className="pfx-side-text">{aboutText}</p>
          </div>

          <div className="pfx-sidecard">
            <h3 className="pfx-side-title">Links</h3>
            {!!me?.links ? (
              <ul className="pfx-links-list">
                {me.links.website && (
                  <li>
                    <a href={me.links.website} target="_blank" rel="noreferrer">
                      Website
                    </a>
                  </li>
                )}
                {me.links.github && (
                  <li>
                    <a href={`https://github.com/${me.links.github}`} target="_blank" rel="noreferrer">
                      GitHub
                    </a>
                  </li>
                )}
                {me.links.twitter && (
                  <li>
                    <a href={`https://x.com/${me.links.twitter}`} target="_blank" rel="noreferrer">
                      X / Twitter
                    </a>
                  </li>
                )}
                {me.links.youtube && (
                  <li>
                    <a href={me.links.youtube} target="_blank" rel="noreferrer">
                      YouTube
                    </a>
                  </li>
                )}
              </ul>
            ) : (
              <p className="pfx-side-text pfx-side-text--muted">ยังไม่ได้เพิ่มลิงก์</p>
            )}
          </div>

          <div className="pfx-sidecard">
            <h3 className="pfx-side-title">Profile info</h3>
            <ul className="pfx-info-list">
              <li>
                <span>Username</span>
                <span>@{me?.username || "unknown"}</span>
              </li>
              <li>
                <span>Games</span>
                <span>{stats.games}</span>
              </li>
              <li>
                <span>Total plays</span>
                <span>{stats.plays}</span>
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}

const CSS = `/* (CSS เดิมของคุณทั้งหมด วางได้เลย) */
.pfx-page{ background:#05070b; min-height:100vh; color:#e8edf2; }
.pfx-banner{ position:relative; background-size:cover; background-position:center; border-bottom:1px solid rgba(255,255,255,.08); }
.pfx-banner__overlay{ position:absolute; inset:0; background: linear-gradient(180deg, rgba(5,7,12,.8), rgba(5,7,12,.75) 40%, rgba(5,7,12,.9)); }
.pfx-banner__inner{ position:relative; z-index:1; padding:26px 0 18px; }
.pfx-banner__top{ display:flex; align-items:flex-end; justify-content:space-between; gap:18px; }
.pfx-main-id{ display:flex; align-items:flex-end; gap:16px; }
.pfx-avatar-wrap{ padding:3px; border-radius:999px; background:radial-gradient(circle at 0 0,#48d0ff,#8b5cf6); box-shadow:0 18px 50px rgba(0,0,0,.7); }
.pfx-avatar{ width:96px; height:96px; border-radius:999px; object-fit:cover; display:block; }
.pfx-id{ display:flex; flex-direction:column; gap:4px; }
.pfx-name{ margin:0; font-weight:900; font-size:26px; letter-spacing:.3px; }
.pfx-handle{ font-size:14px; color:#b7c7d9; }
.pfx-tagline{ font-size:13px; color:#c5d6eb; }
.pfx-links{ display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }
.pfx-links a{ font-size:12px; padding:4px 9px; border-radius:999px; border:1px solid rgba(255,255,255,.18); background:rgba(5,7,12,.4); color:#dff3ff; text-decoration:none; }
.pfx-links a:hover{ background:rgba(255,255,255,.08); }
.pfx-actions{ display:flex; gap:8px; align-items:center; }
.pfx-chip{ height:36px; padding:0 14px; border-radius:10px; border:1px solid rgba(255,255,255,.18); background:rgba(5,7,12,.75); color:#e9f1f7; font-weight:800; cursor:pointer; transition:.15s ease; }
.pfx-chip--primary{ border:none; background:linear-gradient(135deg,#59e0ff,#35c4ff); color:#062028; box-shadow:0 10px 24px rgba(0,172,255,.28); }
.pfx-chip:hover{ transform:translateY(-1px); }
.pfx-banner__stats{ margin-top:18px; display:flex; flex-wrap:wrap; gap:10px; }
.pfx-stat{ flex:1 1 120px; min-width:120px; background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)); border-radius:12px; border:1px solid rgba(255,255,255,.1); padding:10px 12px; text-align:center; }
.pfx-stat__value{ font-size:20px; font-weight:900; }
.pfx-stat__label{ font-size:12px; color:#a9b1bb; }
.pfx-layout{ padding:20px 0 44px; display:grid; grid-template-columns:minmax(0, 2.2fr) minmax(260px, .9fr); gap:18px; }
.pfx-main{ min-width:0; }
.pfx-section-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:10px; margin-bottom:10px; }
.pfx-sec{ margin:0; font-size:20px; font-weight:900; background:linear-gradient(180deg,#fff,#e6f4ff); -webkit-background-clip:text; background-clip:text; color:transparent; }
.pfx-section-sub{ margin:2px 0 0; font-size:13px; color:#8f9ab0; }
.pfx-grid{ display:grid; gap:14px; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); }
.pfx-game{ cursor:pointer; border-radius:16px; border:1px solid rgba(255,255,255,.1); background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02)); }
.pfx-game:hover{ transform:translateY(-3px); box-shadow:0 14px 36px rgba(0,0,0,.35); }
.pfx-game__cover{ aspect-ratio:16/9; background-size:cover; background-position:center; border-top-left-radius:16px; border-top-right-radius:16px; }
.pfx-game__meta{ padding:10px 12px; }
.pfx-game__title{ margin:0 0 4px; font-size:16px; font-weight:800; }
.pfx-game__sub{ margin:0; font-size:12px; color:#a9b1bb; }
.pfx-empty{ margin-top:6px; padding:16px; border-radius:14px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); display:flex; align-items:center; justify-content:space-between; gap:12px; }
.pfx-empty__title{ font-weight:700; margin-bottom:4px; }
.pfx-empty__text{ margin:0; font-size:13px; color:#a9b1bb; }
.pfx-game--skel{ pointer-events:none; }
.pfx-skel.cover{ height:130px; border-top-left-radius:16px; border-top-right-radius:16px; background:linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12), rgba(255,255,255,.06)); background-size:140% 100%; animation:pfx-shimmer 1.2s infinite; }
.pfx-skel.line{ height:14px; margin:10px 12px; border-radius:6px; background:linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12), rgba(255,255,255,.06)); background-size:140% 100%; animation:pfx-shimmer 1.2s infinite; }
.pfx-skel.line.small{ width:60%; }
@keyframes pfx-shimmer{ 0%{ background-position:-40% 0; } 100%{ background-position:140% 0; } }
.pfx-side{ display:flex; flex-direction:column; gap:12px; }
.pfx-sidecard{ border-radius:14px; border:1px solid rgba(255,255,255,.1); background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02)); padding:12px 14px; }
.pfx-side-title{ margin:0 0 6px; font-size:15px; font-weight:800; }
.pfx-side-text{ margin:0; font-size:13px; color:#cfd7e5; }
.pfx-side-text--muted{ color:#9aa4b8; }
.pfx-links-list{ list-style:none; padding:0; margin:2px 0 0; }
.pfx-links-list li{ margin:3px 0; }
.pfx-links-list a{ font-size:13px; color:#dbeeff; text-decoration:none; }
.pfx-links-list a:hover{ text-decoration:underline; }
.pfx-info-list{ list-style:none; padding:0; margin:2px 0 0; font-size:13px; }
.pfx-info-list li{ display:flex; justify-content:space-between; gap:8px; padding:4px 0; border-bottom:1px dashed rgba(148,163,184,.3); }
.pfx-info-list li:last-child{ border-bottom:none; }
@media (max-width: 900px){
  .pfx-banner__top{ flex-direction:column; align-items:flex-start; }
  .pfx-actions{ align-self:flex-start; }
  .pfx-layout{ grid-template-columns:1fr; }
}
@media (max-width: 640px){
  .pfx-avatar{ width:86px; height:86px; }
  .pfx-name{ font-size:22px; }
}
`;
