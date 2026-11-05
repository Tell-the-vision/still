import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth";

// Guards every signed-in screen; each screen draws its own frame (Shell). Figma 09's Overview, Audit log and
// Platform settings have no screens (SPEC §9.2), so they are not offered.
export default function Layout() {
  const { status, me } = useAuth();
  const { pathname } = useLocation();

  // No STILL staff session: temporary sign-in screen, then back to this page.
  if (status === "signed-out") return <Navigate to="/sign-in" replace state={{ from: pathname }} />;

  // A temporary password must be changed before anything else (SPEC §10.5).
  if (me?.mustChangePassword) return <Navigate to="/change-password" replace />;

  if (status === "loading") return <p className="pa-loading">Loading…</p>;
  return <Outlet />;
}
