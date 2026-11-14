// Subscription plans — each plan caps how many tables a restaurant may have.
// Limits are editable by the super admin in Platform Settings (stored in the
// `platform_settings/platform` doc); the values here are the defaults.
// Unlimited = no cap (stored as 0 in settings).
export const PLANS = {
  basic:     { key: "basic",     label: "Basic",     defaultTableLimit: 10 },
  standard:  { key: "standard",  label: "Standard",  defaultTableLimit: 20 },
  unlimited: { key: "unlimited", label: "Unlimited", defaultTableLimit: null },
};

export const DEFAULT_PLAN_LIMITS = { basic: 10, standard: 20, unlimited: 0 };

// Legacy values ("saas"/"standalone") predate tiers — they mean Standard.
export function normalizePlan(plan) {
  return PLANS[plan] ? plan : "standard";
}

export function getPlanLabel(plan) {
  return PLANS[normalizePlan(plan)].label;
}

// overrides: { basic, standard, unlimited } from platform settings
// (unlimited stored as 0 = no cap). Returns the cap, or null = no cap.
export function getPlanLimit(plan, overrides) {
  const key = normalizePlan(plan);
  const raw = overrides && overrides[key] !== undefined && overrides[key] !== null
    ? overrides[key]
    : PLANS[key].defaultTableLimit;
  if (key === "unlimited") {
    const n = Number(raw);
    return n > 0 ? n : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : PLANS[key].defaultTableLimit;
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
