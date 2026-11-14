import { formatPrice } from "../../utils/currency";

export default function CartDrawer({ open, onClose, cart, onAdd, onRemove, onUpdateNotes, onPlaceOrder, restaurant }) {
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const currency = restaurant?.currency || "$";
  const maxPrepTime = cart.length ? Math.max(...cart.map((i) => i.prep_time_minutes || 15)) : 0;

  if (!open) return null;

  return (
    <>
      <div className="cart-overlay" onClick={onClose} />
      <div className="cart-drawer">
        <div className="cart-header">
          <h3>Your Order</h3>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>

        {cart.length === 0 ? (
          <div className="cart-empty">
            <span>🛒</span>
            <p>Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((item) => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-top">
                    <span className="cart-item-name">{item.name}</span>
                    <span className="cart-item-price">{formatPrice(item.price * item.quantity, currency)}</span>
                  </div>
                  <div className="cart-item-controls">
                    <div className="qty-control">
                      <button onClick={() => onRemove(item.id)}>−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => onAdd(item)}>+</button>
                    </div>
                    <span className="unit-price">{formatPrice(item.price, currency)} each</span>
                  </div>
                  <input
                    className="item-notes-input"
                    placeholder="Special instructions..."
                    value={item.notes || ""}
                    onChange={(e) => onUpdateNotes(item.id, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="cart-footer">
              <div className="cart-summary">
                <div className="cart-row">
                  <span>Subtotal</span>
                  <span>{formatPrice(total, currency)}</span>
                </div>
                <div className="cart-row prep-time">
                  <span>⏱ Est. prep time</span>
                  <span>~{maxPrepTime} min</span>
                </div>
                <div className="cart-row cart-total-row">
                  <span>Total</span>
                  <strong>{formatPrice(total, currency)}</strong>
                </div>
              </div>
              <button className="btn-place-order" onClick={onPlaceOrder}>
                Place Order — {formatPrice(total, currency)}
              </button>
              <p className="cart-disclaimer">Payment at the counter after your meal.</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
