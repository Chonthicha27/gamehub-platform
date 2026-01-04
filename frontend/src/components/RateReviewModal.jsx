import { useEffect, useState } from "react";
import api from "../api/axios";
import { cdn } from "../api/cdn";

export default function RateReviewModal({ game, open, onClose, onUpdated, authed }) {
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await api.get(`/games/${game._id}/reviews/me`);
        setScore(r.data.score || 0);
      } catch {
        setScore(0);
      }
    })();
  }, [open, game?._id]);

  const submit = async () => {
    if (!authed) {
      alert("กรุณาเข้าสู่ระบบเพื่อให้คะแนน");
      return;
    }
    if (!(score >= 1 && score <= 5)) {
      alert("เลือกคะแนน 1–5 ดาวก่อน");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // ✅ ส่งเฉพาะคะแนนอย่างเดียว
      const r = await api.put(
        `/games/${game._id}/reviews`,
        { score },
        { withCredentials: true, headers }
      );

      onUpdated?.(r.data); // รีเฟรชสรุปคะแนนได้
      onClose();
    } catch (e) {
      alert(e?.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const Star = ({ i }) => {
    const filled = (score || 0) >= i;
    return (
      <button
        type="button"
        className={`star ${filled ? "on" : ""}`}
        onClick={() => setScore(i)}
        aria-label={`${i} stars`}
        title={`${i} star${i > 1 ? "s" : ""}`}
      >
        ★
      </button>
    );
  };

  if (!open) return null;

  return (
    <div className="rv-overlay" onMouseDown={onClose}>
      <div className="rv-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="rv-head">
          <div className="rv-title">Rate “{game.title}”</div>
          <button className="rv-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="rv-body">
          <div className="rv-stars">
            <span>Choose a rating from 1 to 5 stars.</span>
            <div className="stars">{[1, 2, 3, 4, 5].map((i) => <Star key={i} i={i} />)}</div>
          </div>

          <div className="rv-help">
            Want to say more? Leave a comment in the <b>Comments</b> tab.
          </div>

          <div className="rv-actions">
            <button className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Submit"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
.rv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);display:grid;place-items:center;z-index:60}
.rv-modal{width:min(680px,92vw);background:#151922;border:1px solid var(--stroke);border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.6);color:var(--text)}
.rv-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--stroke)}
.rv-title{font-weight:700}
.rv-x{appearance:none;border:none;background:transparent;color:#9fb4c8;font-size:20px;cursor:pointer}

.rv-body{padding:14px 16px}
.rv-stars{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0 10px}
.stars{display:flex;gap:6px}
.star{font-size:28px;background:transparent;border:none;color:#6f7e8d;cursor:pointer}
.star.on{color:#ffd055;text-shadow:0 0 12px rgba(255,208,85,.35)}
.rv-help{color:#9fb4c8;font-size:12px;margin:6px 0 2px;line-height:1.5}

.rv-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:12px}
.btn{appearance:none;border:1px solid var(--stroke);background:var(--glass);color:var(--text);padding:10px 14px;border-radius:12px;cursor:pointer}
.btn:disabled{opacity:.65;cursor:not-allowed}
.btn-primary{border:none;background:linear-gradient(135deg,#59e0ff,#35c4ff);color:#041318}
`}</style>
    </div>
  );
}
