// frontend/src/components/GameCard.jsx
import { Link } from "react-router-dom";
import { cdn } from "../api/cdn";

export default function GameCard({ game }) {
  if (!game) return null;

  const cover = cdn(game.coverUrl || "/no-cover.png");
  const uploader = game.uploader || {};

  return (
    <article className="gcard">
      <Link to={`/games/${game._id}`} className="gcard__thumb">
        <img src={cover} alt={game.title} loading="lazy" />
        {game.category && <span className="gcard__badge">{game.category}</span>}
      </Link>

      <div className="gcard__body">
        <Link to={`/games/${game._id}`} className="gcard__title">
          {game.title}
        </Link>

        <div className="gcard__meta">
          {uploader?.avatar ? (
            <img className="gcard__avatar" src={cdn(uploader.avatar)} alt={uploader.username || "creator"} />
          ) : (
            <div className="gcard__avatar stub" />
          )}
          <span className="gcard__by">
            by <span className="gcard__author">{uploader?.username || "unknown"}</span>
          </span>
        </div>
      </div>

      <style>{`
        .gcard{
          display:flex; flex-direction:column; gap:8px;
          background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
          border:1px solid var(--stroke); border-radius:16px; padding:10px;
          transition:transform .15s ease, box-shadow .15s ease;
        }
        .gcard:hover{ transform:translateY(-2px); box-shadow:0 10px 26px rgba(0,0,0,.35) }

        .gcard__thumb{ position:relative; display:block; border-radius:12px; overflow:hidden; aspect-ratio:16/10; }
        .gcard__thumb img{ width:100%; height:100%; object-fit:cover; display:block; transform:scale(1.02) }

        .gcard__badge{
          position:absolute; top:8px; left:8px; font-size:12px;
          padding:4px 8px; border-radius:999px; color:#06131a;
          background:linear-gradient(135deg, #59e0ff, #35c4ff);
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
      `}</style>
    </article>
  );
}
