import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToOrders, updatePaymentStatus } from "../config/db";
import AdminLayout from "../components/admin/AdminLayout";

export default function CashCounterDashboard() {
  const { userProfile, restaurantId, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState("unpaid"); // "unpaid" | "paid" | "all"

  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToOrders(restaurantId, setOrders);
    return unsub;
  }, [restaurantId]);

  async function handlePayment(orderId) {
    setProcessing(true);
    await updatePaymentStatus(restaurantId, orderId, paymentMethod);
    setSelectedOrder(null);
    setProcessing(false);
  }

  function formatTime(ts) {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const filteredOrders = orders.filter((o) => {
    if (filter === "unpaid") return o.payment_status === "unpaid" && o.status !== "pending";
    if (filter === "paid") return o.payment_status === "paid";
    return true;
  });

  const todayPaid = orders.filter((o) => {
    const today = new Date().toDateString();
    const orderDate = o.created_at?.toDate?.()?.toDateString?.();
    return orderDate === today && o.payment_status === "paid";
  });

  const todayRevenue = todayPaid.reduce((s, o) => s + (o.total || 0), 0);
  const unpaidCount = orders.filter((o) => o.payment_status === "unpaid" && o.status !== "pending").length;

  return (
    <AdminLayout
      title="💳 Cash Counter"
      subtitle="Payment Management"
      onLogout={logout}
      userProfile={userProfile}
    >
      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Today's Revenue</span>
          <span className="stat-value">${todayRevenue.toFixed(2)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Paid Orders</span>
          <span className="stat-value">{todayPaid.length}</span>
        </div>
        <div className={`stat-card ${unpaidCount > 0 ? "alert" : ""}`}>
          <span className="stat-label">Awaiting Payment</span>
          <span className="stat-value">{unpaidCount}</span>
        </div>
      </div>

      {/* Filter */}
      <div className="filter-tabs">
        {["unpaid", "paid", "all"].map((f) => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="orders-list">
        {filteredOrders.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <p>No {filter} orders</p>
          </div>
        )}
        {filteredOrders.map((order) => (
          <div
            key={order.id}
            className={`order-card ${selectedOrder?.id === order.id ? "selected" : ""}`}
            onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
          >
            <div className="order-card-header">
              <div>
                <span className="table-label">Table {order.table_number}</span>
                <span className="order-time">{formatTime(order.created_at)}</span>
              </div>
              <div className="order-header-right">
                <span className="order-total">${order.total?.toFixed(2)}</span>
                <span className={`payment-badge ${order.payment_status}`}>
                  {order.payment_status === "paid" ? `✅ ${order.payment_method}` : "⏳ Unpaid"}
                </span>
              </div>
            </div>

            {selectedOrder?.id === order.id && (
              <div className="order-detail">
                <div className="order-items-detail">
                  {order.items?.map((item, i) => (
                    <div key={i} className="detail-item">
                      <span>{item.name} ×{item.quantity}</span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="detail-total">
                    <span>Total</span>
                    <span>${order.total?.toFixed(2)}</span>
                  </div>
                </div>

                {order.payment_status === "unpaid" && (
                  <div className="payment-actions">
                    <div className="payment-method-select">
                      {["cash", "card", "upi"].map((m) => (
                        <button
                          key={m}
                          className={`method-btn ${paymentMethod === m ? "active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setPaymentMethod(m); }}
                        >
                          {m === "cash" ? "💵 Cash" : m === "card" ? "💳 Card" : "📱 UPI"}
                        </button>
                      ))}
                    </div>
                    <button
                      className="btn-pay"
                      onClick={(e) => { e.stopPropagation(); handlePayment(order.id); }}
                      disabled={processing}
                    >
                      {processing ? "Processing..." : `Mark Paid — ${paymentMethod.toUpperCase()}`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
