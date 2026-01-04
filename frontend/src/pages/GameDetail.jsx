// frontend/src/pages/GameDetail.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";
import RateReviewModal from "../components/RateReviewModal";

/* -----------------------------
  Helpers
------------------------------ */
const isHtmlFile = (u = "") => /\.html?(\?|$)/i.test(String(u || ""));
const isZipFile = (u = "") => /\.zip(\?|$)/i.test(String(u || ""));
const isRarFile = (u = "") => /\.rar(\?|$)/i.test(String(u || ""));

function visibilityLabel(v) {
  switch (v) {
    case "public":
      return "Public";
    case "review":
      return "In review";
    case "unlisted":
      return "Unlisted";
    case "private":
      return "Private";
    case "suspended":
      return "Suspended";
    default:
      return v || "—";
  }
}
function onlyVisibleComments(arr) {
  const list = Array.isArray(arr) ? arr : [];
  return list.filter((c) => String(c?.status || "visible") === "visible");
}

/** ✅ เพิ่มให้แล้ว: ใช้ใน About (Updated ...) */
function prettyDate(iso) {
  const d = new Date(iso || Date.now());
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

function timeAgo(iso) {
  const t = new Date(iso || Date.now()).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - t);

  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  const week = Math.floor(day / 7);
  if (week < 4) return `${week}w ago`;

  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;

  const year = Math.floor(day / 365);
  return `${year}y ago`;
}

/** ✅ กัน cdn() ไปทับ url เต็ม */
function toCdn(u = "") {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^(https?:)?\/\//i.test(s)) return s;
  if (/^data:/i.test(s)) return s;
  if (/^blob:/i.test(s)) return s;
  return cdn(s);
}

/* Fallback images */
const FALLBACK_AVATAR_DATA =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#38bdf8"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="48" fill="url(#g)"/>
  <circle cx="48" cy="38" r="16" fill="rgba(2,6,23,.65)"/>
  <path d="M20 82c4-16 18-24 28-24s24 8 28 24" fill="rgba(2,6,23,.65)"/>
</svg>`);

const FALLBACK_COVER_DATA =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#020617"/>
      <stop offset="1" stop-color="#0b1225"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#bg)"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
    fill="rgba(148,163,184,.75)" font-family="system-ui,Segoe UI" font-size="22">
    No cover
  </text>
</svg>`);

function safeImgSrc(src, fallback) {
  const s = String(src || "").trim();
  if (!s) return fallback;
  return toCdn(s);
}

function Img({ src, alt, className, fallback = FALLBACK_AVATAR_DATA, ...rest }) {
  const [bad, setBad] = useState(false);
  const finalSrc = bad ? fallback : safeImgSrc(src, fallback);
  return <img src={finalSrc} alt={alt} className={className} onError={() => setBad(true)} {...rest} />;
}

/** ✅ FIX: รองรับ author เป็น object หรือเป็น string id */
function getAuthorIdFromComment(c) {
  const a = c?.author;
  if (!a) return "";
  if (typeof a === "object") return String(a._id || "");
  return String(a || "");
}

/** ✅ แปลงลิงก์ YouTube/Vimeo → embed URL */
function toVideoEmbedUrl(rawUrl = "") {
  let raw = String(rawUrl || "").trim();
  if (!raw) return "";

  if (/^www\./i.test(raw)) raw = `https://${raw}`;
  if (/^youtu\.be\//i.test(raw)) raw = `https://${raw}`;
  if (/^youtube\.com\//i.test(raw)) raw = `https://${raw}`;
  if (/^vimeo\.com\//i.test(raw)) raw = `https://${raw}`;

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");

    if (host.includes("youtube.com")) {
      if (url.pathname === "/watch") {
        const vid = url.searchParams.get("v");
        return vid ? `https://www.youtube.com/embed/${vid}` : "";
      }
      const mShorts = url.pathname.match(/^\/shorts\/([^/?#]+)/i);
      if (mShorts?.[1]) return `https://www.youtube.com/embed/${mShorts[1]}`;
      const mEmbed = url.pathname.match(/^\/embed\/([^/?#]+)/i);
      if (mEmbed?.[1]) return `https://www.youtube.com/embed/${mEmbed[1]}`;
      const mV = url.pathname.match(/^\/v\/([^/?#]+)/i);
      if (mV?.[1]) return `https://www.youtube.com/embed/${mV[1]}`;
    }

    if (host === "youtu.be") {
      const vid = url.pathname.replace("/", "").split("/").filter(Boolean)[0];
      return vid ? `https://www.youtube.com/embed/${vid}` : "";
    }

    if (host.includes("vimeo.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const vid = parts[parts.length - 1];
      return vid ? `https://player.vimeo.com/video/${vid}` : "";
    }

    return "";
  } catch {
    return "";
  }
}

/** ✅ อ่านสถานะ "เปิดคอมเมนต์" จากหลายชื่อฟิลด์ */
function isCommentsEnabled(game) {
  const g = game || {};
  const v =
    g.commentsEnabled ??
    g.commentEnabled ??
    g.allowComments ??
    g.enableComments ??
    g.allowComment ??
    g.isCommentsEnabled ??
    undefined;

  return typeof v === "boolean" ? v : true;
}

/** Draft preview support */
function normalizeDraftToGame(draft) {
  const now = new Date().toISOString();
  const kind = draft?.kind === "download" ? "download" : "html";
  return {
    _id: "draft",
    title: draft?.title || "Untitled Game",
    description: draft?.description || "",
    tagline: draft?.tagline || "",
    category: draft?.category || "",
    tags: Array.isArray(draft?.tags) ? draft.tags : [],
    kind,
    visibility: draft?.visibility || "review",
    updatedAt: now,
    createdAt: now,
    coverUrl: draft?.coverPreview || "",
    screens: Array.isArray(draft?.screenPreviews) ? draft.screenPreviews : [],
    videoUrl: draft?.videoUrl || "",
    fileUrl: "",
    uploader: {
      _id: "me",
      username: "you",
      displayName: "You",
      avatarUrl: "",
    },
    commentsEnabled: true,
  };
}

/* -----------------------------
  Report reasons (UI)
------------------------------ */
const REPORT_REASONS = [
  { id: "off_topic", label: "Off topic" },
  { id: "spam", label: "Spam" },
  { id: "offensive", label: "Offensive" },
  { id: "other", label: "Other" },
];

export default function GameDetail() {
  const { id: paramId } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  const draft = location?.state?.draft;
  const isPreview = !!draft;
  const gameId = isPreview ? "draft" : String(paramId || "");

  const [game, setGame] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");

  const [summary, setSummary] = useState({ avg: 0, count: 0, dist: [0, 0, 0, 0, 0] });

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");

  const [replyToId, setReplyToId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyToMeta, setReplyToMeta] = useState(null);

  const [votedThisMonth, setVotedThisMonth] = useState(false);
  const [currentMonthlyVoteGame, setCurrentMonthlyVoteGame] = useState(null);
  const [monthlyVotes, setMonthlyVotes] = useState(0);

  const [openRate, setOpenRate] = useState(false);

  const [stats, setStats] = useState({
    playsCount: 0,
    downloadsCount: 0,
    lastPlayedAt: null,
    lastDownloadedAt: null,
  });

  const [tab, setTab] = useState("about"); // about | media | comments

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const moreBtnRef = useRef(null);

  const trackedPlayRef = useRef(false);
  const commentsTopRef = useRef(null);

  const [ratingOpen, setRatingOpen] = useState(false);
  const ratingRef = useRef(null);

  const [favBusy, setFavBusy] = useState(false);
  const [fav, setFav] = useState(false);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    trackedPlayRef.current = false;
  }, [gameId]);

  // Close menu on outside click + Esc
  useEffect(() => {
    const onDoc = (e) => {
      if (!moreOpen) return;
      const el = moreRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setMoreOpen(false);
    };
    const onKey = (e) => {
      if (!moreOpen) return;
      if (e.key === "Escape") {
        setMoreOpen(false);
        requestAnimationFrame(() => moreBtnRef.current?.focus());
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const onComposeKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitComment();
  };
  const onReplyKeyDown = (e, parentId) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitReply(parentId);
  };

  const requireAuth = (actionName = "do this") => {
    showToast(`Please sign in to ${actionName}.`);
    return false;
  };

  const trackPlay = async () => {
    if (isPreview) return;
    try {
      const res = await api.post(`/games/${gameId}/track-play`);
      const p = res.data?.playsCount;
      const last = res.data?.lastPlayedAt;
      setStats((s) => ({
        ...s,
        playsCount: typeof p === "number" ? p : s.playsCount,
        lastPlayedAt: last ?? s.lastPlayedAt,
      }));
    } catch {}
  };

  const trackDownload = async () => {
    if (isPreview) return;
    try {
      const res = await api.post(`/games/${gameId}/track-download`);
      const d = res.data?.downloadsCount;
      const last = res.data?.lastDownloadedAt;
      setStats((s) => ({
        ...s,
        downloadsCount: typeof d === "number" ? d : s.downloadsCount,
        lastDownloadedAt: last ?? s.lastDownloadedAt,
      }));
    } catch {}
  };

  useEffect(() => {
    let alive = true;

    async function loadAll() {
      setPageError("");

      if (!isPreview && !gameId) {
        setGame(null);
        setPageError("Missing game id.");
        return;
      }

      if (isPreview) {
        const fakeGame = normalizeDraftToGame(draft);
        setGame(fakeGame);
        setMe(null);
        setFav(false);
        setSummary({ avg: 0, count: 0, dist: [0, 0, 0, 0, 0] });
        setStats({ playsCount: 0, downloadsCount: 0, lastPlayedAt: null, lastDownloadedAt: null });
        setComments([]);
        setVotedThisMonth(false);
        setCurrentMonthlyVoteGame(null);
        setMonthlyVotes(0);
        setTab("about");
        setRatingOpen(false);
        return;
      }

      let gameData = null;

      try {
        const g = await api.get(`/games/${gameId}`);
        if (!alive) return;
        gameData = g.data;
        setGame(gameData);
      } catch (e) {
        if (!alive) return;
        setGame(null);
        setPageError(e?.response?.data?.message || "Failed to load game detail.");
        return;
      }

      try {
        const u = await api.get("/users/me");
        if (!alive) return;
        setMe(u.data);
      } catch {
        if (!alive) return;
        setMe(null);
      }

      try {
        const s = await api.get(`/games/${gameId}/ratings`);
        if (!alive) return;
        setSummary(s.data);
      } catch {}

      try {
        const st = await api.get(`/games/${gameId}/stats`);
        if (!alive) return;
        setStats({
          playsCount: st.data?.playsCount || 0,
          downloadsCount: st.data?.downloadsCount || 0,
          lastPlayedAt: st.data?.lastPlayedAt || null,
          lastDownloadedAt: st.data?.lastDownloadedAt || null,
        });
      } catch {
        if (!alive) return;
        setStats({ playsCount: 0, downloadsCount: 0, lastPlayedAt: null, lastDownloadedAt: null });
      }

      const enabled = isCommentsEnabled(gameData);
      if (!enabled) {
        if (!alive) return;
        setComments([]);
      } else {
        try {
          const c = await api.get(`/games/${gameId}/comments`);
          if (!alive) return;
          setComments(onlyVisibleComments(c.data));
        } catch {
          if (!alive) return;
          setComments([]);
        }
      }

      try {
        const mv = await api.get(`/games/${gameId}/monthly-vote/me`, { withCredentials: true });
        if (!alive) return;
        setVotedThisMonth(mv.data.voted || false);
        setCurrentMonthlyVoteGame(mv.data.gameVoted || null);
      } catch {}

      try {
        const countRes = await api.get(`/games/${gameId}/monthly-vote-count`);
        if (!alive) return;
        setMonthlyVotes(countRes.data.count || 0);
      } catch {
        if (!alive) return;
        setMonthlyVotes(0);
      }

      setTab("about");
      setRatingOpen(false);
    }

    loadAll();
    return () => {
      alive = false;
    };
  }, [gameId, isPreview, draft]);

  const downloadOnly = useMemo(
    () => (game ? game.kind === "download" || isRarFile(game.fileUrl) : false),
    [game]
  );

  const playable = useMemo(
    () =>
      game
        ? !downloadOnly && (game.kind === "html" || isHtmlFile(game.fileUrl) || isZipFile(game.fileUrl))
        : false,
    [game, downloadOnly]
  );

  const uploaderObj = game?.uploader && typeof game.uploader === "object" ? game.uploader : null;
  const uploaderId = String((uploaderObj?._id || game?.uploader || "") ?? "");
  const uploader = uploaderObj;

  const isOwner = useMemo(() => {
    if (!me || !game) return false;
    const up = game.uploader?._id || game.uploader;
    return String(me._id) === String(up);
  }, [me, game]);

  const isAdmin = me?.role === "admin";
  const authed = !!me?._id;

  const commentsEnabled = useMemo(() => isCommentsEnabled(game), [game]);

  const screenshots = useMemo(() => game?.screens || [], [game]);
  const videoEmbedUrl = useMemo(() => toVideoEmbedUrl(game?.videoUrl || ""), [game?.videoUrl]);

  const fileSrc = toCdn(game?.fileUrl || "");
  const coverSrc = safeImgSrc(game?.coverUrl, FALLBACK_COVER_DATA);

  const isFavorited = useMemo(() => {
    const list = me?.favorites || [];
    return !!list.find((gid) => String(gid) === String(game?._id));
  }, [me, game?._id]);

  useEffect(() => {
    if (isPreview) return setFav(false);
    setFav(!!isFavorited);
  }, [isFavorited, isPreview]);

  const toggleFavorite = async () => {
    if (isPreview) return showToast("Upload the game first to use Favorites.");
    if (!authed) return requireAuth("use Favorites");
    if (!game?._id || favBusy) return;

    setFavBusy(true);
    try {
      if (fav) {
        await api.delete(`/users/me/favorites/${game._id}`);
        setFav(false);
        setMe((m) => {
          if (!m) return m;
          const next = Array.isArray(m.favorites) ? m.favorites.filter((x) => String(x) !== String(game._id)) : [];
          return { ...m, favorites: next };
        });
        showToast("Removed from Favorites.");
      } else {
        await api.post(`/users/me/favorites/${game._id}`);
        setFav(true);
        setMe((m) => {
          if (!m) return m;
          const cur = Array.isArray(m.favorites) ? m.favorites : [];
          const next = cur.some((x) => String(x) === String(game._id)) ? cur : [...cur, game._id];
          return { ...m, favorites: next };
        });
        showToast("Added to Favorites.");
      }
    } catch (e) {
      showToast(e?.response?.data?.message || "Favorites update failed.");
    } finally {
      setFavBusy(false);
    }
  };

  const ratingText = useMemo(() => {
    const avg = Number(summary?.avg || 0);
    const cnt = Number(summary?.count || 0);
    return cnt > 0 ? `${avg.toFixed(1)} (${cnt})` : "—";
  }, [summary]);

  const ratingBars = useMemo(() => {
    const dist = Array.isArray(summary?.dist) ? summary.dist : [0, 0, 0, 0, 0];
    const total = dist.reduce((a, b) => a + (Number(b) || 0), 0) || 0;
    return dist.map((n) => {
      const v = Number(n) || 0;
      return { v, pct: total > 0 ? (v / total) * 100 : 0 };
    });
  }, [summary]);

  const onDelete = async () => {
    if (isPreview) return showToast("Draft Preview — not uploaded yet.");
    if (!window.confirm("Delete this game permanently?")) return;
    setBusy(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.delete(`/games/${game._id}`, { withCredentials: true, headers });
      nav("/profile");
    } catch (e) {
      showToast(e?.response?.data?.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async () => {
    if (isPreview) return showToast("Upload the game first.");
    if (!commentsEnabled) return;
    if (!authed) return requireAuth("comment");
    const content = commentText.trim();
    if (!content) return showToast("Write something first.");

    try {
      const res = await api.post(`/games/${game._id}/comments`, { content }, { withCredentials: true });
      setComments((xs) => [...xs, res.data]);
      setCommentText("");
      showToast("Comment posted.");

      requestAnimationFrame(() => {
        commentsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to post comment.");
    }
  };

  const submitReply = async (parentId) => {
    if (isPreview) return showToast("Upload the game first.");
    if (!commentsEnabled) return;
    if (!authed) return requireAuth("reply");
    const content = replyText.trim();
    if (!content) return showToast("Write something first.");

    try {
      const res = await api.post(`/games/${game._id}/comments`, { content, parentId }, { withCredentials: true });
      setComments((xs) => [...xs, res.data]);
      setReplyText("");
      setReplyToId(null);
      setReplyToMeta(null);
      showToast("Reply posted.");
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to reply.");
    }
  };

  const reportGame = async () => {
    if (isPreview) return showToast("Upload the game first.");
    const reason = window.prompt("Report reason", "");
    if (reason === null) return;

    try {
      await api.post(`/games/${game._id}/report`, { reason }, { withCredentials: true });
      showToast("Reported. Thank you.");
    } catch (e) {
      showToast(e?.response?.data?.message || "Report failed.");
    }
  };

  /* -----------------------------
    ✅ Report Comment Modal (NEW)
  ------------------------------ */
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null); // comment object
  const [reportReason, setReportReason] = useState("off_topic");
  const [reportDesc, setReportDesc] = useState("");
  const [reportBlock, setReportBlock] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);

  const openReportForComment = (comment) => {
    if (isPreview) return showToast("Upload the game first.");
    if (!commentsEnabled) return;
    if (!me?._id) return requireAuth("report");

    setReportTarget(comment);
    setReportReason("off_topic");
    setReportDesc("");
    setReportBlock(false);
    setReportOpen(true);
  };

  const closeReport = () => {
    setReportOpen(false);
    setReportBusy(false);
  };

  const submitReport = async () => {
    if (!reportTarget?._id) return;
    if (reportBusy) return;

    setReportBusy(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post(
        `/comments/${reportTarget._id}/report`,
        {
          reason: reportReason,
          description: reportDesc,
          blockAuthor: !!reportBlock,
          gameId: game?._id,
        },
        { withCredentials: true, headers } // ✅ เพิ่ม headers
      );

      showToast("Reported. Thank you.");
      closeReport();
    } catch (e) {
      showToast(e?.response?.data?.message || "Report failed.");
      setReportBusy(false);
    }
  };


  // Esc close (report modal)
  useEffect(() => {
    const onKey = (e) => {
      if (!reportOpen) return;
      if (e.key === "Escape") closeReport();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [reportOpen]);

  const reportComment = async (comment) => {
    // ✅ เปลี่ยนจาก prompt() → เปิด modal
    openReportForComment(comment);
  };

  const deleteComment = async (comment) => {
    if (isPreview) return showToast("Draft Preview — no real comments.");
    if (!commentsEnabled) return;
    if (!authed) return requireAuth("delete comments");

    const myId = String(me?._id || "");
    const authorId = getAuthorIdFromComment(comment);
    const isMine = myId && authorId && myId === authorId;

    if (!isMine && !isAdmin) return showToast("You can only delete your own comment.");
    if (!window.confirm("Delete this comment?")) return;

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.delete(`/games/${game._id}/comments/${comment._id}`, { withCredentials: true, headers });

      setComments((prev) => {
        const remove = new Set([String(comment._id)]);
        while (true) {
          let changed = false;
          for (const c of prev) {
            const pid =
              c?.parentId ||
              c?.parent ||
              c?.parentComment ||
              c?.parentCommentId ||
              c?.replyTo ||
              c?.replyToId ||
              c?.reply_to ||
              c?.parent_id ||
              null;

            const parentKey = pid ? String(pid?._id || pid) : null;
            if (parentKey && remove.has(parentKey) && !remove.has(String(c._id))) {
              remove.add(String(c._id));
              changed = true;
            }
          }
          if (!changed) break;
        }
        return prev.filter((x) => !remove.has(String(x._id)));
      });

      if (replyToId && String(replyToId) === String(comment._id)) {
        setReplyToId(null);
        setReplyText("");
        setReplyToMeta(null);
      }

      showToast("Comment deleted.");
    } catch (e) {
      showToast(e?.response?.data?.message || "Delete comment failed.");
    }
  };

  const voteMonthly = async () => {
    if (isPreview) return showToast("Upload the game first.");
    if (!authed) return requireAuth("vote this month");

    if (currentMonthlyVoteGame && String(currentMonthlyVoteGame) !== String(game._id)) {
      if (!window.confirm("You already voted another game this month. Switch vote to this game?")) return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await api.post(`/games/${game._id}/monthly-vote`, {}, { withCredentials: true, headers });
      setVotedThisMonth(true);
      setCurrentMonthlyVoteGame(game._id);
      setMonthlyVotes(res.data.count ?? 0);
      showToast("Vote submitted for this month.");
    } catch (e) {
      showToast(e?.response?.data?.message || "Vote failed.");
    }
  };

  const onDownloadClick = async (e) => {
    e.preventDefault();
    if (isPreview) return showToast("Upload the game first.");
    await trackDownload();
    window.location.href = fileSrc;
  };

  const onFullscreenPlay = () => {
    if (isPreview) return showToast("Upload the game first.");
    trackPlay();
    window.open(fileSrc, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copied.");
    } catch {
      showToast("Copy failed.");
    }
  };

  const openRatingAndScroll = () => {
    setRatingOpen(true);
    requestAnimationFrame(() => {
      ratingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const flatComments = useMemo(() => {
    const list = Array.isArray(comments) ? comments : [];

    const getParent = (c) =>
      c?.parentId ||
      c?.parent ||
      c?.parentComment ||
      c?.parentCommentId ||
      c?.replyTo ||
      c?.replyToId ||
      c?.reply_to ||
      c?.parent_id ||
      null;

    const map = new Map();
    const roots = [];

    for (const c of list) {
      map.set(String(c._id), {
        ...c,
        __children: [],
        __parentKey: null,
        __replyToHandle: "",
        __replyToName: "",
      });
    }

    for (const c of list) {
      const node = map.get(String(c._id));
      const pid = getParent(c);
      const parentKey = pid ? String(pid?._id || pid) : null;

      if (parentKey && map.has(parentKey)) {
        const parentNode = map.get(parentKey);

        const pHandle =
          parentNode?.author?.username ||
          parentNode?.author?.displayName ||
          parentNode?.author?.name ||
          parentNode?.author?.email ||
          "User";

        const pName =
          parentNode?.author?.displayName ||
          parentNode?.author?.username ||
          parentNode?.author?.name ||
          parentNode?.author?.email ||
          "User";

        node.__parentKey = parentKey;
        node.__replyToHandle = String(pHandle || "User");
        node.__replyToName = String(pName || "User");

        parentNode.__children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortRoots = (arr) => arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const sortReplies = (arr) => arr.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    sortRoots(roots);
    for (const r of roots) sortReplies(r.__children);

    const out = [];
    const walk = (node, depth) => {
      out.push({ node, depth });
      const nextDepth = Math.min(2, depth + 1);
      const children = Array.isArray(node.__children) ? [...node.__children] : [];
      sortReplies(children);
      for (const ch of children) walk(ch, nextDepth);
    };

    roots.forEach((r) => walk(r, 0));
    return out;
  }, [comments]);

  if (!game) {
    return (
      <div className="container section">
        <StyleGameDetail />
        <div className="gd-wrap">
          <div className="gd-loadingCard">
            <div className="gd-spinner" />
            <div className="gd-loadingText">Loading…</div>
            {pageError ? <div className="gd-error">⚠ {pageError}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  const tags = Array.isArray(game.tags) ? game.tags : [];
  const metaCategory = game.category || "—";
  const commentsCount = comments.length || 0;
  const votedOnThisGame = votedThisMonth && String(currentMonthlyVoteGame) === String(game._id);
  const monthlyVoteLabel = votedOnThisGame ? "Voted this month ✓" : "Vote this month";

  const reportAuthorName =
    reportTarget?.author?.displayName ||
    reportTarget?.author?.username ||
    reportTarget?.author?.name ||
    reportTarget?.author?.email ||
    "User";

  return (
    <div className="container section">
      <StyleGameDetail />

      <div className="gd-wrap">
        <section className="gd-frame">
          {playable && !downloadOnly && fileSrc && !isPreview ? (
            <iframe
              title={game.title}
              src={fileSrc}
              className="gd-iframe"
              allow="autoplay; fullscreen *; gamepad; xr-spatial-tracking"
              onLoad={() => {
                if (trackedPlayRef.current) return;
                trackedPlayRef.current = true;
                trackPlay();
              }}
            />
          ) : (
            <img src={coverSrc} alt="cover" className="gd-cover" />
          )}

          <div className="gd-frameCorner">
            {!downloadOnly ? (
              <button className="gd-iconBtn" onClick={onFullscreenPlay} title="Play fullscreen (opens a new tab)" type="button">
                ⛶
              </button>
            ) : (
              <a className="gd-iconBtn" href={fileSrc || "#"} download onClick={onDownloadClick} title="Download">
                ⬇
              </a>
            )}
          </div>
        </section>

        <section className="gd-titlebar" aria-label="Game header">
          <div className="gd-titleLeft">
            <div className="gd-title">{game.title}</div>

            <div className="gd-submeta" aria-label="Game stats">
              <button
                className="gd-chipMeta gd-chipMetaBtn"
                title="See rating breakdown"
                type="button"
                onClick={() => {
                  setTab("about");
                  openRatingAndScroll();
                }}
              >
                ⭐ <b>{ratingText}</b>
              </button>

              {!downloadOnly ? (
                <span className="gd-chipMeta" title="Plays">
                  🎮 <b>{stats.playsCount || 0}</b> plays
                </span>
              ) : (
                <span className="gd-chipMeta" title="Downloads">
                  📥 <b>{stats.downloadsCount || 0}</b> downloads
                </span>
              )}

              <span className="gd-chipMeta" title="Votes this month (total)">
                🗳️ <b>{monthlyVotes || 0}</b> votes
              </span>
            </div>

            <div className="gd-tabs" role="tablist" aria-label="Sections">
              <button className={`gd-tab ${tab === "about" ? "is-on" : ""}`} onClick={() => setTab("about")} role="tab" aria-selected={tab === "about"} type="button">
                About
              </button>
              <button className={`gd-tab ${tab === "media" ? "is-on" : ""}`} onClick={() => setTab("media")} role="tab" aria-selected={tab === "media"} type="button">
                Media
              </button>
              <button className={`gd-tab ${tab === "comments" ? "is-on" : ""}`} onClick={() => setTab("comments")} role="tab" aria-selected={tab === "comments"} type="button">
                Comments {commentsCount > 0 ? <span className="gd-badge">{commentsCount}</span> : null}
              </button>
            </div>
          </div>

          <div className="gd-titleRight">
            <div className="gd-actions" aria-label="Primary actions">
              <button
                className={`gd-btn ${fav ? "is-on" : ""}`}
                onClick={toggleFavorite}
                type="button"
                disabled={favBusy || (isPreview ? true : false)}
                title={
                  isPreview
                    ? "Upload the game first to use Favorites."
                    : !authed
                      ? "Log in to use Favorites."
                      : fav
                        ? "Remove from Favorites"
                        : "Add to Favorites"
                }
              >
                {fav ? "★ In Favorites" : "☆ Add to Favorites"}
              </button>

              <button
                className={`gd-btn ${votedOnThisGame ? "is-on" : ""}`}
                onClick={voteMonthly}
                title={votedOnThisGame ? "You already voted for this game this month." : "Vote for this game (once per month)."}
                type="button"
              >
                {monthlyVoteLabel}
              </button>

              <div className="gd-more" ref={moreRef}>
                <button className="gd-btn" onClick={() => setMoreOpen((v) => !v)} type="button" aria-haspopup="menu" aria-expanded={moreOpen} ref={moreBtnRef}>
                  More ▾
                </button>

                {moreOpen ? (
                  <div className="gd-menu" role="menu" aria-label="More actions">
                    <button className="gd-menuItem" onClick={copyLink} type="button" role="menuitem">
                      Copy link
                    </button>



                    {(me && (String(me._id) === String(game?.uploader?._id || game?.uploader) || me?.role === "admin")) && !isPreview ? (
                      <>
                        <div className="gd-menuSep" />
                        <button
                          className="gd-menuItem"
                          onClick={() => {
                            setMoreOpen(false);
                            nav(`/games/${game._id}/edit`);
                          }}
                          type="button"
                          role="menuitem"
                        >
                          Edit
                        </button>
                        <button
                          className="gd-menuItem gd-menuItem--danger"
                          onClick={() => {
                            setMoreOpen(false);
                            onDelete();
                          }}
                          disabled={busy}
                          type="button"
                          role="menuitem"
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="gd-miniHint">{downloadOnly ? "Tip: Download from ⬇ on the game frame." : "Tip: Fullscreen from ⛶ on the game frame."}</div>
          </div>
        </section>

        {tab === "about" ? (
          <section className="gd-card" role="tabpanel" aria-label="About">
            <div className="gd-cardTitle">Game description</div>

            <div className="gd-aboutMeta" aria-label="Game meta">
              <span className="gd-metaTag" title="Category">
                <span className="gd-metaKey">Category</span>
                <span className="gd-metaVal gd-metaVal--cap">{metaCategory}</span>

              </span>

              <span className="gd-metaTag gd-metaTag--soft" title="Type">
                <span className="gd-metaKey">Type</span>
                <span className="gd-metaVal">{downloadOnly ? "Downloadable" : "Playable"}</span>
              </span>

              <span className="gd-metaTag gd-metaTag--soft" title="Visibility">
                <span className="gd-metaKey">Visibility</span>
                <span className="gd-metaVal">{visibilityLabel(game.visibility)}</span>
              </span>

              <span className="gd-muted">Updated {prettyDate(game.updatedAt || game.createdAt)}</span>
            </div>

            {uploader ? (
              <div className="gd-uploader">
                <Link className="gd-miniUser" to={isPreview ? "#" : `/users/${String(uploaderId)}`}>
                  <Img src={uploader.avatarUrl || uploader.avatar || uploader.photoURL || ""} alt="user" className="gd-miniUser__av" />
                  <span className="gd-miniUser__name">{uploader.displayName || uploader.username || uploader.name || "unknown"}</span>
                </Link>

                {tags?.length ? (
                  <div className="gd-tags" aria-label="Tags">
                    {tags.slice(0, 10).map((t) => (
                      <span key={t} className="gd-tag">
                        #{t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {game.tagline ? <div className="gd-tagline">{game.tagline}</div> : null}
            <div className="gd-text">{game.description?.trim() || "No description."}</div>

            {authed ? (
              <details
                className={`gd-details ${ratingOpen ? "is-open" : ""}`}
                open={ratingOpen}
                onToggle={(e) => setRatingOpen(e.currentTarget.open)}
                ref={ratingRef}
              >
                <summary className="gd-detailsSum">Rating breakdown</summary>

                <div className="gd-rateRow">
                  <div className="gd-rateRow__left">
                    <div className="gd-rateRow__title">How was it?</div>
                    <div className="gd-rateRow__sub">Rate this game to help others.</div>
                  </div>

                  <button
                    className="gd-btnPrimary gd-btnPrimary--ghost"
                    type="button"
                    onClick={() => {
                      if (isPreview) return showToast("Upload the game first.");
                      setOpenRate(true);
                    }}
                  >
                    Rate this game
                  </button>
                </div>

                <div className="gd-rbars">
                  {[5, 4, 3, 2, 1].map((star) => {
  // dist = [1★,2★,3★,4★,5★] => index = star-1
  const row = ratingBars[star - 1] || { v: 0, pct: 0 };
  return (
    <div key={star} className="gd-rrow">
      <div className="gd-rrow__left">{star}★</div>
      <div className="gd-rrow__bar">
        <div className="gd-rrow__fill" style={{ width: `${row.pct}%` }} />
      </div>
      <div className="gd-rrow__right">{row.v}</div>
    </div>
  );
})}

                </div>
              </details>
            ) : null}
          </section>
        ) : null}

        {tab === "media" ? (
          <section className="gd-card" role="tabpanel" aria-label="Media">
            <div className="gd-cardTitle">Media</div>

            {videoEmbedUrl ? (
              <div className="gd-slimBlock">
                
                <div className="gd-video">
                  <iframe
                    src={videoEmbedUrl}
                    title="Game trailer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <div className="gd-note">No trailer provided.</div>
            )}

            <div className="gd-slimBlock">
              <div className="gd-subTitle">Screenshots</div>

              {screenshots.length > 0 ? (
                <div className="gd-shots">
                  {screenshots.slice(0, 12).map((u, i) => (
                    <button
                      key={i}
                      className="gd-shot"
                      type="button"
                      onClick={() => window.open(toCdn(u), "_blank", "noopener,noreferrer")}
                      title="Open image"
                    >
                      <img src={toCdn(u)} alt={`s-${i}`} loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="gd-note">No screenshots provided.</div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "comments" ? (
          <section className="gd-card" role="tabpanel" aria-label="Comments">
            <div ref={commentsTopRef} />
            <div className="gd-cardTitle">Comments</div>

            {!commentsEnabled ? (
              <div className="gd-note">Comments are disabled by the owner.</div>
            ) : isPreview ? (
              <div className="gd-note">Draft Preview — comments will be available after upload.</div>
            ) : (
              <>
                {!authed ? (
                  <div className="gd-note">Sign in to leave a comment.</div>
                ) : (
                  <div className="gd-compose">
                    <textarea
                      className="gd-input"
                      rows={3}
                      placeholder="Write a comment…"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={onComposeKeyDown}
                    />
                    <div className="gd-composeBar">
                      <button className="gd-btnPrimary" onClick={submitComment} type="button">
                        Post
                      </button>
                    </div>
                  </div>
                )}

                <div className="gd-commentList gd-commentList--best">
                  {flatComments.length === 0 ? (
                    <div className="gd-note">No comments yet.</div>
                  ) : (
                    flatComments.map(({ node, depth }) => (
                      <CommentRow
                        key={node._id}
                        c={node}
                        depth={depth}
                        me={me}
                        isAdmin={isAdmin}
                        authed={authed}
                        onReply={(meta) => {
                          setReplyToId(node._id);
                          setReplyText("");
                          setReplyToMeta(meta);
                        }}
                        onDelete={() => deleteComment(node)}
                        onReport={() => reportComment(node)}
                        replyToId={replyToId}
                        replyToMeta={replyToMeta}
                        replyText={replyText}
                        setReplyText={setReplyText}
                        onSubmitReply={() => submitReply(node._id)}
                        onCancelReply={() => {
                          setReplyToId(null);
                          setReplyText("");
                          setReplyToMeta(null);
                        }}
                        onReplyKeyDown={onReplyKeyDown}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        ) : null}

        <RateReviewModal
          game={game}
          open={openRate}
          onClose={() => setOpenRate(false)}
          authed={authed}
          onUpdated={(sum) => setSummary((s) => ({ ...s, ...sum }))}
        />

        {/* ✅ Report Comment Modal UI (เหมือนภาพ) */}
        {reportOpen ? (
          <div
            className="gd-modalBack"
            role="dialog"
            aria-modal="true"
            aria-label="Report comment"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeReport();
            }}
          >
            <div className="gd-modalCard" onMouseDown={(e) => e.stopPropagation()}>
              <div className="gd-modalTop">
                <div className="gd-modalTitle">Report post by {reportAuthorName}</div>
                <button className="gd-modalX" type="button" onClick={closeReport} aria-label="Close">
                  ×
                </button>
              </div>

              <div className="gd-modalBody">
                <div className="gd-modalNote">
                  Reports will be viewed by the moderators of the board. You can also block this person to hide all their posts from you.
                </div>

                <div className="gd-field">
                  <div className="gd-fieldLabel">Reason</div>
                  <div className="gd-radioCol" role="radiogroup" aria-label="Report reason">
                    {REPORT_REASONS.map((r) => (
                      <label key={r.id} className="gd-radio">
                        <input
                          type="radio"
                          name="reportReason"
                          value={r.id}
                          checked={reportReason === r.id}
                          onChange={() => setReportReason(r.id)}
                        />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="gd-field">
                  <div className="gd-fieldLabel">
                    Description <span className="gd-fieldHint">— Any additional information</span>
                  </div>
                  <textarea
                    className="gd-modalTextarea"
                    rows={4}
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    placeholder=""
                  />
                </div>

                <div className="gd-modalActions">
                  <button className="gd-btn" type="button" onClick={closeReport} disabled={reportBusy}>
                    Cancel
                  </button>
                  <button className="gd-dangerBtn" type="button" onClick={submitReport} disabled={reportBusy}>
                    {reportBusy ? "Submitting…" : "Submit report"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {toast ? (
          <div className="gd-toast" role="status" aria-live="polite">
            {toast}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -----------------------------
  Comment Row (Best: no connector line, clear replying-to)
------------------------------ */
function CommentRow({
  c,
  depth,
  me,
  isAdmin,
  authed,
  onReply,
  onDelete,
  onReport,
  replyToId,
  replyToMeta,
  replyText,
  setReplyText,
  onSubmitReply,
  onCancelReply,
  onReplyKeyDown,
}) {
  const myId = String(me?._id || "");
  const authorId = getAuthorIdFromComment(c);
  const isMine = myId && authorId && myId === authorId;

  const canDelete = isMine || isAdmin;
  const canReport = authed && !isMine;

  const authorName = c.author?.displayName || c.author?.username || c.author?.name || c.author?.email || "User";
  const authorHandle = c.author?.username || authorName;

  const avatar = c.author?.avatarUrl || c.author?.avatar || c.author?.photoURL || "";

  const active = replyToId && String(replyToId) === String(c._id);

  const replyInputRef = useRef(null);
  useEffect(() => {
    if (active) requestAnimationFrame(() => replyInputRef.current?.focus());
  }, [active]);

  const timeFull = new Date(c.createdAt || Date.now()).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const timeShort = timeAgo(c.createdAt);
  const replyingToHandle = String(c.__replyToHandle || "").trim();

  return (
    <div className={`gd-crow ${depth > 0 ? "is-reply" : ""}`} style={{ ["--indent"]: depth }}>
      <div className="gd-thread">
        <div className="gd-thread__avWrap">
          <Img className="gd-thread__av" src={avatar} alt="" fallback={FALLBACK_AVATAR_DATA} />
        </div>

        <div className="gd-thread__main">
          <div className="gd-bubble">
            <div className="gd-bubble__top">
              <span className="gd-bubble__name">{authorName}</span>
              {depth > 0 && replyingToHandle ? <span className="gd-replyInline">replying to @{replyingToHandle}</span> : null}
            </div>

            <div className="gd-bubble__text">{c.content?.trim() || <span className="gd-muted">(no text)</span>}</div>
          </div>

          <div className="gd-metaRow">
            {authed ? (
              <button
                className="gd-miniAction"
                onClick={() =>
                  onReply({
                    username: authorHandle,
                    preview: (c.content || "").trim().slice(0, 120),
                  })
                }
                type="button"
              >
                Reply
              </button>
            ) : null}

            {canReport ? (
              <button className="gd-miniAction gd-miniAction--warn" onClick={onReport} type="button">
                Report
              </button>
            ) : null}

            {authed && canDelete ? (
              <button className="gd-miniAction gd-miniAction--danger" onClick={onDelete} type="button">
                Delete
              </button>
            ) : null}

            <span className="gd-metaRow__dot">·</span>
            <span className="gd-metaRow__time" title={timeFull}>
              {timeShort}
            </span>
          </div>

          {active ? (
            <div className="gd-replyBox gd-replyBox--best">
              <div className="gd-replyMeta">
                Replying to <b>@{replyToMeta?.username || replyingToHandle || "User"}</b>
                {replyToMeta?.preview ? <span className="gd-replyPreview">“{replyToMeta.preview}”</span> : null}
              </div>
              <textarea
                ref={replyInputRef}
                className="gd-input"
                rows={2}
                placeholder="Write a reply…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => onReplyKeyDown?.(e, c._id)}
              />
              <div className="gd-replyBar">
                <button className="gd-btnPrimary" onClick={onSubmitReply} type="button">
                  Reply
                </button>
                <button className="gd-btn" onClick={onCancelReply} type="button">
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
  CSS: โทนเดียวกับเว็บ + Best comments (no connector line)
------------------------------ */
function StyleGameDetail() {
  return (
    <style>{`
:root{
  --gd-bg: var(--bg, #0B0F14);
  --gd-panel: var(--panel, #151A22);
  --gd-stroke: var(--stroke, rgba(255,255,255,.12));
  --gd-glass: var(--glass, rgba(255,255,255,.06));
  --gd-text: var(--text, #EAF2FF);
  --gd-muted: var(--muted, #A9B1BB);
  --gd-brand: var(--brand, #38BDF8);
  --gd-shadow: var(--shadow, 0 24px 60px rgba(0,0,0,.55));
  --best-step: 26px;
  --best-bar: rgba(255,255,255,.14);
}
.gd-metaVal--cap { text-transform: capitalize; }

.gd-wrap{ max-width: 980px; margin: 0 auto; padding: 0 12px; color: var(--gd-text); }

/* Loading */
.gd-loadingCard{
  margin-top: 36px;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid var(--gd-stroke);
  background: rgba(255,255,255,.04);
  box-shadow: var(--gd-shadow);
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:10px;
}
.gd-spinner{
  width:18px;height:18px;border-radius:999px;
  border:2px solid rgba(255,255,255,.16);
  border-top-color: var(--gd-brand);
  animation: spin .8s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}
.gd-loadingText{font-weight:900}
.gd-error{
  width:100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(248,113,113,.40);
  background: rgba(248,113,113,.08);
}

/* Frame */
.gd-frame{
  border-radius: 18px;
  overflow:hidden;
  background: rgba(0,0,0,.22);
  border: 1px solid var(--gd-stroke);
  box-shadow: var(--gd-shadow);
  position:relative;
}
.gd-iframe{
  width:100%;
  height: 520px;
  border:0;
  display:block;
  background: rgba(0,0,0,.35);
}
.gd-cover{
  width:100%;
  height: 520px;
  object-fit: cover;
  display:block;
  background: rgba(0,0,0,.35);
}
@media (max-width: 980px){
  .gd-iframe,.gd-cover{ height: 420px; }
}
@media (max-width: 520px){
  .gd-iframe,.gd-cover{ height: 300px; }
}
.gd-frameCorner{
  position:absolute;
  right: 10px;
  bottom: 10px;
  display:flex;
  gap: 8px;
}
.gd-iconBtn{
  border: 1px solid rgba(255,255,255,.14);
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: rgba(255,255,255,.08);
  color: rgba(255,255,255,.92);
  font-weight: 900;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  text-decoration:none;
  backdrop-filter: blur(8px);
}
.gd-iconBtn:hover{ border-color: rgba(56,189,248,.40); }

/* Header bar */
.gd-titlebar{
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid var(--gd-stroke);
  background: rgba(255,255,255,.04);
  box-shadow: 0 12px 40px rgba(0,0,0,.35);
  padding: 14px;
  display:flex;
  justify-content:space-between;
  gap: 12px;
}
@media (max-width: 860px){
  .gd-titlebar{ flex-direction:column; }
}
.gd-title{ font-size: 18px; font-weight: 900; color: rgba(255,255,255,.94); }

.gd-submeta{
  margin-top: 8px;
  display:flex;
  flex-wrap:wrap;
  gap: 8px;
  align-items:center;
  color: rgba(255,255,255,.70);
  font-size: 13px;
}
.gd-chipMeta{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding: 0;                      /* ✅ ไม่ให้เป็นแคปซูล */
  border-radius: 0;

  border: 0 !important;
  background: transparent !important;
}

.gd-chipMeta b{ color: rgba(255,255,255,.92); font-weight: 900; }

.gd-chipMetaBtn{ cursor:pointer; transition: transform .12s ease; }
.gd-chipMetaBtn:hover{ border-color: rgba(56,189,248,.40); transform: translateY(-1px); }

.gd-titleRight{ display:flex; flex-direction:column; align-items:flex-end; gap: 8px; }
@media (max-width: 860px){ .gd-titleRight{ align-items:flex-start; } }

.gd-actions{ display:flex; flex-wrap:wrap; gap: 8px; align-items:center; }

.gd-btn{
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-weight: 900;
  padding: 8px 12px;
  border-radius: 12px;
  cursor:pointer;
  text-decoration:none;
  transition: transform .12s ease, border-color .12s ease, background .12s ease;
}
.gd-btn:hover{ border-color: rgba(56,189,248,.40); transform: translateY(-1px); }
.gd-btn:active{ transform: translateY(0px); }
.gd-btn:disabled{ opacity: .6; cursor:not-allowed; transform:none; }
.gd-btn:focus-visible{
  outline: 2px solid rgba(56,189,248,.22);
  box-shadow: 0 0 0 6px rgba(56,189,248,.10);
}
.gd-btn.is-on{
  border-color: rgba(56,189,248,.55);
  background: rgba(56,189,248,.12);
}

.gd-miniHint{ font-size: 12px; color: rgba(255,255,255,.60); }

/* Tabs */
.gd-tabs{
  margin-top: 10px;
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,.08);
}
.gd-tab{
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.16);
  color: rgba(255,255,255,.88);
  font-weight: 900;
  cursor:pointer;
  padding: 7px 12px;
  border-radius: 12px;
  transition: border-color .12s ease, background .12s ease, transform .12s ease;
}
.gd-tab:hover{ border-color: rgba(56,189,248,.35); transform: translateY(-1px); }
.gd-tab:active{ transform: translateY(0px); }
.gd-tab:focus-visible{
  outline: 2px solid rgba(56,189,248,.22);
  box-shadow: 0 0 0 6px rgba(56,189,248,.10);
}
.gd-tab.is-on{
  border-color: rgba(56,189,248,.55);
  background: rgba(56,189,248,.10);
}

.gd-badge{
  margin-left: 6px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
}

/* More menu */
.gd-more{ position:relative; }
.gd-menu{
  position:absolute;
  right:0;
  top: calc(100% + 8px);
  min-width: 190px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(15,23,42,.96);
  box-shadow: 0 18px 60px rgba(0,0,0,.55);
  padding: 8px;
  z-index: 50;
}
.gd-menuItem{
  width:100%;
  text-align:left;
  border: 0;
  background: transparent;
  color: rgba(255,255,255,.92);
  padding: 10px 10px;
  border-radius: 10px;
  cursor:pointer;
  font-weight: 900;
}
.gd-menuItem:hover{ background: rgba(255,255,255,.06); }
.gd-menuSep{ height:1px; background: rgba(255,255,255,.10); margin: 6px 4px; }
.gd-menuItem--danger{ color: rgba(254,202,202,.96); }
.gd-menuItem--danger:hover{ background: rgba(248,113,113,.12); }

/* Cards */
.gd-card{
  margin-top: 12px;
  border-radius: 16px;
  padding: 16px;
  border: 1px solid var(--gd-stroke);
  background: rgba(255,255,255,.04);
  box-shadow: 0 12px 40px rgba(0,0,0,.25);
}
.gd-cardTitle{
  font-weight: 900;
  font-size: 13px;
  margin-bottom: 10px;
  color: rgba(255,255,255,.92);
}
.gd-subTitle{ font-weight: 900; font-size: 13px; margin-bottom: 10px; color: rgba(255,255,255,.90); }

.gd-aboutMeta{
  display:flex;
  flex-wrap:wrap;
  gap: 8px;
  align-items:center;
  margin-bottom: 10px;
}
.gd-metaTag{
  border: 0 !important;
  background: transparent !important;
  padding: 4px 10px !important;
  border-radius: 0 !important;
  gap: 8px;
  display:inline-flex;
  align-items:center;
  font-size: 12px;
  font-weight: 600;
}
.gd-metaKey{ color: rgba(255,255,255,.60); font-weight: 600; }
.gd-metaVal{ color: rgba(255,255,255,.92); font-weight: 700; }
.gd-muted{ color: rgba(255,255,255,.70); font-size: 12px; }

.gd-uploader{
  display:flex;
  justify-content:space-between;
  gap: 10px;
  align-items:center;
  margin: 10px 0;
  flex-wrap:wrap;
}
.gd-miniUser{
  display:inline-flex;
  gap: 8px;
  align-items:center;
  text-decoration:none;
  color: rgba(255,255,255,.92);
  font-weight: 900;
}
.gd-miniUser:hover{ text-decoration: underline; }
.gd-miniUser__av{
  width: 22px; height: 22px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.16);
  object-fit: cover;
  background: rgba(255,255,255,.06);
}
.gd-miniUser__name{ max-width: 240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.gd-tags{ display:flex; flex-wrap:wrap; gap: 6px; }
.gd-tag{
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
  color: rgba(255,255,255,.82);
  font-weight: 700;
}

.gd-tagline{ font-weight: 800; margin: 8px 0 10px; color: rgba(255,255,255,.90); }
.gd-text{
  white-space: pre-wrap;
  line-height: 1.85;
  color: rgba(255,255,255,.82);
  font-size: 16px;
  letter-spacing: .1px;
}
@media (max-width: 520px){
  .gd-text{ font-size: 15px; line-height: 1.8; }
}
.gd-slimBlock{ margin-top: 12px; }

/* Details */
.gd-details{
  margin-top: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.14);
  padding: 10px 12px;
}
.gd-details.is-open{
  outline: 2px solid rgba(56,189,248,.20);
  box-shadow: 0 0 0 6px rgba(56,189,248,.10);
}
.gd-detailsSum{ cursor:pointer; font-weight: 900; color: rgba(255,255,255,.90); }

.gd-rateRow{
  margin-top: 10px;
  margin-bottom: 12px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.03);
}
@media (max-width: 520px){
  .gd-rateRow{ flex-direction:column; align-items:flex-start; }
}
.gd-rateRow__title{ font-weight: 900; color: rgba(255,255,255,.92); font-size: 13px; }
.gd-rateRow__sub{ margin-top: 2px; font-size: 12px; color: rgba(255,255,255,.65); }

.gd-rbars{ display:flex; flex-direction:column; gap: 8px; margin-top: 10px; }
.gd-rrow{ display:grid; grid-template-columns: 34px 1fr 40px; gap: 10px; align-items:center; }
.gd-rrow__left{ font-size: 12px; color: rgba(255,255,255,.72); font-weight: 900; }
.gd-rrow__bar{
  height: 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.18);
  overflow:hidden;
}
.gd-rrow__fill{ height: 100%; background: rgba(56,189,248,.85); border-radius: 999px; }
.gd-rrow__right{ font-size: 12px; color: rgba(255,255,255,.70); text-align:right; font-weight: 900; }

/* Video */
.gd-video{
  border-radius: 16px;
  overflow:hidden;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.22);
  aspect-ratio: 16/9;
}
.gd-video iframe{ width:100%; height:100%; border:0; }

/* Shots */
.gd-shots{
  display:grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 10px;
}
@media (max-width: 920px){ .gd-shots{ grid-template-columns: repeat(3, 1fr);} }
@media (max-width: 640px){ .gd-shots{ grid-template-columns: repeat(2, 1fr);} }
.gd-shot{
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.18);
  border-radius: 14px;
  overflow:hidden;
  cursor:pointer;
  padding:0;
  transition: border-color .12s ease, transform .12s ease;
}
.gd-shot:hover{ border-color: rgba(56,189,248,.35); transform: translateY(-1px); }
.gd-shot:active{ transform: translateY(0px); }
.gd-shot img{ width:100%; height: 140px; object-fit:cover; display:block; }

/* Notes */
.gd-note{
  padding: 12px;
  border-radius: 14px;
  border: 1px dashed rgba(255,255,255,.18);
  background: rgba(0,0,0,.12);
  color: rgba(255,255,255,.78);
}

/* Compose + comments (Post button beside textarea) */
.gd-compose{
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    "input post"
    "hint  post";
  gap: 10px;
  align-items: start;
}

.gd-input{
  grid-area: input;
  width:100%;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.18);
  color: rgba(255,255,255,.92);
  padding: 10px 12px;
  outline:none;
  resize: vertical;
  min-height: 52px;
  height: 44px;
}

.gd-input:focus{
  border-color: rgba(56,189,248,.55);
  box-shadow: 0 0 0 4px rgba(56,189,248,.10);
}
.gd-composeBar{ display: contents; }
.gd-composeBar .gd-btnPrimary{
  grid-area: post;
  align-self: start;
  min-height: 50px;
  padding: 0 18px;
  white-space: nowrap;
  border: 0;
  border-radius: 12px;
  background: rgba(56,189,248,.92);
  color: rgba(0,0,0,.88);
  font-weight: 900;
  cursor:pointer;
}
.gd-composeBar .gd-btnPrimary:hover{ filter: brightness(1.03); }

@media (max-width: 520px){
  .gd-compose{
    grid-template-columns: 1fr;
    grid-template-areas:
      "input"
      "hint"
      "post";
  }
  .gd-composeBar .gd-btnPrimary{
    width: 100%;
    min-height: 44px;
    padding: 10px 14px;
  }
}

/* ✅ Best comment list */
.gd-commentList{ margin-top: 12px; display:flex; flex-direction:column; gap: 14px; }
.gd-commentList--best{ gap: 16px; }

/* indentation */
.gd-crow{
  --indent: 0;
  position: relative;
  padding-left: calc(var(--indent) * var(--best-step));
}
.gd-crow.is-reply .gd-thread__main{
  border-left: 2px solid var(--best-bar);
  padding-left: 12px;
}

/* row layout */
.gd-thread{ display:flex; gap: 10px; align-items:flex-start; }

/* avatar */
.gd-thread__avWrap{ width: 34px; flex-shrink:0; }
.gd-thread__av{
  width: 34px; height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  object-fit: cover;
  background: rgba(255,255,255,.06);
  display:block;
}
.gd-thread__main{ flex:1; min-width:0; }

/* bubble */
.gd-bubble{
  display:inline-block;
  max-width: 100%;
  border-radius: 18px;
  padding: 10px 12px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.10);
}
.gd-bubble__top{
  display:flex;
  gap: 8px;
  align-items:center;
  flex-wrap: wrap;
}
.gd-bubble__name{
  font-weight: 900;
  color: rgba(255,255,255,.92);
  font-size: 13px;
}
.gd-bubble__text{
  margin-top: 6px;
  white-space: pre-wrap;
  line-height: 1.65;
  color: rgba(255,255,255,.88);
  font-size: 14px;
}

/* ✅ replying label แบบ text ล้วน */
.gd-replyInline{
  display:inline;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: 0;
  color: rgba(255,255,255,.62);
  font-size: 12px;
  font-weight: 700;
}

/* actions row */
.gd-metaRow{
  margin-top: 6px;
  display:flex;
  gap: 10px;
  align-items:center;
  flex-wrap:wrap;
  padding-left: 6px;
  color: rgba(255,255,255,.70);
}
.gd-miniAction{
  border:0;
  background:none;
  color: rgba(147,197,253,.95);
  font-weight: 900;
  cursor:pointer;
  padding: 0;
  font-size: 13px;
}
.gd-miniAction:hover{ text-decoration: underline; }
.gd-miniAction--danger{ color: rgba(251,113,133,.95); }
.gd-miniAction--warn{ color: rgba(245,158,11,.95); }
.gd-metaRow__dot{ color: rgba(255,255,255,.40); }
.gd-metaRow__time{ font-size: 12px; color: rgba(255,255,255,.60); }

/* reply box */
.gd-replyBox{
  margin-top: 10px;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.12);
}
.gd-replyBox--best{ margin-left: 6px; }
.gd-replyMeta{
  font-size: 12px;
  color: rgba(255,255,255,.72);
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.gd-replyPreview{ color: rgba(255,255,255,.60); font-style: italic; }
.gd-replyBar{ display:flex; justify-content:flex-end; gap: 10px; margin-top: 10px; }

/* Toast */
.gd-toast{
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(2,6,23,.92);
  color: rgba(255,255,255,.92);
  box-shadow: 0 18px 60px rgba(0,0,0,.55);
  z-index: 200;
  font-weight: 900;
  font-size: 13px;
}

/* ✅ Force Reply button to match Post button */
.gd-replyBox .gd-btnPrimary{
  background: rgba(56,189,248,.92) !important;
  color: rgba(0,0,0,.88) !important;
  border: 0 !important;
}
.gd-replyBox .gd-btnPrimary:hover{ filter: brightness(1.03); }
.gd-replyBox .gd-btn{
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
}

/* ✅ Rate this game (ghost) ให้เหมือนปุ่ม Post/Reply */
.gd-btnPrimary--ghost{
  border: 0 !important;
  border-radius: 12px !important;
  background: rgba(56,189,248,.92) !important;
  color: rgba(0,0,0,.88) !important;
  font-weight: 900 !important;
  padding: 9px 14px !important;
  cursor: pointer;
}
.gd-btnPrimary--ghost:hover{ filter: brightness(1.03); }

/* =========================
   ✅ Report modal styles (NEW)
========================= */
.gd-modalBack{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 500;
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 18px;
}
.gd-modalCard{
  width: min(620px, 100%);
  border-radius: 14px;
  border: 1px solid var(--gd-stroke);
  background: var(--gd-panel); 
  box-shadow: 0 30px 90px rgba(0,0,0,.65);
  overflow:hidden;
}
.gd-modalTop{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,.10);
}
.gd-modalTitle{
  font-weight: 900;
  color: rgba(255,255,255,.95);
}
.gd-modalX{
  width: 34px; height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-size: 18px;
  cursor:pointer;
}
.gd-modalX:hover{ border-color: rgba(56,189,248,.40); }
.gd-modalBody{ padding: 14px 16px 16px; }

.gd-modalNote{
  color: rgba(255,255,255,.72);
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 14px;
}

.gd-field{ margin-top: 12px; }
.gd-fieldLabel{
  font-weight: 900;
  color: rgba(255,255,255,.92);
  font-size: 13px;
  margin-bottom: 8px;
}
.gd-fieldHint{ color: rgba(255,255,255,.55); font-weight: 700; }

.gd-radioCol{ display:flex; flex-direction:column; gap: 8px; }
.gd-radio{
  display:flex;
  gap: 10px;
  align-items:center;
  color: rgba(255,255,255,.84);
  font-weight: 700;
}
.gd-radio input{ accent-color: rgba(56,189,248,.92); }

.gd-modalTextarea{
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.16);
  color: rgba(255,255,255,.92);
  padding: 10px 12px;
  outline: none;
  resize: vertical;
  min-height: 90px;
}
.gd-modalTextarea:focus{
  border-color: rgba(56,189,248,.55);
  box-shadow: 0 0 0 4px rgba(56,189,248,.10);
}

.gd-check{
  display:flex;
  gap: 10px;
  align-items:center;
  color: rgba(255,255,255,.84);
  font-weight: 800;
}
.gd-check input{ accent-color: rgba(56,189,248,.92); }

.gd-smallWarn{
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255,255,255,.55);
}

.gd-modalActions{
  margin-top: 16px;
  display:flex;
  justify-content:flex-end;
  gap: 10px;
}

.gd-dangerBtn{
  border: 0;
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 900;
  cursor:pointer;
  background: rgba(56,189,248,.92);
  color: rgba(0,0,0,.88);
}
.gd-dangerBtn:hover{ filter: brightness(1.03); }
.gd-dangerBtn:disabled{ opacity: .6; cursor:not-allowed; }

`}</style>
  );
}
