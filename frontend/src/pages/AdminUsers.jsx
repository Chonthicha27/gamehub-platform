import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage]   = useState(1);
  const [limit, setLimit] = useState(20);

  const [search, setSearch] = useState("");
  const [role, setRole]     = useState("");
  const [status, setStatus] = useState("");

  const [busy, setBusy] = useState(false);

  const load = async (p = page) => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const r = await api.get("/admin/users", {
      params: { search, role, status, page: p, limit },
      headers, withCredentials: true
    });
    setItems(r.data.items || []);
    setTotal(r.data.total || 0);
    setPage(r.data.page || 1);
  };

  useEffect(() => { load(1); /* on mount */ }, []);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const updateRole = async (id, newRole) => {
    setBusy(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.patch(`/admin/users/${id}/role`, { role: newRole }, { headers, withCredentials: true });
      await load(page);
    } finally { setBusy(false); }
  };

  const suspend = async (id) => {
    const reason = prompt("เหตุผลในการระงับ (optional)", "");
    const until  = prompt("ระงับถึงวันที่ (ISO หรือเว้นว่างเพื่อถาวร)", "");
    setBusy(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.post(`/admin/users/${id}/suspend`, { reason, until: until || null }, { headers, withCredentials: true });
      await load(page);
    } finally { setBusy(false); }
  };

  const unsuspend = async (id) => {
    setBusy(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.post(`/admin/users/${id}/unsuspend`, {}, { headers, withCredentials: true });
      await load(page);
    } finally { setBusy(false); }
  };

  return (
    <div className="container section">
      <StyleLocal />
      <h1>Admin • Users</h1>

      <div className="toolbar">
        <input className="input" placeholder="ค้นหา username/email…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="input" value={role} onChange={e=>setRole(e.target.value)}>
          <option value="">ทุกสิทธิ์</option>
          <option value="user">user</option>
          <option value="moderator">moderator</option>
          <option value="admin">admin</option>
        </select>
        <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
        </select>
        <button className="btn" onClick={()=>load(1)} disabled={busy}>ค้นหา</button>
      </div>

      <div className="table">
        <div className="thead">
          <div>ผู้ใช้</div><div>อีเมล</div><div>สิทธิ์</div><div>สถานะ</div><div>ดำเนินการ</div>
        </div>
        {items.map(u=>(
          <div key={u._id} className="trow">
            <div>{u.username}</div>
            <div className="muted">{u.email}</div>
            <div>
              <select value={u.role} onChange={e=>updateRole(u._id, e.target.value)} disabled={busy}>
                <option value="user">user</option>
                <option value="moderator">moderator</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              {u.status === "suspended"
                ? <span className="chip danger">suspended</span>
                : <span className="chip">active</span>}
            </div>
            <div className="actions">
              {u.status === "suspended"
                ? <button className="btn" onClick={()=>unsuspend(u._id)} disabled={busy}>ปลดระงับ</button>
                : <button className="btn btn-warn" onClick={()=>suspend(u._id)} disabled={busy}>ระงับ</button>}
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="empty">ไม่พบผู้ใช้</div>}
      </div>

      <div className="pager">
        <button className="btn" onClick={()=> load(Math.max(1, page-1))} disabled={page<=1 || busy}>Prev</button>
        <span>Page {page}/{totalPages}</span>
        <button className="btn" onClick={()=> load(Math.min(totalPages, page+1))} disabled={page>=totalPages || busy}>Next</button>
      </div>
    </div>
  );
}

function StyleLocal(){return(<style>{`
.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.input{padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:rgba(255,255,255,.05);color:var(--text)}
.table{border:1px solid var(--stroke);border-radius:12px;overflow:hidden}
.thead,.trow{display:grid;grid-template-columns:1.2fr 1.6fr .8fr .8fr 1.2fr;gap:8px;align-items:center}
.thead{background:rgba(255,255,255,.06);padding:10px 12px;font-weight:600}
.trow{padding:10px 12px;border-top:1px solid var(--stroke)}
.actions{display:flex;gap:8px}
.chip{font-size:12px;padding:4px 8px;border:1px solid var(--stroke);border-radius:999px}
.chip.danger{background:rgba(255,0,0,.07);border-color:#ff6b6b;color:#ff8a8a}
.btn{appearance:none;border:1px solid var(--stroke);background:var(--glass);color:var(--text);padding:8px 12px;border-radius:10px;cursor:pointer}
.btn-warn{border-color:#ffb347}
.pager{display:flex;align-items:center;gap:10px;margin-top:10px}
.empty{padding:16px;text-align:center;color:#9fb4c8}
`}</style>);}
