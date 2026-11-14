/**
 * useNotifications
 * ════════════════
 * Plays an audio ping and shows a toast whenever a new "pending" order
 * arrives in real-time. Used on Kitchen and Server dashboards.
 *
 * Usage:
 *   const { toasts, dismiss } = useNotifications(restaurantId);
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { subscribeToOrders } from "../config/db";

// Tiny Web Audio API beep — no asset file needed
function playPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) {
    // Audio not available in some contexts — silent fail
  }
}

let toastId = 0;

export function useNotifications(restaurantId, enabled = true) {
  const [toasts, setToasts] = useState([]);
  const knownIds = useRef(new Set());
  const initialized = useRef(false);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]); // max 5 toasts
    if (type === "order") playPing();
    // Auto-dismiss after 6 seconds
    setTimeout(() => dismiss(id), 6000);
  }, [dismiss]);

  useEffect(() => {
    if (!restaurantId || !enabled) return;

    const unsub = subscribeToOrders(restaurantId, (orders) => {
      // On first load, just record existing IDs — don't notify
      if (!initialized.current) {
        orders.forEach((o) => knownIds.current.add(o.id));
        initialized.current = true;
        return;
      }

      orders.forEach((order) => {
        if (!knownIds.current.has(order.id) && order.status === "pending") {
          knownIds.current.add(order.id);
          addToast(`🔔 New order — Table ${order.table_number}`, "order");
        }
      });
    });

    return unsub;
  }, [restaurantId, enabled, addToast]);

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
            background: t.type === "order" ? "#1a1a1a" : "#222",
            border: `1px solid ${t.type === "order" ? "#e85d04" : "#333"}`,
            borderLeft: `4px solid ${t.type === "order" ? "#e85d04" : "#4a90d9"}`,
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
