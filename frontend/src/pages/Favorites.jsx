import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";

export default function Favorites() {
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/users/me/favorites");
        setList(data || []);
      } catch (e) {
        console.error("load favorites failed", e);
        setList([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="container section">
      <h1>My Favorites</h1>

      {loading ? (
        <div className="grid-cards">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card game-card game-card--skel">
              <div className="cover skel" />
              <div className="meta">
                <div className="skel skel-line" />
                <div className="skel skel-line small" />
              </div>
            </div>
          ))}
        </div>
      ) : (list || []).length === 0 ? (
        <div className="empty glass-lg">ยังไม่มีเกมที่บันทึก</div>
      ) : (
        <div className="grid-cards">
          {list.map((g) => {
            const cover = cdn(g.coverUrl || (g.screens?.[0]) || "/no-cover.png");
            return (
              <article key={g._id} className="card game-card" onClick={() => nav(`/games/${g._id}`)}>
                <div className="cover" style={{ backgroundImage: `url(${cover})` }} />
                <div className="meta">
                  <h3 className="title">{g.title}</h3>
                  <p className="muted">{g.category} · by {g?.uploader?.username || "?"}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
