import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AdminLayout from "../components/admin/AdminLayout";
import BranchRequired from "../components/admin/BranchRequired";
import ReceiptModal from "../components/ReceiptModal";
import {
  subscribeToRestaurant, subscribeToMenu, subscribeToOrders,
  createOrder, calculateBill, CATEGORY_ORDER,
} from "../config/db";
import { normalizePlan } from "../config/plans";
import { formatPrice } from "../utils/currency";

// Order Taker mode — staff take orders on behalf of customers (walk-ins,
// phone orders, counter orders). Admin + cashier only; no extra login.
// The order is created as a STAFF order (created_by = staff uid), so it
// never reserves the table for customers — and the customer at that table
// still sees it in their bill and can pay from their phone or at the counter.
//
// GATED: included in the Standard and Premium plans. On Basic it is locked
// unless the super admin enabled it for this restaurant
// (restaurant.order_taker_enabled). The locked screen offers the Standard
// upgrade (admin) or "contact your administrator".
export default function OrderTakerPage() {
  const { userProfile, restaurantId, logout } = useAuth();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState(null);
  const [restaurantLoaded, setRestaurantLoaded] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState({}); // itemId -> qty
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [receiptOrder, setReceiptOrder] = useState(null);

  useEffect(() => {
    if (!restaurantId || restaurantId === "all") return;
    const unsubR = subscribeToRestaurant(restaurantId, (data) => {
      setRestaurant(data);
      setRestaurantLoaded(true);
    });
    const unsubM = subscribeToMenu(restaurantId, (items) =>
      setMenuItems(items.filter((i) => !i.deleted && i.available !== false))
    );
    const unsubO = subscribeToOrders(restaurantId, setOrders);
    return () => { unsubR(); unsubM(); unsubO(); };
  }, [restaurantId]);

  const currency = restaurant?.currency || "$";
  const tableCount = restaurant?.table_count || 10;

  // Missing plan means Basic (locked) — never the "standard" default that
  // normalizePlan(undefined) returns.
  const planKey = restaurant?.plan ? normalizePlan(restaurant.plan) : "basic";
  const takerAllowed =
    ["standard", "premium"].includes(planKey) || restaurant?.order_taker_enabled === true;

  // Today's active (unpaid, not cancelled) orders per table — for the picker.
  const dayStartSec = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }, []);
  const tableActive = useMemo(() => {
    const map = {};
    for (const o of orders) {
      if (
        o.payment_status === "unpaid" &&
        o.status !== "cancelled" &&
        (o.created_at?.seconds ?? dayStartSec) >= dayStartSec
      ) {
        map[o.table_number] = (map[o.table_number] || 0) + 1;
      }
    }
    return map;
  }, [orders, dayStartSec]);

  const visibleCategories = useMemo(() => {
    const present = new Set(menuItems.map((i) => i.category));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [menuItems]);

  const shownItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuItems.filter(
      (i) =>
        (category === "All" || i.category === category) &&
        (!q || i.name.toLowerCase().includes(q))
    );
  }, [menuItems, category, search]);

  const cartItems = useMemo(
    () =>
      menuItems
        .filter((i) => (cart[i.id] || 0) > 0)
        .map((i) => ({ ...i, qty: cart[i.id] })),
    [menuItems, cart]
  );
  const bill = useMemo(
    () =>
      calculateBill(
        cartItems,
        Number(restaurant?.tax_rate) || 0,
        Number(restaurant?.discount_rate) || 0
      ),
    [cartItems, restaurant]
  );

  function changeQty(itemId, delta) {
    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[itemId] || 0) + delta;
      if (qty <= 0) delete next[itemId];
      else next[itemId] = qty;
      return next;
    });
  }

  async function placeOrder() {
    if (!selectedTable || cartItems.length === 0 || placing) return;
    setPlacing(true);
    setError("");
    try {
      const isAddon = orders.some(
        (o) => Number(o.table_number) === Number(selectedTable) && o.payment_status === "unpaid" && o.status !== "cancelled"
      );
      const order = await createOrder(restaurantId, {
        table_number: selectedTable,
        items: cartItems.map((i) => ({ ...i, quantity: i.qty })),
        notes: note,
        created_by: userProfile?.id || "staff",
        is_addon: isAddon,
      });
      // Open the slip for the new order (print it for the customer if needed).
      setReceiptOrder(order);
      setCart({});
      setNote("");
    } catch (e) {
      setError(e.message || "Could not place the order.");
    }
    setPlacing(false);
  }

  const layoutProps = {
    title: "🛎️ Order Taker",
    subtitle: "Take orders on behalf of customers",
    onLogout: logout,
    userProfile,
  };

  if (!restaurantId) {
    return (
      <AdminLayout {...layoutProps}>
        <div className="empty-state">
          <div className="empty-icon">🛎️</div>
          <h3>Order Taker</h3>
          <p>This page is for restaurant staff accounts.</p>
        </div>
      </AdminLayout>
    );
  }

  // Order taking is one branch at a time — "All branches" picks a branch.
  if (restaurantId === "all") {
    return (
      <AdminLayout {...layoutProps}>
        <BranchRequired title="Order Taker is per branch" />
      </AdminLayout>
    );
  }

  if (!restaurantLoaded) {
    return (
      <AdminLayout {...layoutProps}>
        <p style={{ color: "var(--color-muted)", padding: 24 }}>Loading…</p>
      </AdminLayout>
    );
  }

  if (!takerAllowed) {
    return (
      <AdminLayout {...layoutProps}>
        <div className="empty-state">
          <div className="empty-icon">🔒</div>
          <h3>Order Taker Mode</h3>
          <p>
            Order Taker mode is available on the Standard plan. Upgrade your
            plan to take orders from this panel, or contact your administrator.
          </p>
          {userProfile?.role === "general_admin" ? (
            <button className="btn-primary" onClick={() => navigate("/admin/settings")}>
              ⬆️ Upgrade to Standard
            </button>
          ) : (
            <p>Ask your restaurant admin to upgrade the plan.</p>
          )}
          <p style={{ marginTop: 12 }}>
            or contact your administrator —{" "}
            <a href="https://t.me/Saqlyndigital" target="_blank" rel="noreferrer">
              Telegram @SAQLYNDIGITAL
            </a>
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout {...layoutProps}>
      {/* 1 — Table */}
      <h3 style={{ margin: "0 0 10px" }}>1. Select a table</h3>
      <div className="taker-tables">
        {Array.from({ length: tableCount }, (_, i) => i + 1).map((t) => {
          const active = tableActive[t] || 0;
          return (
            <button
              key={t}
              type="button"
              className={`taker-table-btn ${selectedTable === t ? "selected" : ""} ${active > 0 ? "busy" : ""}`}
              onClick={() => setSelectedTable(t)}
            >
              <span>Table {t}</span>
              {active > 0 && <span className="taker-table-count">{active} active</span>}
            </button>
          );
        })}
      </div>

      <div className="taker-layout">
        {/* 2 — Menu */}
        <div className="taker-menu">
          <h3 style={{ margin: "0 0 10px" }}>2. Add dishes</h3>
          <input
            className="menu-search-input"
            placeholder="🔍 Search dishes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div className="filter-tabs" style={{ marginBottom: 12 }}>
            {["All", ...visibleCategories].map((c) => (
              <button
                key={c}
                type="button"
                className={`filter-tab ${category === c ? "active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {shownItems.length === 0 ? (
            <div className="empty-state">
              <p>No dishes found.</p>
            </div>
          ) : (
            <div className="menu-items-list">
              {shownItems.map((item) => {
                const qty = cart[item.id] || 0;
                return (
                  <div key={item.id} className="menu-item-row">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="item-thumb" />
                    )}
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      {item.description && (
                        <span className="item-desc">{item.description}</span>
                      )}
                      <div className="item-meta">
                        <span className="item-price">{formatPrice(item.price, currency)}</span>
                        <span className="item-prep">⏱ {item.prep_time_minutes} min</span>
                      </div>
                    </div>
                    <div className="item-actions" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button type="button" className="btn-icon" onClick={() => changeQty(item.id, -1)} disabled={!qty}>−</button>
                      <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700 }}>{qty}</span>
                      <button type="button" className="btn-icon" onClick={() => changeQty(item.id, 1)}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3 — Cart + place */}
        <aside className="taker-cart">
          <div className="taker-cart-card">
            <h3 style={{ margin: "0 0 10px" }}>
              🧾 New Order{selectedTable ? ` — Table ${selectedTable}` : ""}
            </h3>
            {cartItems.length === 0 ? (
              <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
                Pick a table, then add dishes from the menu.
              </p>
            ) : (
              <>
                {cartItems.map((i) => (
                  <div key={i.id} className="taker-cart-row">
                    <span>{i.qty} × {i.name}</span>
                    <span>{formatPrice(i.price * i.qty, currency)}</span>
                  </div>
                ))}
                <div className="taker-bill">
                  <div className="taker-cart-row">
                    <span>Subtotal</span><span>{formatPrice(bill.subtotal, currency)}</span>
                  </div>
                  {bill.discount > 0 && (
                    <div className="taker-cart-row">
                      <span>Discount</span><span>−{formatPrice(bill.discount, currency)}</span>
                    </div>
                  )}
                  {bill.tax > 0 && (
                    <div className="taker-cart-row">
                      <span>Tax ({restaurant?.tax_rate || 0}%)</span><span>{formatPrice(bill.tax, currency)}</span>
                    </div>
                  )}
                  <div className="taker-cart-row taker-total">
                    <span>Total</span><span>{formatPrice(bill.total, currency)}</span>
                  </div>
                </div>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Order note (optional) — e.g. no onion"
                  style={{ width: "100%", boxSizing: "border-box", margin: "10px 0" }}
                />
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: "100%" }}
                  onClick={placeOrder}
                  disabled={!selectedTable || cartItems.length === 0 || placing}
                >
                  {placing ? "Placing..." : `✅ Place Order • ${formatPrice(bill.total, currency)}`}
                </button>
                {!selectedTable && (
                  <p className="form-hint">Select a table first.</p>
                )}
              </>
            )}
            {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}
          </div>
        </aside>
      </div>

      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          restaurantId={restaurantId}
          restaurantName={restaurant?.name}
          restaurantLogo={restaurant?.logo_url}
          restaurantAddress={restaurant?.address}
          currency={currency}
          mode="receipt"
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </AdminLayout>
  );
}
