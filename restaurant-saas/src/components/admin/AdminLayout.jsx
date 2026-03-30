import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminLayout({ children, title, subtitle, onLogout, userProfile, compact }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className={`admin-layout ${compact ? "compact" : ""}`}>
      {/* Top Bar */}
      <header className="admin-topbar">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          ☰
        </button>
        <div className="topbar-brand">
          <span className="brand-icon">🍽️</span>
          <div>
            <div className="brand-title">{title}</div>
            <div className="brand-subtitle">{subtitle}</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="user-info">
            <div className="user-avatar">{userProfile?.name?.[0]?.toUpperCase() || "?"}</div>
            <div className="user-name">{userProfile?.name}</div>
          </div>
          <button className="btn-logout" onClick={onLogout} title="Logout">
            ⎋ Logout
          </button>
        </div>
      </header>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}>
          <aside className="admin-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <span>Navigation</span>
              <button onClick={() => setSidebarOpen(false)}>✕</button>
            </div>
            <nav className="sidebar-nav">
              {getSidebarLinks(userProfile?.role).map((link) => (
                <button
                  key={link.path}
                  className="sidebar-link"
                  onClick={() => { navigate(link.path); setSidebarOpen(false); }}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
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
    </div>
  );
}

function getSidebarLinks(role) {
  const logout = { path: "/login", icon: "⎋", label: "Logout" };
  if (role === "super_admin") {
    return [
      { path: "/admin/super",   icon: "👑", label: "All Restaurants" },
      logout,
    ];
  }
  if (role === "general_admin") {
    return [
      { path: "/admin/restaurant", icon: "🏪", label: "Dashboard" },
      { path: "/admin/tables",     icon: "🪑", label: "Tables" },
      { path: "/admin/history",    icon: "📋", label: "Order History" },
      { path: "/admin/settings",   icon: "⚙️",  label: "Settings" },
      logout,
    ];
  }
  if (role === "kitchen") {
    return [
      { path: "/admin/kitchen", icon: "👨‍🍳", label: "Kitchen Queue" },
      logout,
    ];
  }
  if (role === "cash_counter") {
    return [
      { path: "/admin/cash", icon: "💳", label: "Cash Counter" },
      logout,
    ];
  }
  if (role === "server") {
    return [
      { path: "/admin/server", icon: "🛎️", label: "Orders" },
      logout,
    ];
  }
  return [logout];
}
