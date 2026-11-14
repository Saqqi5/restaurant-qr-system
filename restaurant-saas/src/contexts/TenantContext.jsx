import { createContext, useContext, useEffect, useState } from "react";
import { subscribeToRestaurant } from "../config/db";

const TenantContext = createContext(null);

/**
 * TenantProvider
 * ──────────────
 * Receives `initialConfig` from the WithTenant wrapper in App.jsx,
 * which already resolved restaurantId from URL params / env / domain.
 * No useParams() here — that's handled one level up.
 */
export function TenantProvider({ children, initialConfig }) {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  const restaurantId = initialConfig?.restaurantId;
  const tableNumber = initialConfig?.tableNumber
    ? parseInt(initialConfig.tableNumber)
    : null;

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToRestaurant(restaurantId, (data) => {
      setRestaurant(data);
      setLoading(false);
      if (data?.theme) applyTheme(data.theme);
    });
    return unsubscribe;
  }, [restaurantId]);

  function applyTheme(theme) {
    const root = document.documentElement;
    // Only apply explicit overrides; fall back to Saqlyn defaults
    const SAQLYN_PRIMARY = "#20C997";
    const SAQLYN_GREEN   = "#0F3D3E";
    const primary = (theme.primary && theme.primary !== "#e85d04" && theme.primary !== "#E85D04")
      ? theme.primary : SAQLYN_PRIMARY;
    const accent  = (theme.accent && theme.accent !== "#e85d04" && theme.accent !== "#E85D04")
      ? theme.accent : SAQLYN_GREEN;
    root.style.setProperty("--color-primary", primary);
    root.style.setProperty("--color-primary-dark", primary);
    root.style.setProperty("--color-accent", accent);
  }

  const value = {
    restaurant,
    tenantConfig: initialConfig,
    tableNumber,
    loading,
    restaurantId,
    isStandalone: initialConfig?.mode === "standalone",
    isSaas: initialConfig?.mode === "saas" || initialConfig?.mode === "saas_path",
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
