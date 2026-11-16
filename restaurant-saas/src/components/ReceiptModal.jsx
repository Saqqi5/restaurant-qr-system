import { useState, useEffect } from "react";
import { getRestaurant } from "../config/db";
import { formatPrice } from "../utils/currency";

// Printable receipt (customer bill) and KOT (kitchen order ticket).
// Print button uses window.print(); index.css @media print shows only
// the .receipt-print-area.
export default function ReceiptModal({ order, restaurantId, restaurantName, currency = "$", mode = "receipt", onClose }) {
  const [name, setName] = useState(restaurantName || "");
  useEffect(() => {
    if (restaurantName) return;
    if (restaurantId) getRestaurant(restaurantId).then((r) => r?.name && setName(r.name));
  }, [restaurantId, restaurantName]);

  if (!order) return null;
  const isKot = mode === "kot";
  const orderNo = order.order_number ? `#${order.order_number}` : `#${order.id?.slice(-6).toUpperCase()}`;
  const dateStr = order.created_at?.toDate
    ? order.created_at.toDate().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  const subtotal = order.subtotal ?? (order.items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = order.discount_amount || 0;
  const tax = order.tax_amount || 0;

  return (
    <div className="receipt-modal-overlay" onClick={onClose}>
      <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-print-area">
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{name || "Restaurant"}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {isKot ? "KITCHEN ORDER TICKET" : "RECEIPT"}
            </div>
          </div>

          <div style={{ fontSize: 13, lineHeight: 1.7, borderTop: "1px dashed #ccc", borderBottom: "1px dashed #ccc", padding: "8px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Order</span><strong>{orderNo}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Table</span><strong>{order.table_number}</strong>
            </div>
            {dateStr && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Date</span><span>{dateStr}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Status</span><strong style={{ textTransform: "capitalize" }}>{order.status || "—"}</strong>
            </div>
            {order.status === "cancelled" && order.cancelled_by_name && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Cancelled by</span><span>{order.cancelled_by_name}</span>
              </div>
            )}
          </div>

          <div style={{ padding: "10px 0", borderBottom: "1px dashed #ccc" }}>
            {(order.items || []).map((item, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>{item.quantity} × {item.name}</span>
                  {!isKot && <span>{formatPrice(item.price * item.quantity, currency)}</span>}
                </div>
                {item.notes && <div style={{ fontSize: 12, color: "#666", paddingLeft: 8 }}>📝 {item.notes}</div>}
              </div>
            ))}
          </div>

          {!isKot && (
            <div style={{ fontSize: 14, lineHeight: 1.9, paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span><span>{formatPrice(subtotal, currency)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Discount{order.discount_rate ? ` (${order.discount_rate}%)` : ""}</span>
                  <span>−{formatPrice(discount, currency)}</span>
                </div>
              )}
              {tax > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Tax{order.tax_rate ? ` (${order.tax_rate}%)` : ""}</span>
                  <span>{formatPrice(tax, currency)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 800, borderTop: "1px solid #ddd", marginTop: 4, paddingTop: 6 }}>
                <span>Total</span><span>{formatPrice(order.total, currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666" }}>
                <span>Payment</span>
                <span>{order.payment_status === "paid" ? `Paid (${order.payment_method || "—"})` : "Unpaid"}</span>
              </div>
            </div>
          )}

          <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginTop: 14 }}>
            {isKot ? "— Kitchen copy —" : "Thank you for dining with us!"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={() => window.print()}
            style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "none", background: "#20C997", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            🖨️ Print
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
