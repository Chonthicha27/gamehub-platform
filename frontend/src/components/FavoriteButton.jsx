// frontend/src/components/FavoriteButton.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";

/** Toggle Favorites */
export default function FavoriteButton({ gameId, authed, initialFavorited }) {
  const [saving, setSaving] = useState(false);
  const [fav, setFav] = useState(!!initialFavorited);

  useEffect(() => {
    setFav(!!initialFavorited);
  }, [initialFavorited]);

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

  const titleText = !authed
    ? "Log in to use Favorites"
    : fav
    ? "Remove from Favorites"
    : "Add to Favorites";

  return (
    <button
      className={`pfx-chip ${fav ? "pfx-chip--primary" : ""}`}
      onClick={toggle}
      disabled={!authed || saving}
      title={titleText}
      aria-pressed={fav}
      aria-label={fav ? "Remove from Favorites" : "Add to Favorites"}
      type="button"
    >
      {fav ? "★ In Favorites" : "☆ Add to Favorites"}
    </button>
  );
}
