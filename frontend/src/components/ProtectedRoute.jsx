import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * ไม่ยิง /users/me ซ้ำ ให้ตรวจจาก state ของ App โดยตรง
 */
export default function ProtectedRoute({ authed, booted, children }) {
  const nav = useNavigate();

  useEffect(() => {
    if (!booted) return;
    if (!authed) nav("/?auth=login", { replace: true });
  }, [authed, booted, nav]);

  if (!booted) return null;
  if (!authed) return null;

  return children;
}
