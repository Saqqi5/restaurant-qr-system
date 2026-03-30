/**
 * App.jsx
 * ────────
 * ARCHITECTURE NOTE:
 * TenantProvider is placed INSIDE <Routes> (via AppRoutes) so that
 * useParams() works correctly inside TenantContext when reading :restaurantId.
 * BrowserRouter → AuthProvider → Routes → TenantProvider (per route) → Page
 */
import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { resolveTenant } from "./config/tenantResolver";

import LandingPage from "./pages/LandingPage";
import CustomerMenu from "./pages/CustomerMenu";
import LoginPage from "./pages/LoginPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import GeneralAdminDashboard from "./pages/GeneralAdminDashboard";
import KitchenDashboard from "./pages/KitchenDashboard";
import CashCounterDashboard from "./pages/CashCounterDashboard";
import ServerDashboard from "./pages/ServerDashboard";
import ProtectedRoute         from "./components/ProtectedRoute";
import RestaurantSettingsPage from "./pages/RestaurantSettingsPage";
import TableManagementPage    from "./pages/TableManagementPage";
import OrderHistoryPage       from "./pages/OrderHistoryPage";

// Wraps any page that needs restaurant context (reads :restaurantId from URL)
function WithTenant({ children }) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  // Merge URL params with env-level config (standalone mode)
  const baseConfig = resolveTenant();
  const config = {
    ...baseConfig,
    restaurantId: params.restaurantId || baseConfig.restaurantId,
    tableNumber: searchParams.get("table"),
  };
  return <TenantProvider initialConfig={config}>{children}</TenantProvider>;
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
          <Route path="/" element={<LandingPage />} />

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
