// A plan price in the VISITOR's currency ONLY (converted from PKR). PKR
// visitors see exactly what they saw before ("Rs. 5,000"); everyone else
// sees just their own currency — no PKR reference line. If the rate lookup
// fails, it stays PKR. The actual charge is always PKR (until international
// cards are added — the payable amount is a separate matter).
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
    if (variant === "settings") {
      return <>{formatMoney(pkr, "PKR")}/mo</>;
    }
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

  if (variant === "settings") {
    return (
      <>
        {formatMoney(converted.amount, converted.currency)}/mo
      </>
    );
  }

  if (variant === "getstarted") {
    return (
      <>
        <span className="gs-plan-price">
          {formatMoney(converted.amount, converted.currency)}<small>/month</small>
        </span>
      </>
    );
  }
  return (
    <>
      <span className="pricing-amount">
        {formatMoney(converted.amount, converted.currency)}
      </span>
    </>
  );
}
