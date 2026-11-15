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

// ── Per-browser demo changes (24h) ──────────────────────────────────────
// On a DEMO restaurant, a visitor's hides and deletes live ONLY in their
// own browser (localStorage) — another visitor elsewhere still sees the
// default demo data (dishes, staff, everything we made). Each entry
// carries a timestamp and expires after 24h, so the default data returns
// on its own. Real restaurants are unaffected: they use the server-side
// soft delete (deleted flag) and real staff removal instead.
const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

function demoKey(kind, restaurantId) {
  return `saqlyn_demo_${kind}_${restaurantId}`;
}

// Read the (pruned) id -> timestamp map for one kind. Expired entries are
// dropped on read, so the default data returns automatically after 24h.
function readDemoMap(kind, restaurantId) {
  try {
    const raw = JSON.parse(localStorage.getItem(demoKey(kind, restaurantId)) || "{}");
    const now = Date.now();
    const fresh = {};
    let changed = false;
    for (const [id, ts] of Object.entries(raw)) {
      if (now - ts < DEMO_TTL_MS) fresh[id] = ts;
      else changed = true;
    }
    if (changed) localStorage.setItem(demoKey(kind, restaurantId), JSON.stringify(fresh));
    return fresh;
  } catch {
    return {};
  }
}

function saveDemoMap(kind, restaurantId, map) {
  try {
    localStorage.setItem(demoKey(kind, restaurantId), JSON.stringify(map));
  } catch {
    // No storage — the change just won't stick in this browser.
  }
}

export function getDemoHiddenDishes(restaurantId) {
  return new Set(Object.keys(readDemoMap("hidden_dishes", restaurantId)));
}

export function hideDemoDish(restaurantId, id) {
  const map = readDemoMap("hidden_dishes", restaurantId);
  map[id] = Date.now();
  saveDemoMap("hidden_dishes", restaurantId, map);
}

export function unhideDemoDish(restaurantId, id) {
  const map = readDemoMap("hidden_dishes", restaurantId);
  delete map[id];
  saveDemoMap("hidden_dishes", restaurantId, map);
}

export function getDemoRemovedStaff(restaurantId) {
  return new Set(Object.keys(readDemoMap("removed_staff", restaurantId)));
}

export function removeDemoStaff(restaurantId, id) {
  const map = readDemoMap("removed_staff", restaurantId);
  map[id] = Date.now();
  saveDemoMap("removed_staff", restaurantId, map);
}

export function restoreDemoStaff(restaurantId, id) {
  const map = readDemoMap("removed_staff", restaurantId);
  delete map[id];
  saveDemoMap("removed_staff", restaurantId, map);
}
