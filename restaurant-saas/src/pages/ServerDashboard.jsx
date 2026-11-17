import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  subscribeToMenu, subscribeToOrders, createOrder, cancelOrder,
  subscribeToRestaurantPayments
, getRestaurant, getOrderPayable, getItemPrice, getItemOriginalPrice } from "../config/db";
import { formatPrice, useRestaurantCurrency } from "../utils/currency";
import { sortByBookedAt } from "../utils/orderSort";
import { isExpiredDemoItem } from "../config/db";
import { getDemoHiddenDishes } from "../utils/session";
import AdminLayout from "../components/admin/AdminLayout";
import BranchRequired from "../components/admin/BranchRequired";
import ConfirmModal from "../components/admin/ConfirmModal";

export default function ServerDashboard() {
  const { userProfile, restaurantId, logout } = useAuth();
  const currency = useRestaurantCurrency(restaurantId);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [view, setView] = useState("orders");
  const [cart, setCart] = useState([]);
  const [selectedTable, setSelectedTable] = useState(1);
  const [tableCount, setTableCount] = useState(20);
  const [isDemo, setIsDemo] = useState(false);
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!restaurantId || restaurantId === "all") return;
    getRestaurant(restaurantId).then((r) => {
      if (r?.table_count) setTableCount(r.table_count);
      setIsDemo(r?.is_demo === true);
    });
  }, [restaurantId]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null); // order awaiting delete confirm
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // A server may delete an order ONLY while it is still pending — before
  // the kitchen confirms it. The order is soft-cancelled (status
  // "cancelled" + who/when), never hard-deleted, so history stays complete.
  async function confirmDeleteOrder() {
    const order = pendingDelete;
    setPendingDelete(null);
    if (!order) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await cancelOrder(restaurantId, order.id, { uid: userProfile?.id, name: userProfile?.name });
    } catch (e) {
      setDeleteError(e.message || "Could not delete this order.");
    }
    setDeleting(false);
  }

  useEffect(() => {
    if (!restaurantId || restaurantId === "all") return;
    const unsubMenu = subscribeToMenu(restaurantId, setMenuItems);
    const unsubOrders = subscribeToOrders(restaurantId, setOrders);
    const unsubPayments = subscribeToRestaurantPayments(restaurantId, setPayments);
    return () => { unsubMenu(); unsubOrders(); unsubPayments(); };
  }, [restaurantId]);

  // Map tableNumber → latest payment status
  const tablePaymentStatus = {};
  payments.forEach((p) => {
    const existing = tablePaymentStatus[p.tableNumber];
    if (!existing || (p.createdAt?.seconds || 0) > (existing.createdAt?.seconds || 0)) {
      tablePaymentStatus[p.tableNumber] = p;
    }
  });

  function addToCart(item) {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id);
      if (ex) return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      // Charged at the promo price while the offer runs (see CustomerMenu).
      return [...prev, { ...item, quantity: 1, notes: "", price: getItemPrice(item), original_price: getItemOriginalPrice(item) || 0 }];
    });
  }

  function removeFromCart(itemId) {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === itemId);
      if (ex?.quantity > 1) return prev.map((c) => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
      return prev.filter((c) => c.id !== itemId);
    });
  }

  async function placeManualOrder() {
    if (!cart.length) return;
    setPlacing(true);
    // Add-on: this table already has an active order, so the kitchen
    // serves this one on priority.
    const isAddon = activeOrders.some((o) => Number(o.table_number) === Number(selectedTable));
    await createOrder(restaurantId, {
      table_number: selectedTable,
      items: cart.map((i) => ({
        item_id: i.id, name: i.name, price: i.price,
        quantity: i.quantity, notes: i.notes,
        prep_time_minutes: i.prep_time_minutes,
      })),
      notes,
      created_by: userProfile?.id || "server",
      is_addon: isAddon,
    });
    setCart([]);
    setNotes("");
    setView("orders");
    setPlacing(false);
  }

  // Cancelled orders never show in the active list (they live in history).
  // Serving order is strictly FIFO — oldest booked first — so the server
  // works down the list and whoever booked first is served first.
  // Home-delivery orders are NOT table service — the rider handles them,
  // so they never appear here.
  const activeOrders = orders
    .filter((o) => o.order_type !== "delivery" && !["served", "paid", "cancelled"].includes(o.status))
    .sort(sortByBookedAt);
  // The oldest READY order is the one to serve next.
  const serveNextId = activeOrders.find((o) => o.status === "ready")?.id;
  const filteredMenu = menuItems.filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) && i.available && !i.deleted
    // On a demo restaurant, dishes hidden in THIS browser (localStorage, 24h)
    // are hidden here too — another browser still sees them.
    && !(isDemo && getDemoHiddenDishes(restaurantId).has(i.id))
    // Visitor-added demo dishes older than 24h never show (website rule).
    && !(isDemo && isExpiredDemoItem(restaurantId, i))
  );
  const categories = [...new Set(filteredMenu.map((i) => i.category))];
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  function getPaymentPill(order) {
    const tableNum = order.table_number;
    const pay = tablePaymentStatus[tableNum];
    if (!pay) return null;
    if (pay.status === "verified") {
      return <span className="pay-status-pill pay-verified">💳 Verified</span>;
    }
    if (pay.status === "pending") {
      return <span className="pay-status-pill pay-pending">💳 Pending</span>;
    }
    return null;
  }

  // The server works one branch at a time — "All branches" picks a branch.
  if (restaurantId === "all") {
    return (
      <AdminLayout
        title="Server"
        subtitle={userProfile?.name || "Order Taker"}
        onLogout={logout}
        userProfile={userProfile}
      >
        <BranchRequired title="Server is per branch" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Server"
      subtitle={userProfile?.name || "Order Taker"}
      onLogout={logout}
      userProfile={userProfile}
    >
      <div className="server-tabs">
        <button
          className={`tab-btn ${view === "orders" ? "active" : ""}`}
          onClick={() => setView("orders")}
        >
          Active Orders ({activeOrders.length})
        </button>
        <button
          className={`tab-btn ${view === "new_order" ? "active" : ""}`}
          onClick={() => setView("new_order")}
        >
          + New Order
        </button>
      </div>

      {view === "orders" && (
        <div className="server-orders">
          {activeOrders.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🛎️</div>
              <p>No active orders right now</p>
            </div>
          )}
          {activeOrders.map((order) => (
            <div key={order.id} className="server-order-card">
              <div className="server-order-header">
                <span className="table-badge">Table {order.table_number} • #{order.order_number ?? order.id?.slice(-6).toUpperCase()}</span>
                <span className={`status-pill status-${order.status}`}>{order.status}</span>
                <span className="order-total-display">{formatPrice(getOrderPayable(order).payable, currency)}</span>
                {getPaymentPill(order)}
              </div>
              {order.created_at?.toDate && (
                <div className="order-booked">🕐 Booked {order.created_at.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              )}
              {order.id === serveNextId && (
                <div className="serve-next-badge">🔺 Serve next — booked first</div>
              )}
              {order.is_addon && (
                <div className="addon-badge">➕ Add-on order — priority</div>
              )}
              <div className="server-order-items">
                {order.items?.map((item, i) => (
                  <span key={i} className="mini-item">
                    {item.name} ×{item.quantity}
                  </span>
                ))}
              </div>
              {order.status === "pending" && (
                <button
                  type="button"
                  className="btn-danger btn-sm"
                  style={{ marginTop: 10 }}
                  onClick={() => setPendingDelete(order)}
                  disabled={deleting}
                >
                  🗑️ Delete Order
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {deleteError && (
        <div className="error-banner" style={{ marginTop: 12 }}>{deleteError}</div>
      )}
      {pendingDelete && (
        <ConfirmModal
          title="Delete this order?"
          message={`Delete Order #${pendingDelete.order_number ?? pendingDelete.id?.slice(-6).toUpperCase()} (Table ${pendingDelete.table_number})? It will be saved as Cancelled — the kitchen will not make it.`}
          confirmLabel="Delete Order"
          danger
          onConfirm={confirmDeleteOrder}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {view === "new_order" && (
        <div className="new-order-layout">
          <div className="menu-panel">
            <div className="table-selector">
              <label>Table:</label>
              <select value={selectedTable} onChange={(e) => setSelectedTable(parseInt(e.target.value))}>
                {[...Array(tableCount)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>Table {i + 1}</option>
                ))}
              </select>
            </div>
            <input
              className="menu-search"
              placeholder="Search menu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {categories.map((cat) => (
              <div key={cat}>
                <h4 className="category-label">{cat}</h4>
                <div className="menu-grid-compact">
                  {filteredMenu.filter((i) => i.category === cat).map((item) => {
                    const inCart = cart.find((c) => c.id === item.id);
                    return (
                      <div
                        key={item.id}
                        className="menu-item-compact"
                        onClick={() => addToCart(item)}
                      >
                        <span className="item-name">{item.name}</span>
                        <span className="item-price">{formatPrice(item.price, currency)}</span>
                        {inCart && <span className="in-cart-badge">{inCart.quantity}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="cart-panel">
            <h3>Order — Table {selectedTable}</h3>
            {cart.length === 0 && <div className="empty-cart">Tap items to add</div>}
            {cart.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-info">
                  <span className="cart-item-name">{item.name}</span>
                  <span className="cart-item-price">{formatPrice(item.price * item.quantity, currency)}</span>
                </div>
                <div className="cart-item-controls">
                  <button onClick={() => removeFromCart(item.id)}>−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => addToCart(item)}>+</button>
                </div>
              </div>
            ))}
            {cart.length > 0 && (
              <>
                <textarea
                  className="order-notes-input"
                  placeholder="Order notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="cart-total">
                  Total: <strong>{formatPrice(cartTotal, currency)}</strong>
                </div>
                <button
                  className="btn-place-order"
                  onClick={placeManualOrder}
                  disabled={placing}
                >
                  {placing ? "Placing..." : "Place Order"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
