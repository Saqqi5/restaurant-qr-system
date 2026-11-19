/**
 * OrderStatusSummary
 * ══════════════════
 * The summary strip above the orders list (his 2026-11-19 order): one box
 * per order stage — Pending, Confirmed, Preparing, Ready, Served, Out
 * for delivery, Delivered, Payment pending, Paid, Cancelled — each
 * showing HOW MANY orders are in that stage right now. Tap a box and
 * the list below shows only that stage's orders; tap All (or the box
 * again) to show everything.
 *
 *   <OrderStatusSummary orders={visibleOrders} selected={stageFilter} onSelect={setStageFilter} />
 *
 * The parent filters its list with matchesStage(order, stageFilter) and
 * sorts it with sortOrdersForDisplay (paid + verified orders sink to
 * the bottom; everything else stays on top in time order).
 */
const STAGES = [
  { key: "all", label: "All Orders", icon: "📋" },
  { key: "pending", label: "Pending", icon: "🕐" },
  { key: "confirmed", label: "Confirmed", icon: "✅" },
  { key: "preparing", label: "Preparing", icon: "👨‍🍳" },
  { key: "ready", label: "Ready", icon: "🔔" },
  { key: "served", label: "Served", icon: "🍽️" },
  { key: "out_for_delivery", label: "Out for delivery", icon: "🛵" },
  { key: "delivered", label: "Delivered", icon: "📦" },
  { key: "payment-pending", label: "Payment pending", icon: "⏳", tone: "red" },
  { key: "paid", label: "Paid", icon: "💰", tone: "green" },
  { key: "cancelled", label: "Cancelled", icon: "❌", tone: "muted" },
];

// Does this order belong to this stage? "payment-pending" = served (or
// ready) but still unpaid — the tables that owe money right now. "paid"
// = payment done AND verified (payment_status paid), never a cancelled
// order (a paid order that is later cancelled drops out of paid).
export function matchesStage(order, stage) {
  if (!stage || stage === "all") return true;
  if (stage === "payment-pending") {
    return ["ready", "served"].includes(order.status) && order.payment_status !== "paid" && order.status !== "cancelled";
  }
  if (stage === "paid") return order.payment_status === "paid" && order.status !== "cancelled";
  return order.status === stage;
}

export function countByStage(orders) {
  const counts = { all: (orders || []).length };
  for (const s of STAGES) {
    if (s.key === "all") continue;
    counts[s.key] = (orders || []).filter((o) => matchesStage(o, s.key)).length;
  }
  return counts;
}

export default function OrderStatusSummary({ orders, selected, onSelect }) {
  const counts = countByStage(orders);
  const active = selected || "all";
  return (
    <div className="order-status-summary" role="group" aria-label="Orders by stage">
      {STAGES.map((s) => {
        // Every stage shows, even with 0 orders — his 2026-11-19 order:
        // a stage with no orders still gets its box, with 0 in it.
        const isActive = active === s.key;
        return (
          <button
            key={s.key}
            type="button"
            className={`stage-box${isActive ? " selected" : ""}${s.tone ? ` tone-${s.tone}` : ""}`}
            onClick={() => onSelect(isActive && s.key !== "all" ? null : s.key === "all" ? null : s.key)}
            title={isActive ? "Tap to show all orders" : `Show only ${s.label.toLowerCase()} orders`}
          >
            <span className="stage-icon">{s.icon}</span>
            <span className="stage-count">{counts[s.key]}</span>
            <span className="stage-label">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
