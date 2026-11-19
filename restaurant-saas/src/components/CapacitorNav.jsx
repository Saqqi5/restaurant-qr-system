import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { App as CapApp } from "@capacitor/app";
import { useAuth } from "../contexts/AuthContext";

// Bottom tab bar (app only, signed-in users only).
// After login each user sees ONLY their own role's options — no public
// website option (Home, Try Demo, Buy a Plan) ever appears here. The
// ☰ side menu keeps the full navigation; this bar is the role's QUICK
// options — the most-used ones, at least 4 where the role has that many
// pages. (Kitchen and server have only ONE page each, so their bar is
// that page + Logout.)
const ROLE_TABS = {
  super_admin: [
    { label: "Dashboard", icon: "👑", to: "/admin/super" },
    { label: "Orders", icon: "📋", to: "/admin/super/orders" },
    { label: "New", icon: "➕", action: "newRestaurant" },
    { label: "Logout", icon: "⎋", action: "logout" },
  ],
  general_admin: [
    { label: "Dashboard", icon: "🏪", to: "/admin/restaurant" },
    { label: "Order Taker", icon: "🛎️", to: "/admin/order-taker" },
    { label: "History", icon: "📋", to: "/admin/history" },
    { label: "Logout", icon: "⎋", action: "logout" },
  ],
  // Multi-branch manager (his 2026-11-19 decision, corrected): Orders,
  // Revenue, Menu and Settings — via the dashboard, history and settings.
  // No Order Taker or Tables.
  branch_manager: [
    { label: "Dashboard", icon: "🏪", to: "/admin/restaurant" },
    { label: "History", icon: "📋", to: "/admin/history" },
    { label: "Settings", icon: "⚙️", to: "/admin/settings" },
    { label: "Logout", icon: "⎋", action: "logout" },
  ],
  kitchen: [
    { label: "Kitchen", icon: "👨‍🍳", to: "/admin/kitchen" },
    { label: "Logout", icon: "⎋", action: "logout" },
  ],
  cash_counter: [
    { label: "Cash", icon: "💳", to: "/admin/cash" },
    { label: "Order Taker", icon: "🛎️", to: "/admin/order-taker" },
    { label: "History", icon: "📋", to: "/admin/history" },
    { label: "Logout", icon: "⎋", action: "logout" },
  ],
  server: [
    { label: "Orders", icon: "🛎️", to: "/admin/server" },
    { label: "Menu", icon: "🍽️", to: "/admin/menu" },
    { label: "Take Order", icon: "📝", to: "/admin/order-taker" },
    { label: "Logout", icon: "⎋", action: "logout" },
  ],
};

// The main dashboard each role lands on after login — the ONLY admin page
// where Back asks "Log out?". From any deeper admin page, Back goes here.
const ROLE_HOME = {
  super_admin: "/admin/super",
  general_admin: "/admin/restaurant",
  branch_manager: "/admin/restaurant",
  kitchen: "/admin/kitchen",
  cash_counter: "/admin/cash",
  server: "/admin/server",
};

/**
 * CapacitorNav — native-app only (renders nothing on the website).
 * The menu, drawer and About now live in the website itself (SiteDrawer),
 * so the app has NO floating buttons: the header's ☰ button is the one menu.
 * This component only does what the website cannot:
 * 1. Status bar: app content below the status bar (overlay off + dark bg +
 *    light icons). The CSS safe-area rules in index.css are the fallback —
 *    env(safe-area-inset-top) is the bar height when the WebView overlays
 *    it, and 0 when it is already inset, so it never double-offsets.
 * 2. Hardware back button: close About, then close the drawer, then — if
 *    the user is signed in — go back to their main dashboard from any
 *    deeper admin page, and only ON that main dashboard ask "Log out?".
 *    Then go back in history, or exit the app from Home.
 * 3. `capacitor-app` class on <html>: app-only zoom (web unaffected).
 */
export default function CapacitorNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, role, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  // The back-button listener is registered once, so it must read auth /
  // dialog state through refs — a plain closure would keep the values
  // from the first render (logged out, dialog closed) forever.
  const currentUserRef = useRef(currentUser);
  const logoutOpenRef = useRef(logoutOpen);
  const roleRef = useRef(role);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { logoutOpenRef.current = logoutOpen; }, [logoutOpen]);
  useEffect(() => { roleRef.current = role; }, [role]);

  async function handleConfirmLogout() {
    setLogoutOpen(false);
    try { await logout(); } catch (e) { /* still go to the login page */ }
    // replace: the dashboard leaves the back stack, so Back from the
    // login page goes to the previous public page (home, …), never back
    // into a signed-in dashboard.
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    document.documentElement.classList.add("capacitor-app");
    let backListener = null;
    (async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: "#070C0C" });
        await StatusBar.setStyle({ style: Style.Light });
      } catch (e) {
        // Status-bar plugin unavailable — the CSS safe-area padding is the fallback.
      }
      try {
        backListener = await CapApp.addListener("backButton", () => {
          // Logout confirm open? Close it first (stay logged in).
          if (logoutOpenRef.current) {
            setLogoutOpen(false);
            return;
          }
          // The drawer / About live in the website (SiteDrawer) — close them first.
          if (document.querySelector(".cap-about")) {
            window.dispatchEvent(new CustomEvent("saqlyn:close-about"));
            return;
          }
          if (document.querySelector(".cap-drawer.open")) {
            window.dispatchEvent(new CustomEvent("saqlyn:close-menu"));
            return;
          }
          // Signed in? Back is two steps: from a deeper admin page go to
          // the main dashboard first — the "Log out?" dialog appears ONLY
          // on that main dashboard, never straight from a sub-page.
          const path = window.location.pathname;
          if (currentUserRef.current && path.startsWith("/admin")) {
            const home = ROLE_HOME[roleRef.current] || "/admin/restaurant";
            if (path === home) {
              setLogoutOpen(true);
            } else {
              navigate(home);
            }
            return;
          }
          // Logged out on the login page (the app's front door) with
          // nowhere to go back to? Exit the app — "/" would only redirect
          // straight back to login.
          if (!currentUserRef.current && path === "/login" && window.history.length <= 1) {
            CapApp.exitApp();
            return;
          }
          if (path !== "/") {
            if (window.history.length > 1) navigate(-1);
            else navigate("/");
          } else {
            CapApp.exitApp();
          }
        });
      } catch (e) {
        // Back-button plugin unavailable.
      }
    })();
    return () => {
      if (backListener) backListener.remove();
    };
    // navigate is stable; register once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!Capacitor.isNativePlatform()) return null;

  // Logged out → NO bottom bar in the app. The app opens on the login
  // page, which has its own ☰ menu; no public tab (Home / Try Demo /
  // Buy a Plan / Login) is ever shown in the app.
  if (!currentUser) return null;

  // Signed in → the role's panel tabs.
  const tabs = ROLE_TABS[role] || ROLE_TABS.general_admin;

  return (
    <>
      <nav className="cap-bottombar" data-testid="capacitor-bottombar">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            className={`cap-bottombar-tab${tab.to && location.pathname === tab.to ? " active" : ""}`}
            onClick={() => {
              if (tab.action === "logout") setLogoutOpen(true);
              else if (tab.action === "newRestaurant") navigate("/admin/super", { state: { openCreate: true } });
              else if (tab.to) navigate(tab.to);
            }}
            aria-label={tab.label}
          >
            <span className="cap-bottombar-icon">{tab.icon}</span>
            <span className="cap-bottombar-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {logoutOpen && (
        <div className="cap-about-backdrop" onClick={() => setLogoutOpen(false)}>
          <div className="cap-about cap-logout" data-testid="logout-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="cap-about-title">Log out?</div>
            <p className="cap-about-text">
              You are signed in. Do you want to log out of your account?
            </p>
            <button className="cap-about-telegram" onClick={handleConfirmLogout}>
              Confirm logout
            </button>
            <button className="cap-about-close" onClick={() => setLogoutOpen(false)}>
              Stay logged in
            </button>
          </div>
        </div>
      )}
    </>
  );
}
