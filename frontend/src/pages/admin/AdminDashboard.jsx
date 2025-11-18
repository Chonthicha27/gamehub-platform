// frontend/src/pages/admin/AdminDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import "./admin.css";

/* ให้มีสี chip ครบ รวมถึง blue */
function Chip({ children, tone = "gray" }) {
  const map = {
    gray: "chip-gray",
    green: "chip-green",
    blue: "chip-blue",
    purple: "chip-purple",
    red: "chip-red",
    amber: "chip-amber",
  };
  return <span className={`chip ${map[tone] || map.gray}`}>{children}</span>;
}

/* อวาตาร์ตัวอักษร */
const initials = (name = "") =>
  name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0] || "")
    .join("")
    .toUpperCase();

/* Toolbar ด้านบน + tabs */
function Toolbar({ tab, setTab, search, setSearch, refresh, counts }) {
  const placeholder =
    tab === "users"
      ? "Search users…"
      : tab === "games"
      ? "Search games…"
      : tab === "pending"
      ? "Search pending games…"
      : tab === "comments"
      ? "Search comments…"
      : "Search monthly votes…";

  return (
    <div className="admin-toolbar glass">
      <div className="tabs">
        <button
          className={`tab ${tab === "users" ? "active" : ""}`}
          onClick={() => setTab("users")}
        >
          <span className="tab-dot" /> Users{" "}
          <span className="counter">{counts.users}</span>
        </button>
        <button
          className={`tab ${tab === "games" ? "active" : ""}`}
          onClick={() => setTab("games")}
        >
          <span className="tab-dot" /> Games{" "}
          <span className="counter">{counts.games}</span>
        </button>
        <button
          className={`tab ${tab === "pending" ? "active" : ""}`}
          onClick={() => setTab("pending")}
        >
          <span className="tab-dot" /> Pending{" "}
          <span className="counter">{counts.pending}</span>
        </button>
        <button
          className={`tab ${tab === "comments" ? "active" : ""}`}
          onClick={() => setTab("comments")}
        >
          <span className="tab-dot" /> Comments{" "}
          <span className="counter">{counts.comments}</span>
        </button>
        <button
          className={`tab ${tab === "monthly" ? "active" : ""}`}
          onClick={() => setTab("monthly")}
        >
          <span className="tab-dot" /> Monthly Vote{" "}
          <span className="counter">{counts.monthly}</span>
        </button>
      </div>

      <div className="right">
        <div className="search-wrap">
          <input
            className="search"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn primary soft" onClick={refresh}>
          Refresh
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("users");

  const [users, setUsers] = useState([]);
  const [games, setGames] = useState([]);
  const [pendingGames, setPendingGames] = useState([]); // visibility = review
  const [comments, setComments] = useState([]); // ความคิดเห็นทั้งหมด

  // ===== Monthly vote state =====
  const [monthlyMonth, setMonthlyMonth] = useState(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${m}`; // YYYY-MM
  });
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState([]);

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const token = localStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  /** โหลด users + games + pending games + comments */
  const refreshCore = async () => {
    setLoading(true);
    try {
      const [u, g, p, c] = await Promise.all([
        api.get("/admin/users", { withCredentials: true, headers }),
        api.get("/admin/games", { withCredentials: true, headers }),
        api.get("/admin/games/pending", { withCredentials: true, headers }),
        api.get("/admin/comments", { withCredentials: true, headers }),
      ]);
      setUsers(u.data || []);
      setGames(g.data || []);
      setPendingGames(p.data || []);
      setComments(c.data || []);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  /** โหลด leaderboard โหวตเกมประจำเดือน */
  const fetchMonthlyLeaderboard = async (overrideMonth) => {
    const month = overrideMonth || monthlyMonth;
    if (!month) return;
    setLoading(true);
    try {
      const res = await api.get("/monthly-vote/leaderboard", {
        params: { month },
      });
      setMonthlyLeaderboard(res.data || []);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  // month label สวย ๆ เช่น November 2025
  const monthlyLabel = useMemo(() => {
    if (!monthlyMonth) return "-";
    try {
      const d = new Date(`${monthlyMonth}-01T00:00:00`);
      if (Number.isNaN(d.getTime())) return monthlyMonth;
      return d.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return monthlyMonth;
    }
  }, [monthlyMonth]);

  // refresh หลักตอนเปิดหน้า (users/games/pending/comments)
  useEffect(() => {
    refreshCore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ถ้าเปลี่ยน tab ไป monthly ครั้งแรก ให้โหลด leaderboard ด้วย
  useEffect(() => {
    if (tab === "monthly") {
      fetchMonthlyLeaderboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /** ปุ่ม Refresh ด้านบน — ถ้าอยู่ tab monthly ให้ refresh leaderboard แทน */
  const handleRefresh = () => {
    if (tab === "monthly") {
      fetchMonthlyLeaderboard();
    } else {
      refreshCore();
    }
  };

  /* ====== Actions: Users ====== */
  const setRole = async (id, role) => {
    const r = await api.patch(
      `/admin/users/${id}`,
      { role },
      { withCredentials: true, headers }
    );
    setUsers((xs) => xs.map((u) => (u._id === id ? r.data : u)));
  };

  const suspend = async (id) => {
    const reason = prompt("เหตุผลระงับการใช้งาน (optional)", "violation");
    if (reason === null) return;
    const daysStr = prompt("จำนวนวันระงับ (default 7)", "7");
    const days = Number(daysStr || 7) || 7;
    const r = await api.patch(
      `/admin/users/${id}`,
      { status: "suspended", reason, days },
      { withCredentials: true, headers }
    );
    setUsers((xs) => xs.map((u) => (u._id === id ? r.data : u)));
  };

  const activate = async (id) => {
    const r = await api.patch(
      `/admin/users/${id}`,
      { status: "active" },
      { withCredentials: true, headers }
    );
    setUsers((xs) => xs.map((u) => (u._id === id ? r.data : u)));
  };

  const delUser = async (id) => {
    if (!confirm("ลบผู้ใช้และเกมทั้งหมดของเขา?")) return;
    await api.delete(`/admin/users/${id}`, {
      withCredentials: true,
      headers,
    });
    setUsers((xs) => xs.filter((u) => u._id !== id));
    refreshCore();
  };

  /* ====== Actions: Games ====== */

  /** ลบ / Reject เกม (ใช้ได้ทั้ง tab games และ tab pending) */
  const delGame = async (game) => {
    const isPending = game.visibility === "review";

    if (
      !confirm(
        isPending
          ? `ไม่อนุมัติเกม "${game.title}" และลบออกจากระบบหรือไม่?`
          : `ลบเกม "${game.title}" ออกจากระบบหรือไม่?`
      )
    )
      return;

    try {
      let url = `/admin/games/${game._id}`;

      if (isPending) {
        const reason = prompt(
          "ระบุเหตุผลที่เกมไม่ผ่านการอนุมัติ (ข้อความนี้จะแนบไปในอีเมลถึงผู้พัฒนาเกม)",
          ""
        );
        if (reason === null) return;
        const encoded = encodeURIComponent(reason);
        url += `?reason=${encoded}`;
      }

      await api.delete(url, {
        withCredentials: true,
        headers,
      });

      setGames((xs) => xs.filter((g) => g._id !== game._id));
      setPendingGames((xs) => xs.filter((g) => g._id !== game._id));

      alert(
        isPending
          ? 'เกมถูก "Reject / Delete" แล้ว และมีการส่งอีเมลแจ้งเจ้าของเกม (ถ้าระบุอีเมลไว้).'
          : "ลบเกมเรียบร้อยแล้ว และมีการส่งอีเมลแจ้งเจ้าของเกม (ถ้าระบุอีเมลไว้)."
      );
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  /** ระงับเกม */
  const suspendGame = async (game) => {
    const reason = prompt(
      "ระบุเหตุผลที่ต้องระงับเกมนี้ (จะแนบในอีเมลถึงผู้พัฒนาเกม)",
      ""
    );
    if (reason === null) return;

    try {
      const res = await api.patch(
        `/admin/games/${game._id}/suspend`,
        { reason },
        { withCredentials: true, headers }
      );
      const updated = res.data.game || res.data;
      setGames((xs) => xs.map((g) => (g._id === game._id ? updated : g)));
      alert(
        "ระงับเกมเรียบร้อยแล้ว และมีการส่งอีเมลแจ้งเจ้าของเกม (ถ้าระบุอีเมลไว้)."
      );
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  /** ปลดระงับเกม */
  const unsuspendGame = async (game) => {
    if (!confirm("ปลดระงับเกมนี้และทำให้กลับมาออนไลน์อีกครั้งหรือไม่?"))
      return;

    try {
      const res = await api.patch(
        `/admin/games/${game._id}/unsuspend`,
        {},
        { withCredentials: true, headers }
      );
      const updated = res.data.game || res.data;
      setGames((xs) => xs.map((g) => (g._id === game._id ? updated : g)));
      alert("ปลดระงับเกมเรียบร้อยแล้ว");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  /** อนุมัติเกม (เปลี่ยน review -> public) */
  const approveGame = async (id) => {
    if (!confirm("อนุมัติเกมนี้เพื่อเผยแพร่สู่สาธารณะ?")) return;
    try {
      const res = await api.patch(
        `/admin/games/${id}/approve`,
        {},
        { withCredentials: true, headers }
      );
      const updated = res.data.game || res.data;

      setPendingGames((xs) => xs.filter((g) => g._id !== id));
      setGames((xs) => {
        const exists = xs.some((g) => g._id === id);
        if (!exists) return [updated, ...xs];
        return xs.map((g) => (g._id === id ? updated : g));
      });

      alert(
        "อนุมัติเกมเรียบร้อยแล้ว และมีการส่งอีเมลแจ้งเจ้าของเกม (ถ้าระบุอีเมลไว้)."
      );
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  /* ====== Actions: Comments ====== */

  const hideComment = async (comment) => {
    const reason = prompt(
      "ระบุเหตุผลที่ต้องซ่อนคอมเมนต์นี้ (ไม่เหมาะสม / ละเมิดนโยบาย ฯลฯ)",
      ""
    );
    if (reason === null) return;

    try {
      const res = await api.patch(
        `/admin/comments/${comment._id}/hide`,
        { reason },
        { withCredentials: true, headers }
      );
      const updated = res.data;
      setComments((xs) =>
        xs.map((c) => (c._id === comment._id ? updated : c))
      );
      alert("ซ่อนคอมเมนต์เรียบร้อยแล้ว");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  const restoreComment = async (comment) => {
    if (!confirm("คืนคอมเมนต์นี้ให้แสดงผลอีกครั้งหรือไม่?")) return;
    try {
      const res = await api.patch(
        `/admin/comments/${comment._id}/restore`,
        {},
        { withCredentials: true, headers }
      );
      const updated = res.data;
      setComments((xs) =>
        xs.map((c) => (c._id === comment._id ? updated : c))
      );
      alert("คืนคอมเมนต์เรียบร้อยแล้ว");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  const deleteComment = async (comment) => {
    if (!confirm("ลบคอมเมนต์นี้ถาวรหรือไม่?")) return;
    try {
      await api.delete(`/admin/comments/${comment._id}`, {
        withCredentials: true,
        headers,
      });
      setComments((xs) => xs.filter((c) => c._id !== comment._id));
      alert("ลบคอมเมนต์เรียบร้อยแล้ว");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  /* ====== Filters ====== */
  const fUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.status?.toLowerCase().includes(q)
    );
  }, [search, users]);

  const fGames = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return games;
    return games.filter(
      (g) =>
        g.title?.toLowerCase().includes(q) ||
        g.uploader?.username?.toLowerCase().includes(q) ||
        g.category?.toLowerCase().includes(q)
    );
  }, [search, games]);

  const fPending = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pendingGames;
    return pendingGames.filter(
      (g) =>
        g.title?.toLowerCase().includes(q) ||
        g.uploader?.username?.toLowerCase().includes(q) ||
        g.category?.toLowerCase().includes(q)
    );
  }, [search, pendingGames]);

  const fComments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter((c) => {
      return (
        c.content?.toLowerCase().includes(q) ||
        c.author?.username?.toLowerCase().includes(q) ||
        c.author?.email?.toLowerCase().includes(q) ||
        c.game?.title?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q)
      );
    });
  }, [search, comments]);

  // ✅ ดันคอมเมนต์ที่โดน report เยอะขึ้นมาก่อน
  const sortedComments = useMemo(() => {
    return [...fComments].sort((a, b) => {
      const ar = a.reportsCount || 0;
      const br = b.reportsCount || 0;
      if (br !== ar) return br - ar; // รายงานเยอะมาก่อน
      return new Date(b.createdAt) - new Date(a.createdAt); // ใหม่ก่อน
    });
  }, [fComments]);

  const counts = {
    users: users.length,
    games: games.length,
    pending: pendingGames.length,
    comments: comments.length,
    monthly: monthlyLeaderboard.length,
  };

  const RoleChip = ({ role }) => (
    <Chip tone={role === "admin" ? "purple" : "gray"}>
      {role === "admin" ? "admin" : "user"}
    </Chip>
  );

  return (
    <div className="admin-wrap">
      <h1 className="admin-title">Admin</h1>

      <Toolbar
        tab={tab}
        setTab={setTab}
        search={search}
        setSearch={setSearch}
        refresh={handleRefresh}
        counts={counts}
      />

      {loading && <div className="loading">Loading…</div>}

      {/* ===== TAB: USERS ===== */}
      {tab === "users" && (
        <div className="card glass">
          <div className="table-wrap">
            <table className="table table-fixed pretty">
              <thead>
                <tr>
                  <th className="col-user">Username</th>
                  <th className="col-email">Email</th>
                  <th className="col-role">Role</th>
                  <th className="col-status">Status</th>
                  <th className="col-actions right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fUsers.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="cell-main">
                        <div className="avatar-circle">
                          {initials(u.username || "U")}
                        </div>
                        <div className="cell-texts">
                          <div className="strong">{u.username}</div>
                          <div className="muted tiny">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="ellipsis">{u.email || "-"}</span>
                    </td>
                    <td>
                      <RoleChip role={u.role} />
                    </td>
                    <td>
                      {u.status === "active" ? (
                        <Chip tone="green">active</Chip>
                      ) : (
                        <Chip tone="red">suspended</Chip>
                      )}
                    </td>
                    <td className="right">
                      <div className="actions">
                        <div className="btn-group compact">
                          <button
                            className="btn ghost"
                            onClick={() => setRole(u._id, "user")}
                          >
                            User
                          </button>
                          <button
                            className="btn ghost"
                            onClick={() => setRole(u._id, "admin")}
                          >
                            Admin
                          </button>
                        </div>
                        {u.status !== "suspended" ? (
                          <button
                            className="btn warn soft"
                            onClick={() => suspend(u._id)}
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            className="btn ok soft"
                            onClick={() => activate(u._id)}
                          >
                            Activate
                          </button>
                        )}
                        <button
                          className="btn danger soft"
                          onClick={() => delUser(u._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {fUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB: GAMES (ทั้งหมด) ===== */}
      {tab === "games" && (
        <div className="card glass">
          <div className="table-wrap">
            <table className="table table-fixed pretty">
              <thead>
                <tr>
                  <th className="col-title">Title</th>
                  <th className="col-uploader">Uploader</th>
                  <th className="col-category">Category</th>
                  <th className="col-status">Visibility</th>
                  <th className="col-created">Created</th>
                  <th className="col-actions right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fGames.map((g) => (
                  <tr key={g._id}>
                    <td>
                      <div className="cell-main">
                        <div
                          className="cover-sm gradient"
                          style={{
                            backgroundImage: g.coverUrl
                              ? `url(${g.coverUrl})`
                              : "none",
                          }}
                        />
                        <div className="cell-texts">
                          <div className="strong">{g.title}</div>
                          <div className="muted tiny ellipsis">{g.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td>{g.uploader?.username || "-"}</td>
                    <td>
                      <Chip tone="amber">{g.category || "all"}</Chip>
                    </td>
                    <td>
                      {g.visibility === "public" && (
                        <Chip tone="green">public</Chip>
                      )}
                      {g.visibility === "review" && (
                        <Chip tone="blue">review</Chip>
                      )}
                      {g.visibility === "suspended" && (
                        <Chip tone="red">suspended</Chip>
                      )}
                    </td>
                    <td className="mono">
                      {new Date(g.createdAt).toLocaleString()}
                    </td>
                    <td className="right">
                      <div className="actions">
                        <a
                          className="btn ghost"
                          href={g.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>

                        {g.visibility === "public" && (
                          <button
                            className="btn warn soft"
                            onClick={() => suspendGame(g)}
                          >
                            Suspend
                          </button>
                        )}

                        {g.visibility === "suspended" && (
                          <button
                            className="btn ok soft"
                            onClick={() => unsuspendGame(g)}
                          >
                            Restore
                          </button>
                        )}

                        <button
                          className="btn danger soft"
                          onClick={() => delGame(g)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {fGames.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      No games found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB: PENDING GAMES (รออนุมัติ) ===== */}
      {tab === "pending" && (
        <div className="card glass">
          <div className="table-wrap">
            <table className="table table-fixed pretty">
              <thead>
                <tr>
                  <th className="col-title">Title</th>
                  <th className="col-uploader">Uploader</th>
                  <th className="col-category">Category</th>
                  <th className="col-created">Uploaded</th>
                  <th className="col-actions right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fPending.map((g) => (
                  <tr key={g._id}>
                    <td>
                      <div className="cell-main">
                        <div
                          className="cover-sm gradient"
                          style={{
                            backgroundImage: g.coverUrl
                              ? `url(${g.coverUrl})`
                              : "none",
                          }}
                        />
                        <div className="cell-texts">
                          <div className="strong">{g.title}</div>
                          <div className="muted tiny ellipsis">{g.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td>{g.uploader?.username || "-"}</td>
                    <td>
                      <Chip tone="amber">{g.category || "all"}</Chip>
                    </td>
                    <td className="mono">
                      {new Date(g.createdAt).toLocaleString()}
                    </td>
                    <td className="right">
                      <div className="actions">
                        <a
                          className="btn ghost"
                          href={g.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                        <button
                          className="btn ok soft"
                          onClick={() => approveGame(g._id)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn danger soft"
                          onClick={() => delGame(g)}
                        >
                          Reject / Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {fPending.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No pending games 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB: COMMENTS ===== */}
      {tab === "comments" && (
        <div className="card glass">
          <div className="table-wrap">
            <table className="table table-fixed pretty">
              <thead>
                <tr>
                  <th style={{ width: "18%" }}>Game</th>
                  <th style={{ width: "18%" }}>Author</th>
                  <th style={{ width: "34%" }}>Comment</th>
                  <th style={{ width: "10%" }}>Status</th>
                  <th style={{ width: "20%" }}>Reports</th>
                  <th style={{ width: "20%" }} className="right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedComments.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <div className="cell-texts">
                        <div className="strong">
                          {c.game?.title || "(deleted game)"}
                        </div>
                        {c.game?.slug && (
                          <div className="muted tiny ellipsis">
                            {c.game.slug}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="cell-texts">
                        <div className="strong">
                          {c.author?.username || "(unknown)"}
                        </div>
                        <div className="muted tiny ellipsis">
                          {c.author?.email || "-"}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="ellipsis multiline">
                        {c.content || ""}
                      </div>
                      {c.moderationReason && (
                        <div className="muted tiny">
                          Note: {c.moderationReason}
                        </div>
                      )}
                    </td>
                    <td>
                      {c.status === "visible" && (
                        <Chip tone="green">visible</Chip>
                      )}
                      {c.status === "hidden" && (
                        <Chip tone="red">hidden</Chip>
                      )}
                      {c.status === "deleted" && (
                        <Chip tone="gray">deleted</Chip>
                      )}
                    </td>
                    <td>
                      <Chip tone={c.reportsCount ? "amber" : "gray"}>
                        {c.reportsCount || 0} report
                        {c.reportsCount === 1 ? "" : "s"}
                      </Chip>
                    </td>
                    <td className="right">
                      <div className="actions">
                        {c.game?._id && (
                          <a
                            className="btn ghost"
                            href={`/games/${c.game._id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Game
                          </a>
                        )}

                        {c.status === "visible" && (
                          <button
                            className="btn warn soft"
                            onClick={() => hideComment(c)}
                          >
                            Hide
                          </button>
                        )}

                        {c.status === "hidden" && (
                          <button
                            className="btn ok soft"
                            onClick={() => restoreComment(c)}
                          >
                            Restore
                          </button>
                        )}

                        <button
                          className="btn danger soft"
                          onClick={() => deleteComment(c)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedComments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      No comments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB: MONTHLY VOTE (LEADERBOARD) ===== */}
      {tab === "monthly" && (
        <div className="card glass">
          <div
            className="monthly-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "16px",
              marginBottom: "8px",
            }}
          >
            <div>
              <div className="muted tiny">Monthly vote leaderboard</div>
              <div className="strong">Showing {monthlyLabel}</div>
              <div className="muted tiny">
                แสดงอันดับเกมที่ถูกโหวตมากที่สุดในเดือนที่เลือก (สูงสุด 50 เกม)
              </div>
            </div>

            <div
              className="monthly-controls"
              style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}
            >
              <div>
                <label className="muted tiny block">Month</label>
                <input
                  type="month"
                  value={monthlyMonth}
                  onChange={(e) => setMonthlyMonth(e.target.value)}
                  className="bordered-input"
                />
              </div>
              <button
                className="btn primary soft"
                type="button"
                onClick={() => fetchMonthlyLeaderboard()}
              >
                Update
              </button>
            </div>
          </div>

          <div className="table-wrap" style={{ marginTop: "8px" }}>
            <table className="table table-fixed pretty">
              <thead>
                <tr>
                  <th style={{ width: "8%" }}>Rank</th>
                  <th style={{ width: "32%" }}>Game</th>
                  <th style={{ width: "20%" }}>Uploader</th>
                  <th style={{ width: "20%" }}>Visibility</th>
                  <th style={{ width: "10%" }}>Votes</th>
                  <th style={{ width: "10%" }} className="right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthlyLeaderboard.map((row, idx) => {
                  const game = row._id || row.game; // เผื่อรูปแบบต่างกัน
                  if (!game) return null;
                  const uploaderName =
                    game.uploader?.username || game.uploaderName || "-";

                  return (
                    <tr key={game._id || idx}>
                      <td>#{idx + 1}</td>
                      <td>
                        <div className="cell-main">
                          <div
                            className="cover-sm gradient"
                            style={{
                              backgroundImage: game.coverUrl
                                ? `url(${game.coverUrl})`
                                : "none",
                            }}
                          />
                          <div className="cell-texts">
                            <div className="strong">{game.title}</div>
                            {game.slug && (
                              <div className="muted tiny ellipsis">
                                {game.slug}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{uploaderName}</td>
                      <td>
                        {game.visibility === "public" && (
                          <Chip tone="green">public</Chip>
                        )}
                        {game.visibility === "review" && (
                          <Chip tone="blue">review</Chip>
                        )}
                        {game.visibility === "suspended" && (
                          <Chip tone="red">suspended</Chip>
                        )}
                      </td>
                      <td className="mono">{row.votes}</td>
                      <td className="right">
                        <div className="actions">
                          <a
                            className="btn ghost"
                            href={`/games/${game._id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {monthlyLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      ยังไม่มีการโหวตในเดือนนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
