import { useState, useEffect } from "react";
import { getRestaurant } from "../config/db";
import { formatPrice } from "../utils/currency";

// Printable receipt (customer bill) and KOT (kitchen order ticket).
// Print button uses window.print(); index.css @media print shows only
// the .receipt-print-area on a forced white page (the app is dark-themed).
// The restaurant logo (set in Restaurant Settings → logo upload, saved as
// `logo_url` on the restaurant doc) shows above the name when available.
export default function ReceiptModal({ order, restaurantId, restaurantName, restaurantLogo = "", restaurantAddress = "", currency = "$", mode = "receipt", onClose }) {
  const [name, setName] = useState(restaurantName || "");
  const [logo, setLogo] = useState(restaurantLogo || "");
  const [address, setAddress] = useState(restaurantAddress || "");
  useEffect(() => { if (restaurantName) setName(restaurantName); }, [restaurantName]);
  useEffect(() => { if (restaurantLogo) setLogo(restaurantLogo); }, [restaurantLogo]);
  useEffect(() => { if (restaurantAddress) setAddress(restaurantAddress); }, [restaurantAddress]);
  useEffect(() => {
    if (restaurantId && (!restaurantName || !restaurantLogo || !restaurantAddress)) {
      getRestaurant(restaurantId).then((r) => {
        if (r?.name && !restaurantName) setName(r.name);
        if (r?.logo_url && !restaurantLogo) setLogo(r.logo_url);
        if (r?.address && !restaurantAddress) setAddress(r.address);
      });
    }
  }, [restaurantId, restaurantName, restaurantLogo, restaurantAddress]);

  // The browser names a saved PDF after document.title — set it to the
  // slip's name (restaurant + order number) while the slip is open, so
  // "Save as PDF" saves e.g. "Lahori Dastarkhwan - Order #1.pdf".
  // Restored when the slip closes.
  useEffect(() => {
    const prev = document.title;
    const no = order?.order_number ? `#${order.order_number}` : `#${order?.id?.slice(-6).toUpperCase()}`;
    document.title = `${name || "Restaurant"} - Order ${no}${mode === "kot" ? " - KOT" : ""}`;
    return () => { document.title = prev; };
  }, [order, name, mode]);

  if (!order) return null;
  const isKot = mode === "kot";
  const orderNo = order.order_number ? `#${order.order_number}` : `#${order.id?.slice(-6).toUpperCase()}`;
  const dateStr = order.created_at?.toDate
    ? order.created_at.toDate().toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  const subtotal = order.subtotal ?? (order.items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = order.discount_amount || 0;
  const tax = order.tax_amount || 0;

  return (
    <div className="receipt-modal-overlay" onClick={onClose}>
      <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-print-area" style={{ borderTop: "3px solid #20C997" }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            {logo && (
              <img src={logo} alt="" style={{ maxHeight: 64, maxWidth: 200, objectFit: "contain", display: "block", margin: "0 auto 8px" }} />
            )}
            <div style={{ fontSize: 18, fontWeight: 800 }}>{name || "Restaurant"}</div>
            <div style={{ fontSize: 12, color: "#12805c", fontWeight: 700, letterSpacing: "2px", marginTop: 2 }}>
              {isKot ? "KITCHEN ORDER TICKET" : "RECEIPT"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0b7a55", marginTop: 6 }}>Order {orderNo}</div>
            {isKot && order.is_addon && (
              <div style={{ fontSize: 13, fontWeight: 800, color: "#b45309", marginTop: 6 }}>➕ ADD-ON ORDER — PRIORITY</div>
            )}
            {isKot && order.order_type === "delivery" && (
              <div style={{ fontSize: 13, fontWeight: 800, color: "#4a90d9", marginTop: 6 }}>🛵 HOME DELIVERY</div>
            )}
          </div>

          <div style={{ fontSize: 13, lineHeight: 1.7, borderTop: "1px dashed #ccc", borderBottom: "1px dashed #ccc", padding: "8px 0" }}>
            {dateStr && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Date</span><span>{dateStr}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{order.order_type === "delivery" ? "🛵 Delivery" : "Table"}</span><strong>{order.order_type === "delivery" ? "Home Delivery" : order.table_number}</strong>
            </div>
            {order.order_type === "delivery" && order.customer_name && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Customer</span><span>{order.customer_name}{order.customer_phone ? ` · ${order.customer_phone}` : ""}</span>
              </div>
            )}
            {order.order_type === "delivery" && order.delivery_address && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Address</span><span style={{ textAlign: "right", maxWidth: "70%" }}>{order.delivery_address}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Status</span><strong style={{ textTransform: "capitalize", color: order.status === "cancelled" ? "#b91c1c" : ["served", "delivered"].includes(order.status) ? "#12805c" : undefined }}>{order.status === "out_for_delivery" ? "Out for delivery" : order.status || "—"}</strong>
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
              {order.delivery_fee > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>🛵 Delivery fee</span>
                  <span>{formatPrice(order.delivery_fee, currency)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 800, color: "#12805c", borderTop: "1px solid #ddd", marginTop: 4, paddingTop: 6 }}>
                <span>Total</span><span>{formatPrice(order.total, currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666" }}>
                <span>Payment</span>
                <span style={{ color: order.payment_status === "paid" ? "#12805c" : "#b45309" }}>{order.payment_status === "paid" ? `Paid (${order.payment_method || "—"})` : "Unpaid"}</span>
              </div>
            </div>
          )}

          {/* Address: below the total bill, at the bottom of the slip. */}
          {!isKot && address && (
            <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginTop: 10 }}>{address}</div>
          )}

          <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginTop: 14 }}>
            {isKot ? "— Kitchen copy —" : (
              <>Thank you for dining <img src="/favicon.svg" alt="" style={{ height: 14, width: 14, verticalAlign: "-2px", margin: "0 1px" }} /> with us!</>
            )}
          </div>
          {!isKot && (
            <div style={{ textAlign: "center", fontSize: 11, color: "#888", marginTop: 4 }}>Powered by SAQLYN</div>
          )}
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
