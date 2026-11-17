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

// Multi-branch owner, blocked on ONE branch (frozen or plan ended): offer
// their other branches instead of stranding them on a dead screen.
function BranchSwitchButtons() {
  const { branches, setActiveRestaurantId, isMultiBranch } = useAuth();
  if (!isMultiBranch) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 13, marginBottom: 8 }}>Or open another branch:</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {branches.map((b) => (
          <button key={b.id} className="btn-primary" onClick={() => setActiveRestaurantId(b.id)}>
            {b.name}
          </button>
        ))}
        <button className="btn-secondary" onClick={() => setActiveRestaurantId("all")}>
          All branches
        </button>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, userProfile, loading, trialBlocked, trialInfo, accountBlocked, frozenBlocked, accountDisabled, logout } = useAuth();
  const location = useLocation();

  if (loading) return <div className="app-loading"><div className="spinner" /></div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // This LOGIN itself was disabled by the super admin — no branch switch
  // helps, because the login is blocked everywhere.
  if (accountDisabled) {
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

  // Frozen by the super admin, or this login disabled one by one: every
  // dashboard stops here with the same message, live (no re-login needed).
  // A frozen BRANCH still lets a multi-branch owner switch to their other
  // branches — only a disabled login strands them.
  if (accountBlocked) {
    return (
      <div className="trial-blocked">
        <div className="trial-blocked-card">
          <h2>⛔ Account Disabled</h2>
          <p>
            Your account is disabled. Please contact your administrator.
          </p>
          {frozenBlocked && <BranchSwitchButtons />}
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
          <BranchSwitchButtons />
          <button className="btn-primary" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  // `role` is one role or a list of roles; the super admin bypasses all of them.
  const allowedRoles = role ? (Array.isArray(role) ? role : [role]) : null;
  if (allowedRoles && !allowedRoles.includes(userProfile?.role) && userProfile?.role !== "super_admin") {
    // Redirect to correct dashboard for their role
    const redirect = ROLE_REDIRECTS[userProfile?.role] || "/login";
    return <Navigate to={redirect} replace />;
  }

  return children;
}
