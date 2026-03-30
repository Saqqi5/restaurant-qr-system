import { useState, useEffect } from "react";
import { useTenant } from "../contexts/TenantContext";
import { subscribeToMenu, createOrder, subscribeToTableOrders } from "../config/db";
import CartDrawer from "../components/customer/CartDrawer";
import MenuGrid from "../components/customer/MenuGrid";
import OrderTracker from "../components/customer/OrderTracker";
import RestaurantHeader from "../components/customer/RestaurantHeader";

export default function CustomerMenu() {
  const { restaurant, tableNumber, restaurantId, loading } = useTenant();
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [view, setView] = useState("menu"); // "menu" | "orders"
  const [orderPlaced, setOrderPlaced] = useState(false);

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
    await createOrder(restaurantId, {
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
    setOrderPlaced(true);
    setView("orders");
    setTimeout(() => setOrderPlaced(false), 4000);
  }

  const categories = [...new Set(menuItems.map((i) => i.category))];
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

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

      {/* Tab Navigation */}
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
          ✅ Order placed! Kitchen is preparing your food.
        </div>
      )}

      {view === "menu" && (
        <MenuGrid
          items={menuItems}
          categories={categories}
          cart={cart}
          onAdd={addToCart}
          onRemove={removeFromCart}
        />
      )}

      {view === "orders" && (
        <OrderTracker orders={activeOrders} />
      )}

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <button className="cart-fab" onClick={() => setCartOpen(true)}>
          <span className="cart-fab-icon">🛒</span>
          <span className="cart-fab-count">{cartCount}</span>
          <span className="cart-fab-total">
            ${cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}
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
