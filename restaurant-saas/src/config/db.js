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

import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, onSnapshot,
  serverTimestamp, Timestamp
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
export const domainMappingsCol = () => collection(db, "domain_mappings");

// ── Restaurant Operations ──────────────────────────────────────────────────

export async function createRestaurant(data) {
  const ref = doc(restaurantsCol());
  const restaurant = {
    id: ref.id,
    name: data.name,
    slug: data.slug || slugify(data.name),
    logo_url: data.logo_url || null,
    table_count: data.table_count || 10,
    custom_domain: data.custom_domain || null,
    theme: data.theme || { primary: "#20C997", accent: "#0F3D3E", font: "modern" },
    created_at: serverTimestamp(),
    active: true,
    plan: data.plan || "saas",
  };
  await setDoc(ref, restaurant);
  return { id: ref.id, ...restaurant };
}

export async function updateRestaurant(restaurantId, data) {
  await updateDoc(restaurantDoc(restaurantId), { ...data, updated_at: serverTimestamp() });
}

export async function getRestaurant(restaurantId) {
  const snap = await getDoc(restaurantDoc(restaurantId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllRestaurants() {
  const snap = await getDocs(restaurantsCol());
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

export async function deleteMenuItem(restaurantId, itemId) {
  await deleteDoc(menuItemDoc(restaurantId, itemId));
}

export function subscribeToMenu(restaurantId, callback) {
  return onSnapshot(menuCol(restaurantId), (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    callback(items);
  });
}

// ── Order Operations ───────────────────────────────────────────────────────

export async function createOrder(restaurantId, data) {
  const sanitizedItems = sanitizeOrderItems(data.items);
  if (sanitizedItems.length === 0) {
    throw new Error("Cannot create an order without at least one valid item.");
  }

  // Billing: tax + discount rates come from the restaurant's settings (0 if unset)
  let taxRate = 0, discountRate = 0;
  try {
    const r = await getRestaurant(restaurantId);
    taxRate = Number(r?.tax_rate) || 0;
    discountRate = Number(r?.discount_rate) || 0;
  } catch { /* keep 0 — bill without tax/discount */ }
  const bill = calculateBill(sanitizedItems, taxRate, discountRate);

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
    table_number: parseInt(data.table_number, 10),
    items: sanitizedItems,
    status: "pending",
    subtotal: bill.subtotal,
    discount_amount: bill.discount,
    discount_rate: discountRate,
    tax_amount: bill.tax,
    tax_rate: taxRate,
    total: bill.total,
    order_number: orderNumber,
    payment_status: "unpaid",
    payment_method: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    estimated_ready: estimatedReady,
    notes: (data.notes || "").trim(),
    created_by: data.created_by || "customer",
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

export async function updatePaymentStatus(restaurantId, orderId, paymentMethod) {
  await updateDoc(orderDoc(restaurantId, orderId), {
    payment_status: "paid",
    payment_method: paymentMethod,
    status: "paid",
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
  return onSnapshot(ordersCol(restaurantId), (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(o => o.table_number === tableNum && o.payment_status === "unpaid")
      .sort((a, b) => {
        const ta = a.created_at?.seconds ?? 0;
        const tb = b.created_at?.seconds ?? 0;
        return tb - ta;
      });
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

export async function getRestaurantUsers(restaurantId) {
  const q = query(usersCol(), where("restaurant_id", "==", restaurantId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
export function calculateBill(items = [], taxRate = 0, discountRate = 0) {
  const subtotal = Number(items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2));
  const discount = Number((subtotal * (discountRate / 100)).toFixed(2));
  const taxable = subtotal - discount;
  const tax = Number((taxable * (taxRate / 100)).toFixed(2));
  const total = Number((taxable + tax).toFixed(2));
  return { subtotal, discount, tax, total };
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function generateOrderNumber() {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}
