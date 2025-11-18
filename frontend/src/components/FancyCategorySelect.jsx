import { useMemo, useState, useEffect, useRef } from "react";

/** ชุดหมวดหมู่หลัก (ใช้ filter / search) */
const CATEGORIES = [
  { id: "all",           name: "All genres",     emoji: "🎮", color: "#7dd3fc" },

  { id: "action",        name: "Action",         emoji: "🗡️", color: "#f97373" },
  { id: "adventure",     name: "Adventure",      emoji: "🧭",  color: "#38bdf8" },
  { id: "card-game",     name: "Card Game",      emoji: "🃏",  color: "#fb7185" },
  { id: "educational",   name: "Educational",    emoji: "📚",  color: "#4ade80" },
  { id: "fighting",      name: "Fighting",       emoji: "⚔️",  color: "#f97316" },
  { id: "interactive-fiction", name: "Interactive Fiction", emoji: "📖", color: "#a855f7" },
  { id: "platformer",    name: "Platformer",     emoji: "🕹️", color: "#22c55e" },
  { id: "puzzle",        name: "Puzzle",         emoji: "🧩",  color: "#60a5fa" },
  { id: "racing",        name: "Racing",         emoji: "🏎️",  color: "#facc15" },
  { id: "rhythm",        name: "Rhythm",         emoji: "🎵",  color: "#f472b6" },
  { id: "role-playing",  name: "Role Playing",   emoji: "🧙‍♂️", color: "#0ea5e9" },
  { id: "shooter",       name: "Shooter",        emoji: "🎯",  color: "#fb923c" },
  { id: "simulation",    name: "Simulation",     emoji: "🏡",  color: "#34d399" },
  { id: "sports",        name: "Sports",         emoji: "🏀",  color: "#a3e635" },
  { id: "strategy",      name: "Strategy",       emoji: "♟️",  color: "#22d3ee" },
  { id: "survival",      name: "Survival",       emoji: "🪓",  color: "#f97373" },
  { id: "visual-novel",  name: "Visual Novel",   emoji: "💬",  color: "#c4b5fd" },
  { id: "other",         name: "Other",          emoji: "✨",  color: "#9ca3af" },
];

/**
 * FancyCategorySelect
 * props:
 *  - value: string (id)
 *  - onChange: (id) => void
 *  - label?: string
 *  - width?: number (px)
 */
export default function FancyCategorySelect({ value = "all", onChange, label = "หมวดหมู่", width = 240 }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const current = useMemo(
    () => CATEGORIES.find((c) => c.id === value) || CATEGORIES[0],
    [value]
  );

  // ปิดเมื่อคลิกนอก
  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="fancy-cat" ref={wrapRef} style={{ width }}>
      <FCStyle />

      {label && <div className="fc-label">{label}</div>}

      <button
        type="button"
        className={`fc-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ borderColor: current.color }}
      >
        <span className="fc-dot" style={{ background: current.color }} />
        <span className="fc-emoji">{current.emoji}</span>
        <span className="fc-name">{current.name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" className="fc-caret">
          <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>

      {open && (
        <div className="fc-pop" role="listbox" tabIndex={-1}>
          {CATEGORIES.map((c) => (
            <div
              key={c.id}
              role="option"
              aria-selected={c.id === value}
              className={`fc-item ${c.id === value ? "is-active" : ""}`}
              onClick={() => {
                onChange?.(c.id);
                setOpen(false);
              }}
            >
              <span className="fc-dot" style={{ background: c.color }} />
              <span className="fc-emoji">{c.emoji}</span>
              <span className="fc-name">{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** style scope ของคอมโพเนนต์ */
function FCStyle() {
  return (
    <style>{`
.fancy-cat{ position:relative; z-index: 50; }
.fc-label{ font-size:12px; color:#bcd3e8; margin:0 0 6px 2px }

.fc-trigger{
  width:100%; height:42px; display:flex; align-items:center; gap:8px;
  padding:0 12px; border-radius:12px; background:rgba(255,255,255,.05);
  border:2px solid var(--stroke); color:var(--text); transition:.15s; justify-content:space-between;
  position:relative; z-index: 51;
}
.fc-trigger:hover{ border-color:#6bd9ff; }
.fc-name{ flex:1; text-align:left; padding-left:4px }
.fc-emoji{ opacity:.95 }
.fc-dot{ width:10px; height:10px; border-radius:999px; box-shadow:0 0 0 2px rgba(255,255,255,.12) inset }
.fc-caret{ opacity:.8; transition:.2s }
.fc-trigger.is-open .fc-caret{ transform: rotate(180deg) }

.fc-pop{
  position:absolute; z-index: 9999;
  top: calc(100% + 6px); left:0; right:0;
  background:#0d1014; border:1px solid var(--stroke); border-radius:12px;
  box-shadow: var(--shadow); max-height:340px; overflow:auto;
}
.fc-item{
  display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer;
}
.fc-item:hover{ background:rgba(255,255,255,.06) }
.fc-item.is-active{ background:rgba(72,208,255,.11); border-left:3px solid #59e0ff }
`}</style>
  );
}
