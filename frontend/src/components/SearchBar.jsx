// frontend/src/components/SearchBar.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SearchBar({ q, onQChange, category, onCategory }) {
  const nav = useNavigate();
  const [kw, setKw] = useState(q || "");
  const [cat, setCat] = useState(category || "all");

  // sync เมื่อ parent เปลี่ยน
  useEffect(() => { setKw(q || ""); }, [q]);
  useEffect(() => { setCat(category || "all"); }, [category]);

  const go = () => {
    // ถ้าหน้าปัจจุบันส่ง handler มา ให้เด้งค่ากลับให้ parent จัดการ
    if (onQChange || onCategory) {
      onQChange && onQChange(kw);
      onCategory && onCategory(cat);
      return;
    }
    // default: ไปหน้า /search พร้อมพารามิเตอร์
    const p = new URLSearchParams();
    if (kw.trim()) p.set("q", kw.trim());
    if (cat && cat !== "all") p.set("category", cat);
    nav(`/search?${p.toString()}`);
  };

  const onKey = (e) => e.key === "Enter" && go();

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <input
        className="input md:col-span-3"
        placeholder="Search title / description / category…"
        value={kw}
        onChange={(e) => setKw(e.target.value)}
        onKeyDown={onKey}
      />
      <div className="flex gap-2 md:col-span-1">
        <select
          className="select flex-1"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="all">All</option>
          <option value="Puzzle">Puzzle</option>
          <option value="RPG">RPG</option>
          <option value="Action">Action</option>
          <option value="Platformer">Platformer</option>
        </select>
        <button className="btn btn-primary" onClick={go}>Search</button>
      </div>
    </div>
  );
}
