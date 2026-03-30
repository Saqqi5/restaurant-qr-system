/**
 * TENANT RESOLVER
 * ================
 * Core multi-tenancy engine. Resolves which restaurant is active based on:
 *   1. VITE_RESTAURANT_ID env var (white-label standalone deployment)
 *   2. Custom domain mapping (e.g. myrestaurant.com → restaurant_id)
 *   3. URL path prefix /r/{restaurant_id}
 *
 * To deploy as white-label standalone:
 *   Set VITE_RESTAURANT_ID=your_restaurant_id in .env
 *   Set VITE_DEPLOYMENT_MODE=standalone
 *
 * To run as SaaS:
 *   Leave VITE_RESTAURANT_ID unset
 *   Set VITE_DEPLOYMENT_MODE=saas (default)
 */

// Static domain→restaurantId map (can be loaded from Firestore for dynamic resolution)
// Format: { "myrestaurant.com": "restaurant_abc123" }
const DOMAIN_MAP = {
  // "burger-palace.com": "rest_burger_palace_001",
  // "pizza-world.com": "rest_pizza_world_002",
  // Add your custom domain mappings here
};

export function resolveTenant() {
  // ── Mode 1: White-label standalone deployment ──────────────────────────────
  const envRestaurantId = import.meta.env.VITE_RESTAURANT_ID;
  const deploymentMode = import.meta.env.VITE_DEPLOYMENT_MODE || "saas";

  if (deploymentMode === "standalone" && envRestaurantId) {
    return {
      mode: "standalone",
      restaurantId: envRestaurantId,
      resolvedBy: "env",
    };
  }

  // ── Mode 2: Custom domain mapping ─────────────────────────────────────────
  const hostname = window.location.hostname;
  const isDev = hostname === "localhost" || hostname === "127.0.0.1";

  if (!isDev && DOMAIN_MAP[hostname]) {
    return {
      mode: "custom_domain",
      restaurantId: DOMAIN_MAP[hostname],
      resolvedBy: "domain",
      hostname,
    };
  }

  // ── Mode 3: URL path /r/{restaurant_id} ───────────────────────────────────
  const pathMatch = window.location.pathname.match(/^\/r\/([^/?#]+)/);
  if (pathMatch) {
    return {
      mode: "saas_path",
      restaurantId: pathMatch[1],
      resolvedBy: "path",
    };
  }

  // ── No tenant resolved (SaaS root / super admin) ─────────────────────────
  return {
    mode: "saas",
    restaurantId: null,
    resolvedBy: "none",
  };
}

export function buildMenuUrl(restaurantId, tableNumber, tenantMode = "saas") {
  if (tenantMode === "standalone") {
    return `/menu?table=${tableNumber}`;
  }
  return `/r/${restaurantId}?table=${tableNumber}`;
}

export function buildQrUrl(restaurantId, tableNumber, tenantMode = "saas", customDomain = null) {
  if (customDomain) {
    return `https://${customDomain}?table=${tableNumber}`;
  }
  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${baseUrl}/r/${restaurantId}?table=${tableNumber}`;
}
