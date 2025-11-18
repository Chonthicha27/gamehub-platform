import { useEffect, useState } from "react";
import api from "../api/axios";
import { cdn } from "../api/cdn";

export default function RateReviewModal({ game, open, onClose, onUpdated, authed }) {
  const [score, setScore] = useState(0);
  const [text, setText]   = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await api.get(`/games/${game._id}/reviews/me`);
        setScore(r.data.score || 0);
        setText(r.data.text || "");
      } catch {}
    })();
  }, [open, game?._id]);

  const submit = async () => {
    if (!authed) { alert("กรุณาเข้าสู่ระบบเพื่อให้คะแนน/รีวิว"); return; }
    if (!(score >= 1 && score <= 5)) { alert("เลือกคะแนน 1–5 ดาวก่อน"); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await api.put(`/games/${game._id}/reviews`, { score, text }, { withCredentials: true, headers });
      onUpdated?.(r.data); // ใช้รีเฟรชหัวสรุปคะแนนได้
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
      >★</button>
    );
  };

  // toolbar มาร์กดาวน์เบาๆ
  const wrap = (pre, post = pre) => {
    const ta = document.getElementById("rv-text");
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const before = text.slice(0, start), mid = text.slice(start, end), after = text.slice(end);
    setText(before + pre + mid + post + after);
    setTimeout(() => { ta.focus(); ta.selectionStart = start + pre.length; ta.selectionEnd = end + pre.length; }, 0);
  };

  if (!open) return null;

  return (
    <div className="rv-overlay" onMouseDown={onClose}>
      <div className="rv-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="rv-head">
          <div className="rv-title">Rate & Review “{game.title}”</div>
          <button className="rv-x" onClick={onClose}>×</button>
        </div>

        <div className="rv-body">
          <div className="rv-stars">
            <span>Choose a rating from 1 to 5 stars.</span>
            <div className="stars">{[1,2,3,4,5].map(i => <Star key={i} i={i} />)}</div>
          </div>

          <div className="rv-label">Your review</div>
          <div className="rv-help">Share what you liked or disliked about this project.</div>

          <div className="rv-toolbar">
            <button onClick={() => wrap("**","**")} title="Bold">B</button>
            <button onClick={() => wrap("_","_")} title="Italic">/</button>
            <button onClick={() => wrap("\n- ")} title="Bullet">•</button>
            <button onClick={() => wrap("\n1. ")} title="Numbered">1.</button>
            <button onClick={() => wrap("[", "](https://)") } title="Link">🔗</button>
            <button onClick={() => wrap("`","`")} title="Inline code">{"</>"}</button>
          </div>

          <textarea id="rv-text" className="rv-text" rows={7}
            placeholder="Optional"
            value={text}
            onChange={(e)=>setText(e.target.value)}
          />

          <div className="rv-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
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
.rv-stars{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0 14px}
.stars{display:flex;gap:6px}
.star{font-size:28px;background:transparent;border:none;color:#6f7e8d;cursor:pointer}
.star.on{color:#ffd055;text-shadow:0 0 12px rgba(255,208,85,.35)}
.rv-label{font-weight:600;margin-top:6px}
.rv-help{color:#9fb4c8;font-size:12px;margin-bottom:6px}

.rv-toolbar{display:flex;gap:8px;margin:8px 0}
.rv-toolbar button{border:1px solid var(--stroke);background:rgba(255,255,255,.05);color:#dfe7ee;border-radius:8px;padding:4px 8px;cursor:pointer}
.rv-text{width:100%;border:1px solid var(--stroke);background:rgba(255,255,255,.04);color:var(--text);border-radius:10px;padding:10px;resize:vertical}

.rv-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:12px}
.btn{appearance:none;border:1px solid var(--stroke);background:var(--glass);color:var(--text);padding:10px 14px;border-radius:12px;cursor:pointer}
.btn-primary{border:none;background:linear-gradient(135deg,#59e0ff,#35c4ff);color:#041318}
`}</style>
    </div>
  );
}
