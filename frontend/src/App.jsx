// frontend/src/App.jsx
import { useEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import Home from "./pages/Home";
import GameList from "./pages/GameList";
import GameDetail from "./pages/GameDetail";
import UploadGame from "./pages/UploadGame";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthModal from "./components/AuthModal";
import api from "./api/axios";
import SettingsProfile from "./pages/SettingsProfile";
import EditGame from "./pages/EditGame";
import SearchResults from "./pages/SearchResults";
import Favorites from "./pages/Favorites";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";

// ลืมรหัสผ่าน
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

export default function App() {
  const nav = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState("login");
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/users/me");
        setUser(res.data);
      } catch {
        setUser(null);
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  const openLogin = () => {
    setAuthTab("login");
    setAuthOpen(true);
  };
  const openRegister = () => {
    setAuthTab("register");
    setAuthOpen(true);
  };

  const handleAuthed = async () => {
    try {
      const res = await api.get("/users/me");
      setUser(res.data);
      setAuthOpen(false);
      nav("/profile");
    } catch {
      nav("/");
    }
  };

  const handleLogout = async () => {
    try {
      await api.get("/auth/logout");
    } catch {}
    setUser(null);
    nav("/");
  };

  if (!booted) return null;

  const isAdmin = user?.isAdmin === true || user?.role === "admin";

  return (
    <>
      <NavBar
        onLoginClick={openLogin}
        onRegisterClick={openRegister}
        currentUser={user}
        onLogout={handleLogout}
      />

      <Routes>
        <Route
          path="/"
          element={
            <Home
              currentUser={user}
              onLoginClick={openLogin}
              onRegisterClick={openRegister}
            />
          }
        />

        <Route path="/search" element={<SearchResults />} />

        {/* ลืมรหัสผ่าน / ตั้งรหัสผ่านใหม่ */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/favorites"
          element={
            <ProtectedRoute authed={!!user} booted={booted}>
              <Favorites />
            </ProtectedRoute>
          }
        />

        {/* ===== Admin ===== */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute authed={!!user && isAdmin} booted={booted}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/games" element={<GameList />} />
        <Route path="/games/:id" element={<GameDetail />} />

        <Route
          path="/games/:id/edit"
          element={
            <ProtectedRoute authed={!!user} booted={booted}>
              <EditGame />
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload"
          element={
            <ProtectedRoute authed={!!user} booted={booted}>
              <UploadGame />
            </ProtectedRoute>
          }
        />

        {/* ✅ โปรไฟล์ของฉัน */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute authed={!!user} booted={booted}>
              <Profile currentUser={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        {/* ✅ โปรไฟล์สาธารณะ: ตาม id */}
        <Route path="/users/:id" element={<Profile />} />

        {/* ✅ โปรไฟล์สาธารณะ: ตาม username (ของเดิม) */}
        <Route path="/@:username" element={<Profile />} />

        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute authed={!!user} booted={booted}>
              <SettingsProfile />
            </ProtectedRoute>
          }
        />
      </Routes>

      <AuthModal
        open={authOpen}
        defaultTab={authTab}
        onClose={() => setAuthOpen(false)}
        onAuthed={handleAuthed}
      />
    </>
  );
}
