// frontend/src/pages/GameDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { cdn } from "../api/cdn";
import FavoriteButton from "../components/FavoriteButton";
import RateReviewModal from "../components/RateReviewModal";

const isHtmlFile = (u = "") => /\.html?(\?|$)/i.test(u);

export default function GameDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [game, setGame] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);

  const [summary, setSummary] = useState({
    avg: 0,
    count: 0,
    dist: [0, 0, 0, 0, 0],
  });

  // ⭐ เก็บ reviews (ใช้สำหรับดาว + รีวิวเดิม)
  const [reviews, setReviews] = useState([]);
  const [rvPage, setRvPage] = useState(1);
  const [rvTotal, setRvTotal] = useState(0);

  // ⭐ เก็บ comments (ใช้กับระบบ report ใหม่)
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");

  // ⭐ โหวตเกมประจำเดือน
  const [votedThisMonth, setVotedThisMonth] = useState(false);
  const [currentMonthlyVoteGame, setCurrentMonthlyVoteGame] =
    useState(null);
  const [monthlyVotes, setMonthlyVotes] = useState(0);

  const [openRate, setOpenRate] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadAll() {
      try {
        const g = await api.get(`/games/${id}`);
        if (!alive) return;
        setGame(g.data);
      } catch {
        if (!alive) return;
        setGame(null);
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
      } catch {
        /* ignore */
      }

      // reviews
      try {
        const r = await api.get(`/games/${id}/reviews`, {
          params: { page: 1, limit: 20 },
        });
        if (!alive) return;
        setReviews(r.data.items || []);
        setRvTotal(r.data.total || 0);
        setRvPage(r.data.page || 1);
      } catch {
        if (!alive) return;
        setReviews([]);
      }

      // comments
      try {
        const c = await api.get(`/games/${id}/comments`);
        if (!alive) return;
        setComments(c.data || []);
      } catch {
        if (!alive) return;
        setComments([]);
      }

      // ⭐ สถานะโหวตประจำเดือน
      try {
        const mv = await api.get(`/games/${id}/monthly-vote/me`, {
          withCredentials: true,
        });
        if (!alive) return;
        setVotedThisMonth(mv.data.voted || false);
        setCurrentMonthlyVoteGame(mv.data.gameVoted || null);
      } catch {
        // ไม่ล็อกอิน / error เบา ๆ — ข้ามได้
      }

      // ⭐ จำนวนโหวตเกมนี้ในเดือนนี้
      try {
        const countRes = await api.get(
          `/games/${id}/monthly-vote-count`
        );
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

  const playable = useMemo(
    () => (game ? game.kind === "html" || isHtmlFile(game.fileUrl) : false),
    [game]
  );

  const isOwner = useMemo(() => {
    if (!me || !game) return false;
    const up = game.uploader?._id || game.uploader;
    return String(me._id) === String(up);
  }, [me, game]);

  const isAdmin = me?.role === "admin";

  if (!game) {
    return (
      <div className="container section">
        <StyleLocal />
        <div className="gd-shell gd-shell--loading">Loading…</div>
      </div>
    );
  }

  const fileSrc = cdn(game.fileUrl || "");
  const coverSrc = cdn(game.coverUrl || "/no-cover.png");
  const authed = !!me?._id;
  const isFavorited = !!(me?.favorites || []).find(
    (gid) => String(gid) === String(id)
  );
  const uploader =
    game.uploader && typeof game.uploader === "object"
      ? game.uploader
      : null;

  const onDelete = async () => {
    if (!confirm("ลบเกมนี้ถาวรใช่ไหม?")) return;
    setBusy(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.delete(`/games/${game._id}`, {
        withCredentials: true,
        headers,
      });
      nav("/games");
    } catch (e) {
      alert(e?.response?.data?.message || "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // ⭐ ส่งคอมเมนต์ใหม่
  const submitComment = async () => {
    if (!authed) {
      alert("กรุณาเข้าสู่ระบบเพื่อเขียนคอมเมนต์");
      return;
    }
    const content = commentText.trim();
    if (!content) {
      alert("พิมพ์ข้อความก่อนนะ");
      return;
    }
    try {
      const res = await api.post(
        `/games/${game._id}/comments`,
        { content },
        { withCredentials: true }
      );
      const created = res.data;
      setComments((xs) => [...xs, created]);
      setCommentText("");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "ส่งคอมเมนต์ไม่สำเร็จ");
    }
  };

  // ⭐ Report comment
  const reportComment = async (comment) => {
    if (!me?._id) {
      alert("ต้องเข้าสู่ระบบก่อนจึงจะรายงานคอมเมนต์ได้");
      return;
    }

    const reason = prompt(
      "แจ้งเหตุผลในการรายงานคอมเมนต์นี้ (เช่น คำหยาบ, สแปม, ละเมิดนโยบาย ฯลฯ)",
      ""
    );
    if (reason === null) return;

    try {
      await api.post(
        `/comments/${comment._id}/report`,
        { reason },
        { withCredentials: true }
      );
      alert("ส่งรายงานคอมเมนต์ให้ผู้ดูแลแล้ว ขอบคุณค่ะ/ครับ 🙏");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "รายงานไม่สำเร็จ");
    }
  };

  // ⭐ โหวตเกมประจำเดือน
  const voteMonthly = async () => {
    if (!authed) {
      alert("ต้องเข้าสู่ระบบก่อนจึงจะโหวตเกมประจำเดือนได้");
      return;
    }

    // ถ้าเคยโหวตเกมอื่นในเดือนนี้
    if (
      currentMonthlyVoteGame &&
      String(currentMonthlyVoteGame) !== String(game._id)
    ) {
      const ok = confirm(
        "คุณได้โหวตเกมอื่นในเดือนนี้แล้ว ต้องการเปลี่ยนมาโหวตเกมนี้แทนหรือไม่?"
      );
      if (!ok) return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.post(
        `/games/${game._id}/monthly-vote`,
        {},
        { withCredentials: true, headers }
      );

      alert("โหวตสำเร็จ! ขอบคุณที่สนับสนุนเกมนี้ ⭐");

      setVotedThisMonth(true);
      setCurrentMonthlyVoteGame(game._id);
      // ใช้ count จาก backend เพื่อให้ตรงกับฐานข้อมูล
      setMonthlyVotes(res.data.count ?? 0);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "โหวตไม่สำเร็จ");
    }
  };

  const prettyDate = (s) =>
    new Date(s || Date.now()).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

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

  // ⭐ สรุปดาว เจ้าของเกม + แอดมินเท่านั้นที่เห็น
  const showSummaryStrip = isOwner || isAdmin;

  return (
    <div className="container section">
      <StyleLocal />

      <div className="gd-page">
        {/* MEDIA */}
        <div className="gd-media">
          <div className="gd-media-inner">
            {playable && game.kind !== "download" ? (
              <iframe
                title={game.title}
                src={fileSrc}
                allow="autoplay; fullscreen *; gamepad; xr-spatial-tracking"
                className="gd-media-frame"
              />
            ) : (
              <img src={coverSrc} alt="cover" className="gd-media-image" />
            )}
          </div>
        </div>

        {/* MAIN */}
        <div className="gd-main-only">
          {/* HEADER */}
          <header className="gd-head">
            <div className="gd-head-left">
              <h1 className="gd-title">{game.title}</h1>

              <div className="gd-head-meta">
                {uploader && (
                  <span className="gd-meta-piece">
                    by{" "}
                    <Link to="/profile" className="gd-author">
                      <img
                        src={cdn(
                          uploader.avatar ||
                            uploader.avatarUrl ||
                            "/avatar-default.png"
                        )}
                        alt="u"
                        className="gd-author__avatar"
                      />
                      {uploader.username || "unknown"}
                    </Link>
                  </span>
                )}

                <span className="gd-meta-dot">•</span>

                <span className="gd-meta-piece">
                  อัปเดต {prettyDate(game.updatedAt || game.createdAt)}
                </span>

                <span className="gd-meta-dot">•</span>

                <span className="gd-meta-piece">
                  การมองเห็น{" "}
                  {game.visibility === "review" ? "รอตรวจ" : "สาธารณะ"}
                </span>
              </div>

              <div className="gd-tags-row">
                <span className="gd-badge kind">
                  {game.kind === "download" ? "Download" : "HTML / WebGL"}
                </span>
                {!!game.category && (
                  <span className="gd-badge cat">{game.category}</span>
                )}
                {(game.tags || []).slice(0, 4).map((t) => (
                  <span key={t} className="gd-chip-tag">
                    #{t}
                  </span>
                ))}
              </div>

              {/* ⭐ แสดงจำนวนโหวตเกมประจำเดือน */}
              <div className="gd-monthly-vote-info">
                ⭐ Monthly votes:{" "}
                <span className="gd-monthly-vote-count">
                  {monthlyVotes || 0}
                </span>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="gd-head-actions">
              <div className="gd-action-group">
                <div className="gd-action-item">
                  <FavoriteButton
                    gameId={game._id}
                    authed={authed}
                    initialFavorited={isFavorited}
                  />
                </div>

                {/* ปุ่มโหวตเกมประจำเดือน */}
                <div className="gd-action-item">
                  <button
                    className={`btn btn-vote ${
                      votedThisMonth &&
                      String(currentMonthlyVoteGame) === String(game._id)
                        ? "voted"
                        : ""
                    }`}
                    onClick={voteMonthly}
                  >
                    {votedThisMonth &&
                    String(currentMonthlyVoteGame) === String(game._id)
                      ? "⭐ Voted this month"
                      : "⭐ Vote this month"}
                  </button>
                </div>

                <div className="gd-action-item">
                  {game.kind === "download" ? (
                    <a className="btn btn-main" href={fileSrc} download>
                      🎮 ดาวน์โหลดเกม
                    </a>
                  ) : (
                    <a
                      className="btn btn-main btn-outline-main"
                      href={fileSrc}
                      target="_blank"
                      rel="noreferrer"
                    >
                      ⛶ เล่นแบบเต็มหน้าจอ
                    </a>
                  )}
                </div>

                {isOwner && (
                  <>
                    <div className="gd-action-item">
                      <Link
                        className="btn btn-ghost"
                        to={`/games/${game._id}/edit`}
                      >
                        ✏️ แก้ไข
                      </Link>
                    </div>
                    <div className="gd-action-item">
                      <button
                        className="btn btn-danger"
                        onClick={onDelete}
                        disabled={busy}
                      >
                        🗑 ลบเกม
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* DESCRIPTION */}
          <section className="gd-section">
            <h2 className="gd-sec-title">รายละเอียดเกม</h2>
            <p className="gd-desc">
              {game.description?.trim() || "ยังไม่มีคำอธิบายเกม"}
            </p>

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

          {/* OWNER/ADMIN-ONLY RATING STRIP */}
          {showSummaryStrip && (
            <section className="gd-section gd-rating-strip">
              <div className="gd-rating-card">
                <div className="gd-rating-header">
                  <span className="gd-rating-title">
                    คะแนนจากผู้เล่น (เห็นเฉพาะเรา/ผู้ดูแล)
                  </span>
                  <span className="gd-rating-sub">
                    ใช้ดูภาพรวมดาว / distribution ของเกมเราเอง
                  </span>
                </div>

                <div className="gd-rating-top">
                  <div className="gd-summary-score">
                    <div className="gd-summary-number">
                      {(summary.avg || 0).toFixed(2)}
                    </div>
                    <div className="gd-summary-stars">
                      {"★".repeat(Math.round(summary.avg || 0))}
                      <span className="gd-summary-stars-faint">
                        {"★".repeat(
                          5 - Math.round(summary.avg || 0)
                        )}
                      </span>
                    </div>
                    <div className="gd-summary-count">
                      {summary.count || 0} ratings
                    </div>
                  </div>

                  <DistBar dist={summary.dist || [0, 0, 0, 0, 0]} />
                </div>
              </div>
            </section>
          )}

          {/* COMMENTS */}
          <section className="gd-section gd-comments">
            <div className="gd-comments-head">
              <h2 className="gd-sec-title">
                Comments{" "}
                {comments.length ? (
                  <span className="gd-sec-count">
                    · {comments.length}
                  </span>
                ) : null}
              </h2>
              <button
                className="btn btn-small"
                onClick={() => setOpenRate(true)}
              >
                ให้คะแนน / รีวิว (feedback ลับ)
              </button>
            </div>

            {/* กล่องเขียนคอมเมนต์ */}
            <div className="gd-comment-form">
              <textarea
                className="gd-comment-input"
                rows={3}
                placeholder={
                  authed
                    ? "เขียนคอมเมนต์เกี่ยวกับเกมนี้..."
                    : "เข้าสู่ระบบเพื่อเขียนคอมเมนต์"
                }
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                disabled={!authed}
              />
              <div className="gd-comment-form-actions">
                <button
                  className="btn btn-small"
                  onClick={submitComment}
                  disabled={!authed}
                >
                  ส่งคอมเมนต์
                </button>
              </div>
              <p className="gd-note-small">
                การให้คะแนน/รีวิวผ่านปุ่มด้านขวาด้านบนจะไม่แสดงต่อสาธารณะ
                ใช้เป็น feedback ให้เจ้าของเกมและผู้ดูแลเท่านั้น
              </p>
            </div>

            <div className="gd-comment-list">
              {comments.length === 0 && (
                <div className="gd-empty">
                  ยังไม่มีคอมเมนต์ — ลองเขียนความเห็นแรกดูสิ ✨
                </div>
              )}

              {comments.map((c) => (
                <article key={c._id} className="gd-comment">
                  <img
                    className="gd-comment-av"
                    src={cdn(
                      c.author?.avatar ||
                        c.author?.avatarUrl ||
                        "/avatar-default.png"
                    )}
                    alt=""
                  />
                  <div className="gd-comment-main">
                    <div className="gd-comment-head">
                      <span className="gd-comment-name">
                        {c.author?.username || "ผู้ใช้"}
                      </span>
                      <span className="gd-comment-time">
                        {prettyDate(c.createdAt)}
                      </span>

                      {me?._id &&
                        String(me._id) !== String(c.author?._id) && (
                          <button
                            type="button"
                            className="gd-report-btn"
                            onClick={() => reportComment(c)}
                          >
                            Report
                          </button>
                        )}
                    </div>
                    <div className="gd-comment-body">
                      {c.content?.trim() || (
                        <span className="gd-comment-muted">
                          (ไม่มีข้อความ)
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* ⭐ Player Reviews (owner/admin only) */}
            {(isOwner || isAdmin) && rvTotal > 0 && (
              <div className="gd-reviews-block">
                <h3 className="gd-sec-title">
                  Player Reviews (owner / admin only){" "}
                  <span className="gd-sec-count">· {rvTotal}</span>
                </h3>
                <div className="gd-comment-list">
                  {reviews.map((r) => (
                    <article key={r._id} className="gd-comment">
                      <img
                        className="gd-comment-av"
                        src={cdn(
                          r.user?.avatar ||
                            r.user?.avatarUrl ||
                            "/avatar-default.png"
                        )}
                        alt=""
                      />
                      <div className="gd-comment-main">
                        <div className="gd-comment-head">
                          <span className="gd-comment-name">
                            {r.user?.username || "ผู้ใช้"}
                          </span>
                          <span className="gd-comment-stars">
                            {"★".repeat(r.score)}
                            <span className="gd-comment-stars-faint">
                              {"★".repeat(5 - r.score)}
                            </span>
                          </span>
                          <span className="gd-comment-time">
                            {prettyDate(r.createdAt)}
                          </span>
                        </div>
                        <div className="gd-comment-body">
                          {r.text?.trim() || (
                            <span className="gd-comment-muted">
                              (ไม่มีข้อความ แสดงความคิดเห็นด้วยดาวอย่างเดียว)
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
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
        onUpdated={(sum) =>
          setSummary((s) => ({
            ...s,
            ...sum,
          }))
        }
      />
    </div>
  );
}

/* ===== Local styles ===== */
function StyleLocal() {
  return (
    <style>{`
.gd-shell{
  max-width:1100px;
  margin:0 auto;
}
.gd-shell--loading{
  text-align:center;
  padding:80px 0;
}

/* Page wrapper */
.gd-page{
  max-width:1100px;
  margin:0 auto;
}

/* Media */
.gd-media{
  margin-bottom:18px;
}
.gd-media-inner{
  background:#020617;
  border-radius:18px;
  overflow:hidden;
  border:1px solid rgba(148,163,184,.4);
  box-shadow:0 18px 48px rgba(0,0,0,.7);
  aspect-ratio:16/9;
  position:relative;
}
.gd-media-frame,
.gd-media-image{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  border:0;
  object-fit:cover;
}

/* Main column */
.gd-main-only{
  display:flex;
  flex-direction:column;
  gap:12px;
}

/* Header */
.gd-head{
  display:flex;
  justify-content:space-between;
  gap:16px;
  padding-bottom:10px;
  border-bottom:1px solid rgba(148,163,184,.35);
}
.gd-head-left{
  flex:1 1 auto;
  min-width:0;
}
.gd-title{
  margin:0 0 4px;
  font-size:clamp(22px,3.1vw,30px);
  font-weight:800;
}
.gd-head-meta{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  align-items:center;
  font-size:12px;
  color:#9ca3af;
}
.gd-meta-piece{display:flex;align-items:center;gap:4px}
.gd-meta-dot{opacity:.7}

.gd-author{
  display:inline-flex;
  align-items:center;
  gap:6px;
  color:#e5e7eb;
  text-decoration:none;
}
.gd-author__avatar{
  width:22px;
  height:22px;
  border-radius:999px;
  object-fit:cover;
  border:1px solid rgba(148,163,184,.7);
}

/* tags / chips */
.gd-tags-row{
  margin-top:8px;
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}
.gd-badge{
  padding:4px 10px;
  border-radius:999px;
  font-size:11px;
  border:1px solid rgba(148,163,184,.55);
}
.gd-badge.kind{
  background:rgba(59,130,246,.14);
  border-color:rgba(59,130,246,.7);
}
.gd-badge.cat{
  background:rgba(56,189,248,.12);
  border-color:rgba(56,189,248,.55);
}
.gd-chip-tag{
  padding:4px 9px;
  border-radius:999px;
  font-size:11px;
  border:1px solid rgba(55,65,81,.7);
  background:rgba(15,23,42,.9);
  color:#e5e7eb;
}

/* Monthly vote info */
.gd-monthly-vote-info{
  margin-top:6px;
  font-size:12px;
  color:#e5e7eb;
  display:flex;
  align-items:center;
  gap:6px;
}
.gd-monthly-vote-count{
  padding:2px 8px;
  border-radius:999px;
  background:rgba(250,204,21,.12);
  border:1px solid rgba(250,204,21,.55);
  color:#facc15;
  font-weight:600;
}

/* ACTIONS AREA */
.gd-head-actions{
  flex-shrink:0;
  display:flex;
  align-items:flex-start;
  justify-content:flex-end;
}
.gd-action-group{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  align-items:center;
}
.gd-action-item{
  display:flex;
}

/* ทำให้ปุ่มของ FavoriteButton กลมและขนาดเท่ากับปุ่มอื่น */
.gd-head-actions button{
  border-radius:999px;
}

/* Buttons */
.btn{
  appearance:none;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.45);
  background:rgba(15,23,42,.96);
  color:#e5edf8;
  padding:7px 14px;
  font-size:13px;
  font-weight:600;
  cursor:pointer;
  transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease, opacity .12s ease;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  text-decoration:none;
  white-space:nowrap;
}
.btn:hover{
  transform:translateY(-1px);
  box-shadow:0 10px 26px rgba(0,0,0,.6);
  border-color:rgba(96,165,250,1);
}
.btn:disabled{
  opacity:.6;
  cursor:default;
  transform:none;
  box-shadow:none;
}

/* ปุ่มหลัก – เล่นเต็มจอ / ดาวน์โหลด */
.btn-main{
  background:linear-gradient(135deg,#38bdf8,#0ea5e9);
  border:none;
  color:#020617;
}
.btn-outline-main{
  background:rgba(15,23,42,.98);
  border:1px solid rgba(56,189,248,.7);
  color:#e0f2fe;
}
.btn-outline-main:hover{
  background:linear-gradient(135deg,#0ea5e9,#0369a1);
  color:#f9fafb;
  border-color:transparent;
}

/* ปุ่มโหวตเกมประจำเดือน */
.btn-vote{
  background:rgba(234,179,8,.15);
  border:1px solid rgba(234,179,8,.6);
  color:#facc15;
  font-weight:700;
}
.btn-vote:hover{
  background:rgba(250,204,21,.25);
  border-color:#fde047;
  box-shadow:0 0 15px rgba(250,204,21,.5);
}
.btn-vote.voted{
  background:linear-gradient(135deg,#fde047,#facc15);
  color:#222;
  border:none;
  box-shadow:0 0 18px rgba(250,204,21,.7);
}
.btn-vote.voted:hover{
  opacity:.9;
}

/* ปุ่มแก้ไข */
.btn-ghost{
  background:rgba(17,24,39,.96);
  border:1px solid rgba(148,163,184,.6);
  color:#e5e7eb;
}
.btn-ghost:hover{
  background:rgba(31,41,55,1);
}

/* ปุ่มลบ */
.btn-danger{
  background:transparent;
  border:1px solid rgba(248,113,113,.95);
  color:#fecaca;
}
.btn-danger:hover{
  background:rgba(248,113,113,.18);
}

/* ปุ่มเล็ก (ใช้ในส่วนคอมเมนต์) */
.btn-small{
  padding:5px 11px;
  font-size:12px;
}

/* Sections */
.gd-section{
  padding-top:10px;
}
.gd-sec-title{
  margin:0 0 6px;
  font-size:15px;
  font-weight:700;
}
.gd-sec-count{font-weight:400;color:#9ca3af;font-size:13px}

.gd-desc{
  margin:0;
  line-height:1.7;
  color:#e5edf8;
  white-space:pre-wrap;
}
.gd-tags-inline{
  margin-top:8px;
  display:flex;
  flex-wrap:wrap;
  gap:6px;
}

/* Rating strip */
.gd-rating-strip{
  margin-top:4px;
}
.gd-rating-card{
  border-radius:14px;
  padding:10px 12px 12px;
  background:linear-gradient(135deg, rgba(15,23,42,.96), rgba(15,23,42,.98));
  border:1px solid rgba(31,41,55,.9);
  box-shadow:0 14px 30px rgba(0,0,0,.7);
}
.gd-rating-header{
  display:flex;
  flex-direction:column;
  gap:2px;
  margin-bottom:6px;
}
.gd-rating-title{
  font-size:14px;
  font-weight:700;
}
.gd-rating-sub{
  font-size:11px;
  color:#9ca3af;
}
.gd-rating-top{
  display:flex;
  gap:16px;
  align-items:flex-start;
}
.gd-rating-top .dist{
  flex:1 1 auto;
}

/* summary score */
.gd-summary-score{
  display:flex;
  flex-direction:column;
  gap:2px;
  min-width:80px;
}
.gd-summary-number{
  font-size:26px;
  font-weight:700;
}
.gd-summary-stars{
  color:#fbbf24;
  font-size:14px;
}
.gd-summary-stars-faint{
  color:#4b5563;
}
.gd-summary-count{
  font-size:12px;
  color:#9ca3af;
}

/* Rating distribution bars */
.dist{
  display:flex;
  flex-direction:column;
  gap:4px;
}
.dist-row{
  display:grid;
  grid-template-columns:30px 1fr 34px;
  gap:6px;
  align-items:center;
  font-size:12px;
}
.d-label{color:#e5e7eb}
.d-bar{
  height:7px;
  border-radius:999px;
  overflow:hidden;
  background:#020617;
  border:1px solid rgba(55,65,81,.9);
}
.d-bar span{
  display:block;
  height:100%;
  background:linear-gradient(90deg,#4ade80,#22c55e);
}
.d-num{
  text-align:right;
  color:#9ca3af;
}

/* comments */
.gd-comments{
  margin-top:10px;
  padding-top:12px;
  border-top:1px solid rgba(55,65,81,.8);
}
.gd-comments-head{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:8px;
}
.gd-comment-form{
  margin-bottom:10px;
}
.gd-comment-input{
  width:100%;
  border-radius:10px;
  border:1px solid rgba(55,65,81,.9);
  background:rgba(15,23,42,.9);
  color:#e5e7eb;
  padding:8px 10px;
  resize:vertical;
}
.gd-comment-form-actions{
  display:flex;
  justify-content:flex-end;
  margin-top:6px;
}
.gd-note-small{
  margin-top:4px;
  font-size:11px;
  color:#9ca3af;
}
.gd-comment-list{
  display:flex;
  flex-direction:column;
  gap:10px;
}
.gd-comment{
  display:flex;
  gap:10px;
}
.gd-comment-av{
  width:36px;
  height:36px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.7);
  object-fit:cover;
}
.gd-comment-main{
  flex:1 1 auto;
  min-width:0;
}
.gd-comment-head{
  display:flex;
  align-items:center;
  gap:8px;
}
.gd-comment-name{
  font-weight:600;
}
.gd-comment-stars{color:#fbbf24;font-size:13px}
.gd-comment-stars-faint{color:#4b5563}
.gd-comment-time{
  margin-left:auto;
  font-size:11px;
  color:#9ca3af;
}

/* ปุ่ม Report */
.gd-report-btn{
  margin-left:8px;
  border:none;
  background:none;
  color:#f87171;
  font-size:11px;
  cursor:pointer;
  padding:0;
}
.gd-report-btn:hover{
  text-decoration:underline;
}

.gd-comment-body{
  margin-top:3px;
  line-height:1.6;
  white-space:pre-wrap;
}
.gd-comment-muted{
  color:#9ca3af;
  font-size:13px;
}
.gd-empty{
  padding:10px 12px;
  border-radius:10px;
  background:rgba(15,23,42,.8);
  border:1px dashed rgba(75,85,99,.8);
  font-size:13px;
  color:#e5e7eb;
}

/* reviews block */
.gd-reviews-block{
  margin-top:18px;
  padding-top:10px;
  border-top:1px dashed rgba(55,65,81,.7);
}

/* responsive */
@media (max-width: 720px){
  .gd-head{
    flex-direction:column;
    align-items:flex-start;
  }
  .gd-head-actions{
    width:100%;
    justify-content:flex-start;
    margin-top:8px;
  }
  .gd-rating-top{
    flex-direction:column;
    align-items:flex-start;
  }
}
`}</style>
  );
}
