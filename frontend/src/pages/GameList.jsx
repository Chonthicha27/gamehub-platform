// frontend/src/components/GameList.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios";
import FancyCategorySelect from "../components/FancyCategorySelect";
import { useNavigate } from "react-router-dom";
import { cdn } from "../api/cdn";

const LIMIT = 24;

export default function GameList() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("latest"); // latest | popular | az

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);

  async function fetchPage(p = 1, append = false) {
    const params = { q, limit: LIMIT, page: p, sort };
    if (category !== "all") params.category = category;

    try {
      if (!append) setLoading(true);
      else setMoreLoading(true);

      const { data } = await api.get("/games", { params });
      const received = Array.isArray(data) ? data : (data?.items ?? []);
      const sorted = sortClient(received, sort);

      setItems((prev) => (append ? [...prev, ...sorted] : sorted));
      setHasMore(received.length === LIMIT);
      setPage(p);
    } finally {
      setLoading(false);
      setMoreLoading(false);
    }
  }

  function sortClient(arr, mode) {
    if (!Array.isArray(arr)) return [];
    switch (mode) {
      case "popular":
        return [...arr].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0));
      case "az":
        return [...arr].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
      default:
        return [...arr].sort(
          (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)
        );
    }
  }

  const debounceRef = useRef(0);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPage(1, false), 250);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, sort]);

  useEffect(() => {
    fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = useMemo(() => "All Games", []);

  return (
    <div className="catalog container">
      <div className="catalog__head">
        <h1 className="catalog__title">{title}</h1>
        <p className="catalog__sub">
          Discover and share indie games from the community.
        </p>
      </div>

      {/* Filter bar (sticky) */}
      <div className="filter-bar" role="search">
        <div className="filter__search">
          <span className="search-ico">🔎</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title / description / category…"
          />
        </div>

        <div className="filter__cat">
          <FancyCategorySelect value={category} onChange={setCategory} label="" />
        </div>

        <div className="filter__sort">
          <select
            className="select-capsule"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort"
          >
            <option value="latest">Newest</option>
            <option value="popular">Most played</option>
            <option value="az">A–Z</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid-cards-lg">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card game-card game-card--skel">
              <div className="cover skel" />
              <div className="meta">
                <div className="skel skel-line" />
                <div className="skel skel-line small" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty glass-lg">
          <div>😶 No games found.</div>
          <button className="btn btn--primary" onClick={() => nav("/upload")}>
            Upload your first game
          </button>
        </div>
      ) : (
        <>
          <div className="grid-cards-lg">
            {items.map((g) => {
              const cover = cdn(
                g.coverUrl ||
                  (Array.isArray(g.screens) && g.screens[0]) ||
                  "/no-cover.png"
              );
              return (
                <article
                  key={g._id}
                  className="card game-card"
                  onClick={() => nav(`/games/${g._id}`)}
                  title={g.title}
                >
                  <div
                    className="cover"
                    style={{ backgroundImage: `url(${cover})` }}
                  />
                  <div className="meta">
                    <h3 className="title">{g.title}</h3>
                    <p className="muted">
                      {g.category || "all"} • {g.plays ?? 0} plays
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          {hasMore && (
            <div className="loadmore-wrap">
              <button
                className="cmd-btn cmd-btn--outline"
                disabled={moreLoading}
                onClick={() => fetchPage(page + 1, true)}
              >
                {moreLoading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
