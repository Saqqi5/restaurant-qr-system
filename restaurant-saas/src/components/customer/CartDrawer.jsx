import { formatPrice } from "../../utils/currency";
import { calculateBill, getEffectiveDiscount } from "../../config/db";
import RestaurantLogo from "./RestaurantLogo";

export default function CartDrawer({ open, onClose, cart, onAdd, onRemove, onUpdateNotes, onPlaceOrder, placing, restaurant, deliveryFee = 0, isDelivery = false }) {
  const currency = restaurant?.currency || "$";
  const effDiscount = getEffectiveDiscount(restaurant);
  const bill = calculateBill(cart, Number(restaurant?.tax_rate) || 0, effDiscount.rate, effDiscount.amount);
  const maxPrepTime = cart.length ? Math.max(...cart.map((i) => i.prep_time_minutes || 15)) : 0;
  const total = Number((bill.total + (deliveryFee || 0)).toFixed(2));

  if (!open) return null;

  return (
    <>
      <div className="cart-overlay" onClick={onClose} />
      <div className="cart-drawer">
        <div className="cart-header">
          <div>
            <div className="cart-restaurant">
              <RestaurantLogo restaurant={restaurant} size={32} />
              <span className="cart-restaurant-name">{restaurant?.name}</span>
            </div>
            <h3 style={{ marginTop: 6 }}>Your Order</h3>
          </div>
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
                <div key={item._key || item.id} className="cart-item">
                  <div className="cart-item-top">
                    <span className="cart-item-name">{item.name}{item.size_label ? ` (${item.size_label})` : ""}</span>
                    <span className="cart-item-price">{formatPrice(item.price * item.quantity, currency)}</span>
                  </div>
                  <div className="cart-item-controls">
                    <div className="qty-control">
                      <button onClick={() => onRemove(item._key || item.id)}>−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => onAdd(item)}>+</button>
                    </div>
                    <span className="unit-price">
                      {item.original_price > item.price ? (
                        <><s className="price-was">{formatPrice(item.original_price, currency)}</s>{" "}</>
                      ) : null}
                      {formatPrice(item.price, currency)} each
                    </span>
                  </div>
                  <input
                    className="item-notes-input"
                    placeholder="Special instructions..."
                    value={item.notes || ""}
                    onChange={(e) => onUpdateNotes(item._key || item.id, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="cart-footer">
              <div className="cart-summary">
                <div className="cart-row">
                  <span>Subtotal</span>
                  <span>{formatPrice(bill.subtotal, currency)}</span>
                </div>
                {bill.discount > 0 && (
                  <div className="cart-row">
                    <span>Discount{effDiscount.active ? " (Promo 🎉)" : effDiscount.rate > 0 ? ` (${effDiscount.rate}%)` : ""}</span>
                    <span>−{formatPrice(bill.discount, currency)}</span>
                  </div>
                )}
                {bill.tax > 0 && (
                  <div className="cart-row">
                    <span>Tax ({Number(restaurant?.tax_rate) || 0}%)</span>
                    <span>{formatPrice(bill.tax, currency)}</span>
                  </div>
                )}
                {deliveryFee > 0 && (
                  <div className="cart-row">
                    <span>🛵 Delivery fee</span>
                    <span>{formatPrice(deliveryFee, currency)}</span>
                  </div>
                )}
                <div className="cart-row prep-time">
                  <span>⏱ Est. prep time</span>
                  <span>~{maxPrepTime} min</span>
                </div>
                <div className="cart-row cart-total-row">
                  <span>Total</span>
                  <strong>{formatPrice(total, currency)}</strong>
                </div>
              </div>
              <button className="btn-place-order" onClick={onPlaceOrder} disabled={placing}>
                {placing ? "Placing order…" : `Place Order — ${formatPrice(total, currency)}`}
              </button>
              <p className="cart-disclaimer">{isDelivery ? "Pay online now, or cash when your food arrives." : "Payment at the counter after your meal."}</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
