import { useLocation, useNavigate } from "react-router-dom";

export default function PreviewGame() {
  const nav = useNavigate();
  const { state } = useLocation();
  const draft = state?.draft;

  if (!draft) {
    return (
      <div className="container section">
        <div className="banner">No draft data. Please go back to Upload page.</div>
        <button className="btn btn-primary" onClick={() => nav(-1)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="container section">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>{draft.title}</h1>
          {draft.tagline ? <div style={{ opacity: 0.8, marginTop: 6 }}>{draft.tagline}</div> : null}
          <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
            Draft preview • Not uploaded yet
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={() => nav(-1)}>
            Back to edit
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.35fr .85fr", gap: 14 }}>
        {/* Left */}
        <div>
          <div className="box">
            <div className="box-head">
              <div className="box-title">Details</div>
              <div className="box-desc muted">This is a draft preview of your game page.</div>
            </div>

            {draft.description ? (
              <div className="preview">
                {String(draft.description).split("\n").map((line, i) => (
                  <p key={i} className="md-line">{line || "\u00A0"}</p>
                ))}
              </div>
            ) : (
              <div className="muted">No description yet.</div>
            )}

            {!!draft.tags?.length && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {draft.tags.map((t) => (
                  <span key={t} className="chip">#{t}</span>
                ))}
              </div>
            )}
          </div>

          {draft.videoUrl ? (
            <div className="box" style={{ marginTop: 12 }}>
              <div className="box-head">
                <div className="box-title">Trailer</div>
                <div className="box-desc muted">{draft.videoUrl}</div>
              </div>
              <div className="muted">
                (Preview only: embed can be done on the real game page later.)
              </div>
            </div>
          ) : null}
        </div>

        {/* Right */}
        <aside>
          <div className="box">
            <div className="box-head">
              <div className="box-title">Cover</div>
              <div className="box-desc muted">Draft preview image</div>
            </div>

            <div className="cover-drop">
              <div className="cover-inner">
                {draft.coverPreview ? (
                  <img src={draft.coverPreview} alt="cover preview" />
                ) : (
                  <div className="cover-empty muted">No cover uploaded</div>
                )}
              </div>
            </div>
          </div>

          <div className="box" style={{ marginTop: 12 }}>
            <div className="box-head">
              <div className="box-title">Screenshots</div>
              <div className="box-desc muted">Draft preview</div>
            </div>

            {draft.screenPreviews?.length ? (
              <div className="screens">
                {draft.screenPreviews.map((u, i) => (
                  <figure key={i} className="screen">
                    <img src={u} alt={`s-${i}`} />
                  </figure>
                ))}
              </div>
            ) : (
              <div className="muted">No screenshots yet.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
