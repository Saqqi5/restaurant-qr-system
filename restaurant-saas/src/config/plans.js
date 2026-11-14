// Subscription plans — table caps AND staff-login caps per plan.
// Limits are editable by the super admin in Platform Settings (stored in the
// `platform_settings/platform` doc); the values here are the defaults.
// Premium = no table cap (stored as 0 in settings).
export const PLANS = {
  basic:    { key: "basic",    label: "Basic",    defaultTableLimit: 10,   defaultStaffLimit: 4 },
  standard: { key: "standard", label: "Standard", defaultTableLimit: 20,   defaultStaffLimit: 10 },
  premium:  { key: "premium",  label: "Premium",  defaultTableLimit: null, defaultStaffLimit: 30 },
};

export const DEFAULT_PLAN_LIMITS = { basic: 10, standard: 20, premium: 0 };
export const DEFAULT_STAFF_LIMITS = { basic: 4, standard: 10, premium: 30 };

// Legacy values ("saas"/"standalone"/"unlimited") predate tiers.
export function normalizePlan(plan) {
  if (plan === "unlimited") return "premium";
  return PLANS[plan] ? plan : "standard";
}

export function getPlanLabel(plan) {
  return PLANS[normalizePlan(plan)].label;
}

// overrides: { basic, standard, premium } from platform settings
// (premium stored as 0 = no cap). Returns the cap, or null = no cap.
export function getPlanLimit(plan, overrides) {
  const key = normalizePlan(plan);
  const raw = overrides && overrides[key] !== undefined && overrides[key] !== null
    ? overrides[key]
    : PLANS[key].defaultTableLimit;
  if (key === "premium") {
    const n = Number(raw);
    return n > 0 ? n : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : PLANS[key].defaultTableLimit;
}

// Staff-login cap for a plan. overrides: { basic_staff, standard_staff,
// premium_staff } from platform settings.
export function getStaffLimit(plan, overrides) {
  const key = normalizePlan(plan);
  const raw = overrides && overrides[`${key}_staff`] !== undefined && overrides[`${key}_staff`] !== null
    ? overrides[`${key}_staff`]
    : PLANS[key].defaultStaffLimit;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : PLANS[key].defaultStaffLimit;
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
