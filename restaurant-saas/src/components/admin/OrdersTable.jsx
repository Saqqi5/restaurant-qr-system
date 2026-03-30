// OrdersTable.jsx
import { updateOrderStatus } from "../../config/db";

const STATUS_COLORS = {
  pending: "#ff6b35", confirmed: "#f7931e", preparing: "#4a90d9",
  ready: "#27ae60", served: "#8e8e8e", paid: "#27ae60",
};

export function OrdersTable({ orders, restaurantId, showActions = true }) {
  function formatTime(ts) {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="orders-table-wrapper">
      {orders.length === 0 && (
        <div className="empty-state"><p>No orders yet.</p></div>
      )}
      <div className="orders-list-admin">
        {orders.map((order) => (
          <div key={order.id} className="order-row-admin">
            <div className="order-row-left">
              <span className="table-badge-sm">T{order.table_number}</span>
              <div className="order-row-info">
                <span className="order-row-time">{formatTime(order.created_at)}</span>
                <span className="order-row-items">
                  {order.items?.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                </span>
              </div>
            </div>
            <div className="order-row-right">
              <span className="order-row-total">${order.total?.toFixed(2)}</span>
              <span className="status-dot" style={{ background: STATUS_COLORS[order.status] }}>
                {order.status}
              </span>
              <span className={`payment-dot ${order.payment_status}`}>
                {order.payment_status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OrdersTable;
