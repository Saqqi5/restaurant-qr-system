import { useState, useEffect } from "react";
import { getRestaurant, getOrderPayable, applyOrderDiscount, removeOrderDiscount, cancelOrder, deleteOrder, hideOrder, setOrderTip } from "../config/db";
import { formatPrice } from "../utils/currency";

// Printable receipt (customer bill) and KOT (kitchen order ticket).
// Print button uses window.print(); index.css @media print shows only
// the .receipt-print-area on a forced white page (the app is dark-themed).
// The restaurant logo (set in Restaurant Settings → logo upload, saved as
// `logo_url` on the restaurant doc) shows above the name when available.
export default function ReceiptModal({ order, restaurantId, restaurantName, restaurantLogo = "", restaurantAddress = "", deliveryPhone = "", complaintsPhone = "", currency = "$", mode = "receipt", onClose, discountActor = null, onDiscountApplied, actor = null, onOrderChanged = null }) {
  const [name, setName] = useState(restaurantName || "");
  const [logo, setLogo] = useState(restaurantLogo || "");
  const [address, setAddress] = useState(restaurantAddress || "");
  // Two separate numbers: one for orders / home delivery, one for
  // complaints & inquiries (his 2026-11-17 decision).
  const [phone1, setPhone1] = useState(deliveryPhone || "");
  const [complaintsNum, setComplaintsNum] = useState(complaintsPhone || "");
  // One-customer discount form state (kept with the other state, above
  // the `if (!order)` return — hooks must never sit after an early return).
  const [discType, setDiscType] = useState("percent");
  const [discValue, setDiscValue] = useState("");
  const [discBusy, setDiscBusy] = useState(false);
  const [discError, setDiscError] = useState("");
  // The slip shows the order as applied locally right after a discount
  // is set or removed — the parent's receipt copy is a snapshot that
  // only refreshes when it re-renders, so the modal keeps its own
  // fresh copy until a different order is opened.
  const [localOrder, setLocalOrder] = useState(null);
  useEffect(() => { setLocalOrder(null); }, [order?.id]);
  useEffect(() => { if (restaurantName) setName(restaurantName); }, [restaurantName]);
  useEffect(() => { if (restaurantLogo) setLogo(restaurantLogo); }, [restaurantLogo]);
  useEffect(() => { if (restaurantAddress) setAddress(restaurantAddress); }, [restaurantAddress]);
  useEffect(() => { if (deliveryPhone) setPhone1(deliveryPhone); }, [deliveryPhone]);
  useEffect(() => { if (complaintsPhone) setComplaintsNum(complaintsPhone); }, [complaintsPhone]);
  useEffect(() => {
    if (restaurantId && (!restaurantName || !restaurantLogo || !restaurantAddress || !deliveryPhone || !complaintsPhone)) {
      getRestaurant(restaurantId).then((r) => {
        if (r?.name && !restaurantName) setName(r.name);
        if (r?.logo_url && !restaurantLogo) setLogo(r.logo_url);
        if (r?.address && !restaurantAddress) setAddress(r.address);
        if (r?.delivery_phone && !deliveryPhone) setPhone1(r.delivery_phone);
        if (r?.complaints_phone && !complaintsPhone) setComplaintsNum(r.complaints_phone);
      });
    }
  }, [restaurantId, restaurantName, restaurantLogo, restaurantAddress, deliveryPhone, complaintsPhone]);

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
  const displayOrder = localOrder || order;
  const isKot = mode === "kot";
  const orderNo = displayOrder.order_number ? `#${displayOrder.order_number}` : `#${displayOrder.id?.slice(-6).toUpperCase()}`;
  const dateStr = displayOrder.created_at?.toDate
    ? displayOrder.created_at.toDate().toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  const subtotal = displayOrder.subtotal ?? (displayOrder.items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = displayOrder.discount_amount || 0;
  const tax = displayOrder.tax_amount || 0;
  // Per-order manual discount (admin / super admin only): the stored
  // total never changes, so the slip shows the payable instead.
  const { payable, discount: manualDiscount, tip, amountPaid, balance } = getOrderPayable(displayOrder);

  // One-customer discount, applied from this slip by the restaurant
  // admin or the super admin only (discountActor is null for everyone
  // else, so the control never renders for them). The slip itself never
  // prints this control — it sits outside the print area.
  const canDiscount = !!discountActor && displayOrder.payment_status !== "paid" && displayOrder.status !== "cancelled";
  async function handleApplyDiscount() {
    setDiscError("");
    setDiscBusy(true);
    try {
      const v = parseFloat(discValue) || 0;
      const amount = await applyOrderDiscount(displayOrder._restaurantId || restaurantId, displayOrder.id, {
        type: discType,
        value: v,
        byUid: discountActor.uid,
        byName: discountActor.name,
      });
      setLocalOrder({ ...displayOrder, manual_discount_type: discType, manual_discount_value: v, manual_discount_amount: amount, manual_discount_by_name: discountActor.name });
      setDiscValue("");
      if (onDiscountApplied) onDiscountApplied();
    } catch (e) {
      setDiscError(e.message || "Could not apply the discount.");
    }
    setDiscBusy(false);
  }
  async function handleRemoveDiscount() {
    setDiscError("");
    setDiscBusy(true);
    try {
      await removeOrderDiscount(displayOrder._restaurantId || restaurantId, displayOrder.id);
      setLocalOrder({ ...displayOrder, manual_discount_type: null, manual_discount_value: null, manual_discount_amount: 0, manual_discount_by_name: null });
      if (onDiscountApplied) onDiscountApplied();
    } catch (e) {
      setDiscError(e.message || "Could not remove the discount.");
    }
    setDiscBusy(false);
  }

  // Tip (cashier / admin, from this slip): added to the order's bill.
  const [tipValue, setTipValue] = useState("");
  const [tipBusy, setTipBusy] = useState(false);
  const [tipError, setTipError] = useState("");
  const canTip = !!actor && ["general_admin", "cash_counter", "super_admin", "branch_manager"].includes(actorRole) && displayOrder.payment_status !== "paid" && displayOrder.status !== "cancelled";
  async function handleSetTip() {
    setTipError("");
    setTipBusy(true);
    try {
      const v = Math.max(0, Number(tipValue) || 0);
      await setOrderTip(displayOrder._restaurantId || restaurantId, displayOrder.id, v);
      setLocalOrder({ ...displayOrder, tip_amount: v });
      setTipValue("");
      if (onDiscountApplied) onDiscountApplied();
    } catch (e) {
      setTipError(e.message || "Could not set the tip.");
    }
    setTipBusy(false);
  }

  // Cancel / Delete from this slip (only when an `actor` is passed —
  // currently the Order History page). Cancel is a soft-cancel (the
  // order stays in history as cancelled, the table is freed at once).
  // Delete removes the order entirely (test / wrong orders only).
  // Two-step confirm: first click arms the button, second click runs it.
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const actorRole = actor?.role || "";
  const canCancel = !!actor && ["general_admin", "cash_counter", "super_admin", "branch_manager"].includes(actorRole) && displayOrder.status !== "cancelled";
  // Delete: the super admin hard-deletes. The restaurant admin and the
  // branch manager may only HIDE the order from the restaurant (the
  // record stays for the super admin) — so they get the same button, but
  // it hides instead of deleting.
  const canDelete = !!actor && ["general_admin", "super_admin", "branch_manager"].includes(actorRole);
  async function runAction(kind) {
    if (confirmAction !== kind) { setConfirmAction(kind); setActionError(""); return; }
    setActionBusy(true);
    setActionError("");
    try {
      const rid = displayOrder._restaurantId || restaurantId;
      if (kind === "cancel") {
        await cancelOrder(rid, displayOrder.id, { uid: actor.uid, name: actor.name });
        setLocalOrder({ ...displayOrder, status: "cancelled", cancelled_by_name: actor.name });
      } else if (actorRole === "super_admin") {
        // Super admin: hard delete — the record is gone for everyone.
        await deleteOrder(rid, displayOrder.id);
        if (onOrderChanged) onOrderChanged();
        onClose();
        return;
      } else {
        // Restaurant admin / branch manager: only HIDE it from the
        // restaurant. The record stays in Firestore and the super admin
        // still sees it.
        await hideOrder(rid, displayOrder.id, { uid: actor.uid, name: actor.name });
        if (onOrderChanged) onOrderChanged();
        onClose();
        return;
      }
      setConfirmAction(null);
      if (onOrderChanged) onOrderChanged();
    } catch (e) {
      setActionError(e.message || `Could not ${kind} the order.`);
    }
    setActionBusy(false);
  }

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
            {isKot && displayOrder.is_addon && (
              <div style={{ fontSize: 13, fontWeight: 800, color: "#b45309", marginTop: 6 }}>➕ ADD-ON ORDER — PRIORITY</div>
            )}
            {isKot && displayOrder.order_type === "delivery" && (
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
              <span>{displayOrder.order_type === "delivery" ? "🛵 Delivery" : "Table"}</span><strong>{displayOrder.order_type === "delivery" ? "Home Delivery" : displayOrder.table_number}</strong>
            </div>
            {displayOrder.order_type === "delivery" && displayOrder.customer_name && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Customer</span><span>{displayOrder.customer_name}{displayOrder.customer_phone ? ` · ${displayOrder.customer_phone}` : ""}</span>
              </div>
            )}
            {displayOrder.order_type === "delivery" && displayOrder.delivery_address && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Address</span><span style={{ textAlign: "right", maxWidth: "70%" }}>{displayOrder.delivery_address}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Status</span><strong style={{ textTransform: "capitalize", color: displayOrder.status === "cancelled" ? "#b91c1c" : ["served", "delivered"].includes(displayOrder.status) ? "#12805c" : undefined }}>{displayOrder.status === "out_for_delivery" ? "Out for delivery" : displayOrder.status || "—"}</strong>
            </div>
            {displayOrder.status === "cancelled" && displayOrder.cancelled_by_name && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Cancelled by</span><span>{displayOrder.cancelled_by_name}</span>
              </div>
            )}
          </div>

          <div style={{ padding: "10px 0", borderBottom: "1px dashed #ccc" }}>
            {(displayOrder.items || []).map((item, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>{item.quantity} × {item.name}</span>
                  {!isKot && (
                    <span>
                      {item.original_price > item.price ? (
                        <><s style={{ color: "#999", marginRight: 5 }}>{formatPrice(item.original_price * item.quantity, currency)}</s></>
                      ) : null}
                      {formatPrice(item.price * item.quantity, currency)}
                    </span>
                  )}
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
                  <span>Discount{displayOrder.promo_applied ? " (Promo 🎉)" : displayOrder.discount_rate ? ` (${displayOrder.discount_rate}%)` : ""}</span>
                  <span>−{formatPrice(discount, currency)}</span>
                </div>
              )}
              {manualDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Extra Discount{displayOrder.manual_discount_type === "percent" && displayOrder.manual_discount_value ? ` (${displayOrder.manual_discount_value}%)` : ""}</span>
                  <span>−{formatPrice(manualDiscount, currency)}</span>
                </div>
              )}
              {tax > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Tax{displayOrder.tax_rate ? ` (${displayOrder.tax_rate}%)` : ""}</span>
                  <span>{formatPrice(tax, currency)}</span>
                </div>
              )}
              {displayOrder.delivery_fee > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>🛵 Delivery fee</span>
                  <span>{formatPrice(displayOrder.delivery_fee, currency)}</span>
                </div>
              )}
              {tip > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>💝 Tip</span>
                  <span>{formatPrice(tip, currency)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 800, color: "#12805c", borderTop: "1px solid #ddd", marginTop: 4, paddingTop: 6 }}>
                <span>Total</span><span>{formatPrice(payable, currency)}</span>
              </div>
              {amountPaid > 0 && displayOrder.payment_status !== "paid" && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>Paid so far</span>
                  <span>−{formatPrice(amountPaid, currency)}</span>
                </div>
              )}
              {displayOrder.payment_status !== "paid" && balance > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                  <span>Balance due</span>
                  <span>{formatPrice(balance, currency)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666" }}>
                <span>Payment</span>
                <span style={{ color: displayOrder.payment_status === "paid" ? "#12805c" : "#b45309" }}>{displayOrder.payment_status === "paid" ? `Paid (${displayOrder.payment_method || "—"})` : displayOrder.payment_status === "partially_paid" ? `Partially paid (${formatPrice(amountPaid, currency)} of ${formatPrice(payable, currency)})` : "Unpaid"}</span>
              </div>
            </div>
          )}

          {/* Address: below the total bill, at the bottom of the slip. */}
          {!isKot && address && (
            <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginTop: 10 }}>{address}</div>
          )}

          <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginTop: 14 }}>
            {isKot ? "— Kitchen copy —" : (
              <>Thank you for dining <svg viewBox="0 0 100 100" aria-hidden="true" style={{ height: 14, width: 14, verticalAlign: "-2px", margin: "0 1px" }}>
                {/* Plate + fork & knife, inlined (no network fetch) so it
                    never shows as a broken image — the old <img> pointed
                    at /favicon.svg and failed on a flaky connection. */}
                <g fill="#20C997">
                  <rect x="9" y="20" width="5" height="26" rx="2.5" />
                  <rect x="16" y="20" width="5" height="26" rx="2.5" />
                  <rect x="23" y="20" width="5" height="26" rx="2.5" />
                  <rect x="16" y="42" width="6" height="38" rx="3" />
                </g>
                <circle cx="50" cy="50" r="21" fill="#20C997" />
                <circle cx="50" cy="50" r="13" fill="none" stroke="#FFFFFF" strokeWidth="3" />
                <g fill="#20C997">
                  <path d="M74 20 h8 v30 l-4 6 -4 -6 z" />
                  <rect x="75" y="58" width="6" height="22" rx="3" />
                </g>
              </svg> with us!</>
            )}
          </div>
          {/* Home-delivery + complaints numbers: big, below the thank-you
              line, so a customer takes them home from any slip. Each
              number shows only when it is set. Receipt only. */}
          {!isKot && (phone1 || complaintsNum) && (
            <div style={{ textAlign: "center", marginTop: 10, borderTop: "1px dashed #ccc", paddingTop: 10 }}>
              {phone1 && (
                <div style={{ marginBottom: complaintsNum ? 10 : 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>📞 For Home Delivery, call us on:</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#111", marginTop: 4, letterSpacing: "0.5px" }}>{phone1}</div>
                </div>
              )}
              {complaintsNum && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>📞 For Complaints &amp; Inquiries, call us on:</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#111", marginTop: 4, letterSpacing: "0.5px" }}>{complaintsNum}</div>
                </div>
              )}
            </div>
          )}
          {!isKot && (
            <div style={{ textAlign: "center", fontSize: 11, color: "#888", marginTop: 4 }}>Powered by SAQLYN</div>
          )}
        </div>

        {/* One-customer discount (admin / super admin only). Outside the
            print area, so it never appears on the printed slip. */}
        {canDiscount && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#f6f6f6", border: "1px solid #ddd" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🎉 Discount for this order only</div>
            {manualDiscount > 0 ? (
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                Applied: −{formatPrice(manualDiscount, currency)}
                {displayOrder.manual_discount_by_name ? ` (by ${displayOrder.manual_discount_by_name})` : ""}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>Give this customer a one-time discount on this displayOrder.</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <select value={discType} onChange={(e) => setDiscType(e.target.value)} style={{ flex: "0 0 120px", width: 120, padding: "8px", borderRadius: 8, border: "1px solid #ccc" }}>
                <option value="percent">% Percent</option>
                <option value="flat">Amount ({currency})</option>
              </select>
              <input
                type="number" min="0" step="any" value={discValue}
                onChange={(e) => setDiscValue(e.target.value)}
                placeholder={discType === "percent" ? "e.g. 10 for 10%" : "e.g. 500"}
                style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #ccc", minWidth: 0 }}
              />
              <button
                onClick={handleApplyDiscount} disabled={discBusy}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#20C997", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                {discBusy ? "…" : "Apply"}
              </button>
            </div>
            {manualDiscount > 0 && (
              <button
                onClick={handleRemoveDiscount} disabled={discBusy}
                style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                Remove discount
              </button>
            )}
            {discError && <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 8 }}>{discError}</div>}
          </div>
        )}

        {/* Tip (cashier / admin). Outside the print area, so it never
            appears on the printed slip — the tip line shows in the bill. */}
        {canTip && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#f6f6f6", border: "1px solid #ddd" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>💝 Tip for this order</div>
            {tip > 0 && (
              <div style={{ fontSize: 13, marginBottom: 8 }}>Current tip: {formatPrice(tip, currency)}</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number" min="0" step="any" value={tipValue}
                onChange={(e) => setTipValue(e.target.value)}
                placeholder={`e.g. 100 (${currency})`}
                style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #ccc", minWidth: 0 }}
              />
              <button
                onClick={handleSetTip} disabled={tipBusy}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#20C997", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                {tipBusy ? "…" : "Set tip"}
              </button>
            </div>
            {tipError && <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 8 }}>{tipError}</div>}
          </div>
        )}

        {/* Cancel / Delete — outside the print area, so they never print.
            Only when an `actor` was passed (Order History page). */}
        {(canCancel || canDelete) && (
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            {canCancel && (
              <button
                onClick={() => runAction("cancel")} disabled={actionBusy}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: confirmAction === "cancel" ? "1px solid #b91c1c" : "1px solid #f0b429", background: confirmAction === "cancel" ? "#b91c1c" : "#fff", color: confirmAction === "cancel" ? "#fff" : "#92400e", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                {confirmAction === "cancel" ? "Confirm cancel?" : "✖️ Cancel order"}
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => runAction("delete")} disabled={actionBusy}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: confirmAction === "delete" ? "1px solid #b91c1c" : "1px solid #f0b429", background: confirmAction === "delete" ? "#b91c1c" : "#fff", color: confirmAction === "delete" ? "#fff" : "#92400e", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                {confirmAction === "delete" ? "Confirm delete?" : "🗑️ Delete order"}
              </button>
            )}
          </div>
        )}
        {actionError && <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 8 }}>{actionError}</div>}

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
