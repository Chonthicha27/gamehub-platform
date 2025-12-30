// frontend/src/components/NavBar.jsx
import { useNavigate } from "react-router-dom";
import { cdn } from "../api/cdn";

export default function NavBar({
  currentUser,
  onLoginClick,
  onRegisterClick,
  onLogout,
}) {
  const nav = useNavigate();

  const goLogin = () => (onLoginClick ? onLoginClick() : nav("/login"));
  const goRegister = () =>
    onRegisterClick ? onRegisterClick() : nav("/register");

  const isAdmin =
    currentUser?.isAdmin === true || currentUser?.role === "admin";

  const displayLabel =
    (currentUser?.displayName || "").trim() ||
    currentUser?.username ||
    "User";

  const avatarSeed = encodeURIComponent(
    currentUser?.username || currentUser?._id || displayLabel || "guest"
  );

  const avatarSrc = currentUser?.avatarUrl
    ? cdn(currentUser.avatarUrl)
    : `https://api.dicebear.com/7.x/identicon/svg?seed=${avatarSeed}`;

  return (
    <header className="nav-pro">
      <style>{CSS}</style>

      <div className="nav-pro__inner">
        {/* BRAND */}
        <a className="nav-pro__brand" onClick={() => nav("/")}>
          <div className="nav-pro__brand-x">GPX</div>
          <div className="nav-pro__brand-sub">
            <span>Free Online</span>
            <span>Games</span>
          </div>
        </a>

        <div className="nav-pro__right">
          {!currentUser && (
            <>
              <button
                className="nav-pro__chip nav-pro__chip--ghost"
                onClick={goLogin}
              >
                Log in
              </button>
              <button
                className="nav-pro__chip nav-pro__chip--primary"
                onClick={goRegister}
              >
                Sign up
              </button>
            </>
          )}

          {currentUser && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isAdmin && (
                <button
                  className="nav-pro__chip nav-pro__chip--ghost"
                  onClick={() => nav("/admin")}
                >
                  Admin
                </button>
              )}

              <button
                className="nav-pro__chip nav-pro__chip--ghost"
                onClick={() => nav("/favorites")}
                title="View your Favorites"
              >
                ★ Favorites
              </button>

              <button
                className="nav-pro__chip nav-pro__chip--ghost"
                onClick={() => nav("/profile")}
                title="Go to profile"
              >
                <img
                  className="nav-pro__avatar"
                  src={avatarSrc}
                  alt="avatar"
                  onError={(e) => {
                    e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${avatarSeed}`;
                  }}
                />
                <span>Hi, {displayLabel}</span>
              </button>

              <button
                className="nav-pro__chip nav-pro__chip--primary"
                onClick={onLogout}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const CSS = `
/* styles เดิมของคุณคงไว้ */
.nav-pro__avatar{
  width:20px; height:20px; border-radius:999px; object-fit:cover;
  border:2px solid rgba(255,255,255,.9); background:#0a0e12;
}
`;
