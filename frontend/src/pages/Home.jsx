// frontend/src/pages/Home.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import FancyCategorySelect from "../components/FancyCategorySelect";
import { cdn } from "../api/cdn";

export default function Home({ onLoginClick, onRegisterClick }) {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // โหลดรายการ Featured & Latest หน้าแรก (ไม่ใช่ผลค้นหา)
  const fetchFeatured = async () => {
    try {
      setLoading(true);
      // อยากกรองตามหมวดที่เลือกบนหน้าแรกก็ได้
      const params = { all: 1 };
      if (category !== "all") params.category = category;
      const { data } = await api.get(`/games`, { params });
      setGames(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatured();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ไปหน้า /search พร้อมพารามิเตอร์
  const goSearch = (kw = q, cat = category) => {
    const sp = new URLSearchParams();
    if (kw && kw.trim()) sp.set("q", kw.trim());
    if (cat && cat !== "all") sp.set("category", cat);
    nav(`/search?${sp.toString()}`);
  };

  return (
    <>
      <section className="hero-neo">
        <div className="container hero-neo__inner">
          <div className="hero-neo__badge">🎮 Welcome to GPX</div>
          <h1 className="hero-neo__title">
            Discover, Play, and <span className="tx-gradient">Share Indie Games</span>
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
            <button
              className="cmdseg cmd-btn cmd-btn--outline"
              onClick={() => nav("/upload")}
            >
              Upload
            </button>
          </div>

          <div className="pill-row" style={{ justifyContent: "center" }}>
            {["เกมใหม่", "กำลังมาเเรง", "เกมยอดนิยม"].map((t) => (
              <button key={t} className="pill" onClick={() => goSearch()}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="hero-neo__blob hero-neo__blob--left" />
        <div className="hero-neo__blob hero-neo__blob--right" />
        <div className="hero-neo__grid" />
        <div className="shine" />
      </section>

      <section className="section container">
        <div className="section__head">
          <h2 className="section__title">Featured & Latest</h2>
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
                g.coverUrl ||
                  (Array.isArray(g.screens) && g.screens[0]) ||
                  "/no-cover.png"
              );
              return (
                <article
                  key={g._id}
                  className="card game-card"
                  onClick={() => nav(`/games/${g._id}`)}
                >
                  <div className="cover" style={{ backgroundImage: `url(${cover})` }} />
                  <div className="meta">
                    <h3 className="title">{g.title}</h3>
                    <p className="muted">
                      {g.category} · by {g?.uploader?.username || "?"}
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
            <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </>
  );
}
