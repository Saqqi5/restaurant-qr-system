// A plan price in the VISITOR's currency (converted from PKR). PKR visitors
// see exactly what they saw before ("Rs. 5,000"); everyone else sees the
// converted price with the PKR price underneath as the reference. If the
// rate lookup fails, it stays PKR. The actual charge is always PKR.
import { useEffect, useState } from "react";
import {
  detectVisitorCurrency, getExchangeRates, convertPkr, formatMoney,
} from "../utils/geoPricing";

export default function PlanPrice({ pkr, variant }) {
  const [converted, setConverted] = useState(null); // { currency, amount } | null

  useEffect(() => {
    const currency = detectVisitorCurrency();
    if (currency === "PKR") return;
    let alive = true;
    getExchangeRates().then((rates) => {
      if (!alive) return;
      const amount = convertPkr(pkr, currency, rates);
      if (amount !== null) setConverted({ currency, amount });
    });
    return () => { alive = false; };
  }, [pkr]);

  if (!converted) {
    // PKR (or rates not ready / failed): exactly the old display.
    if (variant === "getstarted") {
      return (
        <span className="gs-plan-price">
          {formatMoney(pkr, "PKR")}<small>/month</small>
        </span>
      );
    }
    return (
      <>
        <span className="pricing-currency">Rs.</span>
        <span className="pricing-amount">{pkr.toLocaleString("en-US")}</span>
      </>
    );
  }

  if (variant === "getstarted") {
    return (
      <>
        <span className="gs-plan-price">
          {formatMoney(converted.amount, converted.currency)}<small>/month</small>
        </span>
        <span className="gs-converted-note">≈ {formatMoney(pkr, "PKR")}/month</span>
      </>
    );
  }
  return (
    <>
      <span className="pricing-amount">
        {formatMoney(converted.amount, converted.currency)}
      </span>
      <span className="pricing-converted-note">≈ {formatMoney(pkr, "PKR")}/mo</span>
    </>
  );
}
