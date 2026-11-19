// Serving order (FIFO): whoever booked first is served first.
// The kitchen rushes add-on orders while MAKING them, but SERVING is
// strictly first-booked-first-served — the add-on flag never changes it.

// Milliseconds since the order was booked, for sorting. Orders without a
// usable date sort LAST — they never jump the queue.
export function orderBookedMs(order) {
  const c = order?.created_at;
  if (!c) return Number.POSITIVE_INFINITY;
  if (typeof c.toDate === "function") return c.toDate().getTime();
  if (typeof c === "number") return c;
  const t = Date.parse(c);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// Oldest booked first — the serving order for ready orders.
export function sortByBookedAt(a, b) {
  return orderBookedMs(a) - orderBookedMs(b);
}

// Display order for the orders list (his 2026-11-19 order): paid +
// verified orders sink to the BOTTOM; every other order stays on top in
// time order (newest first). As each order's payment is done and
// verified, it drops down the list on its own, and only the unpaid /
// active orders remain on top.
export function sortOrdersForDisplay(orders) {
  const isPaid = (o) => o.payment_status === "paid" && o.status !== "cancelled";
  const t = (o) => {
    const ms = orderBookedMs(o);
    return Number.isFinite(ms) ? ms : 0;
  };
  return [...(orders || [])].sort((a, b) => {
    const pa = isPaid(a) ? 1 : 0;
    const pb = isPaid(b) ? 1 : 0;
    if (pa !== pb) return pa - pb; // unpaid first, paid last
    return t(b) - t(a); // newest first within each group
  });
}

// Kitchen making order: add-on orders first (rushed while cooking), then
// oldest booked first within each group.
export function sortForMaking(a, b) {
  const d = Number(b.is_addon === true) - Number(a.is_addon === true);
  return d !== 0 ? d : orderBookedMs(a) - orderBookedMs(b);
}
