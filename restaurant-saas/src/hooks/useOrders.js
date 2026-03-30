/**
 * useOrders — real-time order subscriptions with filtering
 */
import { useState, useEffect } from "react";
import { subscribeToOrders } from "../config/db";

export function useOrders(restaurantId, filters = {}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    const unsub = subscribeToOrders(restaurantId, (data) => {
      setOrders(data);
      setLoading(false);
    }, filters);
    return unsub;
  }, [restaurantId, JSON.stringify(filters)]);

  return { orders, loading };
}

export function useActiveOrders(restaurantId) {
  return useOrders(restaurantId, {
    status: ["pending", "confirmed", "preparing", "ready"],
  });
}

export function useTodayStats(orders) {
  const today = new Date().toDateString();
  const todayOrders = orders.filter(o =>
    o.created_at?.toDate?.()?.toDateString?.() === today
  );
  const revenue = todayOrders
    .filter(o => o.payment_status === "paid")
    .reduce((s, o) => s + (o.total || 0), 0);
  const pending = todayOrders.filter(o =>
    ["pending","confirmed","preparing"].includes(o.status)
  ).length;

  return { todayOrders, revenue, pending };
}
