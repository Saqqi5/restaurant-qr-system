// One shared feature list for the pricing cards (LandingPage + GetStarted):
// every plan shows ALL features; included ones get a green check, the rest
// are struck-through so plans compare at a glance.
import { getPlanFeatures } from "../config/plans";

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
