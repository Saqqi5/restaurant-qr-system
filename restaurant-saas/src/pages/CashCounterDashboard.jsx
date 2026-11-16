import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  subscribeToOrders, updatePaymentStatus, cancelOrder,
  subscribeToRestaurantPayments, verifyPayment
} from "../config/db";
import { formatPrice, useRestaurantCurrency } from "../utils/currency";
import AdminLayout from "../components/admin/AdminLayout";
import ReceiptModal from "../components/ReceiptModal";
import ConfirmModal from "../components/admin/ConfirmModal";

export default function CashCounterDashboard() {
  const { userProfile, restaurantId, logout } = useAuth();
  const currency = useRestaurantCurrency(restaurantId);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(null);
  const [filter, setFilter] = useState("unpaid");
  const [mainTab, setMainTab] = useState("orders"); // "orders" | "proofs"
  const [expandedProof, setExpandedProof] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // order awaiting delete confirm
  const [deleteError, setDeleteError] = useState("");

  // The cashier may delete a WRONG order only AFTER the kitchen has
  // confirmed it (a still-pending order is the server's to delete).
  // Soft-cancel: the order stays saved with status "cancelled" + who/when.
  async function confirmDeleteOrder() {
    const order = pendingDelete;
    setPendingDelete(null);
    if (!order) return;
    setDeleteError("");
    try {
      await cancelOrder(restaurantId, order.id, { uid: userProfile?.id, name: userProfile?.name });
      setSelectedOrder(null);
    } catch (e) {
      setDeleteError(e.message || "Could not delete this order.");
    }
  }

  useEffect(() => {
    if (!restaurantId) return;
    const unsubOrders = subscribeToOrders(restaurantId, setOrders);
    const unsubPayments = subscribeToRestaurantPayments(restaurantId, setPayments);
    return () => { unsubOrders(); unsubPayments(); };
  }, [restaurantId]);

  async function handlePayment(orderId) {
    setProcessing(true);
    await updatePaymentStatus(restaurantId, orderId, paymentMethod);
    setSelectedOrder(null);
    setProcessing(false);
  }

  async function handleVerifyPayment(payment) {
    setVerifying(payment.id);
    await verifyPayment(payment);
    setVerifying(null);
  }

  function formatTime(ts) {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(ts) {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleString([], {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  // Cancelled orders never show at the counter (they live in history).
  const filteredOrders = orders.filter((o) => {
    if (o.status === "cancelled") return false;
    if (filter === "unpaid") return o.payment_status === "unpaid" && o.status !== "pending";
    if (filter === "paid") return o.payment_status === "paid";
    return true;
  });

  const todayPaid = orders.filter((o) => {
    const today = new Date().toDateString();
    const orderDate = o.created_at?.toDate?.()?.toDateString?.();
    return orderDate === today && o.payment_status === "paid" && o.status !== "cancelled";
  });

  const todayRevenue = todayPaid.reduce((s, o) => s + (o.total || 0), 0);
  const unpaidCount = orders.filter((o) => o.payment_status === "unpaid" && o.status !== "pending" && o.status !== "cancelled").length;
  const pendingProofs = payments.filter(p => p.status === "pending");
  const verifiedProofs = payments.filter(p => p.status === "verified");

  return (
    <AdminLayout
      title="Cash Counter"
      subtitle="Payment Management"
      onLogout={logout}
      userProfile={userProfile}
    >
      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-icon">💰</span>
          <div>
            <div className="stat-value">{formatPrice(todayRevenue, currency)}</div>
            <div className="stat-label">Today's Revenue</div>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✅</span>
          <div>
            <div className="stat-value">{todayPaid.length}</div>
            <div className="stat-label">Paid Orders</div>
          </div>
        </div>
        <div className={`stat-card ${(unpaidCount + pendingProofs.length) > 0 ? "alert" : ""}`}>
          <span className="stat-icon">⏳</span>
          <div>
            <div className="stat-value">{unpaidCount + pendingProofs.length}</div>
            <div className="stat-label">Awaiting Action</div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="tab-nav" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn ${mainTab === "orders" ? "active" : ""}`}
          onClick={() => setMainTab("orders")}
          style={{ position: "relative" }}
        >
          Counter Orders
          {unpaidCount > 0 && <span className="badge-alert">{unpaidCount}</span>}
        </button>
        <button
          className={`tab-btn ${mainTab === "proofs" ? "active" : ""}`}
          onClick={() => setMainTab("proofs")}
          style={{ position: "relative" }}
        >
          Payment Proofs
          {pendingProofs.length > 0 && (
            <span className="badge-alert">{pendingProofs.length}</span>
          )}
        </button>
      </div>

      {/* Counter Orders Tab */}
      {mainTab === "orders" && (
        <>
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
                    <span className="table-label">Table {order.table_number} • #{order.order_number ?? order.id?.slice(-6).toUpperCase()}</span>
                    <span className="order-time">{formatTime(order.created_at)}</span>
                  </div>
                  <div className="order-header-right">
                    <span className="order-total">{formatPrice(order.total, currency)}</span>
                    <span className={`payment-badge ${order.payment_status}`}>
                      {order.payment_status === "paid"
                        ? `✅ ${order.payment_method || "paid"}`
                        : "⏳ Unpaid"}
                    </span>
                  </div>
                </div>

                {selectedOrder?.id === order.id && (
                  <div className="order-detail">
                    <div className="order-items-detail">
                      {order.items?.map((item, i) => (
                        <div key={i} className="detail-item">
                          <span>{item.name} ×{item.quantity}</span>
                          <span>{formatPrice(item.price * item.quantity, currency)}</span>
                        </div>
                      ))}
                      {order.subtotal != null && (
                        <>
                          <div className="detail-item">
                            <span>Subtotal</span>
                            <span>{formatPrice(order.subtotal, currency)}</span>
                          </div>
                          {order.discount_amount > 0 && (
                            <div className="detail-item">
                              <span>Discount{order.discount_rate ? ` (${order.discount_rate}%)` : ""}</span>
                              <span>−{formatPrice(order.discount_amount, currency)}</span>
                            </div>
                          )}
                          {order.tax_amount > 0 && (
                            <div className="detail-item">
                              <span>Tax{order.tax_rate ? ` (${order.tax_rate}%)` : ""}</span>
                              <span>{formatPrice(order.tax_amount, currency)}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="detail-total">
                        <span>Total</span>
                        <span>{formatPrice(order.total, currency)}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ marginTop: 10, cursor: "pointer" }}
                        onClick={(e) => { e.stopPropagation(); setReceiptOrder(order); }}
                      >
                        🖨️ Print Bill
                      </button>
                      {order.status !== "pending" && order.status !== "cancelled" && (
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          style={{ marginTop: 10, cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); setPendingDelete(order); }}
                        >
                          🗑️ Delete Order
                        </button>
                      )}
                    </div>

                    {order.payment_status === "unpaid" && (
                      <div className="payment-actions">
                        <div className="payment-method-select">
                          {[
                            { key: "cash", label: "💵 Cash" },
                            { key: "easypaisa", label: "📱 EasyPaisa" },
                            { key: "jazzcash", label: "💜 JazzCash" },
                          ].map((m) => (
                            <button
                              key={m.key}
                              className={`method-btn ${paymentMethod === m.key ? "active" : ""}`}
                              onClick={(e) => { e.stopPropagation(); setPaymentMethod(m.key); }}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                        <button
                          className="btn-pay"
                          onClick={(e) => { e.stopPropagation(); handlePayment(order.id); }}
                          disabled={processing}
                        >
                          {processing
                            ? "Processing..."
                            : `Mark Paid — ${paymentMethod.toUpperCase()}`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Payment Proofs Tab */}
      {mainTab === "proofs" && (
        <div>
          {/* Pending proofs */}
          <h3 style={{ fontFamily: "var(--font)", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            Pending Verification ({pendingProofs.length})
          </h3>
          {pendingProofs.length === 0 && (
            <div className="empty-state" style={{ minHeight: 150 }}>
              <div className="empty-icon">✅</div>
              <p>All payments verified</p>
            </div>
          )}
          <div className="pending-payments-list" style={{ marginBottom: 28 }}>
            {pendingProofs.map((payment) => (
              <div key={payment.id} className="payment-proof-card">
                <div className="payment-proof-header">
                  <div>
                    <div className="payment-proof-table">Table {payment.tableNumber}</div>
                    {payment.method && (
                      <div className="payment-proof-meta">
                        {payment.method === "bank" ? "🏦 Bank Transfer" : payment.method === "jazzcash" ? "💜 JazzCash" : "📱 EasyPaisa"}
                      </div>
                    )}
                    <div className="payment-proof-meta">{formatDate(payment.createdAt)}</div>
                  </div>
                  <div className="payment-proof-amount">{formatPrice(payment.amount, currency)}</div>
                </div>

                {/* Order items */}
                <div style={{ marginBottom: 10 }}>
                  {payment.items?.slice(0, 3).map((item, i) => (
                    <span key={i} className="track-item" style={{ marginRight: 6, marginBottom: 4, display: "inline-block" }}>
                      {item.name} ×{item.quantity}
                    </span>
                  ))}
                  {(payment.items?.length || 0) > 3 && (
                    <span className="track-item">+{payment.items.length - 3} more</span>
                  )}
                </div>

                {/* Screenshot */}
                {payment.screenshotUrl ? (
                  <img
                    src={payment.screenshotUrl}
                    alt="Payment proof"
                    className="payment-proof-img"
                    onClick={() => setExpandedProof(expandedProof === payment.id ? null : payment.id)}
                  />
                ) : (
                  <div className="payment-proof-placeholder">📷 No screenshot uploaded</div>
                )}

                <button
                  className="btn-verify"
                  onClick={() => handleVerifyPayment(payment)}
                  disabled={verifying === payment.id}
                >
                  {verifying === payment.id ? "Verifying..." : "✓ Mark as Verified"}
                </button>
              </div>
            ))}
          </div>

          {/* Verified proofs */}
          {verifiedProofs.length > 0 && (
            <>
              <h3 style={{ fontFamily: "var(--font)", fontSize: 15, fontWeight: 700, marginBottom: 12, color: "var(--color-primary)" }}>
                Verified ({verifiedProofs.length})
              </h3>
              <div className="pending-payments-list">
                {verifiedProofs.map((payment) => (
                  <div key={payment.id} className="payment-proof-card" style={{ opacity: 0.7 }}>
                    <div className="payment-proof-header">
                      <div>
                        <div className="payment-proof-table">Table {payment.tableNumber}</div>
                        {payment.method && (
                          <div className="payment-proof-meta">
                            {payment.method === "bank" ? "🏦 Bank Transfer" : payment.method === "jazzcash" ? "💜 JazzCash" : "📱 EasyPaisa"}
                          </div>
                        )}
                        <div className="payment-proof-meta">{formatDate(payment.createdAt)}</div>
                      </div>
                      <div className="payment-proof-amount">{formatPrice(payment.amount, currency)}</div>
                    </div>
                    <div className="verified-label">✅ Payment Verified — {formatDate(payment.verifiedAt)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {receiptOrder && (
        <ReceiptModal order={receiptOrder} restaurantId={restaurantId} currency={currency} onClose={() => setReceiptOrder(null)} />
      )}
      {deleteError && (
        <div className="error-banner" style={{ marginTop: 12 }}>{deleteError}</div>
      )}
      {pendingDelete && (
        <ConfirmModal
          title="Delete this order?"
          message={`Delete Order #${pendingDelete.order_number ?? pendingDelete.id?.slice(-6).toUpperCase()} (Table ${pendingDelete.table_number})? It will be saved as Cancelled — it stays in history with who deleted it.`}
          confirmLabel="Delete Order"
          danger
          onConfirm={confirmDeleteOrder}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </AdminLayout>
  );
}
