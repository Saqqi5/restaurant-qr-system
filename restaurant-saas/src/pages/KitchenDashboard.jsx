import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToOrders, updateOrderStatus } from "../config/db";
import { sortByBookedAt, sortForMaking } from "../utils/orderSort";
import AdminLayout from "../components/admin/AdminLayout";
import BranchRequired from "../components/admin/BranchRequired";
import ReceiptModal from "../components/ReceiptModal";
import { useNotifications, ToastContainer } from "../hooks/useNotifications";

const ORDER_STAGES = [
  { status: "pending", label: "New Orders", color: "#ff6b35", icon: "🔔" },
  { status: "confirmed", label: "Confirmed", color: "#f7931e", icon: "✅" },
  { status: "preparing", label: "Preparing", color: "#4a90d9", icon: "👨‍🍳" },
  { status: "ready", label: "Ready to Serve", color: "#27ae60", icon: "🎯" },
];

const NEXT_STATUS = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "served",
};

const STATUS_ACTIONS = {
  pending: "Confirm Order",
  confirmed: "Start Preparing",
  preparing: "Mark Ready",
  ready: "Mark Served",
};

// Next step for an order depends on its status — and on whether it is a
// delivery order: once ready, it goes to the rider, not to a table.
function nextStatusFor(order) {
  if (order.status === "ready" && order.order_type === "delivery") return "out_for_delivery";
  return NEXT_STATUS[order.status];
}

export default function KitchenDashboard() {
  const { userProfile, restaurantId, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(new Set());
  const [kotOrder, setKotOrder] = useState(null);
  // Kitchen alert: EVERY new order — QR customer, staff Order Taker or
  // delivery — gets a triple beep + a toast that STAYS on screen until
  // the kitchen taps it away or starts the order (his 2026-11-19 order).
  const { toasts, dismiss } = useNotifications(restaurantId, true, { persistent: true });
  // Live clock for the order timers — ticks every 30s so the elapsed
  // time on every card stays current without re-fetching.
  const [now, setNow] = useState(Date.now());
  // Kitchen station filter — "All" or one station (Tandoor, Curry, …).
  // A station cook picks their station and sees only their items.
  const [stationFilter, setStationFilter] = useState("All");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!restaurantId || restaurantId === "all") return;
    const unsub = subscribeToOrders(
      restaurantId,
      (data) => { setOrders(data); setLoading(false); },
      { status: ["pending", "confirmed", "preparing", "ready"] }
    );
    return unsub;
  }, [restaurantId]);

  async function handleStatusChange(order) {
    const next = nextStatusFor(order);
    if (!next) return;
    setUpdating((prev) => new Set(prev).add(order.id));
    await updateOrderStatus(restaurantId, order.id, next);
    setUpdating((prev) => { const s = new Set(prev); s.delete(order.id); return s; });
  }

  function getOrderAge(createdAt) {
    if (!createdAt?.toDate) return "—";
    const mins = Math.floor((now - createdAt.toDate().getTime()) / 60000);
    return mins < 1 ? "Just now" : `${mins}m`;
  }

  // An order is "late" once it has waited 15 minutes without being ready
  // or served — the timer turns red so the kitchen sees it at a glance.
  function isLate(order) {
    if (!order.created_at?.toDate) return false;
    if (["ready", "served"].includes(order.status)) return false;
    return (now - order.created_at.toDate().getTime()) / 60000 >= 15;
  }

  // Stations present in the live orders (each item carries its dish's
  // station, falling back to its category). "All" shows everything.
  const stations = ["All", ...new Set(
    orders.flatMap((o) => (o.items || []).map((i) => i.station || i.category || "Kitchen"))
  )];

  // Items of one order, filtered to the chosen station.
  function visibleItems(order) {
    const items = order.items || [];
    if (stationFilter === "All") return items;
    return items.filter((i) => (i.station || i.category || "Kitchen") === stationFilter);
  }

  function isOverdue(order) {
    if (!order.estimated_ready?.toDate) return false;
    return Date.now() > order.estimated_ready.toDate().getTime() &&
      !["ready", "served"].includes(order.status);
  }

  const ordersByStatus = ORDER_STAGES.reduce((acc, stage) => {
    // Serving is strictly FIFO — but while MAKING, add-on orders come
    // first (rushed while cooking). The ready column is pure FIFO:
    // whoever booked first is served first.
    const list = orders.filter((o) => o.status === stage.status);
    acc[stage.status] = stage.status === "ready"
      ? list.sort(sortByBookedAt)
      : list.sort(sortForMaking);
    return acc;
  }, {});

  const totalPending = ordersByStatus.pending.length + ordersByStatus.confirmed.length;

  // The kitchen is one branch at a time — "All branches" picks a branch.
  if (restaurantId === "all") {
    return (
      <AdminLayout
        title="🍳 Kitchen"
        subtitle="Order Queue"
        onLogout={logout}
        userProfile={userProfile}
        compact
      >
        <BranchRequired title="Kitchen is per branch" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="🍳 Kitchen"
      subtitle="Order Queue"
      onLogout={logout}
      userProfile={userProfile}
      compact
    >
      {totalPending > 0 && (
        <div className="kitchen-alert">
          🔔 {totalPending} order{totalPending !== 1 ? "s" : ""} need{totalPending === 1 ? "s" : ""} attention
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {stations.length > 2 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {stations.map((s) => (
            <button
              key={s}
              onClick={() => setStationFilter(s)}
              style={{
                padding: "6px 14px", borderRadius: 20, border: "1px solid var(--color-border)",
                background: stationFilter === s ? "#20C997" : "transparent",
                color: stationFilter === s ? "#fff" : "var(--color-text)",
                fontWeight: stationFilter === s ? 700 : 400, cursor: "pointer",
              }}
            >
              {s === "All" ? "🍳 All stations" : `🍳 ${s}`}
            </button>
          ))}
        </div>
      )}

      <div className="kitchen-kanban">
        {ORDER_STAGES.map((stage) => {
          const stageOrders = ordersByStatus[stage.status] || [];
          // In the ready column the first card is the oldest booked order —
          // that is the one to serve next.
          const serveNextId = stage.status === "ready" ? stageOrders[0]?.id : null;
          return (
            <div key={stage.status} className="kanban-column">
              <div className="kanban-header" style={{ borderColor: stage.color }}>
                <span className="kanban-icon">{stage.icon}</span>
                <span className="kanban-label">{stage.label}</span>
                <span className="kanban-count" style={{ background: stage.color }}>
                  {stageOrders.length}
                </span>
              </div>

              <div className="kanban-cards">
                {stageOrders.length === 0 && (
                  <div className="kanban-empty">No orders here</div>
                )}
                {stageOrders.map((order) => {
                  const items = visibleItems(order);
                  if (stationFilter !== "All" && items.length === 0) return null;
                  return (
                  <div
                    key={order.id}
                    className={`kitchen-card ${isOverdue(order) ? "overdue" : ""} ${order.is_addon ? "addon" : ""}`}
                  >
                    <div className="kitchen-card-header">
                      <span className="table-badge">{order.order_type === "delivery" ? "🛵 Delivery" : `Table ${order.table_number}`} • #{order.order_number ?? order.id?.slice(-6).toUpperCase()}</span>
                      <span className="order-age" style={isLate(order) ? { color: "#e05252", fontWeight: 800 } : {}}>
                        ⏱ {getOrderAge(order.created_at)}
                      </span>
                    </div>

                    {isLate(order) && (
                      <div className="overdue-warning">⏰ Waiting 15+ min — late!</div>
                    )}

                    {order.is_addon && (
                      <div className="addon-badge">➕ Add-on order — priority</div>
                    )}

                    {order.order_type === "delivery" && (
                      <div className="delivery-badge">🛵 Home Delivery</div>
                    )}

                    {order.order_type === "delivery" && (order.customer_name || order.delivery_address) && (
                      <div className="order-delivery-details">
                        {order.customer_name && <div>👤 {order.customer_name}{order.customer_phone ? ` · ${order.customer_phone}` : ""}</div>}
                        {order.delivery_address && <div>📍 {order.delivery_address}</div>}
                      </div>
                    )}

                    {order.id === serveNextId && (
                      <div className="serve-next-badge">🔺 Serve next — booked first</div>
                    )}

                    {isOverdue(order) && (
                      <div className="overdue-warning">⚠️ Overdue!</div>
                    )}

                    <div className="kitchen-items">
                      {items.map((item, i) => (
                        <div key={i} className="kitchen-item">
                          <span className="item-qty">×{item.quantity}</span>
                          <div>
                            <span className="item-name">{item.name}</span>
                            {(item.station || item.category) && (
                              <span style={{ fontSize: 11, color: "var(--color-muted)", marginLeft: 6 }}>
                                [{item.station || item.category}]
                              </span>
                            )}
                            {item.size_label && (
                              <span style={{ fontSize: 11, color: "#20C997", marginLeft: 6 }}>
                                ({item.size_label})
                              </span>
                            )}
                            {item.notes && (
                              <span className="item-note">📝 {item.notes}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <div className="order-notes">📋 {order.notes}</div>
                    )}

                    {STATUS_ACTIONS[order.status] && (
                      <button
                        className="kitchen-action-btn"
                        onClick={() => handleStatusChange(order)}
                        disabled={updating.has(order.id)}
                        style={{ background: stage.color }}
                      >
                        {updating.has(order.id)
                          ? "..."
                          : order.status === "ready" && order.order_type === "delivery"
                            ? "🛵 Out for delivery"
                            : STATUS_ACTIONS[order.status]}
                      </button>
                    )}

                    <button
                      className="kitchen-action-btn"
                      onClick={() => setKotOrder(order)}
                      style={{ background: "#333", marginTop: 8 }}
                    >
                      🖨️ Print KOT
                    </button>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {kotOrder && (
        <ReceiptModal order={kotOrder} restaurantId={restaurantId} mode="kot" onClose={() => setKotOrder(null)} />
      )}
    </AdminLayout>
  );
}
