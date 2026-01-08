// frontend/src/pages/admin/AdminDashboard.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/* ---------- Text formatting (Title Case) ---------- */

function safeStr(v) {
  return (v ?? "").toString().trim();
}

function toTitleCase(input = "") {
  const s = safeStr(input);
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/\b([a-z])([a-z0-9']*)\b/g, (_, a, b) => a.toUpperCase() + b);
}

function prettyEnumLabel(v) {
  const s = safeStr(v);
  if (!s) return "-";
  const spaced = s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return toTitleCase(spaced) || "-";
}

function shortId(id) {
  const s = safeStr(id);
  if (!s) return "";
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

/* ---------- Plain text labels ---------- */

function StatusText({ value }) {
  if (value === "active") return <span className="meta meta-ok">Enabled</span>;
  if (value === "suspended") return <span className="meta meta-bad">Suspended</span>;
  return <span className="meta meta-dim">{prettyEnumLabel(value)}</span>;
}

function RoleText({ value }) {
  if (value === "admin") return <span className="meta meta-link">Admin</span>;
  return <span className="meta meta-dim">User</span>;
}

function PublicationStatusText({ value }) {
  if (value === "public") return <span className="meta meta-ok">Published</span>;
  if (value === "review") return <span className="meta meta-warn">Pending Review</span>;
  if (value === "suspended") return <span className="meta meta-bad">Suspended</span>;
  return <span className="meta meta-dim">{prettyEnumLabel(value)}</span>;
}

function CommentStatusText({ value }) {
  if (value === "visible") return <span className="meta meta-ok">Visible</span>;
  if (value === "hidden") return <span className="meta meta-warn">Hidden</span>;
  if (value === "deleted") return <span className="meta meta-dim">Removed</span>;
  return <span className="meta meta-dim">{prettyEnumLabel(value)}</span>;
}

function CategoryText({ value }) {
  return <span className="meta meta-cat">{prettyEnumLabel(value)}</span>;
}

function ReportsText({ count }) {
  const n = Number(count || 0) || 0;
  if (n <= 0) return <span className="meta meta-dim">0</span>;
  return <span className="meta meta-warn">{n}</span>;
}

/* ---------- Reports (who + reason + description) helpers ---------- */

function normalizeReportEntry(r) {
  if (!r) return null;
  if (typeof r === "string") return { userId: r };
  if (typeof r === "object") return r;
  return null;
}

function pickReporter(r = {}) {
  if (r && typeof r === "object" && (r.username || r.email || r.displayName)) return r;

  const candidate =
    r.user ||
    r.reporter ||
    r.by ||
    r.owner ||
    r.author ||
    r.reportedBy ||
    r.createdBy ||
    null;

  if (typeof candidate === "string") return null;

  return candidate;
}

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
  return "(Unknown)";
}

function normalizeReasonKey(raw) {
  const s = safeStr(raw).toLowerCase();
  if (!s) return "";
  if (s === "off topic" || s === "off-topic" || s === "off_topic") return "off_topic";
  if (s === "spam") return "spam";
  if (s === "offensive" || s === "abuse" || s === "harassment" || s === "hate") return "offensive";
  if (s === "other") return "other";
  return s;
}

function reasonPrettyLabel(key) {
  const k = normalizeReasonKey(key);
  if (k === "off_topic") return "Off Topic";
  if (k === "spam") return "Spam";
  if (k === "offensive") return "Offensive";
  if (k === "other") return "Other";
  return toTitleCase(safeStr(key)) || "-";
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

/* ---------- Icons ---------- */

function EyeIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M2.2 12s3.6-7 9.8-7 9.8 7 9.8 7-3.6 7-9.8 7-9.8-7-9.8-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

/* ---------- Toolbar ---------- */

function Toolbar({ tab, setTab, search, setSearch, refresh, counts, loading }) {
  const placeholder =
    tab === "users"
      ? "Search Users By Username, Email, Role..."
      : tab === "games"
      ? "Search Games By Title, Uploader, Category..."
      : tab === "pending"
      ? "Search Pending Submissions..."
      : tab === "comments"
      ? "Search Reported Comments..."
      : "Search Monthly Votes...";

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
        <div className="tabs" role="tablist" aria-label="Admin Sections">
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

          <div className="toolbar-actions" aria-label="Toolbar Actions">
            <div className="toolbar-divider" aria-hidden="true" />
            <button
              className={`icon-btn ${loading ? "is-loading" : ""}`}
              onClick={refresh}
              type="button"
              title={loading ? "Refreshing..." : "Reload Data"}
              disabled={loading}
              aria-label="Reload Data"
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

function ActionMenu({ menuKey, openKey, setOpenKey, align = "right", width = 240, children }) {
  const open = openKey === menuKey;
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, w: width });

  const compute = () => {
    const el = btnRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    const w = Math.min(Math.max(width, 200), 360);
    let left = align === "left" ? rect.left : rect.right - w;
    left = Math.max(8, Math.min(left, vw - w - 8));

    const belowTop = rect.bottom + 8;
    const aboveTop = rect.top - 8;

    const estH = 240;
    let top = belowTop;
    if (belowTop + estH > vh - 8) top = Math.max(8, aboveTop - estH);

    setPos({ top, left, w });
  };

  useLayoutEffect(() => {
    if (!open) return;
    compute();

    const onResize = () => compute();
    const onScroll = () => compute();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, width, align, menuKey]);

  const menuEl = open ? (
    <div
      className="menu menu-portal"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        minWidth: pos.w,
        maxWidth: 360,
        zIndex: 9999,
        overflow: "visible",
        maxHeight: `calc(100vh - 16px)`,
      }}
      role="menu"
    >
      {children}
    </div>
  ) : null;

  return (
    <div className="menu-root">
      <button
        ref={btnRef}
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

      {menuEl ? createPortal(menuEl, document.body) : null}
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

  const [openReportKey, setOpenReportKey] = useState(null);

  const prevGameVisibilityRef = useRef(new Map());

  const token = localStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const nowYYYYMM = useMemo(() => toYYYYMM(new Date()), []);

  useEffect(() => {
    const onDown = (e) => {
      if (!e.target.closest(".menu-root") && !e.target.closest(".menu-portal")) {
        setOpenMenuKey(null);
      }
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
    const reason = prompt("Reason (Optional)", "Violation");
    if (reason === null) return;
    const daysStr = prompt("Suspension Days (Default 7)", "7");
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
          ? `Reject "${game.title}" And Remove It From The System?`
          : `Delete "${game.title}" From The System?`
      )
    )
      return;

    try {
      let url = `/admin/games/${game._id}`;

      if (isPending) {
        const reason = prompt("Reason For Rejection (Sent To Uploader Via Email)", "");
        if (reason === null) return;
        const encoded = encodeURIComponent(reason);
        url += `?reason=${encoded}`;
      }

      await api.delete(url, { withCredentials: true, headers });

      setGames((xs) => xs.filter((g) => g._id !== game._id));
      setPendingGames((xs) => xs.filter((g) => g._id !== game._id));

      alert(isPending ? "Rejected And Email Sent (If Available)." : "Deleted And Email Sent (If Available).");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  const suspendGame = async (game) => {
    const reason = prompt("Reason For Suspension (Sent To Uploader Via Email)", "");
    if (reason === null) return;

    try {
      prevGameVisibilityRef.current.set(String(game._id), game.visibility || "public");

      const res = await api.patch(
        `/admin/games/${game._id}/suspend`,
        { reason },
        { withCredentials: true, headers }
      );

      const raw = res.data?.game || res.data || {};
      const nextVisibility = raw.visibility ?? raw.status ?? "suspended";
      const updated = { ...game, ...raw, visibility: nextVisibility };

      setGames((xs) => xs.map((g) => (g._id === game._id ? updated : g)));
      setPendingGames((xs) => xs.map((g) => (g._id === game._id ? updated : g)));

      alert("Game Suspended And Email Sent (If Available).");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  const unsuspendGame = async (game) => {
    if (!confirm("Restore This Game And Make It Available Again?")) return;

    try {
      const res = await api.patch(
        `/admin/games/${game._id}/unsuspend`,
        {},
        { withCredentials: true, headers }
      );

      const raw = res.data?.game || res.data || {};
      const prev = prevGameVisibilityRef.current.get(String(game._id)) || "public";
      const backendVis = raw.visibility ?? raw.status ?? prev;
      const fixedVis = backendVis === "review" ? prev : backendVis;

      const updated = { ...game, ...raw, visibility: fixedVis };

      setGames((xs) => xs.map((g) => (g._id === game._id ? updated : g)));
      setPendingGames((xs) => xs.map((g) => (g._id === game._id ? updated : g)));

      alert("Game Restored.");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  const approveGame = async (id) => {
    if (!confirm("Approve This Game And Publish It?")) return;
    try {
      const res = await api.patch(`/admin/games/${id}/approve`, {}, { withCredentials: true, headers });
      const updated = res.data.game || res.data;

      setPendingGames((xs) => xs.filter((g) => g._id !== id));
      setGames((xs) => {
        const exists = xs.some((g) => g._id === id);
        if (!exists) return [updated, ...xs];
        return xs.map((g) => (g._id === id ? updated : g));
      });

      alert("Approved And Email Sent (If Available).");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  /* ---------- Comment actions ---------- */

  const hideComment = async (comment) => {
    const reason = prompt("Reason For Hiding This Comment", "");
    if (reason === null) return;

    try {
      await api.patch(
        `/admin/comments/${comment._id}/hide`,
        { reason },
        { withCredentials: true, headers }
      );

      await refreshCommentsOnly();
      alert("Comment Hidden.");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  const restoreComment = async (comment) => {
    if (!confirm("Restore This Comment?")) return;

    try {
      await api.patch(`/admin/comments/${comment._id}/restore`, {}, { withCredentials: true, headers });
      await refreshCommentsOnly();
      alert("Comment Restored.");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || e.message);
    }
  };

  const deleteComment = async (comment) => {
    if (!confirm("Permanently Delete This Comment?")) return;
    try {
      await api.delete(`/admin/comments/${comment._id}`, { withCredentials: true, headers });
      setComments((xs) => xs.filter((c) => c._id !== comment._id));
      alert("Comment Deleted.");
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
        <div className="admin-subtitle">Moderation & Management Console</div>
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
                Selected {selectedUserIds.length} User{selectedUserIds.length > 1 ? "s" : ""}
              </div>
            ) : (
              <div className="muted tiny">Tip: Use Checkbox To Select</div>
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
                  <th className="col-actions actions-head" style={{ textAlign: "center" }}>
                    Actions
                  </th>
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
                            <div className="muted tiny">Joined {new Date(u.createdAt).toLocaleDateString()}</div>
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

                      <td className="actions-cell" style={{ textAlign: "center" }}>
                        <ActionMenu menuKey={key} openKey={openMenuKey} setOpenKey={setOpenMenuKey} width={260}>
                          <div className="menu-title">User Actions</div>

                          <MenuItem
                            onClick={() => {
                              setOpenMenuKey(null);
                              if (!isAdmin) setRole(u._id, "admin");
                            }}
                            disabled={isAdmin}
                          >
                            Set Role: Admin
                          </MenuItem>

                          <MenuItem
                            onClick={() => {
                              setOpenMenuKey(null);
                              if (isAdmin) setRole(u._id, "user");
                            }}
                            disabled={!isAdmin}
                          >
                            Set Role: User
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
                              Suspend Account
                            </MenuItem>
                          ) : (
                            <MenuItem
                              onClick={() => {
                                setOpenMenuKey(null);
                                activate(u._id);
                              }}
                            >
                              Reactivate Account
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
                      No Users Found
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
            <div className="muted tiny">Manage Published & Suspended Games</div>
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
                  <th className="col-actions actions-head" style={{ textAlign: "center" }}>
                    Actions
                  </th>
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

                      <td className="actions-cell" style={{ textAlign: "center" }}>
                        <ActionMenu menuKey={key} openKey={openMenuKey} setOpenKey={setOpenMenuKey} width={240}>
                          <div className="menu-title">Game Actions</div>

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
                      No Games Found
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
            <div className="muted tiny">Approve Or Reject Submissions</div>
          </div>

          <div className="table-wrap">
            <table className="table table-fixed pretty pending-table">
              <thead>
                <tr>
                  <th className="col-title">Title</th>
                  <th className="col-uploader">Uploader</th>
                  <th className="col-category">Category</th>
                  <th className="col-created">Submitted</th>
                  <th className="col-actions actions-head" style={{ textAlign: "center" }}>
                    Actions
                  </th>
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

                      <td className="actions-cell" style={{ textAlign: "center" }}>
                        <ActionMenu menuKey={key} openKey={openMenuKey} setOpenKey={setOpenMenuKey} width={260}>
                          <div className="menu-title">Review Actions</div>

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
                            Approve & Publish
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
                      No Pending Submissions 🎉
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
            <div className="muted tiny">Only Comments With Reports Are Shown</div>
          </div>

          <div className="table-wrap">
            <table className="table table-fixed pretty comments-table">
  <colgroup>
    <col className="c-col-game" />
    <col className="c-col-author" />
    <col className="c-col-comment" />
    <col className="c-col-reports" />
    <col className="c-col-status" />
    <col className="c-col-count" />
    <col className="c-col-actions" />
  </colgroup>

  <thead>
    <tr>
      <th>Game</th>
      <th>Author</th>
      <th>Comment</th>
      <th>Reports Detail</th>
      <th>Status</th>
      <th style={{ textAlign: "center" }}>Count</th>
      <th style={{ textAlign: "center" }} className="actions-head">Actions</th>
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

                  const summaryItems = repArr.slice(0, 2).map((r, idx) => {
                    const rep = pickReporter(r);
                    const repId = getReporterId(r);
                    const who = reporterLabel(rep, repId);
                    const why = reportReasonLabel(r);
                    const desc = reportDescriptionLabel(r);
                    const descShort = desc ? ` — ${desc.slice(0, 34)}${desc.length > 34 ? "…" : ""}` : "";
                    return (
                      <div
                        key={idx}
                        className="muted tiny ellipsis"
                        title={`${who} — ${why}${desc ? ` — ${desc}` : ""} (${repId || "No-Id"})`}
                        style={{ fontWeight: 400, textAlign: "left" }}
                      >
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
                            <div className="strong">{c.game?.title || "(Deleted Game)"}</div>
                            {c.game?.slug && <div className="muted tiny ellipsis">{c.game.slug}</div>}
                          </div>
                        </td>

                        <td>
                          <div className="cell-texts">
                            <div className="strong">{c.author?.username || "(Unknown)"}</div>
                            <div className="muted tiny ellipsis">{c.author?.email || "-"}</div>
                          </div>
                        </td>

                        <td>
                          <div className="multiline clamp-3">{c.content || ""}</div>
                          {c.moderationReason && (
                            <div className="muted tiny" style={{ fontWeight: 400 }}>
                              Note: {toTitleCase(c.moderationReason)}
                            </div>
                          )}
                        </td>

                        {/* ✅ จัดใหม่ทั้งช่อง Reports Detail: summary ซ้าย + ปุ่มตาขวา (ไม่ลอยกลาง) */}
                        <td>
  {summaryItems.length > 0 ? (
    <div className="reports-cell">
      <div className="reports-left">
        {repArr.slice(0, 2).map((r, idx) => {
          const rep = pickReporter(r);
          const repId = getReporterId(r);
          const who = reporterLabel(rep, repId);
          const why = reportReasonLabel(r);
          const desc = reportDescriptionLabel(r);
          const descShort = desc ? ` — ${desc.slice(0, 34)}${desc.length > 34 ? "…" : ""}` : "";
          return (
            <div
              key={idx}
              className="report-line ellipsis"
              title={`${who} — ${why}${desc ? ` — ${desc}` : ""} (${repId || "No-Id"})`}
            >
              • {who} — {why}
              {descShort}
            </div>
          );
        })}

        {repArr.length > 2 && (
          <div className="report-more">…And {repArr.length - 2} more</div>
        )}
      </div>

      <button
        type="button"
        className="eye-only-btn"
        onClick={() => {
          setOpenMenuKey(null);
          setOpenReportKey(open ? null : rowReportKey);
        }}
        title={open ? "Hide Details" : "View Details"}
        aria-label={open ? "Hide Details" : "View Details"}
      >
        <EyeIcon size={18} />
      </button>
    </div>
  ) : (
    <div className="muted tiny">-</div>
  )}
</td>


                        <td>
                          <CommentStatusText value={c.status} />
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <ReportsText count={repCount} />
                        </td>

                        <td className="actions-cell" style={{ textAlign: "center" }}>
                          <ActionMenu menuKey={key} openKey={openMenuKey} setOpenKey={setOpenMenuKey} width={220}>
                            <div className="menu-title">Comment Actions</div>

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

                      {/* ✅ จัด Report Details ใหม่: header ชัด + layout กระชับ ไม่โล่ง */}
                      {open && (
                        <tr key={`${c._id}:details`} className="row-sub">
<td colSpan={7}>
  <div className="glass report-details">
    <div className="report-details-head">
      <div className="report-details-title">Report Details</div>
      
    </div>

    {repArr.length === 0 ? (
      <div className="report-details-empty">No Report Details Found.</div>
    ) : (
      <div className="report-details-grid">
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
<div key={idx} className="report-item report-rowline">
  <div className="report-inline">
    <div className="report-who-line">
      <span className="report-who-name ellipsis" title={`${who} (${repId || "No-Id"})`}>
        {who}
      </span>
      <span className="report-dot">•</span>
      <span className="report-who-email ellipsis" title={whoEmail}>
        {whoEmail}
      </span>
    </div>

    <div className="report-field">
      <span className="report-k">Reason</span>
      <span className="report-pill">{why}</span>
    </div>

    <div className="report-field report-desc-field">
      <span className="report-k">Description</span>
      {desc ? (
        <span className="report-desc-inline ellipsis" title={desc}>{desc}</span>
      ) : (
        <span className="report-dash">-</span>
      )}
    </div>
  </div>

  <div className="report-right">
    <span className="report-time">{when}</span>
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
                      No Reported Comments 🎉
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
              <div className="muted tiny">Monthly Voting Leaderboard</div>
              <div className="strong">Showing {monthlyLabel}</div>
              <div className="muted tiny">Most Voted Games In The Selected Month (Top 50)</div>
            </div>

            <div className="monthly-controls">
              <div>
                <label className="muted tiny block" htmlFor="monthSelect">
                  Select Month
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
                title="Load Leaderboard For Selected Month"
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
                  <th style={{ width: "10%", textAlign: "center" }}>Votes</th>
                  <th style={{ width: "8%", textAlign: "center" }} className="actions-head">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {monthlyLeaderboard.map((row, idx) => {
                  const game = row._id || row.game;
                  if (!game) return null;

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

                      <td className="mono" style={{ textAlign: "center" }}>
                        {row.votes}
                      </td>

                      <td className="actions-cell" style={{ textAlign: "center" }}>
                        <a
                          href={`/games/${game._id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn tiny"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "6px 12px",
                            borderRadius: "10px",
                            border: "1px solid rgba(255,255,255,.12)",
                            background: "rgba(255,255,255,.04)",
                            textDecoration: "none",
                          }}
                          title="View"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  );
                })}

                {monthlyLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      No Votes For This Month Yet
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
