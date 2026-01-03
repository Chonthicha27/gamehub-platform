// frontend/src/pages/admin/AdminDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import "./admin.css";

/* ---------- Small UI helpers ---------- */

const initials = (name = "") =>
  name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0] || "")
    .join("")
    .toUpperCase();

const pad2 = (n) => String(n).padStart(2, "0");

function toYYYYMM(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function yyyyMmToLabel(yyyyMm) {
  if (!yyyyMm) return "-";
  try {
    const d = new Date(`${yyyyMm}-01T00:00:00`);
    if (Number.isNaN(d.getTime())) return yyyyMm;
    return d.toLocaleString("en-US", { month: "long", year: "numeric" });
  } catch {
    return yyyyMm;
  }
}

/* ---------- Plain text labels ---------- */

function StatusText({ value }) {
  if (value === "active") return <span className="meta meta-ok">Enabled</span>;
  if (value === "suspended") return <span className="meta meta-bad">Suspended</span>;
  return <span className="meta meta-dim">{String(value || "-")}</span>;
}

function RoleText({ value }) {
  if (value === "admin") return <span className="meta meta-link">Admin</span>;
  return <span className="meta meta-dim">User</span>;
}

function PublicationStatusText({ value }) {
  if (value === "public") return <span className="meta meta-ok">Published</span>;
  if (value === "review") return <span className="meta meta-warn">Pending Review</span>;
  if (value === "suspended") return <span className="meta meta-bad">Suspended</span>;
  return <span className="meta meta-dim">{String(value || "-")}</span>;
}

function CommentStatusText({ value }) {
  if (value === "visible") return <span className="meta meta-ok">Visible</span>;
  if (value === "hidden") return <span className="meta meta-warn">Hidden</span>;
  if (value === "deleted") return <span className="meta meta-dim">Removed</span>;
  return <span className="meta meta-dim">{String(value || "-")}</span>;
}

function CategoryText({ value }) {
  return <span className="meta meta-cat">{value || "-"}</span>;
}

function ReportsText({ count }) {
  const n = Number(count || 0) || 0;
  if (n <= 0) return <span className="meta meta-dim">0</span>;
  return <span className="meta meta-warn">{n}</span>;
}

/* ---------- Reports (who + reason + description) helpers ---------- */

function safeStr(v) {
  return (v ?? "").toString().trim();
}
function shortId(id) {
  const s = safeStr(id);
  if (!s) return "";
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

/** normalize: รองรับ reports เป็น string (ObjectId) */
function normalizeReportEntry(r) {
  if (!r) return null;
  if (typeof r === "string") return { userId: r };
  if (typeof r === "object") return r;
  return null;
}

/** reporter object อาจมาได้หลายชื่อ */
function pickReporter(r = {}) {
  // ถ้ารายงานทั้งก้อนเป็น user object เลย
  if (r && typeof r === "object" && (r.username || r.email || r.displayName)) return r;

  // ชื่อที่พบบ่อย
  const candidate =
    r.user ||
    r.reporter ||
    r.by ||
    r.owner ||
    r.author ||
    r.reportedBy ||
    r.createdBy ||
    null;

  // บางทีเป็น id string
  if (typeof candidate === "string") return null;

  return candidate;
}

/** หา id ของผู้รายงานจากหลาย field */
function getReporterId(r = {}) {
  const direct =
    r.userId ||
    r.reporterId ||
    r.byId ||
    r.reportedById ||
    r.createdById ||
    r.userID ||
    r.reporterID ||
    r.uid ||
    r.user_id ||
    r.reporter_id ||
    null;

  if (direct) return direct;

  if (typeof r.user === "string") return r.user;
  if (typeof r.reporter === "string") return r.reporter;
  if (typeof r.by === "string") return r.by;
  if (typeof r.reportedBy === "string") return r.reportedBy;

  const rep = pickReporter(r);
  if (rep && typeof rep === "object" && rep._id) return rep._id;

  return "";
}

function reporterLabel(reporter, fallbackId) {
  if (reporter && typeof reporter === "object") {
    const name =
      safeStr(reporter.displayName) ||
      safeStr(reporter.username) ||
      safeStr(reporter.name) ||
      safeStr(reporter.email) ||
      safeStr(reporter._id) ||
      "";
    if (name) return name;
  }
  const fid = safeStr(fallbackId);
  if (fid) return `User ${shortId(fid)}`;
  return "(unknown)";
}

/* ✅ map reason ให้ตรงกับ modal ใหม่ */
function normalizeReasonKey(raw) {
  const s = safeStr(raw).toLowerCase();
  if (!s) return "";
  // รองรับหลายแบบ
  if (s === "off topic" || s === "off-topic" || s === "off_topic") return "off_topic";
  if (s === "spam") return "spam";
  if (s === "offensive" || s === "abuse" || s === "harassment" || s === "hate") return "offensive";
  if (s === "other") return "other";
  return s; // fallback
}

function reasonPrettyLabel(key) {
  const k = normalizeReasonKey(key);
  if (k === "off_topic") return "Off topic";
  if (k === "spam") return "Spam";
  if (k === "offensive") return "Offensive";
  if (k === "other") return "Other";
  // fallback เป็น raw
  return safeStr(key) || "-";
}

function reportReasonLabel(r = {}) {
  const raw =
    safeStr(r.reason) ||
    safeStr(r.type) ||
    safeStr(r.category) ||
    safeStr(r.message) ||
    "-";
  return reasonPrettyLabel(raw);
}

/* ✅ NEW: ดึง Description / additional info ให้รองรับหลาย field */
function reportDescriptionLabel(r = {}) {
  const s =
    safeStr(r.description) ||
    safeStr(r.details) ||
    safeStr(r.detail) ||
    safeStr(r.note) ||
    safeStr(r.text) ||
    safeStr(r.additionalInfo) ||
    safeStr(r.additional) ||
    safeStr(r.more) ||
    safeStr(r.comment) ||
    safeStr(r.desc) ||
    safeStr(r.reportDescription) ||
    safeStr(r.report_note) ||
    "";

  return s;
}

function reportTimeLabel(r = {}) {
  const t = r.createdAt || r.reportedAt || r.time || r.at;
  if (!t) return "-";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function reportsArrayFromComment(c) {
  const arr = Array.isArray(c?.reports) ? c.reports : [];
  return arr.map(normalizeReportEntry).filter(Boolean);
}

/* ---------- Toolbar ---------- */

function Toolbar({ tab, setTab, search, setSearch, refresh, counts, loading }) {
  const placeholder =
    tab === "users"
      ? "Search users by username, email, role..."
      : tab === "games"
      ? "Search games by title, uploader, category..."
      : tab === "pending"
      ? "Search pending submissions..."
      : tab === "comments"
      ? "Search reported comments..."
      : "Search monthly votes...";

  const TabBtn = ({ id, label, count }) => (
    <button
      className={`tab ${tab === id ? "active" : ""}`}
      onClick={() => setTab(id)}
      type="button"
      role="tab"
      aria-selected={tab === id}
    >
      <span className="tab-dot" />
      <span className="tab-label">{label}</span>
      <span className="counter">{count}</span>
    </button>
  );

  return (
    <div className="admin-toolbar glass">
      <div className="toolbar-row">
        <div className="tabs" role="tablist" aria-label="Admin sections">
          <TabBtn id="users" label="Users" count={counts.users} />
          <TabBtn id="games" label="Games" count={counts.games} />
          <TabBtn id="pending" label="Pending Review" count={counts.pending} />
          <TabBtn id="comments" label="Reported Comments" count={counts.comments} />
          <TabBtn id="monthly" label="Monthly Votes" count={counts.monthly} />
        </div>

        <div className="toolbar-right">
          <div className="search-wrap">
            <input
              className="search"
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="toolbar-actions" aria-label="Toolbar actions">
            <div className="toolbar-divider" aria-hidden="true" />
            <button
              className={`icon-btn ${loading ? "is-loading" : ""}`}
              onClick={refresh}
              type="button"
              title={loading ? "Refreshing..." : "Reload data"}
              disabled={loading}
              aria-label="Reload data"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M20 12a8 8 0 0 1-14.7 4.3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M4 12a8 8 0 0 1 14.7-4.3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M7 17H5v-2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M17 7h2v2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Action Menu (⋯) ---------- */

function MenuItem({ danger, disabled, onClick, children, href, target }) {
  const cls = `menu-item ${danger ? "danger" : ""} ${disabled ? "disabled" : ""}`.trim();

  if (href) {
    return (
      <a
        className={cls}
        href={href}
        target={target}
        rel={target === "_blank" ? "noreferrer" : undefined}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <button className={cls} type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div className="menu-divider" />;
}

function ActionMenu({ menuKey, openKey, setOpenKey, align = "right", children }) {
  const open = openKey === menuKey;

  return (
    <div className={`menu-root ${align === "left" ? "align-left" : "align-right"}`}>
      <button
        type="button"
        className="kebab"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpenKey(open ? null : menuKey)}
        title="Actions"
      >
        <span className="kebab-dot" />
        <span className="kebab-dot" />
        <span className="kebab-dot" />
      </button>

      {open && <div className="menu">{children}</div>}
    </div>
  );
}

/* ---------- Main component ---------- */

export default function AdminDashboard() {
  const [tab, setTab] = useState("users");

  const [users, setUsers] = useState([]);
  const [games, setGames] = useState([]);
  const [pendingGames, setPendingGames] = useState([]);
  const [comments, setComments] = useState([]);

  const [monthlyMonth, setMonthlyMonth] = useState(() => toYYYYMM(new Date()));
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState([]);
  const [monthlyCount, setMonthlyCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [openMenuKey, setOpenMenuKey] = useState(null);

  // report details toggle
  const [openReportKey, setOpenReportKey] = useState(null);

  const token = localStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const nowYYYYMM = useMemo(() => toYYYYMM(new Date()), []);

  useEffect(() => {
    const onDown = (e) => {
      if (!e.target.closest(".menu-root")) setOpenMenuKey(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenMenuKey(null);
        setOpenReportKey(null);
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  /* ---------- Load core data ---------- */

  const loadCoreData = async () => {
    setLoading(true);
    try {
      const [u, g, p, c, m] = await Promise.all([
        api.get("/admin/users", { withCredentials: true, headers }),
        api.get("/admin/games", { withCredentials: true, headers }),
        api.get("/admin/games/pending", { withCredentials: true, headers }),
        api.get("/admin/comments", { withCredentials: true, headers }),
        api.get("/monthly-vote/leaderboard", { params: { month: monthlyMonth } }),
      ]);

      setUsers(u.data || []);
      setGames(g.data || []);
      setPendingGames(p.data || []);
      setComments(c.data || []);

      const monthlyArr = m.data || [];
      setMonthlyCount(monthlyArr.length);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyCountOnly = async (overrideMonth) => {
    const month = overrideMonth || monthlyMonth;
    if (!month) return;
    try {
      const res = await api.get("/monthly-vote/leaderboard", { params: { month } });
      const arr = res.data || [];
      setMonthlyCount(arr.length);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMonthlyLeaderboard = async (overrideMonth) => {
    const month = overrideMonth || monthlyMonth;
    if (!month) return;
    setLoading(true);
    try {
      const res = await api.get("/monthly-vote/leaderboard", { params: { month } });
      const arr = res.data || [];
      setMonthlyLeaderboard(arr);
      setMonthlyCount(arr.length);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const monthlyLabel = useMemo(() => yyyyMmToLabel(monthlyMonth), [monthlyMonth]);

  const monthOptions = useMemo(() => {
    const arr = [];
    const base = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      arr.push(toYYYYMM(d));
    }
    return arr;
  }, []);

  const monthGroups = useMemo(() => {
    const byYear = {};
    for (const m of monthOptions) {
      const y = String(m).slice(0, 4);
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(m);
    }
    const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));
    return years.map((y) => ({ year: y, months: byYear[y] }));
  }, [monthOptions]);

  useEffect(() => {
    loadCoreData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "monthly") fetchMonthlyLeaderboard(monthlyMonth);
    else fetchMonthlyCountOnly(monthlyMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyMonth]);

  useEffect(() => {
    setOpenMenuKey(null);
    setOpenReportKey(null);
    if (tab === "monthly") fetchMonthlyLeaderboard(monthlyMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleRefresh = () => {
    setOpenMenuKey(null);
    setOpenReportKey(null);
    if (tab === "monthly") fetchMonthlyLeaderboard(monthlyMonth);
    else loadCoreData();
  };

  const refreshCommentsOnly = async () => {
    try {
      const res = await api.get("/admin/comments", { withCredentials: true, headers });
      setComments(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  /* ---------- User actions ---------- */

  const setRole = async (id, role) => {
    const r = await api.patch(`/admin/users/${id}`, { role }, { withCredentials: true, headers });
    setUsers((xs) => xs.map((u) => (u._id === id ? r.data : u)));
  };

  const suspend = async (id) => {
    const reason = prompt("Reason (optional)", "violation");
    if (reason === null) return;
    const daysStr = prompt("Suspension days (default 7)", "7");
    const days = Number(daysStr || 7) || 7;

    const r = await api.patch(
      `/admin/users/${id}`,
      { status: "suspended", reason, days },
      { withCredentials: true, headers }
    );
    setUsers((xs) => xs.map((u) => (u._id === id ? r.data : u)));
  };

  const activate = async (id) => {
    const r = await api.patch(`/admin/users/${id}`, { status: "active" }, { withCredentials: true, headers });
    setUsers((xs) => xs.map((u) => (u._id === id ? r.data : u)));
  };

  const toggleUserSelection = (id) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allUsersInViewSelected =
    users.length > 0 && users.every((u) => selectedUserIds.includes(u._id)) && selectedUserIds.length > 0;

  const toggleSelectAllUsers = () => {
    if (allUsersInViewSelected) setSelectedUserIds([]);
    else setSelectedUserIds(users.map((u) => u._id));
  };

  /* ---------- Game actions ---------- */

  const delGame = async (game) => {
    const isPending = game.visibility === "review";
    if (
      !confirm(
        isPending
          ? `Reject "${game.title}" and remove it from the system?`
          : `Delete "${game.title}" from the system?`
      )
    )
      return;

    try {
      let url = `/admin/games/${game._id}`;

      if (isPending) {
        const reason = prompt("Reason for rejection (sent to uploader via email)", "");
        if (reason === null) return;
        const encoded = encodeURIComponent(reason);
        url += `?reason=${encoded}`;
      }

      await api.delete(url, { withCredentials: true, headers });

      setGames((xs) => xs.filter((g) => g._id !== game._id));
      setPendingGames((xs) => xs.filter((g) => g._id !== game._id));

      alert(isPending ? "Rejected and email sent (if available)." : "Deleted and email sent (if available).");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  const suspendGame = async (game) => {
    const reason = prompt("Reason for suspension (sent to uploader via email)", "");
    if (reason === null) return;

    try {
      const res = await api.patch(`/admin/games/${game._id}/suspend`, { reason }, { withCredentials: true, headers });
      const updated = res.data.game || res.data;
      setGames((xs) => xs.map((g) => (g._id === game._id ? updated : g)));
      alert("Game suspended and email sent (if available).");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  const unsuspendGame = async (game) => {
    if (!confirm("Restore this game and make it available again?")) return;

    try {
      const res = await api.patch(`/admin/games/${game._id}/unsuspend`, {}, { withCredentials: true, headers });
      const updated = res.data.game || res.data;
      setGames((xs) => xs.map((g) => (g._id === game._id ? updated : g)));
      alert("Game restored.");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  const approveGame = async (id) => {
    if (!confirm("Approve this game and publish it?")) return;
    try {
      const res = await api.patch(`/admin/games/${id}/approve`, {}, { withCredentials: true, headers });
      const updated = res.data.game || res.data;

      setPendingGames((xs) => xs.filter((g) => g._id !== id));
      setGames((xs) => {
        const exists = xs.some((g) => g._id === id);
        if (!exists) return [updated, ...xs];
        return xs.map((g) => (g._id === id ? updated : g));
      });

      alert("Approved and email sent (if available).");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  /* ---------- Comment actions ---------- */

const hideComment = async (comment) => {
  const reason = prompt("Reason for hiding this comment", "");
  if (reason === null) return;

  try {
    await api.patch(
      `/admin/comments/${comment._id}/hide`,
      { reason },
      { withCredentials: true, headers }
    );

    await refreshCommentsOnly();
    alert("Comment hidden.");
  } catch (e) {
    console.error(e);
    alert(e?.response?.data?.message || e.message);
  }
};


  const restoreComment = async (comment) => {
    if (!confirm("Restore this comment?")) return;

    try {
      await api.patch(`/admin/comments/${comment._id}/restore`, {}, { withCredentials: true, headers });
      await refreshCommentsOnly();
      alert("Comment restored.");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  const deleteComment = async (comment) => {
    if (!confirm("Permanently delete this comment?")) return;
    try {
      await api.delete(`/admin/comments/${comment._id}`, { withCredentials: true, headers });
      setComments((xs) => xs.filter((c) => c._id !== comment._id));
      alert("Comment deleted.");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  /* ---------- Filters ---------- */

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
      const repArr = reportsArrayFromComment(c);

      // ✅ include description in search text
      const reportSearchText = repArr
        .map((r) => {
          const rep = pickReporter(r);
          const repId = getReporterId(r);
          const who = reporterLabel(rep, repId);
          const why = reportReasonLabel(r);
          const desc = reportDescriptionLabel(r);
          return `${who} ${why} ${desc} ${repId}`;
        })
        .join(" | ")
        .toLowerCase();

      return (
        c.content?.toLowerCase().includes(q) ||
        c.author?.username?.toLowerCase().includes(q) ||
        c.author?.email?.toLowerCase().includes(q) ||
        c.game?.title?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q) ||
        reportSearchText.includes(q)
      );
    });
  }, [search, comments]);

  const sortedComments = useMemo(() => {
    const reportedOnly = fComments.filter((c) => {
      const count = c.reportsCount ?? (Array.isArray(c.reports) ? c.reports.length : 0);
      return (count || 0) > 0;
    });

    return reportedOnly.sort((a, b) => {
      const ar = a.reportsCount || (Array.isArray(a.reports) ? a.reports.length : 0) || 0;
      const br = b.reportsCount || (Array.isArray(b.reports) ? b.reports.length : 0) || 0;
      if (br !== ar) return br - ar;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [fComments]);

  const counts = {
    users: users.length,
    games: games.length,
    pending: pendingGames.length,
    comments: sortedComments.length,
    monthly: monthlyCount,
  };

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <h1 className="admin-title">Admin</h1>
        <div className="admin-subtitle">Moderation & management console</div>
      </div>

      <Toolbar
        tab={tab}
        setTab={setTab}
        search={search}
        setSearch={setSearch}
        refresh={handleRefresh}
        counts={counts}
        loading={loading}
      />

      {/* ===== USERS TAB ===== */}
      {tab === "users" && (
        <div className="card glass">
          <div className="card-head">
            <div className="card-title">Users</div>
            {selectedUserIds.length > 0 ? (
              <div className="bulk-indicator">
                Selected {selectedUserIds.length} user{selectedUserIds.length > 1 ? "s" : ""}
              </div>
            ) : (
              <div className="muted tiny">Tip: Use checkbox to select</div>
            )}
          </div>

          <div className="table-wrap">
            <table className="table table-fixed pretty users-table">
              <thead>
                <tr>
                  <th className="col-select">
                    <input
                      type="checkbox"
                      className="row-checkbox"
                      checked={allUsersInViewSelected}
                      onChange={toggleSelectAllUsers}
                    />
                  </th>
                  <th className="col-user">Username</th>
                  <th className="col-email">Email</th>
                  <th className="col-role">Role</th>
                  <th className="col-status">Account Status</th>
                  <th className="col-actions actions-head">Actions</th>
                </tr>
              </thead>

              <tbody>
                {fUsers.map((u) => {
                  const checked = selectedUserIds.includes(u._id);
                  const key = `users:${u._id}`;
                  const isSuspended = u.status === "suspended";
                  const isAdmin = u.role === "admin";

                  return (
                    <tr key={u._id} className={checked ? "row-selected" : undefined}>
                      <td className="cell-center">
                        <input
                          type="checkbox"
                          className="row-checkbox"
                          checked={checked}
                          onChange={() => toggleUserSelection(u._id)}
                        />
                      </td>

                      <td>
                        <div className="cell-main">
                          <div className="avatar-circle">{initials(u.username || "U")}</div>
                          <div className="cell-texts">
                            <div className="strong">{u.username}</div>
                            <div className="muted tiny">
                              Joined {new Date(u.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="ellipsis">{u.email || "-"}</span>
                      </td>

                      <td>
                        <RoleText value={u.role} />
                      </td>

                      <td>
                        <StatusText value={u.status} />
                      </td>

                      <td className="actions-cell">
                        <ActionMenu menuKey={key} openKey={openMenuKey} setOpenKey={setOpenMenuKey}>
                          <div className="menu-title">User actions</div>

                          <MenuItem
                            onClick={() => {
                              setOpenMenuKey(null);
                              if (!isAdmin) setRole(u._id, "admin");
                            }}
                            disabled={isAdmin}
                          >
                            Set role: Admin
                          </MenuItem>

                          <MenuItem
                            onClick={() => {
                              setOpenMenuKey(null);
                              if (isAdmin) setRole(u._id, "user");
                            }}
                            disabled={!isAdmin}
                          >
                            Set role: User
                          </MenuItem>

                          <MenuDivider />

                          {!isSuspended ? (
                            <MenuItem
                              danger
                              onClick={() => {
                                setOpenMenuKey(null);
                                suspend(u._id);
                              }}
                            >
                              Suspend account
                            </MenuItem>
                          ) : (
                            <MenuItem
                              onClick={() => {
                                setOpenMenuKey(null);
                                activate(u._id);
                              }}
                            >
                              Reactivate account
                            </MenuItem>
                          )}
                        </ActionMenu>
                      </td>
                    </tr>
                  );
                })}

                {fUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== GAMES TAB ===== */}
      {tab === "games" && (
        <div className="card glass">
          <div className="card-head">
            <div className="card-title">Games</div>
            <div className="muted tiny">Manage published & suspended games</div>
          </div>

          <div className="table-wrap">
            <table className="table table-fixed pretty games-table">
              <thead>
                <tr>
                  <th className="col-title">Title</th>
                  <th className="col-uploader">Uploader</th>
                  <th className="col-category">Category</th>
                  <th className="col-status">Publication Status</th>
                  <th className="col-created">Created</th>
                  <th className="col-actions actions-head">Actions</th>
                </tr>
              </thead>

              <tbody>
                {fGames.map((g) => {
                  const key = `games:${g._id}`;
                  const canSuspend = g.visibility === "public";
                  const canRestore = g.visibility === "suspended";

                  return (
                    <tr key={g._id}>
                      <td>
                        <div className="cell-texts">
                          <div className="strong">{g.title}</div>
                          <div className="muted tiny ellipsis">{g.slug}</div>
                        </div>
                      </td>

                      <td>{g.uploader?.username || "-"}</td>

                      <td>
                        <CategoryText value={g.category || "all"} />
                      </td>

                      <td>
                        <PublicationStatusText value={g.visibility} />
                      </td>

                      <td className="mono">{new Date(g.createdAt).toLocaleString()}</td>

                      <td className="actions-cell">
                        <ActionMenu menuKey={key} openKey={openMenuKey} setOpenKey={setOpenMenuKey}>
                          <div className="menu-title">Game actions</div>

                          <MenuItem href={`/games/${g._id}`} target="_blank" onClick={() => setOpenMenuKey(null)}>
                            View
                          </MenuItem>

                          <MenuDivider />

                          <MenuItem
                            onClick={() => {
                              setOpenMenuKey(null);
                              if (canSuspend) suspendGame(g);
                            }}
                            disabled={!canSuspend}
                          >
                            Suspend
                          </MenuItem>

                          <MenuItem
                            onClick={() => {
                              setOpenMenuKey(null);
                              if (canRestore) unsuspendGame(g);
                            }}
                            disabled={!canRestore}
                          >
                            Restore
                          </MenuItem>

                          <MenuDivider />

                          <MenuItem
                            danger
                            onClick={() => {
                              setOpenMenuKey(null);
                              delGame(g);
                            }}
                          >
                            Delete
                          </MenuItem>
                        </ActionMenu>
                      </td>
                    </tr>
                  );
                })}

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

      {/* ===== PENDING GAMES TAB ===== */}
      {tab === "pending" && (
        <div className="card glass">
          <div className="card-head">
            <div className="card-title">Pending Review</div>
            <div className="muted tiny">Approve or reject submissions</div>
          </div>

          <div className="table-wrap">
            <table className="table table-fixed pretty pending-table">
              <thead>
                <tr>
                  <th className="col-title">Title</th>
                  <th className="col-uploader">Uploader</th>
                  <th className="col-category">Category</th>
                  <th className="col-created">Submitted</th>
                  <th className="col-actions actions-head">Actions</th>
                </tr>
              </thead>

              <tbody>
                {fPending.map((g) => {
                  const key = `pending:${g._id}`;
                  return (
                    <tr key={g._id}>
                      <td>
                        <div className="cell-main">
                          <div
                            className="cover-sm gradient"
                            style={{
                              backgroundImage: g.coverUrl ? `url(${g.coverUrl})` : "none",
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
                        <CategoryText value={g.category || "all"} />
                      </td>

                      <td className="mono">{new Date(g.createdAt).toLocaleString()}</td>

                      <td className="actions-cell">
                        <ActionMenu menuKey={key} openKey={openMenuKey} setOpenKey={setOpenMenuKey}>
                          <div className="menu-title">Review actions</div>

                          <MenuItem href={`/games/${g._id}`} target="_blank" onClick={() => setOpenMenuKey(null)}>
                            View
                          </MenuItem>

                          <MenuDivider />

                          <MenuItem
                            onClick={() => {
                              setOpenMenuKey(null);
                              approveGame(g._id);
                            }}
                          >
                            Approve & publish
                          </MenuItem>

                          <MenuItem
                            danger
                            onClick={() => {
                              setOpenMenuKey(null);
                              delGame(g);
                            }}
                          >
                            Reject
                          </MenuItem>
                        </ActionMenu>
                      </td>
                    </tr>
                  );
                })}

                {fPending.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No pending submissions 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== COMMENTS TAB ===== */}
      {tab === "comments" && (
        <div className="card glass">
          <div className="card-head">
            <div className="card-title">Reported Comments</div>
            <div className="muted tiny">Only comments with reports are shown</div>
          </div>

          <div className="table-wrap">
            <table className="table table-fixed pretty comments-table">
              <thead>
                <tr>
                  <th style={{ width: "18%" }}>Game</th>
                  <th style={{ width: "16%" }}>Author</th>
                  <th style={{ width: "30%" }}>Comment</th>
                  <th style={{ width: "18%" }}>Reports detail</th>
                  <th style={{ width: "8%" }}>Status</th>
                  <th style={{ width: "6%" }}>Count</th>
                  <th style={{ width: "4%" }} className="actions-head">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedComments.map((c) => {
                  const key = `comments:${c._id}`;

                  const repArr = reportsArrayFromComment(c);
                  const repCount = c.reportsCount ?? (Array.isArray(c.reports) ? c.reports.length : 0);

                  const canView = Boolean(c.game?._id);
                  const isVisible = c.status === "visible";
                  const isHidden = c.status === "hidden";

                  const rowReportKey = `report:${c._id}`;
                  const open = openReportKey === rowReportKey;

                  // ✅ summary: แสดง reason + description สั้น ๆ
                  const summaryItems = repArr.slice(0, 2).map((r, idx) => {
                    const rep = pickReporter(r);
                    const repId = getReporterId(r);
                    const who = reporterLabel(rep, repId);
                    const why = reportReasonLabel(r);
                    const desc = reportDescriptionLabel(r);
                    const descShort = desc ? ` — ${desc.slice(0, 40)}${desc.length > 40 ? "…" : ""}` : "";
                    return (
                      <div key={idx} className="muted tiny ellipsis" title={`${who} — ${why}${desc ? ` — ${desc}` : ""} (${repId || "no-id"})`}>
                        • {who} — {why}
                        {descShort}
                      </div>
                    );
                  });

                  return (
                    <>
                      <tr key={c._id}>
                        <td>
                          <div className="cell-texts">
                            <div className="strong">{c.game?.title || "(deleted game)"}</div>
                            {c.game?.slug && <div className="muted tiny ellipsis">{c.game.slug}</div>}
                          </div>
                        </td>

                        <td>
                          <div className="cell-texts">
                            <div className="strong">{c.author?.username || "(unknown)"}</div>
                            <div className="muted tiny ellipsis">{c.author?.email || "-"}</div>
                          </div>
                        </td>

                        <td>
                          <div className="multiline clamp-3">{c.content || ""}</div>
                          {c.moderationReason && <div className="muted tiny">Note: {c.moderationReason}</div>}
                        </td>

                        <td>
                          <div className="cell-texts">
                            {summaryItems.length > 0 ? (
                              <>
                                {summaryItems}
                                {repArr.length > 2 && <div className="muted tiny">…and {repArr.length - 2} more</div>}

                                <button
                                  type="button"
                                  className="btn link tiny"
                                  onClick={() => {
                                    setOpenMenuKey(null);
                                    setOpenReportKey(open ? null : rowReportKey);
                                  }}
                                  style={{
                                    marginTop: "6px",
                                    textAlign: "left",
                                    padding: "6px 10px",
                                    fontSize: "12px",
                                    lineHeight: 1.1,
                                    borderRadius: "10px",
                                    width: "fit-content",
                                  }}
                                >
                                  {open ? "Hide details" : "View details"}
                                </button>
                              </>
                            ) : (
                              <div className="muted tiny">-</div>
                            )}
                          </div>
                        </td>

                        <td>
                          <CommentStatusText value={c.status} />
                        </td>

                        <td>
                          <ReportsText count={repCount} />
                        </td>

                        <td className="actions-cell">
                          <ActionMenu menuKey={key} openKey={openMenuKey} setOpenKey={setOpenMenuKey}>
                            <div className="menu-title">Comment actions</div>

                            <MenuItem
                              href={canView ? `/games/${c.game._id}` : undefined}
                              target="_blank"
                              disabled={!canView}
                              onClick={() => setOpenMenuKey(null)}
                            >
                              View
                            </MenuItem>

                            <MenuDivider />

                            <MenuItem
                              onClick={() => {
                                setOpenMenuKey(null);
                                if (isVisible) hideComment(c);
                              }}
                              disabled={!isVisible}
                            >
                              Hide
                            </MenuItem>

                            <MenuItem
                              onClick={() => {
                                setOpenMenuKey(null);
                                if (isHidden) restoreComment(c);
                              }}
                              disabled={!isHidden}
                            >
                              Restore
                            </MenuItem>

                            <MenuDivider />

                            <MenuItem
                              danger
                              onClick={() => {
                                setOpenMenuKey(null);
                                deleteComment(c);
                              }}
                            >
                              Delete
                            </MenuItem>
                          </ActionMenu>
                        </td>
                      </tr>

                      {open && (
                        <tr key={`${c._id}:details`} className="row-sub">
                          <td colSpan={7}>
                            <div
                              className="glass"
                              style={{
                                padding: "10px 12px",
                                borderRadius: "12px",
                                border: "1px solid rgba(255,255,255,.10)",
                              }}
                            >
                              <div className="strong" style={{ marginBottom: 6 }}>
                                Report details
                              </div>

                              {repArr.length === 0 ? (
                                <div className="muted tiny">No report details found.</div>
                              ) : (
                                <div style={{ display: "grid", gap: 8 }}>
                                  {repArr.map((r, idx) => {
                                    const rep = pickReporter(r);
                                    const repId = getReporterId(r);
                                    const who = reporterLabel(rep, repId);
                                    const whoEmail =
                                      safeStr(rep?.email) ||
                                      safeStr(r.email) ||
                                      safeStr(r.reporterEmail) ||
                                      "-";

                                    const why = reportReasonLabel(r);
                                    const desc = reportDescriptionLabel(r);
                                    const when = reportTimeLabel(r);

                                    return (
                                      <div
                                        key={idx}
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: "28% 44% 28%",
                                          gap: 10,
                                          padding: "8px 10px",
                                          borderRadius: "10px",
                                          border: "1px solid rgba(255,255,255,.08)",
                                          background: "rgba(255,255,255,.03)",
                                        }}
                                      >
                                        <div className="tiny">
                                          <div className="strong ellipsis" title={`${who} (${repId || "no-id"})`}>
                                            {who}
                                          </div>
                                          <div></div>
                                          <div className="muted tiny ellipsis" title={whoEmail}>
                                            {whoEmail}
                                          </div>
                                        </div>

                                        <div className="tiny">
                                          <div className="muted tiny">Reason</div>
                                          <div className="strong" title={why}>
                                            {why}
                                          </div>

                                          <div className="muted tiny" style={{ marginTop: 6 }}>
                                            Description
                                          </div>
                                          <div className="multiline clamp-3" title={desc || "-"}>
                                            {desc || <span className="muted tiny">-</span>}
                                          </div>
                                        </div>

                                        <div className="tiny">
                                          <div className="muted tiny">Reported at</div>
                                          <div className="mono">{when}</div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}

                {sortedComments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      No reported comments 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== MONTHLY VOTE TAB ===== */}
      {tab === "monthly" && (
        <div className="card glass">
          <div className="monthly-header">
            <div>
              <div className="muted tiny">Monthly voting leaderboard</div>
              <div className="strong">Showing {monthlyLabel}</div>
              <div className="muted tiny">Most voted games in the selected month (top 50)</div>
            </div>

            <div className="monthly-controls">
              <div>
                <label className="muted tiny block" htmlFor="monthSelect">
                  Select month
                </label>
                <select
                  id="monthSelect"
                  className="bordered-input select-input"
                  value={monthlyMonth}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMonthlyMonth(v > nowYYYYMM ? nowYYYYMM : v);
                  }}
                >
                  {monthGroups.map((g) => (
                    <optgroup key={g.year} label={g.year}>
                      {g.months.map((m) => (
                        <option key={m} value={m}>
                          {yyyyMmToLabel(m)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <button
                className={`btn primary soft ${loading ? "is-loading" : ""}`}
                type="button"
                onClick={() => fetchMonthlyLeaderboard(monthlyMonth)}
                disabled={loading}
                title="Load leaderboard for selected month"
              >
                {loading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>

          <div className="table-wrap" style={{ marginTop: "10px" }}>
            <table className="table table-fixed pretty monthly-table">
              <thead>
                <tr>
                  <th style={{ width: "8%" }}>Rank</th>
                  <th style={{ width: "36%" }}>Game</th>
                  <th style={{ width: "20%" }}>Uploader</th>
                  <th style={{ width: "18%" }}>Publication Status</th>
                  <th style={{ width: "10%" }}>Votes</th>
                  <th style={{ width: "8%" }} className="actions-head">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {monthlyLeaderboard.map((row, idx) => {
                  const game = row._id || row.game;
                  if (!game) return null;

                  const key = `monthly:${game._id || idx}`;
                  const uploaderName = game.uploader?.username || game.uploaderName || "-";

                  return (
                    <tr key={game._id || idx}>
                      <td className="mono">#{idx + 1}</td>

                      <td>
                        <div className="cell-main">
                          <div
                            className="cover-sm gradient"
                            style={{
                              backgroundImage: game.coverUrl ? `url(${game.coverUrl})` : "none",
                            }}
                          />
                          <div className="cell-texts">
                            <div className="strong">{game.title}</div>
                            {game.slug && <div className="muted tiny ellipsis">{game.slug}</div>}
                          </div>
                        </div>
                      </td>

                      <td>{uploaderName}</td>

                      <td>
                        <PublicationStatusText value={game.visibility} />
                      </td>

                      <td className="mono">{row.votes}</td>

                      <td className="actions-cell">
                        <ActionMenu menuKey={key} openKey={openMenuKey} setOpenKey={setOpenMenuKey}>
                          <div className="menu-title">Actions</div>
                          <MenuItem href={`/games/${game._id}`} target="_blank" onClick={() => setOpenMenuKey(null)}>
                            View
                          </MenuItem>
                        </ActionMenu>
                      </td>
                    </tr>
                  );
                })}

                {monthlyLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      No votes for this month yet
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
