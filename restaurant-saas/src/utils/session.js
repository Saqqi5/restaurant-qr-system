// Per-browser customer identity, used for table reservation.
//
// The customer who scans a table QR and places an order reserves that
// table until the order is paid and closed. Another browser (another
// customer) scanning the same table then sees it as reserved. The id is
// stored in localStorage so the same customer keeps their table across
// reloads; a different phone/browser is a different customer.
// Staff orders (created_by = staff uid or "server") never reserve a table.
const KEY = "saqlyn_customer_session";

export function getCustomerSessionId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = "cust_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // No storage available (private mode, etc.) — fall back to a
    // per-load id. The table will not be recognised as theirs on a
    // reload, but ordering still works.
    return "cust_fallback_" + Math.random().toString(36).slice(2, 10);
  }
}
