import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getPlanLabel } from "../config/plans";

const ROLE_REDIRECTS = {
  super_admin: "/admin/super",
  general_admin: "/admin/restaurant",
  kitchen: "/admin/kitchen",
  cash_counter: "/admin/cash",
  server: "/admin/server",
};

export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, userProfile, loading, trialBlocked, trialInfo, accountBlocked, logout } = useAuth();
  const location = useLocation();

  if (loading) return <div className="app-loading"><div className="spinner" /></div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Frozen by the super admin, or this login disabled one by one: every
  // dashboard stops here with the same message, live (no re-login needed).
  if (accountBlocked) {
    return (
      <div className="trial-blocked">
        <div className="trial-blocked-card">
          <h2>⛔ Account Disabled</h2>
          <p>
            Your account is disabled. Please contact your administrator.
          </p>
          <button className="btn-primary" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  if (trialBlocked) {
    return (
      <div className="trial-blocked">
        <div className="trial-blocked-card">
          <h2>⛔ Login Blocked</h2>
          <p>
            Your {getPlanLabel(trialInfo?.plan)} plan ended on {trialInfo?.expiresAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
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
