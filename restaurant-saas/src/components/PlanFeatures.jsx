// One shared feature list for the pricing cards (LandingPage + GetStarted):
// each plan shows only the features that DIFFER. The 4 features every plan
// has live in one strip above the cards, and the tables/staff/menu limits
// live in a compact spec line at the top of each card (his 2026-11-17
// order — the lists were too long and looked cluttered). Included features
// get a green check; the struck-through ones are the next plan's teasers.
import { getPlanFeatures, getPlanLimitsLine, SHARED_FEATURES } from "../config/plans";

// "10 tables · 4 staff logins · 20 menu items" — the compact spec line at
// the top of a pricing card. A <span> on GetStarted: its card is a
// <button>, which cannot hold a <p>.
export function PlanLimitsLine({ plan, variant }) {
  const text = getPlanLimitsLine(plan);
  if (variant === "getstarted") {
    return <span className="gs-limits">{text}</span>;
  }
  return <p className="pricing-limits">{text}</p>;
}

// "Every plan includes: QR code ordering · Kitchen & cash dashboards ·
// Tax & discount billing · Payment proof uploads" — one line above the
// pricing cards, so the shared features are stated once, not on every card.
export function SharedFeaturesStrip({ variant }) {
  const text = `Every plan includes: ${SHARED_FEATURES.join(" · ")}`;
  if (variant === "getstarted") {
    return <p className="gs-shared">{text}</p>;
  }
  return <p className="pricing-shared">{text}</p>;
}

export default function PlanFeatures({ plan, variant }) {
  const features = getPlanFeatures(plan);

  if (variant === "getstarted") {
    return (
      <ul>
        {features.map((f) => (
          <li key={f.text} className={f.included ? undefined : "gs-feature-off"}>
            {f.included ? "✓ " : "✕ "}{f.text}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="pricing-features">
      {features.map((f) => (
        <li key={f.text} className={f.included ? undefined : "pricing-feature-off"}>
          <span className={f.included ? "pricing-check" : "pricing-check-off"}>
            {f.included ? "✓" : "✕"}
          </span>
          {f.text}
        </li>
      ))}
    </ul>
  );
}
