// OrdersTable.jsx
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { cancelOrder, getOrderPayable } from "../../config/db";
import { formatPrice, useRestaurantCurrency } from "../../utils/currency";
import ConfirmModal from "./ConfirmModal";

const STATUS_COLORS = {
  pending: "#ff6b35", confirmed: "#f7931e", preparing: "#4a90d9",
  ready: "#27ae60", served: "#8e8e8e", paid: "#27ae60", cancelled: "#e05252",
  out_for_delivery: "#4a90d9", delivered: "#27ae60",
};

export function OrdersTable({ orders, restaurantId, showActions = true, onSelectOrder, showBranch = false }) {
  const currency = useRestaurantCurrency(restaurantId);
  const { userProfile } = useAuth();
  const [pendingDelete, setPendingDelete] = useState(null); // order awaiting delete confirm
  const [deleteError, setDeleteError] = useState("");
  function formatTime(ts) {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // The restaurant admin may delete a WRONG order only AFTER the kitchen
  // has confirmed it (a still-pending order is the server's to delete).
  // Soft-cancel: the order stays saved with status "cancelled" + who/when.
  async function confirmDeleteOrder() {
    const order = pendingDelete;
    setPendingDelete(null);
    if (!order) return;
    setDeleteError("");
    try {
      // In the merged All-branches list each order carries its branch;
      // otherwise the single restaurantId prop is the branch.
      await cancelOrder(order._restaurantId || restaurantId, order.id, { uid: userProfile?.id, name: userProfile?.name });
    } catch (e) {
      setDeleteError(e.message || "Could not delete this order.");
    }
  }

  return (
    <div className="orders-table-wrapper">
      {orders.length === 0 && (
        <div className="empty-state"><p>No orders yet.</p></div>
      )}
      {deleteError && (
        <div className="error-banner" style={{ marginBottom: 12 }}>{deleteError}</div>
      )}
      <div className="orders-list-admin">
        {orders.map((order) => (
          <div key={order.id} className="order-row-admin"
            style={{ ...(order.status === "cancelled" ? { opacity: 0.65 } : {}), ...(onSelectOrder ? { cursor: "pointer" } : {}) }}
            onClick={onSelectOrder ? () => onSelectOrder(order) : undefined}
            title={onSelectOrder ? "Click to view slip" : undefined}>
            <div className="order-row-left">
              <span className="table-badge-sm">
                {order.order_type === "delivery" ? "🛵 Delivery" : `T${order.table_number}`} • #{order.order_number ?? order.id?.slice(-6).toUpperCase()}
              </span>
              {showBranch && order._branchName && (
                <span className="table-badge-sm" style={{ background: "var(--color-surface2)" }}>{order._branchName}</span>
              )}
              <div className="order-row-info">
                <span className="order-row-time">{formatTime(order.created_at)}</span>
                <span className="order-row-items">
                  {order.items?.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                </span>
                {order.status === "cancelled" && order.cancelled_by_name && (
                  <span className="order-row-items" style={{ color: "#e05252" }}>
                    Cancelled by {order.cancelled_by_name}
                  </span>
                )}
              </div>
            </div>
            <div className="order-row-right">
              <span className="order-row-total">{formatPrice(getOrderPayable(order).payable, order._currency || currency)}</span>
              <span className="status-dot" style={{ background: STATUS_COLORS[order.status] || "#888" }}>
                {order.status === "out_for_delivery" ? "out for delivery" : order.status}
              </span>
              <span className={`payment-dot ${order.payment_status}`}>
                {order.payment_status}
              </span>
              {showActions && order.status !== "pending" && order.status !== "cancelled" && (
                <button
                  type="button"
                  className="icon-btn"
                  title="Delete order"
                  onClick={(e) => { e.stopPropagation(); setPendingDelete(order); }}
                  style={{ fontSize: 15 }}
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {pendingDelete && (
        <ConfirmModal
          title="Delete this order?"
          message={`Delete Order #${pendingDelete.order_number ?? pendingDelete.id?.slice(-6).toUpperCase()} (${pendingDelete.order_type === "delivery" ? "Delivery" : `Table ${pendingDelete.table_number}`})? It will be saved as Cancelled — it stays in history with who deleted it.`}
          confirmLabel="Delete Order"
          danger
          onConfirm={confirmDeleteOrder}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

export default OrdersTable;
