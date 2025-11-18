// frontend/src/components/NavBar.jsx
import { useNavigate } from "react-router-dom";
import { cdn } from "../api/cdn";

export default function NavBar({ currentUser, onLoginClick, onRegisterClick, onLogout }) {
  const nav = useNavigate();

  // ถ้ามี prop จากข้างนอก (เปิด modal) ให้ใช้; ถ้าไม่มีให้ไป route
  const goLogin = () => (onLoginClick ? onLoginClick() : nav("/login"));
  const goRegister = () => (onRegisterClick ? onRegisterClick() : nav("/register"));

  const avatarSrc =
    currentUser?.avatarUrl
      ? cdn(currentUser.avatarUrl)
      : `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
          currentUser?.username || currentUser?._id || "guest"
        )}`;

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
              {/* เปลี่ยนมาเรียก goLogin / goRegister */}
              <button className="nav-pro__chip nav-pro__chip--ghost" onClick={goLogin}>
                Log in
              </button>
              <button className="nav-pro__chip nav-pro__chip--primary" onClick={goRegister}>
                Sign up
              </button>
            </>
          )}

          {currentUser && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="nav-pro__chip nav-pro__chip--ghost" onClick={() => nav("/favorites")}>
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
                    e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
                      currentUser?.username || currentUser?._id || "guest"
                    )}`;
                  }}
                />
                <span>Hi, {currentUser?.username || "User"}</span>
              </button>

              <button className="nav-pro__chip nav-pro__chip--primary" onClick={onLogout}>Logout</button>
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
