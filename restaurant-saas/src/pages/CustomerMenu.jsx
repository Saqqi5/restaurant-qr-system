import { useState, useEffect, useRef } from "react";
import { useTenant } from "../contexts/TenantContext";
import {
  subscribeToMenu, createOrder, subscribeToTableOrders,
  createPayment, subscribeToPayment, calculateBill
} from "../config/db";
import { formatPrice } from "../utils/currency";
import { downscaleImage } from "../utils/image";
import CartDrawer from "../components/customer/CartDrawer";
import MenuGrid from "../components/customer/MenuGrid";
import OrderTracker from "../components/customer/OrderTracker";
import RestaurantHeader from "../components/customer/RestaurantHeader";

const PAYMENT_DETAILS = {
  easypaisa: {
    icon: "📱",
    name: "EasyPaisa",
    detail: "Send to account:",
    number: "0300-1234567",
    accountName: "Saqlyn Payments",
    qrEmoji: "📲",
  },
  jazzcash: {
    icon: "💜",
    name: "JazzCash",
    detail: "Send to mobile account:",
    number: "0311-7654321",
    accountName: "Saqlyn Payments",
    qrEmoji: "📲",
  },
  bank: {
    icon: "🏦",
    name: "Bank Transfer",
    detail: "IBAN:",
    number: "PK12 HABB 0000 0012 3456 7890",
    accountName: "Saqlyn Restaurant Ltd",
    qrEmoji: "🏛️",
  },
};

export default function CustomerMenu() {
  const { restaurant, tableNumber, restaurantId, loading } = useTenant();
  const currency = restaurant?.currency || "$";
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
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

  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToMenu(restaurantId, setMenuItems);
    return unsub;
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !tableNumber) return;
    const unsub = subscribeToTableOrders(restaurantId, tableNumber, setActiveOrders);
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
      created_by: "customer",
    });
    setCart([]);
    setCartOpen(false);
    setPlacedOrder(created);
    setOrderPlaced(true);
    setView("orders");
    setTimeout(() => setOrderPlaced(false), 4000);
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

  if (loading) return <CustomerSkeleton />;

  if (!restaurant) {
    return (
      <div className="error-state">
        <div className="error-icon">🍽️</div>
        <h2>Restaurant not found</h2>
        <p>Please scan the correct QR code or ask your server for help.</p>
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

  return (
    <div className="customer-app">
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
          <OrderTracker orders={activeOrders} currency={currency} restaurantId={restaurantId} />
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
                <div className="payment-sheet-subtitle">
                  Send {formatPrice(orderTotal, currency)} using any method below
                </div>

                {/* Method selector */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {Object.keys(PAYMENT_DETAILS).map((key) => (
                    <button
                      key={key}
                      className={`method-btn ${selectedMethod === key ? "active" : ""}`}
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
                      <span className="payment-method-icon">{PAYMENT_DETAILS[selectedMethod].icon}</span>
                      <span className="payment-method-name">{PAYMENT_DETAILS[selectedMethod].name}</span>
                    </div>
                    <div className="payment-method-detail">{PAYMENT_DETAILS[selectedMethod].detail}</div>
                    <div className="payment-method-number">{PAYMENT_DETAILS[selectedMethod].number}</div>
                    <div className="payment-method-detail" style={{ marginTop: 8 }}>
                      Account Name: <strong>{PAYMENT_DETAILS[selectedMethod].accountName}</strong>
                    </div>
                    <div className="payment-qr-placeholder" style={{ marginTop: 16, fontSize: 60, maxWidth: 120 }}>
                      {PAYMENT_DETAILS[selectedMethod].qrEmoji}
                    </div>
                    <div style={{ textAlign: "center", fontSize: 11, color: "var(--color-muted)", marginTop: 8 }}>
                      Scan QR code or use account number above
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
