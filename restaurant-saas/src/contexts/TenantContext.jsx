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
    if (theme.primary) root.style.setProperty("--color-primary", theme.primary);
    if (theme.accent)  root.style.setProperty("--color-accent",  theme.accent);
    if (theme.bg)      root.style.setProperty("--color-bg",      theme.bg);
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
