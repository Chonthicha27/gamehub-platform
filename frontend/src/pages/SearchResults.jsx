// frontend/src/pages/SearchResults.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";

function useQS() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function GameCard({ g, onClick }) {
  return (
    <article className="pfx-game" onClick={onClick} title={g.title}>
      <div
        className="pfx-game__cover"
        style={{ backgroundImage: `url(${cdn(g.coverUrl || "/no-cover.png")})` }}
      />
      <div className="pfx-game__meta">
        <h3 className="pfx-game__title">{g.title}</h3>
        <p className="pfx-game__sub">
          {(g.category || "all")} · by {g?.uploader?.username || "?"}
        </p>
      </div>
    </article>
  );
}

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

  const setParam = (key, val) => {
    const p = new URLSearchParams(qs);
    if (!val || val === "all") p.delete(key); else p.set(key, val);
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
        setItems(data.items || []);
        setTotal(data.total || 0);
      } catch (e) {
        console.error("search failed", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [q, category, page]);

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return (
    <div className="container section">
      <style>{CSS}</style>
      <div className="s-head">
        <h1>Search results</h1>
        <div className="s-sub">
          {loading ? "Searching…" : `${total} result${total===1?"":"s"}`}
          {q && <> for <b>“{q}”</b></>}
        </div>
      </div>

      <div className="s-filters">
        <input
          className="input"
          placeholder="Type and press Enter…"
          defaultValue={q}
          onKeyDown={(e) => e.key === "Enter" && setParam("q", e.currentTarget.value.trim())}
        />
        <select
          className="select"
          value={category}
          onChange={(e) => setParam("category", e.target.value)}
        >
          <option value="all">All</option>
          <option value="Puzzle">Puzzle</option>
          <option value="RPG">RPG</option>
          <option value="Action">Action</option>
          <option value="Platformer">Platformer</option>
        </select>
      </div>

      {loading ? (
        <div className="pfx-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="pfx-game pfx-game--skel">
              <div className="pfx-skel cover" />
              <div className="pfx-skel line" />
              <div className="pfx-skel line small" />
            </div>
          ))}
        </div>
      ) : items.length ? (
        <>
          <div className="pfx-grid">
            {items.map((g) => (
              <GameCard key={g._id} g={g} onClick={() => nav(`/games/${g._id}`)} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="pager">
              <button disabled={page<=1} onClick={() => nav(`/search?${new URLSearchParams({ q, category, page: String(page-1) })}`)}>Prev</button>
              <div className="pg">{page} / {totalPages}</div>
              <button disabled={page>=totalPages} onClick={() => nav(`/search?${new URLSearchParams({ q, category, page: String(page+1) })}`)}>Next</button>
            </div>
          )}
        </>
      ) : (
        <div className="empty">ไม่พบผลลัพธ์</div>
      )}
    </div>
  );
}

const CSS = `
.s-head h1{margin:0;font-size:26px;font-weight:900}
.s-sub{color:#a9b1bb;margin-top:4px}
.s-filters{display:flex;gap:10px;align-items:center;margin:12px 0}
.input{flex:1;padding:10px 12px;border-radius:12px;border:1px solid var(--stroke);background:rgba(255,255,255,.05);color:var(--text)}
.select{padding:10px 12px;border-radius:12px;border:1px solid var(--stroke);background:rgba(255,255,255,.05);color:var(--text)}

.pfx-grid{ display:grid; gap:14px; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)) }
.pfx-game{ cursor:pointer; border:1px solid rgba(255,255,255,.10); border-radius:16px; background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03)) }
.pfx-game__cover{ aspect-ratio:16/9; background-size:cover; background-position:center; border-top-left-radius:16px; border-top-right-radius:16px }
.pfx-game__meta{ padding:10px 12px }
.pfx-game__title{ margin:0 0 4px; font-size:16px; font-weight:800 }
.pfx-game__sub{ margin:0; color:#a9b1bb }

.pfx-game--skel{ pointer-events:none }
.pfx-skel.cover{
  height:130px;border-top-left-radius:16px;border-top-right-radius:16px;
  background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.12),rgba(255,255,255,.06));
  background-size:140% 100%;animation:sh 1.2s infinite
}
.pfx-skel.line{
  height:14px;margin:10px 12px;border-radius:6px;
  background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.12),rgba(255,255,255,.06));
  background-size:140% 100%;animation:sh 1.2s infinite
}
.pfx-skel.line.small{ width:60% }
@keyframes sh{0%{background-position:-40% 0}100%{background-position:140% 0}}

.pager{display:flex;align-items:center;gap:10px;justify-content:center;margin:14px 0}
.pager button{padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#e9f1f7;cursor:pointer}
.pg{color:#a9b1bb}
.empty{padding:20px;border-radius:12px;background:rgba(255,255,255,.04)}
`;
