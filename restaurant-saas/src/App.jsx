/**
 * App.jsx
 * ────────
 * ARCHITECTURE NOTE:
 * TenantProvider is placed INSIDE <Routes> (via AppRoutes) so that
 * useParams() works correctly inside TenantContext when reading :restaurantId.
 * BrowserRouter → AuthProvider → Routes → TenantProvider (per route) → Page
 */
import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { resolveTenant, getCustomDomainRestaurantId } from "./config/tenantResolver";

import LandingPage from "./pages/LandingPage";
import GetStarted from "./pages/GetStarted";
import DemoPage from "./pages/DemoPage";
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
import RestaurantSettingsPage from "./pages/RestaurantSettingsPage";
import TableManagementPage    from "./pages/TableManagementPage";
import OrderHistoryPage       from "./pages/OrderHistoryPage";
import OrderTakerPage         from "./pages/OrderTakerPage";

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

// Admin pages don't need restaurant from URL — they get it from user profile
function WithAdminTenant({ children }) {
  const baseConfig = resolveTenant();
  return <TenantProvider initialConfig={baseConfig}>{children}</TenantProvider>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public ─────────────────────────────────────── */}
          <Route path="/" element={<HomeRoute />} />
          <Route path="/get-started" element={<GetStarted />} />
          <Route path="/demo" element={<DemoPage />} />

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
              <ProtectedRoute role="general_admin">
                <GeneralAdminDashboard />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/settings" element={
            <WithAdminTenant>
              <ProtectedRoute role="general_admin">
                <RestaurantSettingsPage />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/tables" element={
            <WithAdminTenant>
              <ProtectedRoute role="general_admin">
                <TableManagementPage />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/history" element={
            <WithAdminTenant>
              <ProtectedRoute role="general_admin">
                <OrderHistoryPage />
              </ProtectedRoute>
            </WithAdminTenant>
          } />
          <Route path="/admin/order-taker" element={
            <WithAdminTenant>
              <ProtectedRoute role={["general_admin", "cash_counter"]}>
                <OrderTakerPage />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
