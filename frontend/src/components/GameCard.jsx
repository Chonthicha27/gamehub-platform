// frontend/src/components/GameCard.jsx
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";

const isHtmlFile = (u = "") => /\.html?(\?|$)/i.test(u);

export default function GameCard({ game }) {
  const nav = useNavigate();
  if (!game) return null;

  const cover = cdn(game.coverUrl || "/no-cover.png");
  const uploader = game.uploader || {};

  const fileSrc = cdn(game.fileUrl || "");
  const playable = game.kind === "html" || isHtmlFile(game.fileUrl || "");
  const downloadable = game.kind === "download";

  const trackPlay = async () => {
    try {
      await api.post(`/games/${game._id}/track-play`);
    } catch {
      // ignore (เช่น rate limit / network)
    }
  };

  const trackDownload = async () => {
    try {
      await api.post(`/games/${game._id}/track-download`);
    } catch {
      // ignore
    }
  };

  const onPlayClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await trackPlay();
    // เปิดเกมทันที
    window.open(fileSrc, "_blank", "noopener,noreferrer");
  };

  const onDownloadClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await trackDownload();
    // ดาวน์โหลดจริง
    window.location.href = fileSrc;
  };

  const goDetail = () => nav(`/games/${game._id}`);

  return (
    <article className="gcard" onClick={goDetail} role="button" tabIndex={0}>
      <Link to={`/games/${game._id}`} className="gcard__thumb" onClick={(e) => e.stopPropagation()}>
        <img src={cover} alt={game.title} loading="lazy" />

        {game.category && <span className="gcard__badge">{game.category}</span>}

        {/* ✅ Quick actions */}
        {(playable || downloadable) && (
          <div className="gcard__actions" onClick={(e) => e.stopPropagation()}>
            {playable && !downloadable ? (
              <button className="gbtn gbtn--play" type="button" onClick={onPlayClick}>
                ▶ Play
              </button>
            ) : null}

            {downloadable ? (
              <button className="gbtn gbtn--dl" type="button" onClick={onDownloadClick}>
                ⬇ Download
              </button>
            ) : null}

            {/* ปุ่มเข้า detail (กันคนไม่อยากกดทั้งการ์ด) */}
            <Link
              className="gbtn gbtn--ghost"
              to={`/games/${game._id}`}
              onClick={(e) => e.stopPropagation()}
            >
              Details
            </Link>
          </div>
        )}
      </Link>

      <div className="gcard__body">
        <Link to={`/games/${game._id}`} className="gcard__title" onClick={(e) => e.stopPropagation()}>
          {game.title}
        </Link>

        <div className="gcard__meta">
          {uploader?.avatar ? (
            <img
              className="gcard__avatar"
              src={cdn(uploader.avatar)}
              alt={uploader.username || "creator"}
            />
          ) : (
            <div className="gcard__avatar stub" />
          )}
          <span className="gcard__by">
            by <span className="gcard__author">{uploader?.username || "unknown"}</span>
          </span>
        </div>

        {/* ✅ Optional: show kind */}
        <div className="gcard__kind">
          {downloadable ? "Downloadable" : playable ? "HTML / WebGL" : "Game"}
        </div>
      </div>

      <style>{`
        .gcard{
          display:flex; flex-direction:column; gap:8px;
          background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
          border:1px solid var(--stroke); border-radius:16px; padding:10px;
          transition:transform .15s ease, box-shadow .15s ease;
          cursor:pointer;
          outline:none;
        }
        .gcard:hover{ transform:translateY(-2px); box-shadow:0 10px 26px rgba(0,0,0,.35) }

        .gcard__thumb{ position:relative; display:block; border-radius:12px; overflow:hidden; aspect-ratio:16/10; }
        .gcard__thumb img{ width:100%; height:100%; object-fit:cover; display:block; transform:scale(1.02) }

        .gcard__badge{
          position:absolute; top:8px; left:8px; font-size:12px;
          padding:4px 8px; border-radius:999px; color:#06131a;
          background:linear-gradient(135deg, #59e0ff, #35c4ff);
        }

        /* ✅ actions overlay */
        .gcard__actions{
          position:absolute;
          left:10px;
          right:10px;
          bottom:10px;
          display:flex;
          gap:8px;
          align-items:center;
          justify-content:flex-start;
          opacity:0;
          transform:translateY(6px);
          transition:opacity .15s ease, transform .15s ease;
          pointer-events:none;
        }
        .gcard:hover .gcard__actions{
          opacity:1;
          transform:translateY(0);
          pointer-events:auto;
        }
        .gcard__thumb::after{
          content:"";
          position:absolute;
          inset:0;
          background:linear-gradient(180deg, transparent 55%, rgba(0,0,0,.55));
          opacity:.9;
          pointer-events:none;
        }

        .gbtn{
          appearance:none;
          border:1px solid rgba(255,255,255,.22);
          background:rgba(2,6,23,.8);
          color:#eaf4ff;
          padding:6px 10px;
          border-radius:999px;
          font-size:12px;
          font-weight:800;
          cursor:pointer;
          text-decoration:none;
          display:inline-flex;
          align-items:center;
          gap:6px;
          backdrop-filter: blur(10px);
          transition:transform .12s ease, box-shadow .12s ease, opacity .12s ease;
        }
        .gbtn:hover{
          transform:translateY(-1px);
          box-shadow:0 10px 18px rgba(0,0,0,.35);
        }

        .gbtn--play{
          border:none;
          background:linear-gradient(135deg, #59e0ff, #35c4ff);
          color:#06131a;
        }
        .gbtn--dl{
          border:1px solid rgba(250,204,21,.55);
          background:rgba(250,204,21,.12);
          color:#facc15;
        }
        .gbtn--ghost{
          border:1px solid rgba(255,255,255,.22);
          background:rgba(2,6,23,.65);
          color:#eaf4ff;
        }

        .gcard__body{ display:flex; flex-direction:column; gap:6px }
        .gcard__title{
          color:#eaf4ff; font-weight:700; text-decoration:none;
          display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;
        }

        .gcard__meta{ display:flex; align-items:center; gap:8px; color:#a7b8c9; font-size:13px }
        .gcard__avatar{
          width:22px; height:22px; border-radius:999px; object-fit:cover;
          border:1px solid rgba(255,255,255,.2);
        }
        .gcard__avatar.stub{ background:rgba(255,255,255,.08) }
        .gcard__by{ opacity:.9 }
        .gcard__author{ color:#dfe7ee; font-weight:600 }

        .gcard__kind{
          font-size:12px;
          color:#9ca3af;
        }
      `}</style>
    </article>
  );
}
