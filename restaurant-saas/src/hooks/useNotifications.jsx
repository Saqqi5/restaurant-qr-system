/**
 * useNotifications
 * ════════════════
 * Plays an audio alert and shows a toast whenever a new order arrives in
 * real-time — EVERY kind of order, whatever its source (his 2026-11-19
 * order): a customer scanning the QR code, a waiter placing it through
 * Order Taker, or a home-delivery order. The kitchen, cashier, waiter
 * and admin all hear it, so the kitchen can start preparing at once.
 *
 *   Kitchen:  useNotifications(restaurantId, true, { persistent: true })
 *             — the alert stays on screen until the kitchen taps it away
 *               or starts the order (status leaves "pending"), and the
 *               beep repeats 3 times so it cuts through kitchen noise.
 *   Cashier:  useNotifications(restaurantId) — new order ping + toast.
 *   Waiter:   useNotifications(restaurantId, true, { onReady: true, onWaiterCall: true })
 *             — also a toast when an order becomes READY, with its table,
 *               and a loud persistent alert (table number + ~5.5s tone)
 *               the moment a customer taps "Call Waiter".
 *   Cashier + admin: pass { onServed: true } — a toast the moment an
 *             order is SERVED and its payment is still pending, so the
 *             counter knows which tables owe money.
 *   Admin:    useNotifications(restaurantId) — same new-order alert.
 *
 * Usage:
 *   const { toasts, dismiss } = useNotifications(restaurantId);
 *   const { toasts, dismiss } = useNotifications(restaurantId, true, { onReady: true });
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { subscribeToOrders, subscribeToWaiterCalls } from "../config/db";

// Tiny Web Audio API beep — no asset file needed. `times` repeats the
// beep (a kitchen is noisy — one short beep is easy to miss).
function playPing(times = 1) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const t0 = ctx.currentTime + i * 0.35;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, t0);
      osc.frequency.exponentialRampToValueAtTime(440, t0 + 0.15);
      gain.gain.setValueAtTime(0.3, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    }
  } catch (_) {
    // Audio not available in some contexts — silent fail
  }
}

// Waiter-call alarm — a two-tone alert that sounds for ~5.5 seconds
// (his 2026-11-20 order: the tone must last at least 5 seconds), so a
// waiter who stepped away from the screen still hears the call. 11 beeps,
// 0.5s apart, alternating 880/660 Hz; the last beep ends at ~5.45s.
function playWaiterAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 11; i++) {
      const t0 = ctx.currentTime + i * 0.5;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, t0);
      gain.gain.setValueAtTime(0.35, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    }
  } catch (_) {
    // Audio not available in some contexts — silent fail
  }
}

let toastId = 0;

// One line per order source — the kitchen must know WHERE the order came
// from at a glance. Delivery orders have no table number (never "Table
// null" — that was a bug). When a branch name is passed in
// options.restaurantNames, it is appended, so the toast says WHICH
// branch the order belongs to.
function newOrderMessage(order, branchName) {
  const suffix = branchName ? ` • ${branchName}` : "";
  if (order.order_type === "delivery") return `🔔 New delivery order${suffix}`;
  const table = `Table ${order.table_number}`;
  return String(order.created_by || "").startsWith("cust_")
    ? `🔔 New customer order — ${table}${suffix}`
    : `🔔 New order — ${table}${suffix}`;
}

export function useNotifications(target, enabled = true, options = {}) {
  // target: one restaurant id, or an array of ids. options.restaurantNames
  // maps id → branch name for the toast.
  const ids = Array.isArray(target) ? target.filter(Boolean) : (target ? [target] : []);
  const idsKey = ids.join(",");
  const names = options.restaurantNames || {};
  const [toasts, setToasts] = useState([]);
  const knownIds = useRef(new Set());
  // Last status seen per order — so a status flip to "ready" is caught
  // exactly once (the waiter needs "Table X order is ready"), and so a
  // kitchen toast can be cleared the moment the order is started.
  const knownStatus = useRef(new Map());
  // Toast id shown for each pending order — when the kitchen starts the
  // order (status leaves "pending"), its alert goes away by itself.
  const toastByOrder = useRef(new Map());
  // Restaurants whose first snapshot has already been recorded (per id —
  // when several are subscribed at once, each one's first load must stay
  // silent, not notify for its old orders).
  const initializedIds = useRef(new Set());
  // Waiter calls — same pattern, separate sets: a call's toast must clear
  // the moment it is acknowledged or marked done, and old pending calls
  // must not re-alert when the waiter logs in.
  const knownCallIds = useRef(new Set());
  const knownCallStatus = useRef(new Map());
  const toastByCall = useRef(new Map());
  const initializedCallIds = useRef(new Set());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = "info", opts = {}) => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]); // max 5 toasts
    if (type === "order") playPing(3); // 3 beeps — a kitchen is noisy
    else if (type === "served") playPing(2); // served + unpaid = money owed
    else if (type === "ready") playPing();
    else if (type === "waiter") playWaiterAlert(); // ~5.5s alarm — a table is calling
    // A kitchen alert stays until the kitchen taps it away or starts the
    // order. Everywhere else it goes away after 6 seconds.
    if (!opts.persistent) setTimeout(() => dismiss(id), 6000);
    return id;
  }, [dismiss]);

  useEffect(() => {
    if (!ids.length || !enabled) return;

    const handleOrders = (orders, rid) => {
      // On first load, just record existing IDs + statuses — don't notify
      if (!initializedIds.current.has(rid)) {
        orders.forEach((o) => { knownIds.current.add(o.id); knownStatus.current.set(o.id, o.status); });
        initializedIds.current.add(rid);
        return;
      }

      orders.forEach((order) => {
        const prevStatus = knownStatus.current.get(order.id);
        if (!knownIds.current.has(order.id)) {
          // Brand-new order — only a pending one needs acting on. EVERY
          // source counts: QR customer, staff Order Taker, delivery.
          knownIds.current.add(order.id);
          knownStatus.current.set(order.id, order.status);
          if (order.status === "pending") {
            const id = addToast(newOrderMessage(order, names[rid]), "order", {
              persistent: options.persistent === true,
            });
            toastByOrder.current.set(order.id, id);
          }
        } else {
          // Status changed on a known order.
          if (prevStatus === "pending" && order.status !== "pending") {
            // Somebody started this order (confirmed / preparing / ready /
            // served) — its new-order alert has done its job, clear it.
            const toast = toastByOrder.current.get(order.id);
            if (toast) { dismiss(toast); toastByOrder.current.delete(order.id); }
          }
          if (options.onServed && prevStatus !== "served" && order.status === "served" && order.payment_status !== "paid") {
            // Just served and still unpaid — the counter + admin must know
            // this table owes money (his 2026-11-19 order). Already-paid
            // orders stay silent.
            addToast(
              order.order_type === "delivery"
                ? "⏳ Delivery order served — payment pending"
                : `⏳ Table ${order.table_number} served — payment pending`,
              "served"
            );
          } else if (options.onReady && prevStatus !== "ready" && order.status === "ready") {
            // This order just became ready — the waiter must know which table.
            addToast(
              order.order_type === "delivery"
                ? "✅ Delivery order is ready"
                : `✅ Table ${order.table_number} order is ready`,
              "ready"
            );
          }
          knownStatus.current.set(order.id, order.status);
        }
      });
    };

    const unsubs = ids.map((id) => subscribeToOrders(id, (orders) => handleOrders(orders, id)));
    return () => unsubs.forEach((u) => u && u());
  }, [idsKey, enabled, addToast, dismiss, options.onReady, options.onServed, options.persistent]);

  // ── Waiter calls (his 2026-11-20 order) ──────────────────────────────
  // When a customer taps "Call Waiter", the waiter gets a loud, persistent
  // alert with the table number + a tone that lasts at least 5 seconds.
  // First snapshot per restaurant is silent (old pending calls don't
  // re-alert on login); a call's toast clears the moment it is
  // acknowledged or marked done, so the waiter only hears live calls.
  useEffect(() => {
    if (!ids.length || !enabled || !options.onWaiterCall) return;

    const handleCalls = (calls, rid) => {
      if (!initializedCallIds.current.has(rid)) {
        calls.forEach((c) => { knownCallIds.current.add(c.id); knownCallStatus.current.set(c.id, c.status); });
        initializedCallIds.current.add(rid);
        return;
      }
      calls.forEach((call) => {
        const prevStatus = knownCallStatus.current.get(call.id);
        if (!knownCallIds.current.has(call.id)) {
          knownCallIds.current.add(call.id);
          knownCallStatus.current.set(call.id, call.status);
          if (call.status === "pending") {
            const suffix = names[rid] ? ` • ${names[rid]}` : "";
            const id = addToast(`🙋 Table ${call.table_number} called a waiter${suffix}`, "waiter", { persistent: true });
            toastByCall.current.set(call.id, id);
          }
        } else {
          if (prevStatus === "pending" && call.status !== "pending") {
            const toast = toastByCall.current.get(call.id);
            if (toast) { dismiss(toast); toastByCall.current.delete(call.id); }
          }
          knownCallStatus.current.set(call.id, call.status);
        }
      });
    };

    const unsubs = ids.map((id) => subscribeToWaiterCalls(id, (calls) => handleCalls(calls, id)));
    return () => unsubs.forEach((u) => u && u());
  }, [idsKey, enabled, addToast, dismiss, options.onWaiterCall]);

  return { toasts, dismiss, addToast };
}

/**
 * ToastContainer — drop this anywhere in a dashboard layout
 *
 * <ToastContainer toasts={toasts} onDismiss={dismiss} />
 */
export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 999,
      display: "flex", flexDirection: "column", gap: 10,
      maxWidth: 320,
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          style={{
            background: "#1a1a1a",
            border: `1px solid ${t.type === "order" ? "#e85d04" : t.type === "served" ? "#e05252" : t.type === "waiter" ? "#ff6b35" : "#333"}`,
            borderLeft: `4px solid ${t.type === "order" ? "#e85d04" : t.type === "served" ? "#e05252" : t.type === "waiter" ? "#ff6b35" : "#4a90d9"}`,
            color: "#f0f0f0", padding: "12px 16px",
            borderRadius: 10, fontSize: 13, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            animation: "toastIn 0.25s ease",
          }}
        >
          {t.message}
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            Click to dismiss
          </div>
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
