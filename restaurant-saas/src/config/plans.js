// Subscription plans — table caps, staff-login caps, menu-item caps and
// monthly prices per plan. Limits are editable by the super admin in
// Platform Settings (stored in the `platform_settings/platform` doc); the
// values here are the defaults.
// Tables: Basic 10 / Standard 20 / Premium 50 (his 2026-11-14 decision).
// Staff logins: Basic 4 / Standard 10 / Premium 30.
// Menu items: Basic 30 / Standard 100 / Premium unlimited (0 = unlimited).
// Prices (PKR/month): Basic 5,000 / Standard 8,000 / Premium 12,000
// (his 2026-11-14 decision; Premium was my pick).
export const PLANS = {
  basic:    { key: "basic",    label: "Basic",    defaultTableLimit: 10,   defaultStaffLimit: 4,  defaultMenuItemLimit: 30,   defaultPrice: 5000 },
  standard: { key: "standard", label: "Standard", defaultTableLimit: 20,   defaultStaffLimit: 10, defaultMenuItemLimit: 100,  defaultPrice: 8000 },
  premium:  { key: "premium",  label: "Premium",  defaultTableLimit: 50,   defaultStaffLimit: 30, defaultMenuItemLimit: null, defaultPrice: 12000 },
};

export const DEFAULT_PLAN_LIMITS = { basic: 10, standard: 20, premium: 50 };
export const DEFAULT_STAFF_LIMITS = { basic: 4, standard: 10, premium: 30 };
export const DEFAULT_MENU_LIMITS = { basic: 30, standard: 100, premium: 0 };
export const DEFAULT_PLAN_PRICES = { basic: 5000, standard: 8000, premium: 12000 };

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

// ── Trial / subscription period ──────────────────────────────────────────
// A new restaurant starts on a 7-day period (the Basic trial — the trial
// exists ONLY on Basic). At expiry the login is blocked until the super
// admin continues the plan (one click, +30 days — a paid month). A
// restaurant with no plan_expires_at (older data) never expires.
// Paid periods (Continue, verified plan payment, a Standard/Premium
// restaurant created after payment) are always 30 days — they must NOT
// follow TRIAL_DAYS.
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
