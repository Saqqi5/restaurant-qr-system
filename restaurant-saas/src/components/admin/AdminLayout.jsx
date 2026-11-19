import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeToRestaurantPayments, getRestaurant } from "../../config/db";
import { useAuth } from "../../contexts/AuthContext";
import ChangePasswordModal from "./ChangePasswordModal";

export default function AdminLayout({ children, title, subtitle, onLogout, userProfile, compact }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantTheme, setRestaurantTheme] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [prevPendingCount, setPrevPendingCount] = useState(null);
  const navigate = useNavigate();

  // The ACTIVE branch (branch switcher), not the user's first branch:
  // every dashboard in this layout follows the switcher. "all" is the
  // combined All-branches view.
  const { restaurantId, branches, activeRestaurantId, setActiveRestaurantId, isMultiBranch } = useAuth();
  const isSuperAdmin = userProfile?.role === "super_admin";

  useEffect(() => {
    if (!restaurantId || isSuperAdmin) return;
    // The restaurant's own brand colours theme the whole staff panel —
    // same mapping as the customer menu (primary colours the header, the
    // brighter accent colours buttons and active states). Super admin
    // panels keep the SAQLYN green default.
    getRestaurant(restaurantId).then((r) => {
      if (r?.name) setRestaurantName(r.name);
      if (r?.theme) setRestaurantTheme(r.theme);
    });
    const unsub = subscribeToRestaurantPayments(restaurantId, (payments) => {
      const pending = payments.filter(p => p.status === "pending");
      setPendingPayments(pending);
      setPrevPendingCount(prev => {
        if (prev !== null && pending.length > prev) {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 5000);
        }
        return pending.length;
      });
    });
    return unsub;
  }, [restaurantId, isSuperAdmin]);

  const pendingCount = pendingPayments.length;

  const themeVars = restaurantTheme ? {
    "--color-primary": restaurantTheme.accent || "#17A884",
    "--color-primary-dark": restaurantTheme.primary || "#20C997",
    "--color-green": restaurantTheme.primary || "#20C997",
  } : undefined;

  return (
    <div className={`admin-layout ${compact ? "compact" : ""}`} style={themeVars}>
      {/* Top Bar */}
      <header className="admin-topbar">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          ☰
        </button>
        <div className="topbar-brand">
          <div className="topbar-brand-name">SAQL<span>YN</span></div>
          <div className="topbar-brand-text" style={{ marginLeft: 12 }}>
            <div className="brand-title">{restaurantName || title}</div>
            {subtitle && <div className="brand-subtitle">{restaurantName ? `${title} • ${subtitle}` : subtitle}</div>}
            {!subtitle && restaurantName && <div className="brand-subtitle">{title}</div>}
          </div>
        </div>
        <div className="topbar-right">
          {/* Branch switching is ONLY for the Branch Manager (his
              2026-11-19 correction): the single-restaurant admin never
              sees it. The manager works one branch at a time from the
              switcher — there is no combined "all branches" view (removed
              his 2026-11-19 order). */}
          {isMultiBranch && userProfile?.role === "branch_manager" && (
            <select
              className="branch-switcher"
              value={activeRestaurantId || userProfile?.restaurant_id || ""}
              onChange={(e) => setActiveRestaurantId(e.target.value)}
              title="Switch branch"
              aria-label="Switch branch"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {!isSuperAdmin && pendingCount > 0 && (
            <button
              className="notif-btn"
              onClick={() => {
                const path = userProfile?.role === "cash_counter" ? "/admin/cash" : "/admin/restaurant";
                navigate(path);
                setSidebarOpen(false);
              }}
              title={`${pendingCount} pending payment${pendingCount > 1 ? "s" : ""}`}
            >
              🔔
              <span className="notif-count">{pendingCount}</span>
            </button>
          )}
          <div className="user-info">
            <div className="user-avatar">{userProfile?.name?.[0]?.toUpperCase() || "?"}</div>
            <div className="user-name">{userProfile?.name}</div>
          </div>
          <button className="btn-logout" onClick={() => setShowPasswordModal(true)} title="Change password">
            🔒 <span className="btn-label">Password</span>
          </button>
          <button className="btn-logout" onClick={onLogout}>
            <span className="btn-logout-icon">⎋</span><span className="btn-label">Logout</span>
          </button>
        </div>
      </header>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}>
          <aside className="admin-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <img src="/images/saqlyn-logo-tagline.png" alt="SAQLYN — Scan, Order, Pay" className="sidebar-brand-img" />
              <button onClick={() => setSidebarOpen(false)}>✕</button>
            </div>
            <nav className="sidebar-nav">
              {getSidebarLinks(userProfile?.role, pendingCount).map((link) => (
                <button
                  key={link.path}
                  className="sidebar-link"
                  onClick={() => { navigate(link.path); setSidebarOpen(false); }}
                >
                  <span>{link.icon}</span>
                  <span style={{ flex: 1 }}>{link.label}</span>
                  {link.badge > 0 && (
                    <span style={{
                      background: "var(--color-danger)", color: "white",
                      fontSize: 11, fontWeight: 700, padding: "1px 7px",
                      borderRadius: 10, minWidth: 20, textAlign: "center"
                    }}>{link.badge}</span>
                  )}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="admin-main">
        <div className="admin-content">
          {children}
        </div>
      </main>

      {/* Payment notification toast */}
      {showToast && (
        <div className="toast">
          <span className="toast-icon">💳</span>
          <div>
            <div className="toast-text">New Payment Received</div>
            <div className="toast-sub">A customer has uploaded payment proof</div>
          </div>
        </div>
      )}

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

function getSidebarLinks(role, pendingCount = 0) {
  const logout = { path: "/login", icon: "⎋", label: "Logout", badge: 0 };
  if (role === "super_admin") {
    return [
      { path: "/admin/super", icon: "👑", label: "All Restaurants", badge: 0 },
      { path: "/admin/super/orders", icon: "📋", label: "All Orders", badge: 0 },
      { path: "/admin/super/settings", icon: "⚙️", label: "Settings", badge: 0 },
      logout,
    ];
  }
  if (role === "general_admin") {
    return [
      { path: "/admin/restaurant", icon: "🏪", label: "Dashboard", badge: pendingCount },
      { path: "/admin/order-taker", icon: "🛎️", label: "Order Taker", badge: 0 },
      { path: "/admin/tables",     icon: "🪑", label: "Tables", badge: 0 },
      { path: "/admin/history",    icon: "📋", label: "Order History", badge: 0 },
      { path: "/admin/settings",   icon: "⚙️",  label: "Settings", badge: 0 },
      logout,
    ];
  }
  // Multi-branch manager (his 2026-11-19 decision, corrected): the manager
  // sits ABOVE the restaurant admin, so they get every option the admin
  // has — Dashboard, Order Taker, Tables, Order History, Settings — plus
  // the branch switcher (rendered by AdminLayout), one branch at a time.
  if (role === "branch_manager") {
    return [
      { path: "/admin/restaurant", icon: "🏪", label: "Dashboard", badge: pendingCount },
      { path: "/admin/order-taker", icon: "🛎️", label: "Order Taker", badge: 0 },
      { path: "/admin/tables",     icon: "🪑", label: "Tables", badge: 0 },
      { path: "/admin/history",    icon: "📋", label: "Order History", badge: 0 },
      { path: "/admin/settings",   icon: "⚙️",  label: "Settings", badge: 0 },
      logout,
    ];
  }
  if (role === "kitchen") {
    return [
      { path: "/admin/kitchen", icon: "👨‍🍳", label: "Kitchen Queue", badge: 0 },
      logout,
    ];
  }
  if (role === "cash_counter") {
    return [
      { path: "/admin/cash", icon: "💳", label: "Cash Counter", badge: pendingCount },
      { path: "/admin/order-taker", icon: "🛎️", label: "Order Taker", badge: 0 },
      logout,
    ];
  }
  if (role === "server") {
    return [
      { path: "/admin/server", icon: "🛎️", label: "Orders", badge: 0 },
      { path: "/admin/menu", icon: "🍽️", label: "Menu", badge: 0 },
      { path: "/admin/order-taker", icon: "📝", label: "Take Order", badge: 0 },
      logout,
    ];
  }
  return [logout];
}
