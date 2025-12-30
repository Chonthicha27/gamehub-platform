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

function prettyDate(iso) {
  try {
    const d = new Date(iso || Date.now());
    return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "—";
  }
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

  // ✅ Tab แบบชัด: แสดงทีละส่วน
  const [tab, setTab] = useState("about"); // about | media | comments

  // ✅ “More” menu ลดปุ่มรก
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const moreBtnRef = useRef(null);

  const trackedPlayRef = useRef(false);
  const commentsTopRef = useRef(null);

  // ✅ Rating breakdown: คุมเอง + allow deep-link highlight
  const [ratingOpen, setRatingOpen] = useState(false);
  const ratingRef = useRef(null);

  // ✅ Favorites (ทำในหน้านี้เลย เพื่อให้ “หน้าตา/ศัพท์” คุมได้ชัด)
  const [favBusy, setFavBusy] = useState(false);
  const [fav, setFav] = useState(false);

  // ✅ UX: toast (ไม่ใช้ alert ให้ดู pro)
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

  // Close menu on outside click + Esc (accessibility)
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

  // ✅ Keyboard: ctrl/cmd + enter to post
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
          setComments(Array.isArray(c.data) ? c.data : []);
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

  // sync fav state ให้ตรงกับข้อมูลจริง
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
        // อัปเดต me.favorites แบบเบาๆ (กัน UI ดีเลย์)
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

  const kindLabel = downloadOnly ? "Downloadable" : "Playable";

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
    if (!confirm("Delete this game permanently?")) return;
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
    const reason = prompt("Report reason", "");
    if (reason === null) return;

    try {
      await api.post(`/games/${game._id}/report`, { reason }, { withCredentials: true });
      showToast("Reported. Thank you.");
    } catch (e) {
      showToast(e?.response?.data?.message || "Report failed.");
    }
  };

  const reportComment = async (comment) => {
    if (isPreview) return showToast("Upload the game first.");
    if (!commentsEnabled) return;
    if (!me?._id) return requireAuth("report");

    const reason = prompt("Report reason", "");
    if (reason === null) return;

    try {
      await api.post(`/comments/${comment._id}/report`, { reason }, { withCredentials: true });
      showToast("Reported. Thank you.");
    } catch (e) {
      showToast(e?.response?.data?.message || "Report failed.");
    }
  };

  const deleteComment = async (comment) => {
    if (isPreview) return showToast("Draft Preview — no real comments.");
    if (!commentsEnabled) return;
    if (!authed) return requireAuth("delete comments");

    const myId = String(me?._id || "");
    const authorId = getAuthorIdFromComment(comment);
    const isMine = myId && authorId && myId === authorId;

    if (!isMine && !isAdmin) return showToast("You can only delete your own comment.");
    if (!confirm("Delete this comment?")) return;

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.delete(`/games/${game._id}/comments/${comment._id}`, { withCredentials: true, headers });

      const remove = new Set([String(comment._id)]);
      while (true) {
        let changed = false;
        for (const c of comments) {
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

      setComments((xs) => xs.filter((x) => !remove.has(String(x._id))));

      if (replyToId && remove.has(String(replyToId))) {
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
      if (!confirm("You already voted another game this month. Switch vote to this game?")) return;
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
    for (const c of list) map.set(String(c._id), { ...c, __children: [] });

    for (const c of list) {
      const node = map.get(String(c._id));
      const pid = getParent(c);
      const parentKey = pid ? String(pid?._id || pid) : null;
      if (parentKey && map.has(parentKey)) map.get(parentKey).__children.push(node);
      else roots.push(node);
    }

    const sortByTime = (arr) => {
      arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      for (const n of arr) sortByTime(n.__children);
    };
    sortByTime(roots);

    const out = [];
    const walk = (node, depth) => {
      out.push({ node, depth });
      for (const ch of node.__children) walk(ch, Math.min(2, depth + 1));
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

  // ✅ label ที่ชัดกับผู้ใช้
  const monthlyVoteLabel = votedOnThisGame ? "Voted this month ✓" : "Vote this month";

  return (
    <div className="container section">
      <StyleGameDetail />

      <div className="gd-wrap">
        {/* ✅ FRAME */}
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

        {/* ✅ Header: summary + actions + tabs */}
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
              <button
                className={`gd-tab ${tab === "about" ? "is-on" : ""}`}
                onClick={() => setTab("about")}
                role="tab"
                aria-selected={tab === "about"}
                type="button"
              >
                About
              </button>
              <button
                className={`gd-tab ${tab === "media" ? "is-on" : ""}`}
                onClick={() => setTab("media")}
                role="tab"
                aria-selected={tab === "media"}
                type="button"
              >
                Media
              </button>
              <button
                className={`gd-tab ${tab === "comments" ? "is-on" : ""}`}
                onClick={() => setTab("comments")}
                role="tab"
                aria-selected={tab === "comments"}
                type="button"
              >
                Comments {commentsCount > 0 ? <span className="gd-badge">{commentsCount}</span> : null}
              </button>
            </div>
          </div>

          <div className="gd-titleRight">
            <div className="gd-actions" aria-label="Primary actions">
              {/* ✅ Favorites: ใช้คำเดียวกับ Navbar และหน้าตาเหมือนปุ่มอื่น */}
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

              {/* ✅ Monthly vote wording ชัดเจน */}
              <button
                className={`gd-btn ${votedOnThisGame ? "is-on" : ""}`}
                onClick={voteMonthly}
                title={
                  votedOnThisGame
                    ? "You already voted for this game this month."
                    : "Vote for this game (once per month)."
                }
                type="button"
              >
                {monthlyVoteLabel}
              </button>

              {/* ✅ More menu */}
              <div className="gd-more" ref={moreRef}>
                <button
                  className="gd-btn"
                  onClick={() => setMoreOpen((v) => !v)}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  ref={moreBtnRef}
                >
                  More ▾
                </button>

                {moreOpen ? (
                  <div className="gd-menu" role="menu" aria-label="More actions">
                    <button className="gd-menuItem" onClick={copyLink} type="button" role="menuitem">
                      Copy link
                    </button>

                    <button
                      className="gd-menuItem"
                      onClick={() => {
                        setMoreOpen(false);
                        reportGame();
                      }}
                      type="button"
                      role="menuitem"
                    >
                      Report game
                    </button>

                    {(isOwner || isAdmin) && !isPreview ? (
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

            <div className="gd-miniHint">
              {downloadOnly ? "Tip: Download from ⬇ on the game frame." : "Tip: Fullscreen from ⛶ on the game frame."}
            </div>
          </div>
        </section>

        {/* ✅ Content: show one section at a time */}
        {tab === "about" ? (
          <section className="gd-card" role="tabpanel" aria-label="About">
            <div className="gd-cardTitle">Game description</div>

            {/* ✅ ทำให้ชัดว่า “นี่คือข้อมูล” ไม่ใช่ปุ่ม */}
            <div className="gd-aboutMeta" aria-label="Game meta">
              <span className="gd-metaTag" title="Category">
                <span className="gd-metaKey">Category</span>
                <span className="gd-metaVal">{metaCategory}</span>
              </span>

              <span className="gd-metaTag gd-metaTag--soft" title="Type">
                <span className="gd-metaKey">Type</span>
                <span className="gd-metaVal">{kindLabel}</span>
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
                  <Img
                    src={uploader.avatarUrl || uploader.avatar || uploader.photoURL || ""}
                    alt="user"
                    className="gd-miniUser__av"
                  />
                  <span className="gd-miniUser__name">
                    {uploader.displayName || uploader.username || uploader.name || "unknown"}
                  </span>
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

            {/* ✅ Rating Breakdown + Rate button อยู่กับหลอด */}
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
                  <div className="gd-rateRow__sub">
                    {authed ? "Rate this game to help others." : "Sign in to rate this game."}
                  </div>
                </div>

                <button
                  className="gd-btnPrimary gd-btnPrimary--ghost"
                  type="button"
                  onClick={() => {
                    if (isPreview) return showToast("Upload the game first.");
                    if (!authed) return requireAuth("rate");
                    setOpenRate(true);
                  }}
                >
                  Rate this game
                </button>
              </div>

              <div className="gd-rbars">
                {[5, 4, 3, 2, 1].map((star) => {
                  const row = ratingBars[5 - star] || { v: 0, pct: 0 };
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
          </section>
        ) : null}

        {tab === "media" ? (
          <section className="gd-card" role="tabpanel" aria-label="Media">
            <div className="gd-cardTitle">Media</div>

            {videoEmbedUrl ? (
              <div className="gd-slimBlock">
                <div className="gd-subTitle">Trailer</div>
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
                      <div className="gd-composeHint">Tip: Ctrl/⌘ + Enter to post</div>
                      <button className="gd-btnPrimary" onClick={submitComment} type="button">
                        Post
                      </button>
                    </div>
                  </div>
                )}

                <div className="gd-commentList">
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

        {/* ✅ Toast */}
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
  Comment Row
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

  const authorName = c.author?.username || c.author?.name || "User";
  const avatar = c.author?.avatarUrl || c.author?.avatar || c.author?.photoURL || "";

  const active = replyToId && String(replyToId) === String(c._id);

  const replyInputRef = useRef(null);
  useEffect(() => {
    if (active) requestAnimationFrame(() => replyInputRef.current?.focus());
  }, [active]);

  const time = new Date(c.createdAt || Date.now()).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="gd-crow" style={{ ["--indent"]: depth }}>
      <div className="gd-crow__card">
        <Img className="gd-crow__av" src={avatar} alt="" fallback={FALLBACK_AVATAR_DATA} />
        <div className="gd-crow__body">
          <div className="gd-crow__head">
            <div className="gd-crow__name">{authorName}</div>
            <div className="gd-crow__time">{time}</div>
          </div>

          <div className="gd-crow__text">{c.content?.trim() || <span className="gd-muted">(no text)</span>}</div>

          <div className="gd-crow__actions">
            {authed ? (
              <button
                className="gd-linkBtn"
                onClick={() =>
                  onReply({
                    username: authorName,
                    preview: (c.content || "").trim().slice(0, 120),
                  })
                }
                type="button"
              >
                Reply
              </button>
            ) : null}

            {authed && canDelete ? (
              <button className="gd-linkBtn gd-linkBtn--danger" onClick={onDelete} type="button">
                Delete
              </button>
            ) : null}

            {canReport ? (
              <button className="gd-linkBtn gd-linkBtn--warn" onClick={onReport} type="button">
                Report
              </button>
            ) : null}
          </div>

          {active ? (
            <div className="gd-replyBox">
              <div className="gd-replyMeta">
                Replying to <b>@{replyToMeta?.username || "User"}</b>
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
  CSS: โทนเดียวกับเว็บ + UX clearer (ปรับแล้ว)
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
}

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
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.14);
}
.gd-chipMeta b{ color: rgba(255,255,255,.92); font-weight: 900; }

.gd-chipMetaBtn{
  cursor:pointer;
  transition: transform .12s ease;
}
.gd-chipMetaBtn:hover{ border-color: rgba(56,189,248,.40); transform: translateY(-1px); }

.gd-titleRight{ display:flex; flex-direction:column; align-items:flex-end; gap: 8px; }
@media (max-width: 860px){ .gd-titleRight{ align-items:flex-start; } }

.gd-actions{ display:flex; flex-wrap:wrap; gap: 8px; align-items:center; }

/* ✅ ปุ่มหลัก: ให้ดู “โปร” มากขึ้น + focus ชัด */
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

/* ✅ ทำให้ FavoriteButton ที่ใช้ class pfx-chip “หน้าตาเหมือน gd-btn” */
.gd-actions .pfx-chip{
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
.gd-actions .pfx-chip:hover{ border-color: rgba(56,189,248,.40); transform: translateY(-1px); }
.gd-actions .pfx-chip:active{ transform: translateY(0px); }
.gd-actions .pfx-chip:disabled{ opacity:.6; cursor:not-allowed; transform:none; }
.gd-actions .pfx-chip:focus-visible{
  outline: 2px solid rgba(56,189,248,.22);
  box-shadow: 0 0 0 6px rgba(56,189,248,.10);
}
/* เมื่อ favorited (pfx-chip--primary) ให้ดูเป็น state เหมือนปุ่ม is-on */
.gd-actions .pfx-chip.pfx-chip--primary{
  border-color: rgba(56,189,248,.55);
  background: rgba(56,189,248,.12);
}

.gd-miniHint{
  font-size: 12px;
  color: rgba(255,255,255,.60);
}

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
.gd-menuItem:focus-visible{
  outline: 2px solid rgba(56,189,248,.22);
  box-shadow: 0 0 0 6px rgba(56,189,248,.10);
}
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

/* ✅ Meta badges (ไม่ให้เหมือนปุ่ม) — ปรับให้เล็กลง/ไม่หนา/ไม่เด้ง */
.gd-aboutMeta{
  display:flex;
  flex-wrap:wrap;
  gap: 8px;
  align-items:center;
  margin-bottom: 10px;
}
.gd-metaTag{
  display:inline-flex;
  align-items:center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.03);
  font-weight: 600;          /* เดิม 900 */
  font-size: 12px;           /* meta ควรเล็กกว่า body */
  user-select:none;
  cursor: default;
}
.gd-metaTag--soft{
  background: rgba(255,255,255,.02);
  border-color: rgba(255,255,255,.08);
}
.gd-metaKey{
  color: rgba(255,255,255,.60);
  font-weight: 600;          /* เดิม 900 */
}
.gd-metaVal{
  color: rgba(255,255,255,.92);
  font-weight: 700;
}
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
  font-weight: 700;          /* เดิม 800 (ลดนิด) */
}

/* ✅ ข้อความอ่านยาว: 15-16px ใช้ได้ แต่ปรับ line-height + spacing ให้เนียน */
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
.gd-detailsSum{
  cursor:pointer;
  font-weight: 900;
  color: rgba(255,255,255,.90);
}

/* ✅ Rate row inside breakdown */
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
.gd-rateRow__title{
  font-weight: 900;
  color: rgba(255,255,255,.92);
  font-size: 13px;
}
.gd-rateRow__sub{
  margin-top: 2px;
  font-size: 12px;
  color: rgba(255,255,255,.65);
}

/* Rating bars */
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
.gd-rrow__fill{
  height: 100%;
  background: rgba(56,189,248,.85);
  border-radius: 999px;
}
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

/* Compose + comments */
.gd-compose{ margin-top: 10px; display:flex; flex-direction:column; gap:10px; }
.gd-input{
  width:100%;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.18);
  color: rgba(255,255,255,.92);
  padding: 10px 12px;
  outline:none;
  resize: vertical;
}
.gd-input:focus{
  border-color: rgba(56,189,248,.55);
  box-shadow: 0 0 0 4px rgba(56,189,248,.10);
}
.gd-composeBar{
  display:flex;
  justify-content:space-between;
  gap: 10px;
  align-items:center;
}
@media (max-width: 520px){
  .gd-composeBar{ flex-direction:column; align-items:flex-start; }
}
.gd-composeHint{
  font-size: 12px;
  color: rgba(255,255,255,.55);
}
.gd-btnPrimary{
  border: 0;
  border-radius: 12px;
  background: rgba(56,189,248,.92);
  color: rgba(0,0,0,.88);
  font-weight: 900;
  padding: 9px 14px;
  cursor:pointer;
}
.gd-btnPrimary:hover{ filter: brightness(1.03); }
.gd-btnPrimary:focus-visible{
  outline: 2px solid rgba(56,189,248,.22);
  box-shadow: 0 0 0 6px rgba(56,189,248,.10);
}
.gd-btnPrimary--ghost{
  background: rgba(56,189,248,.18);
  color: rgba(255,255,255,.92);
  border: 1px solid rgba(56,189,248,.35);
}
.gd-btnPrimary--ghost:hover{
  filter:none;
  border-color: rgba(56,189,248,.55);
  background: rgba(56,189,248,.22);
}

.gd-commentList{ margin-top: 12px; display:flex; flex-direction:column; gap:10px; }
.gd-crow{ --indent: 0; padding-left: calc(var(--indent) * 14px); }
.gd-crow__card{
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.16);
  border-radius: 16px;
  padding: 12px;
  display:flex;
  gap: 10px;
}
.gd-crow__av{
  width: 34px; height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  object-fit: cover;
  background: rgba(255,255,255,.06);
  flex-shrink:0;
}
.gd-crow__body{ flex:1; min-width:0; }
.gd-crow__head{ display:flex; gap:10px; align-items:center; }
.gd-crow__name{ font-weight: 900; color: rgba(255,255,255,.92); }
.gd-crow__time{ margin-left:auto; font-size: 12px; color: rgba(255,255,255,.60); }
.gd-crow__text{ margin-top: 8px; white-space: pre-wrap; line-height: 1.75; color: rgba(255,255,255,.86); }
.gd-crow__actions{ margin-top: 10px; display:flex; gap: 12px; flex-wrap:wrap; }

.gd-linkBtn{
  border:0; background:none;
  color: rgba(147,197,253,.95);
  font-weight: 900;
  cursor:pointer;
  padding: 0;
}
.gd-linkBtn:hover{ text-decoration: underline; }
.gd-linkBtn:focus-visible{
  outline: 2px solid rgba(56,189,248,.22);
  box-shadow: 0 0 0 6px rgba(56,189,248,.10);
}
.gd-linkBtn--danger{ color: rgba(251,113,133,.95); }
.gd-linkBtn--warn{ color: rgba(245,158,11,.95); }

.gd-replyBox{
  margin-top: 12px;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
}
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

/* ✅ Toast */
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
`}</style>
  );
}
