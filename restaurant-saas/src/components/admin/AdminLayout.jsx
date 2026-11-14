import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeToRestaurantPayments, getRestaurant } from "../../config/db";

export default function AdminLayout({ children, title, subtitle, onLogout, userProfile, compact }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  const [pendingPayments, setPendingPayments] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [prevPendingCount, setPrevPendingCount] = useState(null);
  const navigate = useNavigate();

  const restaurantId = userProfile?.restaurant_id;
  const isSuperAdmin = userProfile?.role === "super_admin";

  useEffect(() => {
    if (!restaurantId || isSuperAdmin) return;
    getRestaurant(restaurantId).then((r) => r?.name && setRestaurantName(r.name));
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

  return (
    <div className={`admin-layout ${compact ? "compact" : ""}`}>
      {/* Top Bar */}
      <header className="admin-topbar">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          ☰
        </button>
        <div className="topbar-brand">
          <div className="topbar-brand-name">SAQL<span>YN</span></div>
          <div style={{ marginLeft: 12 }}>
            <div className="brand-title">{restaurantName || title}</div>
            {subtitle && <div className="brand-subtitle">{restaurantName ? `${title} • ${subtitle}` : subtitle}</div>}
            {!subtitle && restaurantName && <div className="brand-subtitle">{title}</div>}
          </div>
        </div>
        <div className="topbar-right">
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
          <button className="btn-logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}>
          <aside className="admin-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <div className="sidebar-brand">SAQL<span>YN</span></div>
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
    </div>
  );
}

function getSidebarLinks(role, pendingCount = 0) {
  const logout = { path: "/login", icon: "⎋", label: "Logout", badge: 0 };
  if (role === "super_admin") {
    return [
      { path: "/admin/super", icon: "👑", label: "All Restaurants", badge: 0 },
      { path: "/admin/super/settings", icon: "⚙️", label: "Settings", badge: 0 },
      logout,
    ];
  }
  if (role === "general_admin") {
    return [
      { path: "/admin/restaurant", icon: "🏪", label: "Dashboard", badge: pendingCount },
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
      logout,
    ];
  }
  if (role === "server") {
    return [
      { path: "/admin/server", icon: "🛎️", label: "Orders", badge: 0 },
      logout,
    ];
  }
  return [logout];
}
