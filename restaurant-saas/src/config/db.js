/**
 * DATABASE SCHEMA & COLLECTION REFERENCES
 * ========================================
 *
 * Firestore Structure:
 *
 * restaurants/{restaurantId}
 *   - name, slug, logo_url, table_count, custom_domain,
 *     theme, created_at, active, plan
 *
 * restaurants/{restaurantId}/menu/{itemId}
 *   - name, description, price, category, image_url,
 *     available, prep_time_minutes, sort_order, created_at
 *
 * restaurants/{restaurantId}/orders/{orderId}
 *   - table_number, items, status, total, payment_status,
 *     payment_method, created_at, updated_at, estimated_ready,
 *     notes, created_by
 *
 * users/{userId}
 *   - email, name, role, restaurant_id, created_at, active
 *
 * payments/{paymentId}           ← top-level collection
 *   - restaurantId, tableNumber, orderId, amount, items,
 *     status ("pending" | "verified"), screenshotUrl,
 *     createdAt, verifiedAt
 *
 * domain_mappings/{domain}
 *   - restaurant_id, verified, created_at
 */

import { expiryDateFrom, demoExpiryDateFrom, paidExpiryDateFrom } from "./plans";
import { DEMO_MENU_SEED } from "./demoMenuSeed";

import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, onSnapshot,
  serverTimestamp, Timestamp, arrayUnion, arrayRemove
} from "firebase/firestore";
import { db } from "./firebase";

// ── Collection References ──────────────────────────────────────────────────

export const restaurantsCol = () => collection(db, "restaurants");
export const restaurantDoc = (id) => doc(db, "restaurants", id);
export const menuCol = (restaurantId) => collection(db, "restaurants", restaurantId, "menu");
export const menuItemDoc = (restaurantId, itemId) => doc(db, "restaurants", restaurantId, "menu", itemId);
export const ordersCol = (restaurantId) => collection(db, "restaurants", restaurantId, "orders");
export const orderDoc = (restaurantId, orderId) => doc(db, "restaurants", restaurantId, "orders", orderId);
export const usersCol = () => collection(db, "users");
export const userDoc = (userId) => doc(db, "users", userId);
export const paymentsCol = () => collection(db, "payments");
export const paymentDoc = (paymentId) => doc(db, "payments", paymentId);
export const planPaymentsCol = () => collection(db, "plan_payments");
export const planPaymentDoc = (paymentId) => doc(db, "plan_payments", paymentId);
export const signupRequestsCol = () => collection(db, "signup_requests");
export const signupRequestDoc = (requestId) => doc(db, "signup_requests", requestId);
export const demoLeadsCol = () => collection(db, "demo_leads");
export const demoLeadDoc = (leadId) => doc(db, "demo_leads", leadId);
export const domainMappingsCol = () => collection(db, "domain_mappings");

// ── Restaurant Operations ──────────────────────────────────────────────────

export async function createRestaurant(data) {
  const ref = doc(restaurantsCol());
  const restaurant = {
    id: ref.id,
    name: data.name,
    slug: data.slug || slugify(data.name),
    logo_url: data.logo_url || null,
    // Currency is picked by the super admin at creation (default "$") and
    // changeable later in the Edit modal; address prints on the receipt.
    currency: data.currency || "$",
    address: data.address || "",
    table_count: data.table_count || 10,
    custom_domain: data.custom_domain || null,
    theme: data.theme || { primary: "#20C997", accent: "#0F3D3E", font: "modern" },
    created_at: serverTimestamp(),
    active: true,
    plan: data.plan || "basic",
    // Every new restaurant starts with a 7-day free trial, on any plan.
    // At expiry the login is blocked until the super admin continues the
    // plan (see continuePlan).
    plan_expires_at: Timestamp.fromDate(expiryDateFrom(new Date())),
  };
  await setDoc(ref, restaurant);
  return { id: ref.id, ...restaurant };
}

// Super admin, one click: extend the plan by another 30 days and clear
// any expiry block (the new plan_expires_at is what unblocks the login).
export async function continuePlan(restaurantId) {
  await updateDoc(restaurantDoc(restaurantId), {
    plan_expires_at: Timestamp.fromDate(paidExpiryDateFrom(new Date())),
    updated_at: serverTimestamp(),
  });
}

// Super admin, one click: lend a restaurant as a 7-day demo. The staff
// logins work for 7 days; at expiry they block until the super admin
// continues the plan or re-starts the demo for the next prospect.
export async function startDemo(restaurantId) {
  await updateDoc(restaurantDoc(restaurantId), {
    plan_expires_at: Timestamp.fromDate(demoExpiryDateFrom(new Date())),
    updated_at: serverTimestamp(),
  });
}

export async function updateRestaurant(restaurantId, data) {
  await updateDoc(restaurantDoc(restaurantId), { ...data, updated_at: serverTimestamp() });
}

// Freeze / unfreeze a whole restaurant (super admin only — the rules block
// a general admin from changing is_frozen). Frozen: every staff login of
// that restaurant is blocked and the public menu hides. Unfreezing restores
// everything at once.
export async function setRestaurantFrozen(restaurantId, frozen) {
  await updateDoc(restaurantDoc(restaurantId), { is_frozen: frozen, updated_at: serverTimestamp() });
}

// ── Platform Settings (super admin) ────────────────────────────────────────
// Doc `platform_settings/platform`: { basic, standard, premium } — the
// table cap per plan (Premium 50) plus { *_staff } staff caps,
// { *_menu } menu-item caps (0 = unlimited) and { *_price } monthly prices
// (PKR), plus the platform's own payment accounts (platform_easypaisa_*,
// platform_jazzcash_*, platform_bank_*) that owners pay into when they buy
// a plan. Absent doc = defaults.
export const platformSettingsDoc = () => doc(db, "platform_settings", "platform");

export async function getPlatformSettings() {
  const snap = await getDoc(platformSettingsDoc());
  return snap.exists() ? snap.data() : null;
}

export function subscribeToPlatformSettings(callback) {
  return onSnapshot(platformSettingsDoc(), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function updatePlatformSettings(data) {
  await setDoc(platformSettingsDoc(), { ...data, updated_at: serverTimestamp() }, { merge: true });
}

// ── Delete Restaurant (super admin) ────────────────────────────────────────
// The client SDK has no recursive delete, so the menu + orders
// subcollections, the restaurant's payments and its domain mapping are
// removed explicitly before the restaurant doc itself. Staff Auth accounts
// and their `users` records are left alone (the super admin can remove
// them from Staff if needed).
export async function deleteRestaurant(restaurantId) {
  const restaurant = await getRestaurant(restaurantId);
  for (const colFn of [menuCol, ordersCol]) {
    const snap = await getDocs(colFn(restaurantId));
    for (const d of snap.docs) await deleteDoc(d.ref);
  }
  const pays = await getDocs(query(paymentsCol(), where("restaurantId", "==", restaurantId)));
  for (const d of pays.docs) await deleteDoc(d.ref);
  const planPays = await getDocs(query(planPaymentsCol(), where("restaurantId", "==", restaurantId)));
  for (const d of planPays.docs) await deleteDoc(d.ref);
  if (restaurant?.custom_domain) {
    await deleteDoc(doc(domainMappingsCol(), restaurant.custom_domain));
  }
  await deleteDoc(restaurantDoc(restaurantId));
}

// Reset a DEMO restaurant after visitors have played with it: delete all
// its orders, payment proofs and plan payments, then restore its menu to
// the original seed (DEMO_MENU_SEED). The restaurant doc itself is NOT
// touched — plan, tables, settings and any demo expiry stay as they are.
// Super-admin only (enforced by the caller's dashboard, not by rules).
export async function resetDemoRestaurant(restaurantId) {
  const seed = DEMO_MENU_SEED[restaurantId];
  if (!seed) throw new Error("No demo menu snapshot for this restaurant.");
  for (const colFn of [menuCol, ordersCol]) {
    const snap = await getDocs(colFn(restaurantId));
    for (const d of snap.docs) await deleteDoc(d.ref);
  }
  const pays = await getDocs(query(paymentsCol(), where("restaurantId", "==", restaurantId)));
  for (const d of pays.docs) await deleteDoc(d.ref);
  const planPays = await getDocs(query(planPaymentsCol(), where("restaurantId", "==", restaurantId)));
  for (const d of planPays.docs) await deleteDoc(d.ref);
  for (const item of seed) {
    await setDoc(menuItemDoc(restaurantId, item.id), item);
  }
}

export async function getRestaurant(restaurantId) {
  const snap = await getDoc(restaurantDoc(restaurantId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Demo auto-cleanup (website rule, no outside task) ────────────────────
// Visitor-added dishes on a demo restaurant expire after 24 hours. The
// website enforces this itself in two places:
//   1. isExpiredDemoItem() — every menu view (customer, waiter, admin)
//      hides expired visitor dishes, so the default demo menu shows even
//      before any delete runs.
//   2. cleanupExpiredDemoItems() — the demo admin's dashboard deletes the
//      expired docs for real when it opens (the menu write rule lets the
//      restaurant's own general admin delete menu docs).
// Seeded dishes are never touched, and an item with no created_at is never
// hidden or deleted. Orders/payments are NOT auto-deleted here: only the
// super admin may delete those (rules), so they still clear via the
// super-admin "Reset demo" button.
export const DEMO_AUTO_CLEANUP_HOURS = 24;

function demoSeedIds(restaurantId) {
  const seed = DEMO_MENU_SEED[restaurantId];
  return seed ? new Set(seed.map((s) => s.id)) : null;
}

function demoItemCreatedMs(item) {
  return item?.created_at?.toDate?.()?.getTime?.() ?? null;
}

export function isExpiredDemoItem(restaurantId, item) {
  const seedIds = demoSeedIds(restaurantId);
  if (!seedIds) return false;
  if (seedIds.has(item.id)) return false;
  const created = demoItemCreatedMs(item);
  if (!created) return false;
  return created < Date.now() - DEMO_AUTO_CLEANUP_HOURS * 60 * 60 * 1000;
}

export async function cleanupExpiredDemoItems(restaurantId) {
  const seedIds = demoSeedIds(restaurantId);
  if (!seedIds) return 0;
  const snap = await getDocs(menuCol(restaurantId));
  const cutoff = Date.now() - DEMO_AUTO_CLEANUP_HOURS * 60 * 60 * 1000;
  let n = 0;
  for (const d of snap.docs) {
    if (seedIds.has(d.id)) continue;
    const created = demoItemCreatedMs(d.data());
    if (created && created < cutoff) {
      await deleteDoc(d.ref);
      n++;
    }
  }
  return n;
}

export async function getAllRestaurants() {
  const snap = await getDocs(restaurantsCol());
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Homepage directory: ONLY the sample demo restaurants (is_demo). Real
// customer restaurants must never appear on the public homepage — they
// are reached only through their own QR codes / direct links. A frozen
// demo is hidden too (its menu shows "unavailable" anyway).
export async function getDemoRestaurants() {
  const snap = await getDocs(query(restaurantsCol(), where("is_demo", "==", true)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.is_frozen !== true);
}

export function subscribeToRestaurant(restaurantId, callback) {
  return onSnapshot(restaurantDoc(restaurantId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// ── Menu Operations ────────────────────────────────────────────────────────

export async function createMenuItem(restaurantId, data) {
  const ref = doc(menuCol(restaurantId));
  const item = {
    id: ref.id,
    name: data.name,
    description: data.description || "",
    price: parseFloat(data.price),
    category: data.category || "Uncategorized",
    image_url: data.image_url || null,
    available: data.available !== false,
    deleted: false,
    prep_time_minutes: parseInt(data.prep_time_minutes) || 15,
    sort_order: data.sort_order || 999,
    created_at: serverTimestamp(),
  };
  await setDoc(ref, item);
  return item;
}

export async function updateMenuItem(restaurantId, itemId, data) {
  await updateDoc(menuItemDoc(restaurantId, itemId), data);
}

// Soft delete: hiding a dish only flips a flag — the document stays in
// Firestore so it can be restored and is never lost. Nothing in the app
// hard-deletes a menu item any more (the super-admin "Reset demo" still
// wipes + reseeds a demo restaurant, and deleting a whole restaurant
// removes its menu with it).
export async function deleteMenuItem(restaurantId, itemId) {
  await updateDoc(menuItemDoc(restaurantId, itemId), {
    deleted: true,
    deleted_at: serverTimestamp(),
  });
}

export async function restoreMenuItem(restaurantId, itemId) {
  await updateDoc(menuItemDoc(restaurantId, itemId), {
    deleted: false,
    deleted_at: null,
  });
}

// Natural menu flow for category tabs — starters first, drinks last.
// Categories not in this list (a restaurant's custom ones) come after,
// alphabetical among themselves. sort_order still orders dishes within
// a category. (Previous behaviour sorted categories alphabetically, so
// Bella opened on Beverages instead of Starters.)
export const CATEGORY_ORDER = [
  "Starters", "BBQ", "Desi", "Pasta", "Pizza", "Breads",
  "Desserts", "Beverages",
];

export function categoryRank(category) {
  const idx = CATEGORY_ORDER.indexOf(category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

export function sortMenuItems(items) {
  return [...items].sort((a, b) => {
    const ra = categoryRank(a.category), rb = categoryRank(b.category);
    if (ra !== rb) return ra - rb;
    if (ra === CATEGORY_ORDER.length && a.category !== b.category) {
      return a.category < b.category ? -1 : 1;
    }
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

// A restaurant may set its own category order in Settings
// (menu_category_order on the restaurant doc). Listed categories come
// first in that order; the rest follow CATEGORY_ORDER, then their
// first-appearance order (Array.sort is stable, so ties keep it).
export function sortCategories(categories, restaurant) {
  const custom = Array.isArray(restaurant?.menu_category_order)
    ? restaurant.menu_category_order
    : [];
  const rank = (c) => {
    const ci = custom.indexOf(c);
    if (ci !== -1) return ci;
    const oi = CATEGORY_ORDER.indexOf(c);
    return oi === -1 ? custom.length + CATEGORY_ORDER.length : custom.length + oi;
  };
  return [...categories].sort((a, b) => rank(a) - rank(b));
}

export function subscribeToMenu(restaurantId, callback) {
  return onSnapshot(menuCol(restaurantId), (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(sortMenuItems(items));
  });
}

// ── Order Operations ───────────────────────────────────────────────────────

export async function createOrder(restaurantId, data) {
  const sanitizedItems = sanitizeOrderItems(data.items);
  if (sanitizedItems.length === 0) {
    throw new Error("Cannot create an order without at least one valid item.");
  }

  // Billing: tax + discount rates come from the restaurant's settings (0 if unset).
  // A time-limited promo (Settings → Discount Promo) replaces the regular
  // discount rate while it is active — see getEffectiveDiscount below.
  let taxRate = 0, discountRate = 0, discountAmount = 0, promoApplied = false;
  try {
    const r = await getRestaurant(restaurantId);
    taxRate = Number(r?.tax_rate) || 0;
    const eff = getEffectiveDiscount(r);
    discountRate = eff.rate;
    discountAmount = eff.amount;
    promoApplied = eff.active;
  } catch { /* keep 0 — bill without tax/discount */ }
  const bill = calculateBill(sanitizedItems, taxRate, discountRate, discountAmount);

  // Home delivery: no table (table_number 0), a flat delivery fee added
  // AFTER tax (fees are not taxed), and the customer's contact + address
  // on the order so the kitchen and the rider know where it goes.
  const isDelivery = data.order_type === "delivery";
  const deliveryFee = isDelivery ? Math.max(0, Number(data.delivery_fee) || 0) : 0;

  // Sequential order number for today (KOT / receipt friendly). Falls back
  // to null when the count query can't run (e.g. rules not yet published).
  let orderNumber = null;
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const snap = await getDocs(query(ordersCol(restaurantId), where("created_at", ">=", Timestamp.fromDate(start))));
    orderNumber = snap.size + 1;
  } catch { /* leave null */ }

  const prepTime = Math.max(...sanitizedItems.map(i => i.prep_time_minutes || 15));
  const estimatedReady = Timestamp.fromDate(new Date(Date.now() + prepTime * 60000));

  const ref = doc(ordersCol(restaurantId));
  const order = {
    id: ref.id,
    table_number: isDelivery ? 0 : parseInt(data.table_number, 10),
    items: sanitizedItems,
    status: "pending",
    subtotal: bill.subtotal,
    discount_amount: bill.discount,
    discount_rate: discountRate,
    promo_applied: promoApplied,
    tax_amount: bill.tax,
    tax_rate: taxRate,
    total: Number((bill.total + deliveryFee).toFixed(2)),
    order_number: orderNumber,
    payment_status: "unpaid",
    payment_method: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    estimated_ready: estimatedReady,
    notes: (data.notes || "").trim(),
    created_by: data.created_by || "customer",
    // Order type: "dine_in" (table) or "delivery" (home). Delivery orders
    // carry the customer + address; dine-in orders leave them blank.
    order_type: isDelivery ? "delivery" : "dine_in",
    customer_name: isDelivery ? String(data.customer_name || "").trim() : "",
    customer_phone: isDelivery ? String(data.customer_phone || "").trim() : "",
    delivery_address: isDelivery ? String(data.delivery_address || "").trim() : "",
    delivery_fee: deliveryFee,
    // Add-on order: the table already had an active (unpaid) order when
    // this one was placed, so the kitchen serves it on priority.
    is_addon: data.is_addon === true,
  };
  await setDoc(ref, order);
  return order;
}

export async function updateOrderStatus(restaurantId, orderId, status) {
  await updateDoc(orderDoc(restaurantId, orderId), {
    status,
    updated_at: serverTimestamp(),
  });
}

// Soft-cancel an order: it stays in Firestore with status "cancelled"
// (plus who cancelled it and when), so the daily history stays complete —
// nothing is ever hard-deleted. Who may cancel is enforced in the app
// (server: only while the order is still pending; kitchen / cashier /
// admin: after the kitchen has confirmed it) and in firestore.rules
// (the server may only cancel a pending order).
export async function cancelOrder(restaurantId, orderId, by) {
  await updateDoc(orderDoc(restaurantId, orderId), {
    status: "cancelled",
    cancelled_by: by?.uid || null,
    cancelled_by_name: by?.name || null,
    cancelled_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

export async function updatePaymentStatus(restaurantId, orderId, paymentMethod) {
  // Payment state and kitchen stage are separate: only the payment fields
  // change here. Setting status: "paid" used to drop the order out of the
  // kitchen kanban and the server's active list, so paid food never got made.
  await updateDoc(orderDoc(restaurantId, orderId), {
    payment_status: "paid",
    payment_method: paymentMethod,
    updated_at: serverTimestamp(),
  });
}

export function subscribeToOrders(restaurantId, callback, filters = {}) {
  return onSnapshot(ordersCol(restaurantId), (snap) => {
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (filters.status) {
      items = items.filter(o => filters.status.includes(o.status));
    }
    items.sort((a, b) => {
      const ta = a.created_at?.seconds ?? 0;
      const tb = b.created_at?.seconds ?? 0;
      return tb - ta;
    });
    callback(items);
  });
}

export function subscribeToTableOrders(restaurantId, tableNumber, callback) {
  const tableNum = parseInt(tableNumber, 10);
  // Today's orders for this table, any payment status — a paid order must
  // stay visible to the customer (with its receipt); only unpaid ones are
  // payable. A missing created_at (pending server write) counts as today,
  // so a just-placed order never flickers out of the list.
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayStartSec = Math.floor(dayStart.getTime() / 1000);
  return onSnapshot(ordersCol(restaurantId), (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(o => o.table_number === tableNum && (o.created_at?.seconds ?? dayStartSec) >= dayStartSec)
      .sort((a, b) => {
        const ta = a.created_at?.seconds ?? 0;
        const tb = b.created_at?.seconds ?? 0;
        return tb - ta;
      });
    callback(items);
  });
}

// A delivery customer's own orders: there is no table to track, so the
// session id is the key. Today's orders only (same day window as the
// table orders, so yesterday's orders never linger in "My Orders").
export function subscribeToSessionOrders(restaurantId, sessionId, callback) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayStartSec = Math.floor(dayStart.getTime() / 1000);
  return onSnapshot(ordersCol(restaurantId), (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(o => o.created_by === sessionId && (o.created_at?.seconds ?? dayStartSec) >= dayStartSec)
      .sort((a, b) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0));
    callback(items);
  });
}

// ── Payment Operations ─────────────────────────────────────────────────────

export async function createPayment(data) {
  const ref = doc(paymentsCol());
  const payment = {
    id: ref.id,
    restaurantId: data.restaurantId,
    tableNumber: parseInt(data.tableNumber, 10),
    // "dine_in" or "delivery" — the cash counter shows 🛵 Delivery for a
    // delivery payment (tableNumber 0) instead of a table number.
    orderType: data.orderType || "dine_in",
    orderId: data.orderId || null,
    method: data.method || "easypaisa",
    orderIds: data.orderIds || (data.orderId ? [data.orderId] : []),
    amount: parseFloat(data.amount),
    items: data.items || [],
    status: "pending",
    screenshotUrl: data.screenshotUrl || null,
    createdAt: serverTimestamp(),
    verifiedAt: null,
  };
  await setDoc(ref, payment);
  return payment;
}

export async function verifyPayment(payment) {
  await updateDoc(paymentDoc(payment.id), {
    status: "verified",
    verifiedAt: serverTimestamp(),
  });
  // Mark every order this payment covers as paid — without this the order
  // stays "unpaid" forever (revenue, Paid Orders and the receipt never update).
  const ids = payment.orderIds?.length
    ? payment.orderIds
    : payment.orderId
      ? [payment.orderId]
      : [];
  for (const orderId of ids) {
    await updatePaymentStatus(payment.restaurantId, orderId, payment.method || "online");
  }
}

export function subscribeToPayment(paymentId, callback) {
  return onSnapshot(paymentDoc(paymentId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export function subscribeToRestaurantPayments(restaurantId, callback) {
  return onSnapshot(
    query(paymentsCol(), where("restaurantId", "==", restaurantId)),
    (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      callback(items);
    }
  );
}

// ── Plan Payments (owner buys a plan, super admin verifies) ──────────────
// An owner picks a plan in Settings, pays the platform's account
// (EasyPaisa/JazzCash/Bank) and uploads the proof screenshot. The super
// admin verifies it — and only then the plan activates: the restaurant's
// plan switches and a fresh 30-day period starts (plan_expires_at = now +
// 30 days), which also unblocks an expired login. Same proof flow as the
// food payments, but the money goes to SAQLYN (the platform), not to the
// restaurant's own customers.
export async function createPlanPayment(data) {
  const ref = doc(planPaymentsCol());
  const payment = {
    id: ref.id,
    restaurantId: data.restaurantId,
    restaurantName: data.restaurantName || "",
    plan: data.plan || "standard",
    amount: parseFloat(data.amount),
    method: data.method || "easypaisa",
    status: "pending",
    proofImage: data.proofImage || null,
    createdAt: serverTimestamp(),
    verifiedAt: null,
    verifiedBy: null,
  };
  await setDoc(ref, payment);
  return payment;
}

// Super admin only: verify a plan payment and activate the plan.
export async function verifyPlanPayment(payment) {
  await updateDoc(planPaymentDoc(payment.id), {
    status: "verified",
    verifiedAt: serverTimestamp(),
    verifiedBy: "super_admin",
  });
  await updateDoc(restaurantDoc(payment.restaurantId), {
    plan: payment.plan,
    plan_expires_at: Timestamp.fromDate(paidExpiryDateFrom(new Date())),
    updated_at: serverTimestamp(),
  });
}

export async function rejectPlanPayment(payment) {
  await updateDoc(planPaymentDoc(payment.id), {
    status: "rejected",
    verifiedAt: serverTimestamp(),
    verifiedBy: "super_admin",
  });
}

// ── Signup Requests (Get Started page) ───────────────────────────────────
// A prospect buys a plan from the public /get-started page (no login).
// The request is stored for the super admin, who creates the restaurant
// from it (see SuperAdminDashboard). Status: "new" | "created" | "dismissed".
export async function createSignupRequest(data) {
  const ref = doc(signupRequestsCol());
  const request = {
    id: ref.id,
    plan: data.plan,
    amount: data.amount,
    restaurantName: data.restaurantName,
    ownerName: data.ownerName,
    whatsapp: data.whatsapp,
    city: data.city,
    cuisine: data.cuisine || "",
    tables: data.tables,
    notes: data.notes || "",
    status: "new",
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, request);
  return request;
}

export async function updateSignupRequest(requestId, data) {
  await updateDoc(signupRequestDoc(requestId), { ...data, updatedAt: serverTimestamp() });
}

export function subscribeToSignupRequests(callback) {
  return onSnapshot(signupRequestsCol(), (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    callback(items);
  });
}

// ── Demo Leads (Try Demo page) ───────────────────────────────────────────
// A visitor playing with a DEMO restaurant who adds their own menu item
// first leaves their name, email and WhatsApp — that is a sales lead for
// the super admin to follow up. Status: "new" only (leads are never
// edited in the app; the super admin contacts them on WhatsApp).
export async function createDemoLead(data) {
  const ref = doc(demoLeadsCol());
  const lead = {
    id: ref.id,
    name: data.name,
    email: data.email,
    whatsapp: data.whatsapp,
    restaurantId: data.restaurantId,
    restaurantName: data.restaurantName || "",
    source: "demo-menu-add",
    status: "new",
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, lead);
  return lead;
}

export function subscribeToDemoLeads(callback) {
  return onSnapshot(demoLeadsCol(), (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    callback(items);
  });
}

export function subscribeToPlanPayments(callback) {
  return onSnapshot(planPaymentsCol(), (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    callback(items);
  });
}

export function subscribeToRestaurantPlanPayments(restaurantId, callback) {
  return onSnapshot(
    query(planPaymentsCol(), where("restaurantId", "==", restaurantId)),
    (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      callback(items);
    }
  );
}

// ── User Operations ────────────────────────────────────────────────────────

export async function createUser(userId, data) {
  await setDoc(userDoc(userId), {
    email: data.email,
    name: data.name,
    role: data.role,
    restaurant_id: data.restaurant_id || null,
    created_at: serverTimestamp(),
    active: true,
  });
}

export async function getUser(userId) {
  const snap = await getDoc(userDoc(userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Live-watch one user's doc (used by AuthContext so a staff member who is
// disabled while signed in is blocked immediately, not on next login).
export function subscribeToUser(userId, callback) {
  return onSnapshot(userDoc(userId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// Disable / enable ONE staff login (super admin only — the rules block a
// user from changing their own is_disabled). Disabled: that login is
// blocked with "Your account is disabled. Please contact your
// administrator." until the super admin enables it again.
export async function setUserDisabled(userId, disabled) {
  await updateDoc(userDoc(userId), { is_disabled: disabled, updated_at: serverTimestamp() });
}

export async function deleteUser(userId) {
  await deleteDoc(userDoc(userId));
}

export async function getRestaurantUsers(restaurantId) {
  const q = query(usersCol(), where("restaurant_id", "==", restaurantId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    // Platform accounts never appear in a restaurant's staff list: the
    // super admin, and the platform owner's own account (flagged
    // is_platform_owner). Demo-only logins (flagged is_demo_user) are
    // hidden too — visitors use them, they are not staff and never count
    // toward the plan's staff cap. A restaurant admin sees only their own
    // login and their staff — and can never remove the owner's login.
    .filter(u => u.role !== "super_admin" && !u.is_platform_owner && !u.is_demo_user);
}

// ── Multi-branch owners ─────────────────────────────────────────────────
// An owner (general_admin) can run 2+ branches from ONE login. Their users
// doc keeps restaurant_id (first branch) plus restaurant_ids (every branch
// they can open). Staff logins stay per-branch — only the owner switches.
// The branch switcher (AdminLayout) and the "All branches" combined view
// (Admin dashboard + Order History) read this list.
export function getAccessibleRestaurantIds(userProfile) {
  if (!userProfile) return [];
  const ids = [userProfile.restaurant_id, ...(userProfile.restaurant_ids || [])];
  return [...new Set(ids.filter(Boolean))];
}

export async function getRestaurantsByIds(ids) {
  const docs = await Promise.all((ids || []).map((id) => getRestaurant(id)));
  return docs.filter(Boolean);
}

// One live list across branches: each branch's orders, merged newest
// first, tagged with _restaurantId so actions (cancel, receipt) hit the
// right branch. Same merge pattern as SuperAdminOrdersPage.
export function subscribeToMultiOrders(restaurantIds, callback) {
  const ids = (restaurantIds || []).filter(Boolean);
  if (ids.length === 0) { callback([]); return () => {}; }
  const byBranch = new Map(ids.map((id) => [id, []]));
  const emit = () => {
    const items = [...byBranch.values()].flat()
      .sort((a, b) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0));
    callback(items);
  };
  const unsubs = ids.map((rid) =>
    onSnapshot(ordersCol(rid), (snap) => {
      byBranch.set(rid, snap.docs.map(d => ({ id: d.id, ...d.data(), _restaurantId: rid })));
      emit();
    })
  );
  return () => unsubs.forEach((u) => u());
}

// Same merge for payment proofs (the AdminLayout bell + the dashboard
// Payments tab in "All branches" mode).
export function subscribeToMultiPayments(restaurantIds, callback) {
  const ids = (restaurantIds || []).filter(Boolean);
  if (ids.length === 0) { callback([]); return () => {}; }
  const byBranch = new Map(ids.map((id) => [id, []]));
  const emit = () => {
    const items = [...byBranch.values()].flat()
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    callback(items);
  };
  const unsubs = ids.map((rid) =>
    onSnapshot(query(paymentsCol(), where("restaurantId", "==", rid)), (snap) => {
      byBranch.set(rid, snap.docs.map(d => ({ id: d.id, ...d.data() })));
      emit();
    })
  );
  return () => unsubs.forEach((u) => u());
}

// Every general_admin who can own branches (the super admin picks one in
// the restaurant Edit modal to link a branch to them). Demo logins and the
// platform owner are not branch owners.
export async function getAllOwners() {
  const snap = await getDocs(query(usersCol(), where("role", "==", "general_admin")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(u => !u.is_demo_user && !u.is_platform_owner);
}

// Super admin links a branch to an existing owner (their first branch's
// admin login). The owner then opens this branch from the switcher — the
// branch keeps its own auto-created staff logins.
export async function linkRestaurantToOwner(ownerUid, restaurantId) {
  await updateDoc(userDoc(ownerUid), { restaurant_ids: arrayUnion(restaurantId), updated_at: serverTimestamp() });
}

export async function unlinkRestaurantFromOwner(ownerUid, restaurantId) {
  await updateDoc(userDoc(ownerUid), { restaurant_ids: arrayRemove(restaurantId), updated_at: serverTimestamp() });
}

// ── Domain Mapping ─────────────────────────────────────────────────────────

export async function mapDomain(domain, restaurantId) {
  await setDoc(doc(domainMappingsCol(), domain), {
    restaurant_id: restaurantId,
    verified: false,
    created_at: serverTimestamp(),
  });
}

export async function resolveDomain(domain) {
  const snap = await getDoc(doc(domainMappingsCol(), domain));
  return snap.exists() ? snap.data() : null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sanitizeOrderItems(items = []) {
  return items
    .map((item) => ({
      item_id: item.item_id || item.id || null,
      name: (item.name || "").trim(),
      price: Number(item.price || 0),
      quantity: Math.max(1, parseInt(item.quantity || 1, 10)),
      notes: (item.notes || "").trim(),
      prep_time_minutes: Math.max(1, parseInt(item.prep_time_minutes || 15, 10)),
    }))
    .filter((item) => item.name && Number.isFinite(item.price) && item.price >= 0);
}

function calculateOrderTotal(items = []) {
  return Number(items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2));
}

// Subtotal -> discount -> tax -> total. Rates are percentages (e.g. 16 = 16%).
// discountAmount is a flat amount (Rs. 500 off) on top of the rate;
// the total discount never exceeds the subtotal.
export function calculateBill(items = [], taxRate = 0, discountRate = 0, discountAmount = 0) {
  const subtotal = Number(items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2));
  const discount = Number(Math.min(subtotal, subtotal * (discountRate / 100) + (Number(discountAmount) || 0)).toFixed(2));
  const taxable = subtotal - discount;
  const tax = Number((taxable * (taxRate / 100)).toFixed(2));
  const total = Number((taxable + tax).toFixed(2));
  return { subtotal, discount, tax, total };
}

// ── Discounts ─────────────────────────────────────────────────────────────
// A restaurant-wide, time-limited promo (Settings → Discount Promo).
// While active it REPLACES the regular discount_rate — one discount line
// on the slip, never a stacked surprise. Dates are plain YYYY-MM-DD
// strings compared against the browser's local date.
export function getEffectiveDiscount(restaurant) {
  const r = restaurant || {};
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const value = Number(r.promo_value) || 0;
  const active = r.promo_enabled === true && value > 0
    && (!r.promo_start || today >= r.promo_start)
    && (!r.promo_end || today <= r.promo_end);
  if (active) {
    return r.promo_type === "flat"
      ? { rate: 0, amount: value, active: true, label: "Promo" }
      : { rate: value, amount: 0, active: true, label: "Promo" };
  }
  return { rate: Number(r.discount_rate) || 0, amount: 0, active: false, label: null };
}

// What the customer actually pays for one order: the stored total minus
// a per-order manual discount applied by the admin (see below). The
// stored `total` never changes — the rules lock it — so every bill,
// receipt and revenue sum reads through this helper instead.
export function getOrderPayable(order) {
  const total = Number(order?.total) || 0;
  const discount = Math.max(0, Math.min(total, Number(order?.manual_discount_amount) || 0));
  return { payable: Number((total - discount).toFixed(2)), discount };
}

// One-customer discount, applied by the restaurant admin or the super
// admin to a single unpaid order (the app only shows the control to
// them, and the Firestore rules enforce it too). Percent is converted
// to a fixed amount against the order's total at apply time, so the
// slip always shows the exact rupees taken off.
export async function applyOrderDiscount(restaurantId, orderId, { type, value, byUid, byName }) {
  const ref = doc(ordersCol(restaurantId), orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order not found.");
  const order = snap.data();
  if (order.payment_status === "paid") throw new Error("This order is already paid.");
  if (order.status === "cancelled") throw new Error("This order is cancelled.");
  const total = Number(order.total) || 0;
  const v = Math.max(0, Number(value) || 0);
  const amount = Number(Math.min(total, type === "percent" ? total * (v / 100) : v).toFixed(2));
  if (amount <= 0) throw new Error("Enter a discount above zero.");
  await updateDoc(ref, {
    manual_discount_type: type,
    manual_discount_value: v,
    manual_discount_amount: amount,
    manual_discount_by: byUid || null,
    manual_discount_by_name: byName || null,
    manual_discount_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return amount;
}

// Undo a per-order discount (admin / super admin only, same as applying).
export async function removeOrderDiscount(restaurantId, orderId) {
  const ref = doc(ordersCol(restaurantId), orderId);
  await updateDoc(ref, {
    manual_discount_type: null,
    manual_discount_value: null,
    manual_discount_amount: 0,
    manual_discount_by: null,
    manual_discount_by_name: null,
    manual_discount_at: null,
    updated_at: serverTimestamp(),
  });
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function generateOrderNumber() {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}
