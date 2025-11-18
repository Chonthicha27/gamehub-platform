import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "./categories";

/**
 * CategorySelect
 * props:
 *  - value (string)    : id ของหมวดหมู่ (เช่น 'all','racing',...)
 *  - onChange (id)     : callback ส่ง id กลับ
 *  - placeholder (str) : ข้อความเวลายังไม่เลือก (ถ้าอยากใช้)
 *  - className (str)   : เติมคลาสนอกได้
 */
export default function CategorySelect({ value = "all", onChange, placeholder, className = "" }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const current = CATEGORIES.find((c) => c.id === value) || CATEGORIES[0];

  useEffect(() => {
    const onClickOutside = (e) => {
      if (!open) return;
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        popRef.current && !popRef.current.contains(e.target)
      ) setOpen(false);
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <>
      <style>{`
        .catsel { position:relative; }
        .catsel-btn{
          width: 220px; height: 40px; padding: 0 14px;
          display:flex; align-items:center; justify-content:space-between; gap:10px;
          border-radius:12px; background: rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.18); color:#e8edf2; cursor:pointer;
          transition:.2s; outline:none;
        }
        .catsel-btn:hover{ box-shadow:0 10px 24px rgba(0,0,0,.25); transform: translateY(-1px); }
        .catsel-badge{
          display:inline-flex; align-items:center; gap:8px; font-weight:700;
        }
        .catsel-pop{
          position:absolute; top:46px; left:0; z-index:50;
          width: 280px; max-height: 320px; overflow:auto;
          background: rgba(12,14,18,.98);
          border:1px solid rgba(255,255,255,.12); border-radius:14px;
          box-shadow:0 30px 80px rgba(0,0,0,.4);
        }
        .catsel-item{
          display:flex; align-items:center; gap:10px;
          padding:10px 12px; cursor:pointer; transition:.15s;
          border-bottom:1px solid rgba(255,255,255,.06);
        }
        .catsel-item:last-child{ border-bottom:0 }
        .catsel-item:hover{ background: rgba(255,255,255,.06) }
        .catsel-dot{
          width:10px; height:10px; border-radius:999px; flex:0 0 10px;
          box-shadow:0 0 0 2px rgba(255,255,255,.15) inset;
        }
        .catsel-emoji{ font-size:16px; width:22px; text-align:center }
        .catsel-label{ color:#dfe7ee; font-weight:600 }
      `}</style>

      <div className={`catsel ${className}`}>
        <button ref={btnRef} type="button" className="catsel-btn" onClick={() => setOpen((v) => !v)}>
          <span className="catsel-badge">
            <span className="catsel-emoji">{current.emoji}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span
                className="catsel-dot"
                style={{ background: current.color }}
              />
              {current.label}
            </span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M7 10l5 5 5-5z" />
          </svg>
        </button>

        {open && (
          <div ref={popRef} className="catsel-pop">
            {CATEGORIES.map((c) => (
              <div
                key={c.id}
                className="catsel-item"
                onClick={() => {
                  onChange?.(c.id);
                  setOpen(false);
                }}
              >
                <span className="catsel-emoji">{c.emoji}</span>
                <span className="catsel-dot" style={{ background: c.color }} />
                <span className="catsel-label">{c.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
