import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  subscribeToMenu, subscribeToOrders, createOrder,
  subscribeToRestaurantPayments
, getRestaurant } from "../config/db";
import { formatPrice, useRestaurantCurrency } from "../utils/currency";
import { isExpiredDemoItem } from "../config/db";
import { getDemoHiddenDishes } from "../utils/session";
import AdminLayout from "../components/admin/AdminLayout";

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
    if (!restaurantId) return;
    getRestaurant(restaurantId).then((r) => {
      if (r?.table_count) setTableCount(r.table_count);
      setIsDemo(r?.is_demo === true);
    });
  }, [restaurantId]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!restaurantId) return;
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
      return [...prev, { ...item, quantity: 1, notes: "" }];
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
    await createOrder(restaurantId, {
      table_number: selectedTable,
      items: cart.map((i) => ({
        item_id: i.id, name: i.name, price: i.price,
        quantity: i.quantity, notes: i.notes,
        prep_time_minutes: i.prep_time_minutes,
      })),
      notes,
      created_by: userProfile?.id || "server",
    });
    setCart([]);
    setNotes("");
    setView("orders");
    setPlacing(false);
  }

  const activeOrders = orders.filter((o) => !["served", "paid"].includes(o.status));
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
                <span className="table-badge">Table {order.table_number}</span>
                <span className={`status-pill status-${order.status}`}>{order.status}</span>
                <span className="order-total-display">{formatPrice(order.total, currency)}</span>
                {getPaymentPill(order)}
              </div>
              <div className="server-order-items">
                {order.items?.map((item, i) => (
                  <span key={i} className="mini-item">
                    {item.name} ×{item.quantity}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
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
