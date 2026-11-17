import { useState } from "react";
import { formatPrice } from "../../utils/currency";
import { cancelOrder } from "../../config/db";
import ReceiptModal from "../ReceiptModal";
import RestaurantLogo from "./RestaurantLogo";

const STATUS_STEPS = [
  { key: "pending", label: "Order Received", icon: "📋" },
  { key: "confirmed", label: "Confirmed", icon: "✅" },
  { key: "preparing", label: "Preparing", icon: "👨‍🍳" },
  { key: "ready", label: "Ready!", icon: "🎯" },
  { key: "served", label: "Served", icon: "🍽️" },
];

// Home delivery: same kitchen flow, then the rider takes over —
// "Out for delivery" replaces "Served" as the final step.
const DELIVERY_STEPS = [
  { key: "pending", label: "Order Received", icon: "📋" },
  { key: "confirmed", label: "Confirmed", icon: "✅" },
  { key: "preparing", label: "Preparing", icon: "👨‍🍳" },
  { key: "ready", label: "Ready!", icon: "🎯" },
  { key: "out_for_delivery", label: "Out for delivery", icon: "🛵" },
  { key: "delivered", label: "Delivered", icon: "✅" },
];

const STATUS_INDEX = STATUS_STEPS.reduce((acc, s, i) => ({ ...acc, [s.key]: i }), {});
const DELIVERY_INDEX = DELIVERY_STEPS.reduce((acc, s, i) => ({ ...acc, [s.key]: i }), {});

export default function OrderTracker({ orders, currency, restaurantId, sessionId, restaurant }) {
  const [receiptOrder, setReceiptOrder] = useState(null);
  // Which order's Cancel button is armed (first tap asks, second tap cancels).
  const [armingCancelId, setArmingCancelId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState(null);

  // A customer may cancel their OWN order, and only while it is still
  // pending — before the kitchen confirms it. Staff orders at the same
  // table (created_by is a staff uid, not this browser's session) stay.
  async function handleCancel(order) {
    if (armingCancelId !== order.id) {
      setCancelError(null);
      setArmingCancelId(order.id);
      return;
    }
    setArmingCancelId(null);
    setCancellingId(order.id);
    setCancelError(null);
    try {
      await cancelOrder(restaurantId, order.id, { uid: sessionId, name: "Customer" });
    } catch (e) {
      setCancelError("Could not cancel this order. Please ask the counter for help.");
    } finally {
      setCancellingId(null);
    }
  }
  if (orders.length === 0) {
    return (
      <div className="order-tracker-empty">
        {restaurant && (
          <div className="tracker-restaurant">
            <RestaurantLogo restaurant={restaurant} size={32} />
            <span className="tracker-restaurant-name">{restaurant.name}</span>
          </div>
        )}
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
      {restaurant && (
        <div className="tracker-restaurant">
          <RestaurantLogo restaurant={restaurant} size={32} />
          <span className="tracker-restaurant-name">{restaurant.name}</span>
        </div>
      )}
      {cancelError && <div className="cancel-error">{cancelError}</div>}
      {orders.map((order) => {
        const isDelivery = order.order_type === "delivery";
        const steps = isDelivery ? DELIVERY_STEPS : STATUS_STEPS;
        const stepIndex = (isDelivery ? DELIVERY_INDEX : STATUS_INDEX)[order.status] ?? 0;
        const eta = getEstimatedTime(order);
        const isMine = !!sessionId && order.created_by === sessionId;
        const canCancel = order.status === "pending" && isMine;

        // A cancelled order stays visible, dimmed, so the customer sees
        // the cancel went through — it never reaches the bill or the kitchen.
        if (order.status === "cancelled") {
          return (
            <div key={order.id} className="order-track-card cancelled">
              <div className="order-track-header">
                <span className="order-track-id">Order #{order.order_number ?? order.id?.slice(-6).toUpperCase()}</span>
                <span className="order-total-display">{formatPrice(order.total, currency)}</span>
              </div>
              <div className="cancelled-badge">❌ Cancelled</div>
              <div className="order-items-summary">
                {order.items?.map((item, i) => (
                  <span key={i} className="track-item">
                    {item.name} ×{item.quantity}
                  </span>
                ))}
              </div>
              <button className="receipt-btn" onClick={() => setReceiptOrder(order)}>
                🧾 View Receipt
              </button>
            </div>
          );
        }

        return (
          <div key={order.id} className="order-track-card">
            <div className="order-track-header">
              <span className="order-track-id">Order #{order.order_number ?? order.id?.slice(-6).toUpperCase()}</span>
              <span className="order-total-display">{formatPrice(order.total, currency)}</span>
            </div>

            {/* Progress Steps */}
            <div className="progress-steps">
              {steps.slice(0, -1).map((step, i) => (
                <div key={step.key} className={`step ${i <= stepIndex ? "done" : ""} ${i === stepIndex ? "current" : ""}`}>
                  <div className="step-icon">{i <= stepIndex ? step.icon : "○"}</div>
                  <div className="step-label">{step.label}</div>
                  {i < steps.length - 2 && <div className={`step-line ${i < stepIndex ? "done" : ""}`} />}
                </div>
              ))}
            </div>

            {order.payment_status === "paid" && (
              <div className="order-paid-badge">✅ Paid — thank you!</div>
            )}

            {eta && order.payment_status !== "paid" && !["served", "ready", "delivered", "out_for_delivery"].includes(order.status) && (
              <div className="eta-badge">⏱ {eta}</div>
            )}

            {order.status === "ready" && (
              <div className="ready-banner">{isDelivery ? "🎯 Your order is ready! The rider is on the way." : "🎯 Your order is ready! A server will bring it to you."}</div>
            )}

            {order.status === "out_for_delivery" && (
              <div className="ready-banner">🛵 Out for delivery — your food is on the way!</div>
            )}

            {order.status === "delivered" && (
              <div className="order-paid-badge">✅ Delivered — enjoy your meal!</div>
            )}

            <div className="order-items-summary">
              {order.items?.map((item, i) => (
                <span key={i} className="track-item">
                  {item.name} ×{item.quantity}
                </span>
              ))}
            </div>

            <button className="receipt-btn" onClick={() => setReceiptOrder(order)}>
              🧾 View Receipt
            </button>

            {canCancel && (
              <button
                className={`cancel-order-btn ${armingCancelId === order.id ? "armed" : ""}`}
                onClick={() => handleCancel(order)}
                disabled={cancellingId === order.id}
              >
                {cancellingId === order.id
                  ? "Cancelling…"
                  : armingCancelId === order.id
                    ? "Tap again to cancel this order"
                    : "✕ Cancel order"}
              </button>
            )}
          </div>
        );
      })}
      {receiptOrder && (
        <ReceiptModal order={receiptOrder} restaurantId={restaurantId} currency={currency} onClose={() => setReceiptOrder(null)} />
      )}
    </div>
  );
}
