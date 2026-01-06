// frontend/src/pages/PreviewGame.jsx
import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const DRAFT_KEY = "gpx_upload_draft";

export default function PreviewGame() {
  const nav = useNavigate();
  const { state } = useLocation();

  const draft = useMemo(() => {
    // 1) from navigate state
    if (state?.draft) return state.draft;

    // 2) fallback: sessionStorage (survive refresh)
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [state]);

  // ✅ ถ้ามี draft ให้พาไปหน้า /games/draft อัตโนมัติ
  useEffect(() => {
    if (!draft) return;
    // หน่วงนิดเดียวให้ปุ่ม/หน้าจอ render ทัน (จะเป็น 0 ก็ได้)
    const t = setTimeout(() => {
      nav("/games/draft", { replace: true, state: { draft } });
    }, 50);
    return () => clearTimeout(t);
  }, [draft, nav]);

  // ไม่มี draft -> กลับไปหน้า upload
  if (!draft) {
    return (
      <div className="container section">
        <div className="banner">No draft data. Please go back to Upload page.</div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/upload")}>
            Upload page
          </button>
          <button className="btn btn-primary" onClick={() => nav(-1)}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // ✅ มี draft แล้ว แสดงปุ่ม “กลับไปแก้ไข” / “ไปหน้าอัปโหลด”
  // (ปุ่มนี้จะเห็นแค่แว้บเดียวก่อน redirect — ปุ่มจริงควรไปอยู่ที่ /games/draft)
  return (
    <div className="container section">
      <div className="banner">
        Opening preview…
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          Tip: If it doesn’t redirect, use the buttons below.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          className="btn"
          onClick={() => nav("/upload")}
          title="Back to upload/edit form"
        >
          Upload page
        </button>

        <button
          className="btn btn-primary"
          onClick={() => nav("/games/draft", { state: { draft } })}
          title="Open draft preview"
        >
          Open preview
        </button>
      </div>
    </div>
  );
}
