/**
 * DATABASE SCHEMA & COLLECTION REFERENCES
 * ========================================
 *
 * Firestore Structure:
 *
 * restaurants/{restaurantId}
 *   - name: string
 *   - slug: string (URL-safe unique identifier)
 *   - logo_url: string
 *   - table_count: number
 *   - custom_domain: string | null
 *   - theme: { primary, accent, font }
 *   - created_at: timestamp
 *   - active: boolean
 *   - plan: "saas" | "standalone"
 *
 * restaurants/{restaurantId}/menu/{itemId}
 *   - name: string
 *   - description: string
 *   - price: number
 *   - category: string
 *   - image_url: string
 *   - available: boolean
 *   - prep_time_minutes: number
 *   - sort_order: number
 *   - created_at: timestamp
 *
 * restaurants/{restaurantId}/orders/{orderId}
 *   - table_number: number
 *   - items: [{ item_id, name, price, quantity, notes, prep_time_minutes }]
 *   - status: "pending" | "confirmed" | "preparing" | "ready" | "served" | "paid" | "cancelled"
 *   - total: number
 *   - payment_status: "unpaid" | "paid"
 *   - payment_method: "cash" | "card" | "upi"
 *   - created_at: timestamp
 *   - updated_at: timestamp
 *   - estimated_ready: timestamp
 *   - notes: string
 *   - created_by: userId | "customer"
 *
 * users/{userId}
 *   - email: string
 *   - name: string
 *   - role: "super_admin" | "general_admin" | "kitchen" | "cash_counter" | "server"
 *   - restaurant_id: string | null  (null for super_admin)
 *   - created_at: timestamp
 *   - active: boolean
 *
 * domain_mappings/{domain}  (top-level for quick lookup)
 *   - restaurant_id: string
 *   - verified: boolean
 */

import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, onSnapshot,
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
    theme: data.theme || { primary: "#e85d04", accent: "#f48c06", font: "modern" },
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
  const q = query(menuCol(restaurantId), orderBy("category"), orderBy("sort_order"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ── Order Operations ───────────────────────────────────────────────────────

export async function createOrder(restaurantId, data) {
  const sanitizedItems = sanitizeOrderItems(data.items);
  if (sanitizedItems.length === 0) {
    throw new Error("Cannot create an order without at least one valid item.");
  }

  const total = calculateOrderTotal(sanitizedItems);
  const prepTime = Math.max(...sanitizedItems.map(i => i.prep_time_minutes || 15));
  const estimatedReady = Timestamp.fromDate(new Date(Date.now() + prepTime * 60000));

  const ref = doc(ordersCol(restaurantId));
  const order = {
    id: ref.id,
    table_number: parseInt(data.table_number, 10),
    items: sanitizedItems,
    status: "pending",
    total,
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
  let q = query(ordersCol(restaurantId), orderBy("created_at", "desc"));
  if (filters.status) {
    q = query(ordersCol(restaurantId), where("status", "in", filters.status), orderBy("created_at", "desc"));
  }
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeToTableOrders(restaurantId, tableNumber, callback) {
  const q = query(
    ordersCol(restaurantId),
    where("table_number", "==", parseInt(tableNumber, 10)),
    where("payment_status", "==", "unpaid"),
    orderBy("created_at", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
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

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function generateOrderNumber() {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}
