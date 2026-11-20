/**
 * App.jsx
 * ────────
 * ARCHITECTURE NOTE:
 * TenantProvider is placed INSIDE <Routes> (via AppRoutes) so that
 * useParams() works correctly inside TenantContext when reading :restaurantId.
 * BrowserRouter → AuthProvider → Routes → TenantProvider (per route) → Page
 */
import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { resolveTenant, getCustomDomainRestaurantId } from "./config/tenantResolver";

import LandingPage from "./pages/LandingPage";
import GetStarted from "./pages/GetStarted";
import DemoPage from "./pages/DemoPage";
import ContactPage from "./pages/ContactPage";
import CustomerMenu from "./pages/CustomerMenu";
import LoginPage from "./pages/LoginPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminOrdersPage from "./pages/SuperAdminOrdersPage";
import PlatformSettingsPage from "./pages/PlatformSettingsPage";
import GeneralAdminDashboard from "./pages/GeneralAdminDashboard";
import KitchenDashboard from "./pages/KitchenDashboard";
import CashCounterDashboard from "./pages/CashCounterDashboard";
import ServerDashboard from "./pages/ServerDashboard";
import ProtectedRoute         from "./components/ProtectedRoute";
import ErrorBoundary          from "./components/ErrorBoundary";
import CapacitorNav           from "./components/CapacitorNav";
import RestaurantSettingsPage from "./pages/RestaurantSettingsPage";
import TableManagementPage    from "./pages/TableManagementPage";
import OrderHistoryPage       from "./pages/OrderHistoryPage";
import OrderTakerPage         from "./pages/OrderTakerPage";
import StaffMenuPage          from "./pages/StaffMenuPage";

// Resolves a custom-domain tenant (Firestore lookup, cached). undefined =
// still resolving, null = no mapping for this hostname.
function useDomainRestaurantId(needsLookup) {
  const [id, setId] = useState(undefined);
  useEffect(() => {
    if (!needsLookup) { setId(null); return; }
    let alive = true;
    getCustomDomainRestaurantId().then((rid) => { if (alive) setId(rid); });
    return () => { alive = false; };
  }, [needsLookup]);
  return id;
}

// Scroll to the top on every route change — without this, opening
// /contact (or /demo, /get-started) from a scrolled-down page keeps the
// old scroll position and the new page's heading hides under the sticky
// header. When the URL carries a hash (/#demos from the drawer), scroll
// to that section instead of the top.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { el.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function LoadingSplash() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#070C0C" }}>
      <div className="spinner" />
    </div>
  );
}

// Wraps any page that needs restaurant context (reads :restaurantId from URL)
function WithTenant({ children, restaurantIdOverride }) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  // Merge URL params with env-level config (standalone mode)
  const baseConfig = resolveTenant();
  // A custom domain (https://myrestaurant.com?table=N) has no /r/ id in the
  // URL — resolve it from Firestore domain_mappings before rendering.
  const needsLookup = !params.restaurantId && !baseConfig.restaurantId && !restaurantIdOverride;
  const domainRestaurantId = useDomainRestaurantId(needsLookup);
  if (needsLookup && domainRestaurantId === undefined) return <LoadingSplash />;
  const config = {
    ...baseConfig,
    restaurantId: params.restaurantId || baseConfig.restaurantId || restaurantIdOverride || domainRestaurantId,
    tableNumber: searchParams.get("table"),
  };
  return <TenantProvider initialConfig={config}>{children}</TenantProvider>;
}

// The root route: on a custom domain it IS the restaurant's menu
// (https://myrestaurant.com?table=N); everywhere else it is the landing page.
function HomeRoute() {
  const domainRestaurantId = useDomainRestaurantId(true);
  if (domainRestaurantId === undefined) return <LoadingSplash />;
  if (domainRestaurantId) {
    return <WithTenant restaurantIdOverride={domainRestaurantId}><CustomerMenu /></WithTenant>;
  }
  return <LandingPage />;
}

// Native app only: the app opens straight on the login page — the public
// landing page is never shown in the app. Signed-in users go to their own
// dashboard instead. (The website keeps the landing page on "/".)
const ROLE_REDIRECTS = {
  super_admin: "/admin/super",
  general_admin: "/admin/restaurant",
  kitchen: "/admin/kitchen",
  cash_counter: "/admin/cash",
  server: "/admin/server",
};

function NativeRoot() {
  const { currentUser, role, loading } = useAuth();
  if (loading) return <LoadingSplash />;
  if (currentUser) return <Navigate to={ROLE_REDIRECTS[role] || "/login"} replace />;
  return <Navigate to="/login" replace />;
}

// Admin pages don't need restaurant from URL — they get it from user profile
function WithAdminTenant({ children }) {
  const baseConfig = resolveTenant();
  return <TenantProvider initialConfig={baseConfig}>{children}</TenantProvider>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          {/* ── Public ─────────────────────────────────────── */}
          <Route path="/" element={Capacitor.isNativePlatform() ? <NativeRoot /> : <HomeRoute />} />
          <Route path="/get-started" element={<GetStarted />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* ── Customer Menu (SaaS path) ──────────────────── */}
          <Route path="/r/:restaurantId" element={
            <WithTenant><CustomerMenu /></WithTenant>
          } />
          {/* ── Customer Menu (Standalone / custom domain) ─── */}
          <Route path="/menu" element={
            <WithTenant><CustomerMenu /></WithTenant>
          } />

          {/* ── Auth ──────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/r/:restaurantId/login" element={<LoginPage />} />

          {/* ── Admin Dashboards ───────────────────────────── */}
          <Route path="/admin/super" element={
            <WithAdminTenant>
              <ProtectedRoute role="super_admin">
                <SuperAdminDashboard />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/super/settings" element={
            <WithAdminTenant>
              <ProtectedRoute role="super_admin">
                <PlatformSettingsPage />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/super/orders" element={
            <WithAdminTenant>
              <ProtectedRoute role="super_admin">
                <SuperAdminOrdersPage />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/restaurant" element={
            <WithAdminTenant>
              <ProtectedRoute role={["general_admin", "branch_manager"]}>
                <GeneralAdminDashboard />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/settings" element={
            <WithAdminTenant>
              <ProtectedRoute role={["general_admin", "branch_manager"]}>
                <RestaurantSettingsPage />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/tables" element={
            <WithAdminTenant>
              <ProtectedRoute role={["general_admin", "branch_manager"]}>
                <TableManagementPage />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/history" element={
            <WithAdminTenant>
              <ProtectedRoute role={["general_admin", "branch_manager"]}>
                <OrderHistoryPage />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/order-taker" element={
            <WithAdminTenant>
              <ProtectedRoute role={["general_admin", "cash_counter", "server", "branch_manager"]}>
                <OrderTakerPage />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          {/* Staff Menu — read-only menu for the waiter/server (and the
              other order-taking roles), so they can show a customer the
              dishes or check a price without placing an order. */}
          <Route path="/admin/menu" element={
            <WithAdminTenant>
              <ProtectedRoute role={["server", "general_admin", "cash_counter"]}>
                <StaffMenuPage />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/kitchen" element={
            <WithAdminTenant>
              <ProtectedRoute role="kitchen">
                <KitchenDashboard />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/cash" element={
            <WithAdminTenant>
              <ProtectedRoute role="cash_counter">
                <CashCounterDashboard />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/server" element={
            <WithAdminTenant>
              <ProtectedRoute role="server">
                <ServerDashboard />
              </ProtectedRoute>
            </WithAdminTenant>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CapacitorNav />
      </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
