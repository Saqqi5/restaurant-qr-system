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
  const { isAuthenticated, userProfile, loading, trialBlocked, trialInfo, logout } = useAuth();
  const location = useLocation();

  if (loading) return <div className="app-loading"><div className="spinner" /></div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (trialBlocked) {
    return (
      <div className="trial-blocked">
        <div className="trial-blocked-card">
          <h2>⛔ Login Blocked</h2>
          <p>
            Your plan ended on {trialInfo?.expiresAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
          </p>
          <p>
            To continue, please pay the subscription fee and contact the
            administrator — they can restart your plan with one click.
          </p>
          <button className="btn-primary" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  if (role && userProfile?.role !== role && userProfile?.role !== "super_admin") {
    // Redirect to correct dashboard for their role
    const redirect = ROLE_REDIRECTS[userProfile?.role] || "/login";
    return <Navigate to={redirect} replace />;
  }

  return children;
}
