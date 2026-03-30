const STATUS_STEPS = [
  { key: "pending", label: "Order Received", icon: "📋" },
  { key: "confirmed", label: "Confirmed", icon: "✅" },
  { key: "preparing", label: "Preparing", icon: "👨‍🍳" },
  { key: "ready", label: "Ready!", icon: "🎯" },
  { key: "served", label: "Served", icon: "🍽️" },
];

const STATUS_INDEX = STATUS_STEPS.reduce((acc, s, i) => ({ ...acc, [s.key]: i }), {});

export default function OrderTracker({ orders }) {
  if (orders.length === 0) {
    return (
      <div className="order-tracker-empty">
        <div className="empty-icon">📋</div>
        <h3>No active orders</h3>
        <p>Your orders will appear here once placed.</p>
      </div>
    );
  }

  function getEstimatedTime(order) {
    if (!order.estimated_ready?.toDate) return null;
    const eta = order.estimated_ready.toDate();
    const now = new Date();
    const diffMins = Math.max(0, Math.round((eta - now) / 60000));
    if (diffMins === 0) return "Any moment now!";
    return `~${diffMins} min remaining`;
  }

  return (
    <div className="order-tracker">
      {orders.map((order) => {
        const stepIndex = STATUS_INDEX[order.status] ?? 0;
        const eta = getEstimatedTime(order);

        return (
          <div key={order.id} className="order-track-card">
            <div className="order-track-header">
              <span className="order-track-id">Order #{order.id?.slice(-6).toUpperCase()}</span>
              <span className="order-total-display">${order.total?.toFixed(2)}</span>
            </div>

            {/* Progress Steps */}
            <div className="progress-steps">
              {STATUS_STEPS.slice(0, -1).map((step, i) => (
                <div key={step.key} className={`step ${i <= stepIndex ? "done" : ""} ${i === stepIndex ? "current" : ""}`}>
                  <div className="step-icon">{i <= stepIndex ? step.icon : "○"}</div>
                  <div className="step-label">{step.label}</div>
                  {i < STATUS_STEPS.length - 2 && <div className={`step-line ${i < stepIndex ? "done" : ""}`} />}
                </div>
              ))}
            </div>

            {eta && order.status !== "served" && order.status !== "ready" && (
              <div className="eta-badge">⏱ {eta}</div>
            )}

            {order.status === "ready" && (
              <div className="ready-banner">🎯 Your order is ready! A server will bring it to you.</div>
            )}

            <div className="order-items-summary">
              {order.items?.map((item, i) => (
                <span key={i} className="track-item">
                  {item.name} ×{item.quantity}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
