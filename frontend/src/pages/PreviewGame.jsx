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

  // ✅ ปลายทาง "กลับไปแก้" (มาจาก edit จะมี backTo)
  const backTo = useMemo(() => {
    const v = draft?.backTo;
    return typeof v === "string" && v.trim() ? v.trim() : "";
  }, [draft]);

  // ✅ ถ้าไม่มี backTo ให้ fallback เป็นหน้า upload
  const safeBackTo = backTo || "/upload";

  // ✅ ถ้ามี draft ให้พาไปหน้า /games/draft อัตโนมัติ
  useEffect(() => {
    if (!draft) return;

    // ✅ สร้าง backTo ที่ถูกต้อง (มาจาก state ก่อน -> draft -> inference -> upload)
    const backToResolved =
      state?.backTo ||
      draft?.backTo ||
      (draft?.fromEdit && draft?.gameId ? `/games/${draft.gameId}/edit` : "/upload");

    // ✅ ensure we persist draft (including backTo) for refresh
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ ...draft, backTo: backToResolved })
      );
    } catch {}

    const t = setTimeout(() => {
      // ✅ ส่ง backTo ไปด้วยตอน redirect
      nav("/games/draft", {
        replace: true,
        state: { draft: { ...draft, backTo: backToResolved }, backTo: backToResolved },
      });
    }, 50);

    return () => clearTimeout(t);
  }, [draft, nav, state]); // ✅ เพิ่ม state

  // ไม่มี draft -> กลับไปหน้าที่เหมาะสม
  if (!draft) {
    return (
      <div className="container section">
        <div className="banner">No draft data. Please go back.</div>

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

  // ✅ มี draft แล้ว แสดงปุ่มเผื่อ redirect ไม่ทำงาน
  return (
    <div className="container section">
      <div className="banner">
        Opening preview…
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          Tip: If it doesn’t redirect, use the buttons below.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        {/* ✅ ปุ่มกลับ: ถ้ามาจาก edit จะกลับไป edit, ถ้าไม่ใช่จะกลับ upload */}
        <button
          className="btn"
          onClick={() => nav(safeBackTo)}
          title="Back to where you came from"
        >
          Back to edit
        </button>

        {/* เผื่ออยากกลับ upload ตรงๆ */}
        <button className="btn" onClick={() => nav("/upload")} title="Go to Upload page">
          Upload page
        </button>

        <button
          className="btn btn-primary"
          onClick={() => {
            const backToResolved =
              state?.backTo ||
              draft?.backTo ||
              (draft?.fromEdit && draft?.gameId ? `/games/${draft.gameId}/edit` : "/upload");

            nav("/games/draft", {
              state: { draft: { ...draft, backTo: backToResolved }, backTo: backToResolved },
            });
          }}
          title="Open draft preview"
        >
          Open preview
        </button>
      </div>
    </div>
  );
}
