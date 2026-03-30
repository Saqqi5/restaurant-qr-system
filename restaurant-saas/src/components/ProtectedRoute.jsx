import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ROLE_REDIRECTS = {
  super_admin: "/admin/super",
  general_admin: "/admin/restaurant",
  kitchen: "/admin/kitchen",
  cash_counter: "/admin/cash",
  server: "/admin/server",
};

export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="app-loading"><div className="spinner" /></div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && userProfile?.role !== role && userProfile?.role !== "super_admin") {
    // Redirect to correct dashboard for their role
    const redirect = ROLE_REDIRECTS[userProfile?.role] || "/login";
    return <Navigate to={redirect} replace />;
  }

  return children;
}
