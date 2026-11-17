// Subscription plans — table caps, staff-login caps, menu-item caps and
// monthly prices per plan. Limits are editable by the super admin in
// Platform Settings (stored in the `platform_settings/platform` doc); the
// values here are the defaults.
// Tables: Basic 10 / Standard 20 / Premium 50 (his 2026-11-14 decision).
// Staff logins: Basic 4 / Standard 10 / Premium 30.
// Menu items: Basic 20 / Standard 50 / Premium unlimited (his 2026-11-15
// decision; 0 = unlimited in settings).
// Prices (PKR/month): Basic 5,000 / Standard 8,000 / Premium 12,000
// (his 2026-11-14 decision; Premium was my pick).
// Data backup (his 2026-11-16 decision): Basic 30 days / Standard 90 days
// / Premium 365 days — the order history a plan keeps, shown to the owner
// when they choose a plan. Nothing is auto-deleted; the number is the
// promise shown at plan-choosing time.
export const PLANS = {
  basic:    { key: "basic",    label: "Basic",    defaultTableLimit: 10,   defaultStaffLimit: 4,  defaultMenuItemLimit: 20,   defaultPrice: 5000, defaultBackupDays: 30,  support: "WhatsApp support" },
  standard: { key: "standard", label: "Standard", defaultTableLimit: 20,   defaultStaffLimit: 10, defaultMenuItemLimit: 50,   defaultPrice: 8000, defaultBackupDays: 90,  support: "Priority WhatsApp support" },
  premium:  { key: "premium",  label: "Premium",  defaultTableLimit: 50,   defaultStaffLimit: 30, defaultMenuItemLimit: null, defaultPrice: 12000, defaultBackupDays: 365, support: "Priority support + phone calls" },
};

export const DEFAULT_PLAN_LIMITS = { basic: 10, standard: 20, premium: 50 };
export const DEFAULT_STAFF_LIMITS = { basic: 4, standard: 10, premium: 30 };
export const DEFAULT_MENU_LIMITS = { basic: 20, standard: 50, premium: 0 };
export const DEFAULT_PLAN_PRICES = { basic: 5000, standard: 8000, premium: 12000 };
export const DEFAULT_BACKUP_DAYS = { basic: 30, standard: 90, premium: 365 };

// Legacy values ("saas"/"standalone"/"unlimited") predate tiers.
export function normalizePlan(plan) {
  if (plan === "unlimited") return "premium";
  return PLANS[plan] ? plan : "standard";
}

export function getPlanLabel(plan) {
  return PLANS[normalizePlan(plan)].label;
}

// overrides: { basic, standard, premium } from platform settings.
// Returns the cap; a missing/invalid value falls back to the plan default.
export function getPlanLimit(plan, overrides) {
  const key = normalizePlan(plan);
  const raw = overrides && overrides[key] !== undefined && overrides[key] !== null
    ? overrides[key]
    : PLANS[key].defaultTableLimit;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : PLANS[key].defaultTableLimit;
}

// Monthly price (PKR) for a plan. overrides: { basic_price, standard_price,
// premium_price } from platform settings.
export function getPlanPrice(plan, overrides) {
  const key = normalizePlan(plan);
  const raw = overrides && overrides[`${key}_price`] !== undefined && overrides[`${key}_price`] !== null
    ? overrides[`${key}_price`]
    : PLANS[key].defaultPrice;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : PLANS[key].defaultPrice;
}

// Menu-item cap for a plan. overrides: { basic_menu, standard_menu,
// premium_menu } from platform settings. Returns the cap, or null = no cap
// (Premium default; a settings value of 0 also means unlimited).
export function getMenuItemLimit(plan, overrides) {
  const key = normalizePlan(plan);
  const raw = overrides && overrides[`${key}_menu`] !== undefined && overrides[`${key}_menu`] !== null
    ? overrides[`${key}_menu`]
    : PLANS[key].defaultMenuItemLimit;
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (n === 0) return null;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : PLANS[key].defaultMenuItemLimit;
}
export function getStaffLimit(plan, overrides) {
  const key = normalizePlan(plan);
  const raw = overrides && overrides[`${key}_staff`] !== undefined && overrides[`${key}_staff`] !== null
    ? overrides[`${key}_staff`]
    : PLANS[key].defaultStaffLimit;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : PLANS[key].defaultStaffLimit;
}

// Data backup for a plan, in days. overrides: { basic_backup,
// standard_backup, premium_backup } from platform settings.
export function getBackupDays(plan, overrides) {
  const key = normalizePlan(plan);
  const raw = overrides && overrides[`${key}_backup`] !== undefined && overrides[`${key}_backup`] !== null
    ? overrides[`${key}_backup`]
    : PLANS[key].defaultBackupDays;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : PLANS[key].defaultBackupDays;
}

// "Data backup: 30 days" (365 days shows as "1 year") — the line shown on
// pricing cards when a restaurant chooses a plan.

// Custom logo: free on Premium, a one-time add-on on Standard, not on
// Basic. Amount is my pick — PKR 2,000 one-time — change it in one place.
export const CUSTOM_LOGO_ADDON_PKR = 2000;
// What the customer pays SAQLYN for a custom domain, per year, on top of
// the plan. The registrar charges us ~$10-15/year (~PKR 2,800-4,200);
// PKR 3,500 covers the common .com price with a small margin. Premium
// TLDs (.io/.ai) cost more at the registrar — the super admin sees the
// live price in the buy dialog before paying.
export const DOMAIN_CHARGE_PKR_PER_YEAR = 3500;

// The 4 features EVERY plan has — shown once, in a strip above the
// pricing cards, instead of repeated on every card (his 2026-11-17 order:
// the lists were too long and looked cluttered).
export const SHARED_FEATURES = [
  "QR code ordering",
  "Kitchen & cash dashboards",
  "Tax & discount billing",
  "Payment proof uploads",
];

// "10 tables · 4 staff logins · 20 menu items" — the compact spec line
// shown at the top of each pricing card, instead of three list rows.
export function getPlanLimitsLine(planKey) {
  const key = normalizePlan(planKey);
  const tables = getPlanLimit(key, null);
  const staff = getStaffLimit(key, null);
  const menu = getMenuItemLimit(key, null);
  const menuText = menu === null ? "Unlimited menu items" : `${menu} menu items`;
  return `${tables} tables · ${staff} staff logins · ${menuText}`;
}

// Home Delivery — a Premium feature (his 2026-11-17 order): Premium plans
// include it; on any other plan the super admin may enable it for one
// restaurant (restaurant.delivery_override), the same override pattern as
// Order Taker mode.
export function canUseDelivery(plan, restaurant) {
  const key = plan ? normalizePlan(plan) : "basic";
  return key === "premium" || restaurant?.delivery_override === true;
}

// Each plan card shows only the features that DIFFER (LandingPage +
// GetStarted share this, so the cards can never drift apart). The shared
// features live in the strip above the cards and the limits in the spec
// line at the top of each card — so Basic shows 5 lines, Standard and
// Premium 7, instead of 12–14. Included features render with a green
// check. On top, Basic and Standard each show one or two headline Premium
// features struck-through, so a buyer sees what the next plan unlocks
// (his 2026-11-16 order — the full list on every card is gone).
// Basic teasers: Order Taker mode + Custom domain. Standard teaser:
// Custom domain. Order = card order.
export function getPlanFeatures(planKey) {
  const key = normalizePlan(planKey);
  const std = key !== "basic"; // Standard + Premium
  const prem = key === "premium";
  const own = [];
  if (std) {
    own.push(
      { text: "Server dashboard", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Order Taker mode", included: true },
    );
  }
  if (prem) own.push({ text: `Custom domain — PKR ${DOMAIN_CHARGE_PKR_PER_YEAR.toLocaleString("en-US")}/year`, included: true });
  // Custom logo: free on Premium; on Basic and Standard the customer can
  // buy it from us for the one-time fee (his 2026-11-16 order — the line
  // shows on every plan, so a Basic customer can ask for it too).
  own.push(
    {
      text: prem
        ? "Custom logo — Free"
        : `Custom logo — PKR ${CUSTOM_LOGO_ADDON_PKR.toLocaleString("en-US")} one-time`,
      included: true,
    },
    { text: getBackupLabel(key, null), included: true },
    { text: PLANS[key].support, included: true },
  );
  if (key === "basic") {
    own.push(
      { text: "Order Taker mode", included: false },
      { text: "Custom domain", included: false },
    );
  }
  if (key === "standard") own.push({ text: "Custom domain", included: false });
  return own;
}

// Retention window (his 2026-11-16 order): a restaurant admin sees only
// orders newer than their plan's backup window (Basic 30 / Standard 90 /
// Premium 365 days). NOTHING is deleted — the super admin still sees every
// order; the window only limits what the restaurant's own panels show. It
// rolls forward daily: each morning one more day falls out of the admin's
// view. The cutoff is the start of the day N days ago, so "the last 90
// days" shows exactly 90 days back.
export function getRetentionCutoffDate(planKey, overrides) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - getBackupDays(planKey, overrides));
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

function orderDate(order) {
  if (!order?.created_at) return null;
  if (typeof order.created_at.toDate === "function") return order.created_at.toDate();
  const d = new Date(order.created_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

// An order with no usable date is always shown — never hide blindly.
export function isOrderWithinRetention(order, planKey, overrides) {
  const d = orderDate(order);
  if (!d) return true;
  return d >= getRetentionCutoffDate(planKey, overrides);
}
export function getBackupLabel(plan, overrides) {
  const days = getBackupDays(plan, overrides);
  const span = days >= 365 && days % 365 === 0
    ? `${days / 365} year${days / 365 > 1 ? "s" : ""}`
    : `${days} days`;
  return `Data backup: ${span}`;
}

// ── Trial / subscription period ──────────────────────────────────────────
// Every new restaurant starts with a 7-day free trial, on ANY plan. At
// expiry the login is blocked until the administrator continues the plan
// (one click, +30 days — a paid month). A restaurant with no
// plan_expires_at (older data) never expires.
// Paid periods (Continue, verified plan payment) are always 30 days —
// they must NOT follow TRIAL_DAYS.
export const TRIAL_DAYS = 7;
export const PAID_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Demo handout: a prospect gets the demo restaurant accounts for 7 days
// only. If they don't take it in their own name, the demo ends — the
// logins block at expiry, exactly like a trial ending (the super admin
// re-starts it for the next prospect with one click).
export const DEMO_DAYS = 7;

export function demoExpiryDateFrom(date) {
  const base = date instanceof Date ? date.getTime() : Date.now();
  return new Date(base + DEMO_DAYS * DAY_MS);
}

export function expiryDateFrom(date) {
  const base = date instanceof Date ? date.getTime() : Date.now();
  return new Date(base + TRIAL_DAYS * DAY_MS);
}

export function paidExpiryDateFrom(date) {
  const base = date instanceof Date ? date.getTime() : Date.now();
  return new Date(base + PAID_PERIOD_DAYS * DAY_MS);
}

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === "function") return v.toDate();
  if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
  return null;
}

// { expiresAt: Date|null, daysLeft: number|null, expired: boolean,
//   expiringSoon: boolean } — expiringSoon = 2 days or less left.
export function getExpiryInfo(restaurant) {
  const expiresAt = toDate(restaurant?.plan_expires_at);
  if (!expiresAt) return { expiresAt: null, daysLeft: null, expired: false, expiringSoon: false };
  const expired = expiresAt.getTime() < Date.now();
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / DAY_MS));
  return { expiresAt, daysLeft, expired, expiringSoon: !expired && daysLeft <= 2 };
}

export function formatExpiryDate(date) {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Can the table count move from `current` to `next` under this plan?
// Owners may lower the count anytime, but never raise it above the plan's
// limit (a count already above the limit — e.g. after a downgrade — may
// stay, but may not grow further).
export function canSetTableCount(current, next, plan, overrides) {
  const limit = getPlanLimit(plan, overrides);
  if (next < 1) return false;
  if (limit === null) return true;
  return next <= Math.max(current || 0, limit);
}
