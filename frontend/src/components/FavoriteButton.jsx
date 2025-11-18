import { useEffect, useState } from "react";
import api from "../api/axios";

/** ปุ่ม Toggle Favorite */
export default function FavoriteButton({ gameId, authed, initialFavorited }) {
  const [saving, setSaving] = useState(false);
  const [fav, setFav] = useState(!!initialFavorited);

  useEffect(() => { setFav(!!initialFavorited); }, [initialFavorited]);

  const toggle = async () => {
    if (!authed || !gameId || saving) return;
    setSaving(true);
    try {
      if (fav) {
        await api.delete(`/users/me/favorites/${gameId}`);
        setFav(false);
      } else {
        await api.post(`/users/me/favorites/${gameId}`);
        setFav(true);
      }
    } catch (e) {
      console.error("favorite toggle failed", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      className={`pfx-chip ${fav ? "pfx-chip--primary" : ""}`}
      onClick={toggle}
      disabled={!authed || saving}
      title={authed ? (fav ? "Remove from favorites" : "Save to favorites") : "Log in to use favorites"}
    >
      {fav ? "★ Favorited" : "☆ Save"}
    </button>
  );
}
