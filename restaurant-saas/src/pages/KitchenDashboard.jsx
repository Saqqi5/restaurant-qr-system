import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToOrders, updateOrderStatus } from "../config/db";
import AdminLayout from "../components/admin/AdminLayout";
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

export default function KitchenDashboard() {
  const { userProfile, restaurantId, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(new Set());
  const { toasts, dismiss } = useNotifications(restaurantId);

  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToOrders(
      restaurantId,
      (data) => { setOrders(data); setLoading(false); },
      { status: ["pending", "confirmed", "preparing", "ready"] }
    );
    return unsub;
  }, [restaurantId]);

  async function handleStatusChange(orderId, currentStatus) {
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;
    setUpdating((prev) => new Set(prev).add(orderId));
    await updateOrderStatus(restaurantId, orderId, next);
    setUpdating((prev) => { const s = new Set(prev); s.delete(orderId); return s; });
  }

  function getOrderAge(createdAt) {
    if (!createdAt?.toDate) return "—";
    const mins = Math.floor((Date.now() - createdAt.toDate().getTime()) / 60000);
    return mins < 1 ? "Just now" : `${mins}m ago`;
  }

  function isOverdue(order) {
    if (!order.estimated_ready?.toDate) return false;
    return Date.now() > order.estimated_ready.toDate().getTime() &&
      !["ready", "served"].includes(order.status);
  }

  const ordersByStatus = ORDER_STAGES.reduce((acc, stage) => {
    acc[stage.status] = orders.filter((o) => o.status === stage.status);
    return acc;
  }, {});

  const totalPending = ordersByStatus.pending.length + ordersByStatus.confirmed.length;

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

      <div className="kitchen-kanban">
        {ORDER_STAGES.map((stage) => {
          const stageOrders = ordersByStatus[stage.status] || [];
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
                {stageOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`kitchen-card ${isOverdue(order) ? "overdue" : ""}`}
                  >
                    <div className="kitchen-card-header">
                      <span className="table-badge">Table {order.table_number}</span>
                      <span className="order-age">{getOrderAge(order.created_at)}</span>
                    </div>

                    {isOverdue(order) && (
                      <div className="overdue-warning">⚠️ Overdue!</div>
                    )}

                    <div className="kitchen-items">
                      {order.items?.map((item, i) => (
                        <div key={i} className="kitchen-item">
                          <span className="item-qty">×{item.quantity}</span>
                          <div>
                            <span className="item-name">{item.name}</span>
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
                        onClick={() => handleStatusChange(order.id, order.status)}
                        disabled={updating.has(order.id)}
                        style={{ background: stage.color }}
                      >
                        {updating.has(order.id) ? "..." : STATUS_ACTIONS[order.status]}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
