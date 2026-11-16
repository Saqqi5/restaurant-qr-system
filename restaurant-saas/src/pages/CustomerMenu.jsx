import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../contexts/TenantContext";
import { useAuth } from "../contexts/AuthContext";
import {
  subscribeToMenu, createOrder, subscribeToTableOrders,
  createPayment, subscribeToPayment, calculateBill, isExpiredDemoItem
} from "../config/db";
import { formatPrice } from "../utils/currency";
import { downscaleImage } from "../utils/image";
import { getCustomerSessionId, getDemoHiddenDishes } from "../utils/session";
import CartDrawer from "../components/customer/CartDrawer";
import MenuGrid from "../components/customer/MenuGrid";
import OrderTracker from "../components/customer/OrderTracker";
import RestaurantHeader from "../components/customer/RestaurantHeader";

export default function CustomerMenu() {
  const { restaurant, tableNumber, restaurantId, loading } = useTenant();
  const { userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const currency = restaurant?.currency || "$";
  // Payment accounts come from the restaurant's own settings (editable in
  // Settings > Payment Methods). Only methods the restaurant actually
  // configured are offered — no demo fallback, so money never looks like
  // it goes to "Saqlyn Payments" for a real restaurant.
  const PAYMENT_DETAILS = {
    easypaisa: restaurant?.payment_easypaisa_number ? {
      icon: "📱",
      name: "EasyPaisa",
      detail: "Send to account:",
      number: restaurant.payment_easypaisa_number,
      accountName: restaurant.payment_easypaisa_name || restaurant?.name || "",
    } : null,
    jazzcash: restaurant?.payment_jazzcash_number ? {
      icon: "💜",
      name: "JazzCash",
      detail: "Send to mobile account:",
      number: restaurant.payment_jazzcash_number,
      accountName: restaurant.payment_jazzcash_name || restaurant?.name || "",
    } : null,
    bank: restaurant?.payment_bank_iban ? {
      icon: "🏦",
      name: "Bank Transfer",
      detail: "IBAN:",
      number: restaurant.payment_bank_iban,
      accountName: restaurant.payment_bank_name || restaurant?.name || "",
    } : null,
  };
  const configuredMethods = Object.keys(PAYMENT_DETAILS).filter((k) => PAYMENT_DETAILS[k]);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  // True while an order is being sent — the Place Order button is disabled
  // in that window, so a double tap can never book the order twice.
  const [placingOrder, setPlacingOrder] = useState(false);
  const [tableOrders, setTableOrders] = useState([]);
  const [tableOrdersLoaded, setTableOrdersLoaded] = useState(false);
  // This browser's customer identity (localStorage). The customer who
  // places an order reserves the table until it is paid; another browser
  // is another customer and sees the table as reserved.
  const [mySessionId] = useState(() => getCustomerSessionId());
  // Unpaid ones only — used for the bill total, the badge and Pay Bill.
  // Cancelled orders drop out at once (they are never served or paid).
  const activeOrders = tableOrders.filter((o) => o.payment_status === "unpaid" && o.status !== "cancelled");

  // Table reservation: an unpaid order placed by ANOTHER customer (a
  // different browser session) reserves this table until that customer
  // pays and the order closes. Staff orders never reserve a table, and
  // the restaurant's own staff are never blocked from their table.
  const isStaffOfThisRestaurant =
    userProfile?.restaurant_id === restaurantId || userProfile?.role === "super_admin";
  const isTableReserved =
    tableOrdersLoaded &&
    !isStaffOfThisRestaurant &&
    tableOrders.some(
      (o) =>
        o.payment_status === "unpaid" &&
        o.status !== "cancelled" &&
        typeof o.created_by === "string" &&
        o.created_by.startsWith("cust_") &&
        o.created_by !== mySessionId
    );
  const [view, setView] = useState("menu");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Payment flow state
  const [paymentStage, setPaymentStage] = useState(null); // null | "bill" | "pay" | "uploading" | "waiting" | "verified"
  const [paymentId, setPaymentId] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("easypaisa");
  const fileInputRef = useRef(null);

  // If the saved selection is not configured (e.g. EasyPaisa removed),
  // fall back to the first configured method instead of crashing.
  const activeMethodKey = configuredMethods.includes(selectedMethod)
    ? selectedMethod
    : configuredMethods[0];
  const activeMethod = activeMethodKey ? PAYMENT_DETAILS[activeMethodKey] : null;

  useEffect(() => {
    if (!restaurantId) return;
    // Hidden (soft-deleted) dishes never reach the customer menu. On a demo
    // restaurant, dishes hidden in THIS browser (localStorage, 24h) are
    // hidden here too — another browser still sees them.
    const isDemo = restaurant?.is_demo === true;
    const unsub = subscribeToMenu(restaurantId, (items) => setMenuItems(items.filter((i) => !i.deleted && !(isDemo && getDemoHiddenDishes(restaurantId).has(i.id)) && !(isDemo && isExpiredDemoItem(restaurantId, i)))));
    return unsub;
  }, [restaurantId, restaurant?.is_demo]);

  useEffect(() => {
    if (!restaurantId || !tableNumber) return;
    setTableOrdersLoaded(false);
    const unsub = subscribeToTableOrders(restaurantId, tableNumber, (orders) => {
      setTableOrders(orders);
      setTableOrdersLoaded(true);
    });
    return unsub;
  }, [restaurantId, tableNumber]);

  // Subscribe to payment when waiting for verification
  useEffect(() => {
    if (!paymentId || paymentStage !== "waiting") return;
    const unsub = subscribeToPayment(paymentId, (payment) => {
      if (payment?.status === "verified") {
        setPaymentStage("verified");
      }
    });
    return unsub;
  }, [paymentId, paymentStage]);

  function addToCart(item) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, quantity: 1, notes: "" }];
    });
  }

  function removeFromCart(itemId) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === itemId);
      if (existing?.quantity > 1) {
        return prev.map((c) => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
      }
      return prev.filter((c) => c.id !== itemId);
    });
  }

  function updateNotes(itemId, notes) {
    setCart((prev) => prev.map((c) => c.id === itemId ? { ...c, notes } : c));
  }

  async function placeOrder() {
    if (!cart.length || !tableNumber) return;
    // The table may have been reserved by another customer since the page loaded.
    if (isTableReserved) return;
    // Double-tap guard: a second tap while the first order is still being
    // sent is ignored, so the order can never be booked twice.
    if (placingOrder) return;
    setPlacingOrder(true);
    try {
      const created = await createOrder(restaurantId, {
        table_number: tableNumber,
        items: cart.map(i => ({
          item_id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          notes: i.notes,
          prep_time_minutes: i.prep_time_minutes,
        })),
        created_by: mySessionId,
        // Add-on: this table already has an active order, so the kitchen
        // serves this one on priority.
        is_addon: activeOrders.length > 0,
      });
      // The cart clears the moment the order is confirmed — the selected
      // items are gone at once, so there is nothing left to re-place.
      setCart([]);
      setCartOpen(false);
      setPlacedOrder(created);
      setOrderPlaced(true);
      setView("orders");
      setTimeout(() => setOrderPlaced(false), 4000);
    } finally {
      setPlacingOrder(false);
    }
  }

  function handleProofFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPaymentError("File is too large. Please use an image under 5MB.");
      return;
    }
    setPaymentError("");
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmitPayment() {
    setPaymentError("");
    if (!proofFile) {
      setPaymentError("Please upload your payment screenshot to proceed.");
      return;
    }
    setUploading(true);
    try {
      // Calculate total from all active orders
      const total = activeOrders.reduce((s, o) => s + (o.total || 0), 0);
      const allItems = activeOrders.flatMap(o => o.items || []);

      // Compress the screenshot to a data URL stored in the payment record.
      // No Firebase Storage needed (Storage requires the paid Blaze plan).
      const screenshotUrl = await downscaleImage(proofFile, 800, 0.72);
      if (screenshotUrl.length > 700000) {
        setPaymentError("Screenshot is too large. Please use a smaller image.");
        setUploading(false);
        return;
      }

      // Create payment record in Firestore
      const payment = await createPayment({
        restaurantId,
        tableNumber,
        orderId: activeOrders[0]?.id || null,
        method: activeMethodKey,
        orderIds: activeOrders.map((o) => o.id),
        amount: total,
        items: allItems,
        screenshotUrl,
      });

      setPaymentId(payment.id);
      setPaymentStage("waiting");
    } catch (err) {
      console.error("Payment submission failed:", err);
      setPaymentError("Failed to submit payment. Please try again.");
    }
    setUploading(false);
  }

  function closePayment() {
    setPaymentStage(null);
    setPaymentId(null);
    setProofFile(null);
    setProofPreview(null);
    setPaymentError("");
    setSelectedMethod("easypaisa");
  }

  const categories = [...new Set(menuItems.map((i) => i.category))];
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const orderTotal = activeOrders.reduce((s, o) => s + (o.total || 0), 0);
  const allOrderItems = activeOrders.flatMap(o => o.items || []);
  // Bill breakdown for the payment sheet (orders store these since the
  // tax/discount billing update; fall back gracefully for older orders).
  const billSubtotal = activeOrders.reduce((s, o) => s + (o.subtotal ?? o.total ?? 0), 0);
  const billDiscount = activeOrders.reduce((s, o) => s + (o.discount_amount || 0), 0);
  const billTax = activeOrders.reduce((s, o) => s + (o.tax_amount || 0), 0);

  // The restaurant's own brand colours theme the whole customer page:
  // primary colours the header, the brighter accent colours the buttons,
  // prices and active states. Falls back to SAQLYN green.
  const themePrimary = restaurant?.theme?.primary || "#20C997";
  const themeAccent = restaurant?.theme?.accent || "#17A884";
  const themeVars = {
    "--color-primary": themeAccent,
    "--color-primary-dark": themePrimary,
    "--color-green": themePrimary,
  };

  if (loading || authLoading) return <CustomerSkeleton />;

  if (!restaurant) {
    return (
      <div className="error-state">
        <div className="error-icon">🍽️</div>
        <h2>Restaurant not found</h2>
        <p>Please scan the correct QR code or ask your server for help.</p>
      </div>
    );
  }

  // Frozen by the super admin: the whole restaurant stops publicly — no
  // menu, no ordering — until it is unfrozen. The super admin can still
  // preview the menu.
  if (restaurant?.is_frozen === true && userProfile?.role !== "super_admin") {
    return (
      <div className="error-state">
        <div className="error-icon">🧊</div>
        <h2>This restaurant is currently unavailable</h2>
        <p>Ordering is paused for this restaurant. Please contact the restaurant for more information.</p>
      </div>
    );
  }

  // Staff of one restaurant must never see another restaurant's menu or
  // its table orders. The customer menu is public for real customers
  // (anonymous), but a signed-in staff member belongs to exactly one
  // restaurant — opening any other restaurant's menu is blocked here.
  // The super admin (no restaurant of their own) is exempt.
  const STAFF_DASHBOARD = {
    general_admin: "/admin/restaurant",
    kitchen: "/admin/kitchen",
    cash_counter: "/admin/cash",
    server: "/admin/server",
  };
  if (
    userProfile &&
    userProfile.role !== "super_admin" &&
    userProfile.restaurant_id &&
    userProfile.restaurant_id !== restaurantId
  ) {
    return (
      <div className="error-state">
        <div className="error-icon">⛔</div>
        <h2>This menu belongs to another restaurant</h2>
        <p>You are signed in as staff of another restaurant. Please use your own restaurant&apos;s QR code or dashboard.</p>
        <button
          className="btn-primary"
          onClick={() => navigate(STAFF_DASHBOARD[userProfile.role] || "/login")}
        >
          Go to my dashboard
        </button>
      </div>
    );
  }

  if (!tableNumber) {
    return (
      <div className="error-state">
        <div className="error-icon">🪑</div>
        <h2>No table assigned</h2>
        <p>Please scan the QR code on your table to start ordering.</p>
      </div>
    );
  }

  // Another customer has an unpaid order on this table — it stays
  // reserved until they pay and the order closes. The live subscription
  // clears this screen automatically the moment the table frees up.
  if (isTableReserved) {
    return (
      <div className="error-state">
        <div className="error-icon">🪑</div>
        <h2>Table {tableNumber} is reserved</h2>
        <p>Another customer is currently ordering at this table. It will open again automatically after they pay.</p>
      </div>
    );
  }

  return (
    <div className="customer-app" style={themeVars}>
      <RestaurantHeader restaurant={restaurant} tableNumber={tableNumber} />

      <nav className="customer-nav">
        <button
          className={`nav-tab ${view === "menu" ? "active" : ""}`}
          onClick={() => setView("menu")}
        >
          Menu
        </button>
        <button
          className={`nav-tab ${view === "orders" ? "active" : ""}`}
          onClick={() => setView("orders")}
        >
          My Orders
          {activeOrders.length > 0 && (
            <span className="badge">{activeOrders.length}</span>
          )}
        </button>
      </nav>

      {orderPlaced && (
        <div className="order-success-banner">
          ✅ Order {placedOrder ? `#${placedOrder.order_number ?? placedOrder.id?.slice(-6).toUpperCase()} ` : ""}placed! Kitchen is preparing your food.
        </div>
      )}

      {view === "menu" && (
        <>
          <div className="menu-search-row">
            <input
              type="search"
              className="menu-search-input"
              placeholder="🔍 Search dishes…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <MenuGrid
            items={searchTerm.trim()
              ? menuItems.filter((i) => i.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))
              : menuItems}
            searchActive={!!searchTerm.trim()}
            categories={categories}
            cart={cart}
            onAdd={addToCart}
            onRemove={removeFromCart}
            currency={currency}
          />
        </>
      )}

      {view === "orders" && (
        <>
          <OrderTracker orders={tableOrders} currency={currency} restaurantId={restaurantId} sessionId={mySessionId} />
          <div className="order-more-section">
            <button className="btn-order-more" onClick={() => setView("menu")}>
              ➕ Order more items
            </button>
          </div>
          {activeOrders.length > 0 && (
            <div className="pay-now-section">
              <button
                className="btn-pay-now"
                onClick={() => setPaymentStage("bill")}
              >
                💳 Pay Bill — {formatPrice(orderTotal, currency)}
              </button>
            </div>
          )}
        </>
      )}

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <button className="cart-fab" onClick={() => setCartOpen(true)}>
          <span className="cart-fab-icon">🛒</span>
          <span className="cart-fab-count">{cartCount}</span>
          <span className="cart-fab-total">
            {formatPrice(calculateBill(cart, Number(restaurant?.tax_rate) || 0, Number(restaurant?.discount_rate) || 0).total, currency)}
          </span>
        </button>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onAdd={addToCart}
        onRemove={removeFromCart}
        onUpdateNotes={updateNotes}
        onPlaceOrder={placeOrder}
        placing={placingOrder}
        restaurant={restaurant}
      />

      {/* Payment Overlay */}
      {paymentStage && (
        <div className="payment-overlay">
          <div className="payment-sheet">
            <div className="payment-sheet-handle" />

            {/* BILL STAGE */}
            {paymentStage === "bill" && (
              <>
                <div className="payment-sheet-title">Your Bill</div>
                <div className="payment-sheet-subtitle">
                  <span className="bill-table-badge">Table {tableNumber}</span>
                </div>
                <div className="bill-items">
                  {allOrderItems.map((item, i) => (
                    <div key={i} className="bill-item">
                      <span className="bill-item-name">{item.name} ×{item.quantity}</span>
                      <span className="bill-item-price">
                        {formatPrice(item.price * item.quantity, currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bill-summary">
                  <div className="bill-row">
                    <span>Subtotal</span>
                    <span>{formatPrice(billSubtotal, currency)}</span>
                  </div>
                  {billDiscount > 0 && (
                    <div className="bill-row">
                      <span>Discount</span>
                      <span>−{formatPrice(billDiscount, currency)}</span>
                    </div>
                  )}
                  {billTax > 0 && (
                    <div className="bill-row">
                      <span>Tax</span>
                      <span>{formatPrice(billTax, currency)}</span>
                    </div>
                  )}
                </div>
                <div className="bill-total">
                  <span>Total</span>
                  <span>{formatPrice(orderTotal, currency)}</span>
                </div>
                <button
                  className="btn-pay-now"
                  style={{ marginTop: 16 }}
                  onClick={() => setPaymentStage("pay")}
                >
                  Proceed to Pay →
                </button>
                <button
                  className="btn-secondary"
                  style={{ width: "100%", marginTop: 12 }}
                  onClick={closePayment}
                >
                  Cancel
                </button>
              </>
            )}

            {/* PAY STAGE */}
            {paymentStage === "pay" && (
              <>
                <div className="payment-sheet-title">Choose Payment</div>
                {!activeMethod ? (
                  <>
                    <div className="payment-sheet-subtitle">
                      Online payment isn't set up for this restaurant yet.
                    </div>
                    <div className="payment-status-screen">
                      <span className="payment-status-icon">💵</span>
                      <div className="payment-status-title">Please pay at the counter</div>
                      <div className="payment-status-desc">
                        Your bill is {formatPrice(orderTotal, currency)}. The cash
                        counter will take your payment and mark the order paid.
                      </div>
                      <button
                        className="btn-pay-now"
                        onClick={closePayment}
                        style={{ maxWidth: 280, margin: "0 auto" }}
                      >
                        Done
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="payment-sheet-subtitle">
                      Send {formatPrice(orderTotal, currency)} using any method below
                    </div>

                    {/* Method selector — only configured methods */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      {configuredMethods.map((key) => (
                        <button
                          key={key}
                          className={`method-btn ${activeMethodKey === key ? "active" : ""}`}
                          onClick={() => setSelectedMethod(key)}
                          style={{ flex: 1, padding: "10px 6px", fontSize: 12 }}
                        >
                          {PAYMENT_DETAILS[key].icon} {PAYMENT_DETAILS[key].name}
                        </button>
                      ))}
                    </div>

                    <div className="payment-methods">
                      <div className="payment-method-card">
                        <div className="payment-method-header">
                          <span className="payment-method-icon">{activeMethod.icon}</span>
                          <span className="payment-method-name">{activeMethod.name}</span>
                        </div>
                        <div className="payment-method-detail">{activeMethod.detail}</div>
                        <div className="payment-method-number">{activeMethod.number}</div>
                        <div className="payment-method-detail" style={{ marginTop: 8 }}>
                          Account Name: <strong>{activeMethod.accountName}</strong>
                        </div>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(activeMethod.number)}&format=png&qzone=2`}
                          alt={`${activeMethod.name} payment QR code`}
                          className="payment-qr"
                        />
                        <div style={{ textAlign: "center", fontSize: 11, color: "var(--color-muted)", marginTop: 8 }}>
                          Scan to copy the account number, or use the number above
                        </div>
                      </div>
                    </div>

                    <div className="upload-section">
                      <h4>Upload Payment Screenshot</h4>
                      <div
                        className="file-upload-area"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleProofFileChange}
                          style={{ display: "none" }}
                        />
                        <div className="file-upload-icon">📸</div>
                        {proofFile ? (
                          <div className="file-upload-text">✅ {proofFile.name}</div>
                        ) : (
                          <div className="file-upload-text">Tap to upload screenshot</div>
                        )}
                      </div>
                      {proofPreview && (
                        <img src={proofPreview} alt="Payment proof" className="file-preview" />
                      )}
                    </div>

                    {paymentError && <div className="error-banner">{paymentError}</div>}

                    <button
                      className="btn-pay-now"
                      onClick={handleSubmitPayment}
                      disabled={uploading}
                      style={{ marginBottom: 12 }}
                    >
                      {uploading ? <span className="spinner-sm" /> : "✓ Confirm Payment"}
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ width: "100%" }}
                      onClick={() => setPaymentStage("bill")}
                    >
                      ← Back
                    </button>
                  </>
                )}
              </>
            )}

            {/* WAITING STAGE */}
            {paymentStage === "waiting" && (
              <div className="payment-status-screen">
                <div className="payment-spinner" />
                <div className="payment-status-title">Awaiting Verification</div>
                <div className="payment-status-desc">
                  Your payment proof has been submitted. Staff will verify it shortly.
                  This page will update automatically.
                </div>
                <div style={{ fontSize: 13, color: "var(--color-muted)" }}>
                  Please keep this screen open
                </div>
              </div>
            )}

            {/* VERIFIED STAGE */}
            {paymentStage === "verified" && (
              <div className="payment-status-screen">
                <span className="payment-status-icon">✅</span>
                <div className="payment-status-title">Payment Verified!</div>
                <div className="payment-status-desc">
                  Your payment has been confirmed. Thank you for dining with us!
                </div>
                <button
                  className="btn-pay-now"
                  onClick={closePayment}
                  style={{ maxWidth: 280, margin: "0 auto" }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerSkeleton() {
  return (
    <div className="customer-app skeleton-loading">
      <div className="skeleton-header" />
      <div className="skeleton-nav" />
      <div className="skeleton-grid">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton-card" />
        ))}
      </div>
    </div>
  );
}
