// frontend/src/pages/OAuthFinish.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function OAuthFinish({ onAuthed }) {
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        onAuthed?.(data);
        nav("/profile");
      } catch {
        nav("/");
      }
    })();
  }, [nav, onAuthed]);

  return null;
}
