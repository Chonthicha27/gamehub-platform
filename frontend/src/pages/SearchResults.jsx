// frontend/src/pages/SearchResults.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";

// ใช้ query string
function useQS() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

// ใช้ CATEGORIES เดียวกับหน้า UploadGame
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
        setItems(data.items || []);
        setTotal(data.total || 0);
      } catch (e) {
        console.error("search failed", e);
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
      <style>{CSS}</style>

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

        {/* แถวค้นหา + เลือกหมวดหมู่ */}
        <div className="s-filters">
          <input
            className="s-input"
            placeholder="Search games, creators, tags..."
            defaultValue={q}
            onKeyDown={(e) =>
              e.key === "Enter" && setParam("q", e.currentTarget.value.trim())
            }
          />

          <div className="s-genre">
            <span className="s-genre-label">Genre</span>
            <select
              className="s-select"
              value={category}
              onChange={(e) => setParam("category", e.target.value)}
            >
              <option value="all">All genres</option>
              {CATEGORIES.filter((c) => c.id !== "no-genre").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* เนื้อหา */}
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
                <GameCard
                  key={g._id}
                  g={g}
                  onClick={() => nav(`/games/${g._id}`)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pager">
                <button
                  disabled={page <= 1}
                  onClick={() =>
                    nav(
                      `/search?${new URLSearchParams({
                        q,
                        category,
                        page: String(page - 1),
                      })}`
                    )
                  }
                >
                  Prev
                </button>
                <div className="pg">
                  {page} / {totalPages}
                </div>
                <button
                  disabled={page >= totalPages}
                  onClick={() =>
                    nav(
                      `/search?${new URLSearchParams({
                        q,
                        category,
                        page: String(page + 1),
                      })}`
                    )
                  }
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty">ไม่พบผลลัพธ์</div>
        )}
      </div>
    </div>
  );
}

const CSS = `
/* พื้นหลังหน้า Search: ให้ใช้สีเดียวกับหน้าแรก (var(--bg)) */
.search-page{
  min-height: 100vh;
  background: var(--bg);
}

/* Head */
.s-head h1{
  margin:0;
  font-size:26px;
  font-weight:900;
}
.s-sub{
  color:var(--muted);
  margin-top:4px;
}

/* แถวค้นหา */
.s-filters{
  margin:14px 0 18px;
  display:flex;
  align-items:center;
  gap:10px;
}

.s-input{
  flex:1;
  padding:11px 14px;
  border-radius:999px;
  border:1px solid var(--stroke);
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

/* Genre capsule */
.s-genre{
  display:flex;
  align-items:center;
  gap:8px;
}
.s-genre-label{
  font-size:13px;
  color:var(--muted);
}
.s-select{
  min-width:150px;
  padding:9px 14px;
  border-radius:999px;
  border:1px solid var(--stroke);
  background:rgba(255,255,255,.05);
  color:var(--text);
}

/* Grid / cards (ใช้สไตล์เดียวกับหน้าแรก) */
.pfx-grid{
  display:grid;
  gap:14px;
  grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));
}
.pfx-game{
  cursor:pointer;
  border:1px solid rgba(255,255,255,.10);
  border-radius:16px;
  background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03));
  box-shadow: var(--shadow);
}
.pfx-game__cover{
  aspect-ratio:16/9;
  background-size:cover;
  background-position:center;
  border-top-left-radius:16px;
  border-top-right-radius:16px;
}
.pfx-game__meta{ padding:10px 12px; }
.pfx-game__title{
  margin:0 0 4px;
  font-size:16px;
  font-weight:800;
}
.pfx-game__sub{
  margin:0;
  color:var(--muted);
}

/* skeleton */
.pfx-game--skel{ pointer-events:none; }
.pfx-skel.cover{
  height:130px;
  border-top-left-radius:16px;
  border-top-right-radius:16px;
  background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.12),rgba(255,255,255,.06));
  background-size:140% 100%;
  animation:sh 1.2s infinite;
}
.pfx-skel.line{
  height:14px;
  margin:10px 12px;
  border-radius:6px;
  background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.12),rgba(255,255,255,.06));
  background-size:140% 100%;
  animation:sh 1.2s infinite;
}
.pfx-skel.line.small{ width:60%; }
@keyframes sh{
  0%{background-position:-40% 0}
  100%{background-position:140% 0}
}

/* Pager */
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

/* empty */
.empty{
  padding:20px;
  border-radius:12px;
  background:rgba(255,255,255,.04);
}

/* responsive */
@media (max-width: 640px){
  .s-filters{
    flex-direction:column;
    align-items:stretch;
  }
  .s-genre{
    justify-content:flex-end;
  }
}
`;
