// frontend/src/pages/GameDetail.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";
import FavoriteButton from "../components/FavoriteButton";
import RateReviewModal from "../components/RateReviewModal";

const isHtmlFile = (u = "") => /\.html?(\?|$)/i.test(u);
const isZipFile = (u = "") => /\.zip(\?|$)/i.test(String(u || ""));
const isRarFile = (u = "") => /\.rar(\?|$)/i.test(String(u || ""));

const ICON_PLAY = "🎮";
const ICON_DOWNLOAD = "📥";

function visibilityLabel(v) {
  switch (v) {
    case "public":
      return "สาธารณะ";
    case "review":
      return "รอตรวจ / ยังไม่เผยแพร่";
    case "unlisted":
      return "Unlisted (ลิงก์เท่านั้น)";
    case "private":
      return "Private (เฉพาะฉัน)";
    case "suspended":
      return "ถูกระงับ";
    default:
      return v || "—";
  }
}

/** normalize image src + fallback */
function safeImgSrc(src, fallback = "/avatar-default.png") {
  const s = String(src || "").trim();
  if (!s) return cdn(fallback);
  return cdn(s);
}

function Img({ src, alt, className, fallback = "/avatar-default.png", ...rest }) {
  const [bad, setBad] = useState(false);
  const finalSrc = bad ? cdn(fallback) : safeImgSrc(src, fallback);

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      onError={() => setBad(true)}
      {...rest}
    />
  );
}

export default function GameDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [game, setGame] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);

  const [pageError, setPageError] = useState("");

  const [summary, setSummary] = useState({
    avg: 0,
    count: 0,
    dist: [0, 0, 0, 0, 0],
  });

  // reviews
  const [reviews, setReviews] = useState([]);
  const [rvPage, setRvPage] = useState(1);
  const [rvTotal, setRvTotal] = useState(0);

  // comments
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");

  // reply
  const [replyToId, setReplyToId] = useState(null); // ✅ ตอนนี้ reply ได้ทุกชั้น
  const [replyText, setReplyText] = useState("");

  // monthly vote
  const [votedThisMonth, setVotedThisMonth] = useState(false);
  const [currentMonthlyVoteGame, setCurrentMonthlyVoteGame] = useState(null);
  const [monthlyVotes, setMonthlyVotes] = useState(0);

  const [openRate, setOpenRate] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState("comments");

  // stats
  const [stats, setStats] = useState({
    playsCount: 0,
    downloadsCount: 0,
    lastPlayedAt: null,
    lastDownloadedAt: null,
  });

  // กันยิงซ้ำ
  const trackedPlayRef = useRef(false);
  useEffect(() => {
    trackedPlayRef.current = false;
  }, [id]);

  const trackPlay = async () => {
    try {
      const res = await api.post(`/games/${id}/track-play`);
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
    try {
      const res = await api.post(`/games/${id}/track-download`);
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

      try {
        const g = await api.get(`/games/${id}`);
        if (!alive) return;
        setGame(g.data);
      } catch (e) {
        if (!alive) return;
        setGame(null);
        setPageError(e?.response?.data?.message || "โหลดรายละเอียดเกมไม่สำเร็จ (games/:id)");
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
        const s = await api.get(`/games/${id}/ratings`);
        if (!alive) return;
        setSummary(s.data);
      } catch {}

      try {
        const st = await api.get(`/games/${id}/stats`);
        if (!alive) return;
        setStats({
          playsCount: st.data?.playsCount || 0,
          downloadsCount: st.data?.downloadsCount || 0,
          lastPlayedAt: st.data?.lastPlayedAt || null,
          lastDownloadedAt: st.data?.lastDownloadedAt || null,
        });
      } catch {
        if (!alive) return;
        setStats({
          playsCount: 0,
          downloadsCount: 0,
          lastPlayedAt: null,
          lastDownloadedAt: null,
        });
      }

      // reviews
      try {
        const r = await api.get(`/games/${id}/reviews`, { params: { page: 1, limit: 20 } });
        if (!alive) return;
        setReviews(r.data.items || []);
        setRvTotal(r.data.total || 0);
        setRvPage(r.data.page || 1);
      } catch {
        if (!alive) return;
        setReviews([]);
        setRvTotal(0);
      }

      // comments
      try {
        const c = await api.get(`/games/${id}/comments`);
        if (!alive) return;
        setComments(Array.isArray(c.data) ? c.data : []);
      } catch {
        if (!alive) return;
        setComments([]);
      }

      // monthly vote
      try {
        const mv = await api.get(`/games/${id}/monthly-vote/me`, { withCredentials: true });
        if (!alive) return;
        setVotedThisMonth(mv.data.voted || false);
        setCurrentMonthlyVoteGame(mv.data.gameVoted || null);
      } catch {}

      // vote count
      try {
        const countRes = await api.get(`/games/${id}/monthly-vote-count`);
        if (!alive) return;
        setMonthlyVotes(countRes.data.count || 0);
      } catch {
        if (!alive) return;
        setMonthlyVotes(0);
      }
    }

    loadAll();
    return () => {
      alive = false;
    };
  }, [id]);

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

  const isOwner = useMemo(() => {
    if (!me || !game) return false;
    const up = game.uploader?._id || game.uploader;
    return String(me._id) === String(up);
  }, [me, game]);

  const isAdmin = me?.role === "admin";
  const authed = !!me?._id;

  const screenshots = useMemo(() => game?.screens || [], [game]);

  const videoEmbedUrl = useMemo(() => {
    const raw = (game?.videoUrl || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (url.hostname.includes("youtube.com")) {
        const vid = url.searchParams.get("v");
        return vid ? `https://www.youtube.com/embed/${vid}` : "";
      }
      if (url.hostname === "youtu.be") {
        const vid = url.pathname.replace("/", "");
        return vid ? `https://www.youtube.com/embed/${vid}` : "";
      }
      if (url.hostname.includes("vimeo.com")) {
        const parts = url.pathname.split("/").filter(Boolean);
        const vid = parts[parts.length - 1];
        return vid ? `https://player.vimeo.com/video/${vid}` : "";
      }
      return "";
    } catch {
      return "";
    }
  }, [game?.videoUrl]);

  const prettyDate = (s) =>
    new Date(s || Date.now()).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  // ✅✅ เปลี่ยนเป็น TREE + recursive เพื่อให้ Reply ได้ไม่จำกัดชั้น
  const commentTree = useMemo(() => {
    const list = Array.isArray(comments) ? comments : [];
    const getParent = (c) => c?.parentId || c?.parent || c?.parentComment || c?.replyTo || null;

    const map = new Map(); // id -> node
    const roots = [];

    // สร้าง node
    for (const c of list) {
      map.set(String(c._id), { ...c, __children: [] });
    }

    // ผูก parent/child
    for (const c of list) {
      const node = map.get(String(c._id));
      const pid = getParent(c);
      const parentKey = pid ? String(pid?._id || pid) : null;

      if (parentKey && map.has(parentKey)) {
        map.get(parentKey).__children.push(node);
      } else {
        roots.push(node);
      }
    }

    // sort ตามเวลา
    const sortByDate = (arr) => {
      arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      for (const n of arr) sortByDate(n.__children);
    };
    sortByDate(roots);

    return roots;
  }, [comments]);

  // loading / error
  if (!game) {
    return (
      <div className="container section">
        <StyleLocal />
        <div className="gd-shell gd-shell--loading">
          <div>Loading…</div>
          {pageError ? <div className="gd-big-error">⚠ {pageError}</div> : null}
        </div>
      </div>
    );
  }

  const fileSrc = cdn(game.fileUrl || "");
  const coverSrc = safeImgSrc(game.coverUrl || "/no-cover.png", "/no-cover.png");

  const isFavorited = !!(me?.favorites || []).find((gid) => String(gid) === String(id));
  const uploader = game.uploader && typeof game.uploader === "object" ? game.uploader : null;

  const onDelete = async () => {
    if (!confirm("ลบเกมนี้ถาวรใช่ไหม?")) return;
    setBusy(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.delete(`/games/${game._id}`, { withCredentials: true, headers });
      nav("/games");
    } catch (e) {
      alert(e?.response?.data?.message || "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async () => {
    if (!authed) return alert("กรุณาเข้าสู่ระบบเพื่อเขียนคอมเมนต์");
    const content = commentText.trim();
    if (!content) return alert("พิมพ์ข้อความก่อนนะ");

    try {
      const res = await api.post(`/games/${game._id}/comments`, { content }, { withCredentials: true });
      setComments((xs) => [...xs, res.data]);
      setCommentText("");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "ส่งคอมเมนต์ไม่สำเร็จ");
    }
  };

  // ✅ reply ได้ทุกชั้น (ส่ง parentId เป็น id ของคอมเมนต์ที่กด Reply)
  const submitReply = async (parentId) => {
    if (!authed) return alert("กรุณาเข้าสู่ระบบก่อนตอบกลับ");
    const content = replyText.trim();
    if (!content) return alert("พิมพ์ข้อความตอบกลับก่อนนะ");

    try {
      const res = await api.post(
        `/games/${game._id}/comments`,
        { content, parentId },
        { withCredentials: true }
      );
      setComments((xs) => [...xs, res.data]);
      setReplyText("");
      setReplyToId(null);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "ตอบกลับไม่สำเร็จ");
    }
  };

  const reportComment = async (comment) => {
    if (!me?._id) return alert("ต้องเข้าสู่ระบบก่อนจึงจะรายงานคอมเมนต์ได้");

    const reason = prompt("แจ้งเหตุผลในการรายงานคอมเมนต์นี้ (เช่น คำหยาบ, สแปม, ละเมิดนโยบาย ฯลฯ)", "");
    if (reason === null) return;

    try {
      await api.post(`/comments/${comment._id}/report`, { reason }, { withCredentials: true });
      alert("ส่งรายงานคอมเมนต์ให้ผู้ดูแลแล้ว ขอบคุณค่ะ/ครับ 🙏");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "รายงานไม่สำเร็จ");
    }
  };

  const voteMonthly = async () => {
    if (!authed) return alert("ต้องเข้าสู่ระบบก่อนจึงจะโหวตเกมประจำเดือนได้");

    if (currentMonthlyVoteGame && String(currentMonthlyVoteGame) !== String(game._id)) {
      const ok = confirm("คุณได้โหวตเกมอื่นในเดือนนี้แล้ว ต้องการเปลี่ยนมาโหวตเกมนี้แทนหรือไม่?");
      if (!ok) return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await api.post(`/games/${game._id}/monthly-vote`, {}, { withCredentials: true, headers });
      alert("โหวตสำเร็จ! ขอบคุณที่สนับสนุนเกมนี้ ⭐");
      setVotedThisMonth(true);
      setCurrentMonthlyVoteGame(game._id);
      setMonthlyVotes(res.data.count ?? 0);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "โหวตไม่สำเร็จ");
    }
  };

  const onDownloadClick = async (e) => {
    e.preventDefault();
    await trackDownload();
    window.location.href = fileSrc;
  };

  const onFullscreenPlay = () => {
    trackPlay();
    window.open(fileSrc, "_blank", "noopener,noreferrer");
  };

  const DistBar = ({ dist }) => {
    const total = dist.reduce((a, b) => a + b, 0) || 1;
    return (
      <div className="dist">
        {[5, 4, 3, 2, 1].map((star) => {
          const i = star - 1;
          const pct = Math.round(((dist[i] || 0) * 100) / total);
          return (
            <div key={star} className="dist-row">
              <span className="d-label">{star}★</span>
              <div className="d-bar">
                <span style={{ width: `${pct}%` }} />
              </div>
              <span className="d-num">{pct}%</span>
            </div>
          );
        })}
      </div>
    );
  };

  const showSummaryStrip = isOwner || isAdmin;

  // ✅ render comment แบบ recursive (reply ได้ไม่จำกัดชั้น)
  const renderCommentNode = (c, depth = 0) => {
    const isMine = String(me?._id || "") === String(c.author?._id || "");
    const canReport = me?._id && !isMine;

    return (
      <div key={c._id} className="gd-thread" style={{ marginLeft: depth ? depth * 26 : 0 }}>
        <article className={`gd-comment ${depth ? "gd-comment--nested" : ""}`}>
          <Img
            className="gd-comment-av"
            src={c.author?.avatarUrl || c.author?.avatar || "/avatar-default.png"}
            alt=""
            fallback="/avatar-default.png"
          />
          <div className="gd-comment-main">
            <div className="gd-comment-head">
              <span className="gd-comment-name">{c.author?.username || "ผู้ใช้"}</span>
              <span className="gd-comment-time">{prettyDate(c.createdAt)}</span>

              <div className="gd-comment-actions">
                {authed && (
                  <button
                    type="button"
                    className="gd-action-link"
                    onClick={() => {
                      setReplyToId(c._id);
                      setReplyText("");
                    }}
                  >
                    Reply
                  </button>
                )}

                {canReport && (
                  <button type="button" className="gd-action-link danger" onClick={() => reportComment(c)}>
                    Report
                  </button>
                )}
              </div>
            </div>

            <div className="gd-comment-body">
              {c.content?.trim() || <span className="gd-comment-muted">(ไม่มีข้อความ)</span>}
            </div>

            {replyToId && String(replyToId) === String(c._id) && (
              <div className="gd-reply-box">
                <textarea
                  className="gd-reply-input"
                  rows={2}
                  placeholder="พิมพ์ตอบกลับ..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div className="gd-reply-actions">
                  <button className="btn btn-small" onClick={() => submitReply(c._id)}>
                    ส่งตอบกลับ
                  </button>
                  <button
                    className="btn btn-small btn-ghost2"
                    onClick={() => {
                      setReplyToId(null);
                      setReplyText("");
                    }}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        </article>

        {Array.isArray(c.__children) && c.__children.length > 0 && (
          <div className="gd-replies">
            {c.__children.map((child) => renderCommentNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container section">
      <StyleLocal />

      <div className="gd-page">
        {/* ❌ ลบ DEBUG STRIP ออกแล้ว */}

        <div className="gd-media">
          <div className="gd-media-inner">
            {playable && !downloadOnly && fileSrc ? (
              <iframe
                title={game.title}
                src={fileSrc}
                allow="autoplay; fullscreen *; gamepad; xr-spatial-tracking"
                className="gd-media-frame"
                onLoad={() => {
                  if (trackedPlayRef.current) return;
                  trackedPlayRef.current = true;
                  trackPlay();
                }}
              />
            ) : (
              <img src={coverSrc} alt="cover" className="gd-media-image" />
            )}
          </div>
        </div>

        <div className="gd-main-only">
          <header className="gd-head">
            <div className="gd-head-left">
              <h1 className="gd-title">{game.title}</h1>

              <div className="gd-head-meta">
                {uploader && (
                  <span className="gd-meta-piece">
                    by{" "}
                    <Link to="/profile" className="gd-author">
                      <Img
                        src={uploader.avatarUrl || uploader.avatar || "/avatar-default.png"}
                        alt="u"
                        className="gd-author__avatar"
                        fallback="/avatar-default.png"
                      />
                      {uploader.username || "unknown"}
                    </Link>
                  </span>
                )}

                <span className="gd-meta-dot">•</span>
                <span className="gd-meta-piece">อัปเดต {prettyDate(game.updatedAt || game.createdAt)}</span>

                <span className="gd-meta-dot">•</span>
                <span className="gd-meta-piece">การมองเห็น {visibilityLabel(game.visibility)}</span>
              </div>

              <div className="gd-tags-row">
                <span className="gd-badge kind">{downloadOnly ? "Download" : "HTML / WebGL"}</span>
                {!!game.category && <span className="gd-badge cat">{game.category}</span>}
                {(game.tags || []).slice(0, 4).map((t) => (
                  <span key={t} className="gd-chip-tag">
                    #{t}
                  </span>
                ))}
              </div>

              <div className="gd-monthly-vote-info">
                ⭐ Monthly votes: <span className="gd-monthly-vote-count">{monthlyVotes || 0}</span>
              </div>

              <div className="gd-stats-row">
                {playable && !downloadOnly ? (
                  <span className="gd-stat">
                    {ICON_PLAY} Plays: <b>{stats.playsCount || 0}</b>
                  </span>
                ) : null}
                {downloadOnly ? (
                  <span className="gd-stat">
                    {ICON_DOWNLOAD} Downloads: <b>{stats.downloadsCount || 0}</b>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="gd-head-actions">
              <div className="gd-action-group">
                <div className="gd-action-item">
                  <FavoriteButton gameId={game._id} authed={authed} initialFavorited={isFavorited} />
                </div>

                <div className="gd-action-item">
                  <button
                    className={`btn btn-vote ${
                      votedThisMonth && String(currentMonthlyVoteGame) === String(game._id) ? "voted" : ""
                    }`}
                    onClick={voteMonthly}
                  >
                    {votedThisMonth && String(currentMonthlyVoteGame) === String(game._id)
                      ? "⭐ Voted this month"
                      : "⭐ Vote this month"}
                  </button>
                </div>

                <div className="gd-action-item">
                  {downloadOnly ? (
                    <a className="btn btn-main" href={fileSrc} download onClick={onDownloadClick}>
                      {ICON_DOWNLOAD} ดาวน์โหลดเกม
                    </a>
                  ) : (
                    <button type="button" className="btn btn-main btn-outline-main" onClick={onFullscreenPlay}>
                      ⛶ เล่นแบบเต็มหน้าจอ
                    </button>
                  )}
                </div>

                {isOwner && (
                  <>
                    <div className="gd-action-item">
                      <Link className="btn btn-ghost" to={`/games/${game._id}/edit`}>
                        ✏️ แก้ไข
                      </Link>
                    </div>
                    <div className="gd-action-item">
                      <button className="btn btn-danger" onClick={onDelete} disabled={busy}>
                        🗑 ลบเกม
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <section className="gd-section">
            <h2 className="gd-sec-title">รายละเอียดเกม</h2>
            <p className="gd-desc">{game.description?.trim() || "ยังไม่มีคำอธิบายเกม"}</p>

            {!!(game.tags || []).length && (
              <div className="gd-tags-inline">
                {game.tags.map((t) => (
                  <span key={t} className="gd-chip-tag">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </section>

          {videoEmbedUrl && (
            <section className="gd-section gd-video">
              <h2 className="gd-sec-title">วิดีโอตัวอย่าง</h2>
              <div className="gd-video-frame-wrap">
                <iframe
                  src={videoEmbedUrl}
                  title={`${game.title} trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </section>
          )}

          {screenshots.length > 0 && (
            <section className="gd-section gd-screens">
              <h2 className="gd-sec-title">สกรีนช็อต</h2>
              <div className="gd-screens-grid">
                {screenshots.map((s, i) => (
                  <button key={s || i} type="button" className="gd-screen" onClick={() => window.open(cdn(s), "_blank")}>
                    <img src={cdn(s)} alt={`Screenshot ${i + 1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {showSummaryStrip && (
            <section className="gd-section gd-rating-strip">
              <div className="gd-rating-card">
                <div className="gd-rating-header">
                  <span className="gd-rating-title">คะแนนจากผู้เล่น (เห็นเฉพาะเรา/ผู้ดูแล)</span>
                  <span className="gd-rating-sub">ใช้ดูภาพรวมดาว / distribution ของเกมเราเอง</span>
                </div>

                <div className="gd-rating-top">
                  <div className="gd-summary-score">
                    <div className="gd-summary-number">{(summary.avg || 0).toFixed(2)}</div>
                    <div className="gd-summary-stars">
                      {"★".repeat(Math.round(summary.avg || 0))}
                      <span className="gd-summary-stars-faint">{"★".repeat(5 - Math.round(summary.avg || 0))}</span>
                    </div>
                    <div className="gd-summary-count">{summary.count || 0} ratings</div>
                  </div>

                  <DistBar dist={summary.dist || [0, 0, 0, 0, 0]} />
                </div>
              </div>
            </section>
          )}

          <section className="gd-section gd-tabs">
            <div className="gd-tabs-bar">
              <button
                className={`gd-tab ${activeTab === "comments" ? "active" : ""}`}
                onClick={() => setActiveTab("comments")}
                type="button"
              >
                💬 Comments <span className="gd-tab-count">{comments.length || 0}</span>
              </button>

              <button
                className={`gd-tab ${activeTab === "reviews" ? "active" : ""}`}
                onClick={() => setActiveTab("reviews")}
                type="button"
                disabled={!(isOwner || isAdmin)}
                title={isOwner || isAdmin ? "" : "เห็นได้เฉพาะเจ้าของเกม/แอดมิน"}
              >
                ⭐ Reviews <span className="gd-tab-count">{rvTotal || 0}</span>
              </button>

              <div className="gd-tabs-actions">
                <button className="btn btn-small" onClick={() => setOpenRate(true)}>
                  ให้คะแนน / รีวิว (feedback ลับ)
                </button>
              </div>
            </div>

            {/* COMMENTS */}
            {activeTab === "comments" && (
              <div className="gd-comments">
                <div className="gd-comment-form">
                  <textarea
                    className="gd-comment-input"
                    rows={3}
                    placeholder={authed ? "เขียนคอมเมนต์เกี่ยวกับเกมนี้..." : "เข้าสู่ระบบเพื่อเขียนคอมเมนต์"}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    disabled={!authed}
                  />
                  <div className="gd-comment-form-actions">
                    <button className="btn btn-small" onClick={submitComment} disabled={!authed}>
                      ส่งคอมเมนต์
                    </button>
                  </div>
                  <p className="gd-note-small">รีวิว/ให้คะแนนผ่านปุ่มด้านบนจะไม่แสดงต่อสาธารณะ (เป็น feedback ลับ)</p>
                </div>

                <div className="gd-comment-list">
                  {commentTree.length === 0 ? (
                    <div className="gd-empty">ยังไม่มีคอมเมนต์ — ลองเขียนความเห็นแรกดูสิ ✨</div>
                  ) : (
                    commentTree.map((node) => renderCommentNode(node, 0))
                  )}
                </div>
              </div>
            )}

            {/* REVIEWS */}
            {activeTab === "reviews" && (
              <div className="gd-reviews-block2">
                {!(isOwner || isAdmin) ? (
                  <div className="gd-empty">เห็น Reviews ได้เฉพาะเจ้าของเกม/แอดมิน</div>
                ) : rvTotal === 0 ? (
                  <div className="gd-empty">ยังไม่มีรีวิวจากผู้เล่น</div>
                ) : (
                  <div className="gd-comment-list">
                    {reviews.map((r) => (
                      <article key={r._id} className="gd-comment">
                        <Img
                          className="gd-comment-av"
                          src={r.user?.avatarUrl || r.user?.avatar || "/avatar-default.png"}
                          alt=""
                          fallback="/avatar-default.png"
                        />
                        <div className="gd-comment-main">
                          <div className="gd-comment-head">
                            <span className="gd-comment-name">{r.user?.username || "ผู้ใช้"}</span>
                            <span className="gd-comment-stars">
                              {"★".repeat(r.score)}
                              <span className="gd-comment-stars-faint">{"★".repeat(5 - r.score)}</span>
                            </span>
                            <span className="gd-comment-time">{prettyDate(r.createdAt)}</span>
                          </div>
                          <div className="gd-comment-body">
                            {r.text?.trim() || <span className="gd-comment-muted">(ไม่มีข้อความ แสดงความคิดเห็นด้วยดาวอย่างเดียว)</span>}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <RateReviewModal
        game={game}
        open={openRate}
        onClose={() => setOpenRate(false)}
        authed={authed}
        onUpdated={(sum) => setSummary((s) => ({ ...s, ...sum }))}
      />
    </div>
  );
}

/* ===== Local styles ===== */
function StyleLocal() {
  return (
    <style>{`
.gd-shell{max-width:1100px;margin:0 auto;}
.gd-shell--loading{text-align:center;padding:80px 0;color:#e5e7eb;}
.gd-big-error{
  margin-top:10px;
  padding:10px 12px;
  border-radius:12px;
  border:1px solid rgba(248,113,113,.45);
  background:rgba(127,29,29,.25);
  color:#fecaca;
  display:inline-block;
}
.gd-page{max-width:1100px;margin:0 auto;color:#e5e7eb;}

.gd-debug{
  border:1px solid rgba(148,163,184,.25);
  background:rgba(2,6,23,.55);
  border-radius:14px;
  padding:10px 12px;
  margin-bottom:12px;
}
.gd-debug-row{display:flex;gap:10px;align-items:flex-start;margin-bottom:6px;}
.gd-debug-k{min-width:60px;color:#93c5fd;font-weight:800;font-size:12px;}
.gd-debug-v{color:#e5e7eb;font-size:12px;word-break:break-all;opacity:.95;}
.gd-debug-actions{display:flex;gap:8px;margin-top:8px;}
.gd-debug-btn{
  display:inline-flex;align-items:center;justify-content:center;
  padding:6px 10px;border-radius:999px;
  border:1px solid rgba(148,163,184,.35);
  background:rgba(15,23,42,.9);
  color:#e5e7eb;text-decoration:none;font-weight:800;font-size:12px;
}
.gd-debug-btn:hover{border-color:rgba(96,165,250,1);}
.gd-debug-hint{margin-top:8px;font-size:11px;color:#9ca3af;line-height:1.5}

.gd-media{margin-bottom:18px;}
.gd-media-inner{
  background:#020617;border-radius:18px;overflow:hidden;
  border:1px solid rgba(148,163,184,.4);
  box-shadow:0 18px 48px rgba(0,0,0,.7);
  aspect-ratio:16/9;position:relative;
}
.gd-media-frame,.gd-media-image{position:absolute;inset:0;width:100%;height:100%;border:0;object-fit:cover;}

.gd-main-only{display:flex;flex-direction:column;gap:12px;}
.gd-head{display:flex;justify-content:space-between;gap:16px;padding-bottom:10px;border-bottom:1px solid rgba(148,163,184,.35);}
.gd-head-left{flex:1 1 auto;min-width:0;}
.gd-title{margin:0 0 4px;font-size:clamp(22px,3.1vw,30px);font-weight:800;color:#e5e7eb;}
.gd-head-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#9ca3af;}
.gd-meta-piece{display:flex;align-items:center;gap:4px}
.gd-meta-dot{opacity:.7}
.gd-author{display:inline-flex;align-items:center;gap:6px;color:#e5e7eb;text-decoration:none;}
.gd-author__avatar{width:22px;height:22px;border-radius:999px;object-fit:cover;border:1px solid rgba(148,163,184,.7);}

.gd-tags-row{margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;}
.gd-badge{padding:4px 10px;border-radius:999px;font-size:11px;border:1px solid rgba(148,163,184,.55);}
.gd-badge.kind{background:rgba(59,130,246,.14);border-color:rgba(59,130,246,.7);}
.gd-badge.cat{background:rgba(56,189,248,.12);border-color:rgba(56,189,248,.55);}
.gd-chip-tag{padding:4px 9px;border-radius:999px;font-size:11px;border:1px solid rgba(55,65,81,.7);background:rgba(15,23,42,.9);color:#e5e7eb;}
.gd-monthly-vote-info{margin-top:6px;font-size:12px;display:flex;align-items:center;gap:6px;}
.gd-monthly-vote-count{padding:2px 8px;border-radius:999px;background:rgba(250,204,21,.12);border:1px solid rgba(250,204,21,.55);color:#facc15;font-weight:600;}
.gd-stats-row{margin-top:6px;display:flex;flex-wrap:wrap;gap:10px;font-size:12px;}
.gd-stat{padding:3px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.45);background:rgba(15,23,42,.75);}

.gd-head-actions{flex-shrink:0;display:flex;align-items:flex-start;justify-content:flex-end;}
.gd-action-group{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.gd-action-item{display:flex;}
.gd-head-actions button{border-radius:999px;}

.btn{
  appearance:none;border-radius:999px;border:1px solid rgba(148,163,184,.45);
  background:rgba(15,23,42,.96);color:#e5edf8;padding:7px 14px;
  font-size:13px;font-weight:600;cursor:pointer;
  transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease, opacity .12s ease;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  text-decoration:none;white-space:nowrap;
}
.btn:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(0,0,0,.6);border-color:rgba(96,165,250,1);}
.btn:disabled{opacity:.55;cursor:default;transform:none;box-shadow:none;}

.btn-main{background:linear-gradient(135deg,#38bdf8,#0ea5e9);border:none;color:#020617;}
.btn-outline-main{background:rgba(15,23,42,.98);border:1px solid rgba(56,189,248,.7);color:#e0f2fe;}
.btn-outline-main:hover{background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#f9fafb;border-color:transparent;}
.btn-vote{background:rgba(234,179,8,.15);border:1px solid rgba(234,179,8,.6);color:#facc15;font-weight:700;}
.btn-vote:hover{background:rgba(250,204,21,.25);border-color:#fde047;box-shadow:0 0 15px rgba(250,204,21,.5);}
.btn-vote.voted{background:linear-gradient(135deg,#fde047,#facc15);color:#222;border:none;box-shadow:0 0 18px rgba(250,204,21,.7);}
.btn-ghost{background:rgba(17,24,39,.96);border:1px solid rgba(148,163,184,.6);color:#e5e7eb;}
.btn-danger{background:transparent;border:1px solid rgba(248,113,113,.95);color:#fecaca;}
.btn-small{padding:5px 11px;font-size:12px;}
.btn-ghost2{background:rgba(17,24,39,.92);border:1px solid rgba(148,163,184,.5);color:#e5e7eb;}

.gd-section{padding-top:10px;}
.gd-sec-title{margin:0 0 6px;font-size:15px;font-weight:700;color:#e5e7eb;}
.gd-desc{margin:0;line-height:1.7;color:#e5edf8;white-space:pre-wrap;}
.gd-tags-inline{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;}

.gd-video{margin-top:6px;}
.gd-video-frame-wrap{
  margin-top:6px;border-radius:18px;overflow:hidden;aspect-ratio:16/9;background:#020617;
  border:1px solid rgba(148,163,184,.4);box-shadow:0 18px 40px rgba(0,0,0,.8);
}
.gd-video-frame-wrap iframe{width:100%;height:100%;border:0;}

.gd-screens-grid{margin-top:6px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;}
.gd-screen{position:relative;border-radius:12px;overflow:hidden;aspect-ratio:4/3;background:#020617;border:1px solid rgba(148,163,184,.25);}
.gd-screen img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .18s ease, filter .18s ease;}
.gd-screen:hover img{transform:scale(1.03);filter:brightness(1.05);}
@media (max-width:1024px){.gd-screens-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}
@media (max-width:640px){.gd-screens-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}

.gd-rating-strip{margin-top:4px;}
.gd-rating-card{border-radius:14px;padding:10px 12px 12px;background:linear-gradient(135deg, rgba(15,23,42,.96), rgba(15,23,42,.98));
  border:1px solid rgba(31,41,55,.9);box-shadow:0 14px 30px rgba(0,0,0,.7);}
.gd-rating-header{display:flex;flex-direction:column;gap:2px;margin-bottom:6px;}
.gd-rating-title{font-size:14px;font-weight:700;}
.gd-rating-sub{font-size:11px;color:#9ca3af;}
.gd-rating-top{display:flex;gap:16px;align-items:flex-start;}
.gd-rating-top .dist{flex:1 1 auto;}
.gd-summary-score{display:flex;flex-direction:column;gap:2px;min-width:80px;}
.gd-summary-number{font-size:26px;font-weight:700;}
.gd-summary-stars{color:#fbbf24;font-size:14px;}
.gd-summary-stars-faint{color:#4b5563;}
.gd-summary-count{font-size:12px;color:#9ca3af;}
.dist{display:flex;flex-direction:column;gap:4px;}
.dist-row{display:grid;grid-template-columns:30px 1fr 34px;gap:6px;align-items:center;font-size:12px;}
.d-label{color:#e5e7eb;}
.d-bar{height:7px;border-radius:999px;overflow:hidden;background:#020617;border:1px solid rgba(55,65,81,.9);}
.d-bar span{display:block;height:100%;background:linear-gradient(90deg,#4ade80,#22c55e);}
.d-num{text-align:right;color:#9ca3af;}

.gd-tabs{margin-top:12px;padding-top:12px;border-top:1px solid rgba(55,65,81,.8);}
.gd-tabs-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 10px;border-radius:14px;border:1px solid rgba(148,163,184,.25);background:rgba(2,6,23,.55);}
.gd-tab{border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.9);color:#e5e7eb;border-radius:999px;padding:6px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:12px;}
.gd-tab.active{background:linear-gradient(135deg, rgba(56,189,248,.35), rgba(14,165,233,.2));border-color:rgba(56,189,248,.9);}
.gd-tab:disabled{opacity:.45;cursor:not-allowed;}
.gd-tab-count{padding:2px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.35);background:rgba(2,6,23,.7);font-weight:700;}
.gd-tabs-actions{margin-left:auto;display:flex;gap:8px;}

.gd-comments{margin-top:12px;}
.gd-comment-input,.gd-reply-input{width:100%;border-radius:10px;border:1px solid rgba(55,65,81,.9);background:rgba(15,23,42,.9);color:#e5e7eb;padding:8px 10px;resize:vertical;}
.gd-comment-form-actions{display:flex;justify-content:flex-end;margin-top:6px;}
.gd-note-small{margin-top:4px;font-size:11px;color:#9ca3af;}
.gd-comment-list{display:flex;flex-direction:column;gap:10px;}
.gd-thread{display:flex;flex-direction:column;gap:8px;}
.gd-comment{display:flex;gap:10px;}
.gd-comment--reply{margin-left:38px;}
.gd-replies{display:flex;flex-direction:column;gap:10px;}
.gd-comment-av{width:36px;height:36px;border-radius:999px;border:1px solid rgba(148,163,184,.7);object-fit:cover;flex-shrink:0;}
.gd-comment-main{flex:1 1 auto;min-width:0;}
.gd-comment-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.gd-comment-name{font-weight:700;}
.gd-comment-stars{color:#fbbf24;font-size:13px;}
.gd-comment-stars-faint{color:#4b5563;}
.gd-comment-time{margin-left:auto;font-size:11px;color:#9ca3af;}
.gd-comment-body{margin-top:3px;line-height:1.6;white-space:pre-wrap;}
.gd-comment-muted{color:#9ca3af;font-size:13px;}
.gd-comment-actions{display:flex;gap:10px;margin-left:8px;}
.gd-action-link{border:none;background:none;color:#93c5fd;cursor:pointer;font-size:11px;font-weight:700;padding:0;}
.gd-action-link.danger{color:#f87171;}
.gd-reply-box{margin-top:8px;padding:8px;border-radius:12px;border:1px solid rgba(148,163,184,.25);background:rgba(2,6,23,.55);}
.gd-reply-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px;}
.gd-empty{padding:10px 12px;border-radius:10px;background:rgba(15,23,42,.8);border:1px dashed rgba(75,85,99,.8);font-size:13px;color:#e5e7eb;}

@media (max-width:720px){
  .gd-head{flex-direction:column;align-items:flex-start;}
  .gd-head-actions{width:100%;justify-content:flex-start;margin-top:8px;}
  .gd-rating-top{flex-direction:column;align-items:flex-start;}
}
`}</style>
  );
}
