import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  subscribeToMenu, subscribeToOrders, subscribeToRestaurant,
  createMenuItem, updateMenuItem, deleteMenuItem, restoreMenuItem, createDemoLead,
  getRestaurantUsers, subscribeToPlatformSettings,
  subscribeToRestaurantPayments, subscribeToMultiOrders, subscribeToMultiPayments,
  subscribeToReviews, subscribeToMultiReviews,
  verifyPayment
} from "../config/db";
import { formatPrice, useRestaurantCurrency } from "../utils/currency";
import { cleanupExpiredDemoItems, isExpiredDemoItem, getOrderPayable, isItemPromoActive, getItemPrice } from "../config/db";
import { hideDemoDish, unhideDemoDish, getDemoHiddenDishes } from "../utils/session";
import { formatExpiryDate, getPlanLabel, getMenuItemLimit, getBackupDays, getExpiryInfo, isOrderWithinRetention } from "../config/plans";
import { downscaleImage } from "../utils/image";
import AdminLayout from "../components/admin/AdminLayout";
import BranchRequired from "../components/admin/BranchRequired";
import MenuItemModal from "../components/admin/MenuItemModal";
import OrdersTable from "../components/admin/OrdersTable";
import StatsBar from "../components/admin/StatsBar";
import StaffModal from "../components/admin/StaffModal";
import QRModal from "../components/admin/QRModal";
import ConfirmModal from "../components/admin/ConfirmModal";
import ReceiptModal from "../components/ReceiptModal";
import AnalyticsPanel from "../components/admin/AnalyticsPanel";
import OrderStatusSummary, { matchesStage } from "../components/admin/OrderStatusSummary";
import { sortOrdersForDisplay } from "../utils/orderSort";
import { useNotifications, ToastContainer } from "../hooks/useNotifications";

const ALL_TABS = ["menu", "orders", "payments", "analytics", "reviews", "staff", "qr"];
// The branch manager sits ABOVE the restaurant admin (his 2026-11-19
// decision) — they get every tab the admin has (menu, orders, payments,
// analytics, staff, QR) plus the branch switcher and All branches.

export default function GeneralAdminDashboard() {
  const { userProfile, restaurantId, logout, trialInfo, branches, accessibleRestaurantIds } = useAuth();
  const TABS = ALL_TABS;
  // "all" = the combined All-branches view (one login, every branch).
  // Menu, staff and QR are per-branch, so those tabs ask for a branch;
  // orders, payments and analytics merge across branches.
  const isAllBranches = restaurantId === "all";
  const accessibleKey = accessibleRestaurantIds.join(",");
  const currency = useRestaurantCurrency(isAllBranches ? null : restaurantId);
  const [activeTab, setActiveTab] = useState("menu");
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  // Admin alert: EVERY new order — QR customer, staff Order Taker or
  // delivery — pings + toasts here too (his 2026-11-19 order). In the
  // all-branches view it listens to every branch, with the branch name
  // in the toast.
  const branchNames = useMemo(() => {
    const map = {};
    branches.forEach((b) => { map[b.id] = b.name; });
    return map;
  }, [branches]);
  const { toasts, dismiss } = useNotifications(
    isAllBranches ? accessibleRestaurantIds : restaurantId,
    true,
    { restaurantNames: branchNames, onServed: true }
  );
  // Orders summary filter (his 2026-11-19 order): tap a stage box above
  // the orders list to show only that stage; null = all orders. (The
  // counts live below, next to visibleOrders — they read it, so they must
  // sit after its declaration, not here.)
  const [stageFilter, setStageFilter] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [payments, setPayments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null); // dish awaiting hide confirm
  const [restaurant, setRestaurant] = useState(null);
  // Bump to re-render after a per-browser demo hide/restore (localStorage
  // changes don't re-render on their own).
  const [, setDemoHiddenTick] = useState(0);
  // Demo lead gate: a visitor adding their own dish to a DEMO restaurant
  // first leaves their contact details (saved as a demo lead for the
  // super admin). Asked EVERY time a dish is added, so each dish carries
  // its own fresh lead.
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", email: "", whatsapp: "" });
  const [leadErrors, setLeadErrors] = useState({});
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSubmitError, setLeadSubmitError] = useState("");
  const [verifyingId, setVerifyingId] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [platformLimits, setPlatformLimits] = useState(null);
  const [menuLimitNotice, setMenuLimitNotice] = useState("");

  useEffect(() => subscribeToPlatformSettings(setPlatformLimits), []);

  useEffect(() => {
    if (!restaurantId) return;
    if (isAllBranches) {
      // Combined view: live orders + proofs from every branch, merged.
      // No single menu / staff / restaurant doc — those tabs ask for a branch.
      const unsubOrders = subscribeToMultiOrders(accessibleRestaurantIds, setOrders);
      const unsubPayments = subscribeToMultiPayments(accessibleRestaurantIds, setPayments);
      const unsubReviews = subscribeToMultiReviews(accessibleRestaurantIds, setReviews);
      setMenuItems([]);
      setStaff([]);
      setRestaurant(null);
      setLoading(false);
      return () => { unsubOrders(); unsubPayments(); unsubReviews(); };
    }
    const unsubMenu = subscribeToMenu(restaurantId, (items) => {
      setMenuItems(items);
      setLoading(false);
    });
    const unsubOrders = subscribeToOrders(restaurantId, (data) => {
      setOrders(data);
    });
    const unsubPayments = subscribeToRestaurantPayments(restaurantId, setPayments);
    const unsubRestaurant = subscribeToRestaurant(restaurantId, setRestaurant);
    const unsubReviews = subscribeToReviews(restaurantId, setReviews);
    getRestaurantUsers(restaurantId).then(setStaff);
    return () => { unsubMenu(); unsubOrders(); unsubPayments(); unsubRestaurant(); unsubReviews(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, accessibleKey]);

  // Branch docs by id — so every merged order/payment can find its
  // branch's name, currency and plan. Single-branch mode: the one doc.
  const branchMap = useMemo(() => {
    const map = {};
    if (isAllBranches) branches.forEach((b) => { map[b.id] = b; });
    else if (restaurant) map[restaurantId] = restaurant;
    return map;
  }, [isAllBranches, branches, restaurant, restaurantId]);
  const branchFor = (x) => branchMap[x?._restaurantId || x?.restaurantId || restaurantId] || {};
  // Branches whose plan is about to end (combined view has no single trial).
  const expiringBranches = isAllBranches
    ? branches.filter((b) => getExpiryInfo(b)?.expiringSoon)
    : [];

  async function handleVerifyPayment(payment) {
    setVerifyingId(payment.id);
    await verifyPayment(payment);
    setVerifyingId(null);
    // The bill slip opens right away so it can be printed immediately
    // after the payment is verified (and the order marked paid). The local
    // copy carries the new paid state because the live listener lags a
    // beat behind the write.
    const ids = payment.orderIds?.length
      ? payment.orderIds
      : payment.orderId
        ? [payment.orderId]
        : [];
    const first = orders.find((o) => o.id === ids[0]);
    if (first) setReceiptOrder({ ...first, payment_status: "paid", payment_method: payment.method || first.payment_method });
  }

  // Menu-item cap for this restaurant's plan (Basic 30 / Standard 100 /
  // Premium unlimited). Editing an existing dish doesn't change the count,
  // only adding a new one is gated.
  const menuLimit = getMenuItemLimit(trialInfo?.plan || "standard", platformLimits);

  function handleAddItem() {
    setEditingItem(null);
    if (menuLimit !== null && menuItems.length >= menuLimit) {
      setMenuLimitNotice(
        `⬆️ Your ${getPlanLabel(trialInfo?.plan)} plan allows up to ${menuLimit} menu items. To add more, upgrade your plan or contact your administrator.`
      );
      return;
    }
    setMenuLimitNotice("");
    // Demo restaurants are public playgrounds: before a visitor adds
    // their OWN dish, capture them as a sales lead — every time, so each
    // dish carries its own fresh lead. Real customer restaurants never
    // see this gate.
    if (restaurant?.is_demo) {
      setLeadSubmitError("");
      setShowLeadModal(true);
      return;
    }
    setShowItemModal(true);
  }

  function handleLeadField(key, value) {
    setLeadForm((f) => ({ ...f, [key]: value }));
    setLeadErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleLeadSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (leadForm.name.trim().length < 2) errs.name = "Your name is required.";
    if (!/^\S+@\S+\.\S+$/.test(leadForm.email.trim())) errs.email = "Enter a valid email address.";
    const digits = leadForm.whatsapp.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) errs.whatsapp = "Enter a valid WhatsApp number (10–15 digits).";
    setLeadErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLeadSubmitting(true);
    setLeadSubmitError("");
    try {
      await createDemoLead({
        name: leadForm.name.trim(),
        email: leadForm.email.trim(),
        whatsapp: digits,
        restaurantId,
        restaurantName: restaurant?.name || "",
      });
      setLeadForm({ name: "", email: "", whatsapp: "" });
      setShowLeadModal(false);
      setShowItemModal(true);
    } catch {
      // Rules not published yet, or offline: don't strand the visitor —
      // offer the Telegram fallback (details prefilled) and let them
      // continue to the add-item form anyway.
      setLeadSubmitError("We could not save your details just now. You can send them on Telegram instead — or continue anyway.");
    } finally {
      setLeadSubmitting(false);
    }
  }

  const leadTelegramText = `Hi! I tried the SAQLYN demo and want to add my own menu items.\nName: ${leadForm.name.trim() || "-"}\nEmail: ${leadForm.email.trim() || "-"}\nWhatsApp: ${leadForm.whatsapp.trim() || "-"}\nDemo restaurant: ${restaurant?.name || "-"}`;

  function formatDate(ts) {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  async function handleSaveItem(formData, imageFile) {
    let image_url = formData.image_url;
    if (imageFile) {
      // Stored as a data URL in the menu item — no Firebase Storage needed.
      image_url = await downscaleImage(imageFile, 800, 0.8);
    }
    const data = { ...formData, image_url };

    if (editingItem) {
      await updateMenuItem(restaurantId, editingItem.id, data);
      setMenuItems((prev) => prev.map((i) => i.id === editingItem.id ? { ...i, ...data } : i));
    } else {
      const newItem = await createMenuItem(restaurantId, data);
      setMenuItems((prev) => [...prev, newItem]);
    }
    setShowItemModal(false);
    setEditingItem(null);
  }

  // Soft delete: the dish is only hidden from the customer menu. It stays
  // in the backend and shows in the "Hidden dishes" section below, where
  // it can be restored. The live menu subscription refreshes the list.
  // On a DEMO restaurant the hide is per-browser only (localStorage, 24h):
  // another visitor elsewhere still sees the dish, and it returns on its
  // own after 24 hours. Nothing is written to the backend for demos.
  async function handleDeleteItem(itemId) {
    // Ask in the styled in-app dialog (not the browser's plain popup).
    setPendingDeleteItem(itemId);
  }

  async function confirmDeleteItem() {
    const itemId = pendingDeleteItem;
    setPendingDeleteItem(null);
    if (!itemId) return;
    if (restaurant?.is_demo) {
      hideDemoDish(restaurantId, itemId);
      setDemoHiddenTick((t) => t + 1);
      return;
    }
    await deleteMenuItem(restaurantId, itemId);
  }

  async function handleRestoreItem(itemId) {
    if (restaurant?.is_demo && getDemoHiddenDishes(restaurantId).has(itemId)) {
      unhideDemoDish(restaurantId, itemId);
      setDemoHiddenTick((t) => t + 1);
      return;
    }
    await restoreMenuItem(restaurantId, itemId);
  }

  // Demo auto-cleanup (website rule, no outside task): when a demo
  // restaurant's admin dashboard opens, delete visitor-added dishes older
  // than 24h for real. A failure here is silent — expired dishes are
  // already hidden from every menu view by isExpiredDemoItem.
  useEffect(() => {
    if (restaurant?.is_demo) {
      cleanupExpiredDemoItems(restaurantId).catch(() => {});
    }
  }, [restaurant?.is_demo, restaurantId]);

  function handleEditItem(item) {
    setEditingItem(item);
    setShowItemModal(true);
  }

  const todayOrders = orders.filter((o) => {
    const today = new Date();
    const orderDate = o.created_at?.toDate?.() || new Date();
    return orderDate.toDateString() === today.toDateString();
  });

  // Live today: tables currently occupied (an active unpaid order sits on
  // them), orders today, and today's paid revenue — one glance, no tab.
  const activeTables = new Set(
    todayOrders
      .filter((o) => o.status !== "cancelled" && o.payment_status !== "paid" && o.order_type !== "delivery")
      .map((o) => o.table_number)
  ).size;
  const tableCount = restaurant?.table_count || 0;

  // Cancelled orders never count as revenue (they stay in history only).
  const todayRevenue = todayOrders
    .filter((o) => o.payment_status === "paid" && o.status !== "cancelled")
    .reduce((s, o) => s + getOrderPayable(o).payable, 0);
  // Combined view: today's revenue per branch, each in its own currency.
  const todayRevenueByBranch = isAllBranches
    ? todayOrders
        .filter((o) => o.payment_status === "paid" && o.status !== "cancelled")
        .reduce((acc, o) => {
          const bid = o._restaurantId || restaurantId;
          acc[bid] = (acc[bid] || 0) + getOrderPayable(o).payable;
          return acc;
        }, {})
    : {};
  // Retention window (his 2026-11-16 order): the admin sees only orders
  // newer than their plan's backup window. Nothing is deleted — the
  // super admin still sees everything. todayOrders/todayRevenue are
  // today-only so they are unaffected; the receipt lookup for a
  // just-verified payment keeps the full list so its slip always opens.
  // In the combined view each branch keeps its OWN plan's window.
  // (Declared BEFORE ordersForTable: it reads visibleOrders, and a const
  // used before its declaration throws and blanks the whole dashboard.)
  const retentionDays = getBackupDays(trialInfo?.plan || "basic", platformLimits);
  const planForOrder = (o) => branchFor(o).plan || trialInfo?.plan || "basic";
  const visibleOrders = orders.filter((o) => isOrderWithinRetention(o, planForOrder(o), platformLimits));
  const retentionNote = isAllBranches
    ? "Each branch keeps its own plan's history (Basic 30 days, Standard 90 days, Premium 1 year). Older orders are kept by the administrator."
    : `Showing orders from the last ${retentionDays} days — your ${getPlanLabel(trialInfo?.plan || "basic")} plan keeps ${retentionDays} days of history. Older orders are kept by the administrator.`;

  // Orders table rows carry their branch (name + currency) in the
  // combined view, so the table can show them per row.
  const ordersForTable = visibleOrders.map((o) => ({
    ...o,
    _branchName: branchFor(o).name,
    _currency: branchFor(o).currency || currency,
  }));

  // Orders shown below the summary: filtered to the tapped stage, and
  // paid + verified orders sink to the bottom — only the unpaid / active
  // orders stay on top, in time order (his 2026-11-19 order).
  const ordersShown = sortOrdersForDisplay(
    ordersForTable.filter((o) => matchesStage(o, stageFilter))
  );

  const pendingOrders = visibleOrders.filter((o) =>
    ["pending", "confirmed", "preparing"].includes(o.status)
  ).length;

  const categories = [...new Set(menuItems.map((i) => i.category))];
  // Soft-deleted dishes: hidden from customers, visible only to the admin.
  // On a demo restaurant, dishes hidden in THIS browser (localStorage, 24h)
  // are hidden here too — another browser still sees them.
  const demoHidden = restaurant?.is_demo ? getDemoHiddenDishes(restaurantId) : new Set();
  const visibleItems = menuItems.filter((i) => !i.deleted && !demoHidden.has(i.id) && !(restaurant?.is_demo && isExpiredDemoItem(restaurantId, i)));
  const hiddenItems = menuItems.filter((i) => i.deleted || demoHidden.has(i.id));
  const visibleCategories = [...new Set(visibleItems.map((i) => i.category))];

  return (
    <AdminLayout
      title="Restaurant Admin"
      subtitle={userProfile?.name || "Admin"}
      onLogout={logout}
      userProfile={userProfile}
    >
      {trialInfo?.expiringSoon && (
        <div className="trial-banner">
          ⚠️ Your {getPlanLabel(trialInfo.plan)} plan is about to end on {formatExpiryDate(trialInfo.expiresAt)}
          {trialInfo.daysLeft === 0
            ? " (today)"
            : trialInfo.daysLeft === 1
              ? " (1 day left)"
              : ` (${trialInfo.daysLeft} days left)`}.
          To continue, please pay the subscription fee — otherwise your login
          will be blocked after this date.
        </div>
      )}
      {isAllBranches && expiringBranches.length > 0 && (
        <div className="trial-banner">
          ⚠️ {expiringBranches.map((b) => `${b.name} (${getPlanLabel(b.plan)} ends ${formatExpiryDate(getExpiryInfo(b).expiresAt)})`).join(" • ")}.
          To continue, please pay the subscription fee — otherwise logins for that branch will be blocked after this date.
        </div>
      )}
      <StatsBar stats={isAllBranches ? [
        { label: "Branches", value: branches.length, icon: "🏪" },
        { label: "Tables Active", value: `${activeTables} / ${branches.reduce((s, b) => s + (b.table_count || 0), 0)}`, icon: "🪑" },
        { label: "Today's Orders", value: todayOrders.length, icon: "📋" },
        ...branches.map((b) => ({ label: `Revenue — ${b.name}`, value: formatPrice(todayRevenueByBranch[b.id] || 0, b.currency || "$"), icon: "💰" })),
        { label: "Pending Orders", value: pendingOrders, icon: "⏳", alert: pendingOrders > 5 },
      ] : [
        { label: "Menu Items", value: menuItems.length, icon: "🍽️" },
        { label: "Tables Active", value: tableCount > 0 ? `${activeTables} / ${tableCount}` : activeTables, icon: "🪑" },
        { label: "Today's Orders", value: todayOrders.length, icon: "📋" },
        { label: "Today's Revenue", value: formatPrice(todayRevenue, currency), icon: "💰" },
        { label: "Pending Orders", value: pendingOrders, icon: "⏳", alert: pendingOrders > 5 },
      ]} />

      {/* Tab Navigation */}
      <div className="tab-nav">
        {TABS.map((tab) => {
          const pendingPayments = payments.filter(p => p.status === "pending").length;
          const badge =
            tab === "orders" && pendingOrders > 0 ? pendingOrders :
            tab === "payments" && pendingPayments > 0 ? pendingPayments :
            0;
          return (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
              style={{ position: "relative" }}
            >
              {tab === "payments" ? "Payments" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {badge > 0 && <span className="badge-alert">{badge}</span>}
            </button>
          );
        })}
        <button
          type="button"
          className="tab-btn"
          onClick={() => navigate("/admin/order-taker")}
          title="Take an order on behalf of a customer"
        >
          🛎️ Take Order
        </button>
      </div>

      {/* Menu Tab */}
      {activeTab === "menu" && (
        <div className="tab-content">
          {isAllBranches ? (
            <BranchRequired title="Menu is per branch" />
          ) : (
          <>
          <div className="content-header">
            <h3>Menu Management</h3>
            <button className="btn-primary" onClick={handleAddItem}>
              + Add Item
            </button>
          </div>

          {menuLimitNotice && (
            <div className="error-banner" style={{ marginBottom: 14 }}>{menuLimitNotice}</div>
          )}

          {visibleCategories.map((cat) => (
            <div key={cat} className="menu-category-section">
              <h4 className="category-label">{cat}</h4>
              <div className="menu-items-list">
                {visibleItems.filter((i) => i.category === cat).map((item) => (
                  <div key={item.id} className={`menu-item-row ${!item.available ? "unavailable" : ""}`}>
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="item-thumb" />
                    )}
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-desc">{item.description}</span>
                      <div className="item-meta">
                        {isItemPromoActive(item) ? (
                          <span className="item-price">
                            <s className="price-was">{formatPrice(item.price, currency)}</s>{" "}
                            <span className="price-promo">{formatPrice(getItemPrice(item), currency)}</span>
                            <span className="promo-badge">🎉 Promo</span>
                          </span>
                        ) : (
                          <span className="item-price">{formatPrice(item.price, currency)}</span>
                        )}
                        <span className="item-prep">⏱ {item.prep_time_minutes} min</span>
                        <span className={`item-status ${item.available ? "available" : "sold-out"}`}>
                          {item.available ? "Available" : "Sold Out"}
                        </span>
                      </div>
                    </div>
                    <div className="item-actions">
                      <button className="btn-icon" onClick={() => handleEditItem(item)}>✏️</button>
                      <button className="btn-icon btn-danger" onClick={() => handleDeleteItem(item.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {hiddenItems.length > 0 && (
            <div className="menu-category-section">
              <h4 className="category-label">🙈 Hidden dishes — only you can see these</h4>
              <div className="menu-items-list">
                {hiddenItems.map((item) => (
                  <div key={item.id} className="menu-item-row unavailable">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="item-thumb" />
                    )}
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-desc">{item.description}</span>
                      <div className="item-meta">
                        {isItemPromoActive(item) ? (
                          <span className="item-price">
                            <s className="price-was">{formatPrice(item.price, currency)}</s>{" "}
                            <span className="price-promo">{formatPrice(getItemPrice(item), currency)}</span>
                            <span className="promo-badge">🎉 Promo</span>
                          </span>
                        ) : (
                          <span className="item-price">{formatPrice(item.price, currency)}</span>
                        )}
                        <span className="item-prep">⏱ {item.prep_time_minutes} min</span>
                        <span className="item-status sold-out">Hidden</span>
                      </div>
                    </div>
                    <div className="item-actions">
                      <button className="btn-icon" onClick={() => handleEditItem(item)}>✏️</button>
                      <button className="btn-icon" onClick={() => handleRestoreItem(item.id)} title="Restore dish">↩️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {menuItems.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">🍽️</div>
              <h3>No menu items yet</h3>
              <p>Add your first menu item to get started.</p>
              <button className="btn-primary" onClick={handleAddItem}>
                Add First Item
              </button>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="tab-content">
          <p style={{ fontSize: "13px", color: "var(--color-muted)", margin: "0 0 12px" }}>{retentionNote}</p>
          {/* Stage summary (his 2026-11-19 order): one box per stage with
              its count — tap a box to show only that stage's orders. */}
          <OrderStatusSummary orders={visibleOrders} selected={stageFilter} onSelect={setStageFilter} />
          <OrdersTable orders={ordersShown} restaurantId={restaurantId} showActions={true} onSelectOrder={setReceiptOrder} showBranch={isAllBranches} />
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="tab-content">
          {(() => {
            const pendingProofs = payments.filter(p => p.status === "pending");
            const verifiedProofs = payments.filter(p => p.status === "verified");
            return (
              <>
                <h3 style={{ fontFamily: "var(--font)", fontWeight: 700, marginBottom: 16, fontSize: 16 }}>
                  Pending Verification ({pendingProofs.length})
                </h3>
                {pendingProofs.length === 0 && (
                  <div className="empty-state" style={{ minHeight: 120 }}>
                    <div className="empty-icon">✅</div>
                    <p>No pending payment proofs</p>
                  </div>
                )}
                <div className="pending-payments-list" style={{ marginBottom: 28 }}>
                  {pendingProofs.map((payment) => (
                    <div key={payment.id} className="payment-proof-card">
                      <div className="payment-proof-header">
                        <div>
                          <div className="payment-proof-table">{payment.tableNumber === 0 ? "🛵 Delivery" : `Table ${payment.tableNumber}`}</div>
                          <div className="payment-proof-meta">{formatDate(payment.createdAt)}</div>
                        </div>
                        <div className="payment-proof-amount">{formatPrice(payment.amount, branchFor(payment).currency || currency)}</div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        {payment.items?.slice(0, 3).map((item, i) => (
                          <span key={i} className="track-item" style={{ marginRight: 6, display: "inline-block", marginBottom: 4 }}>
                            {item.name} ×{item.quantity}
                          </span>
                        ))}
                        {(payment.items?.length || 0) > 3 && (
                          <span className="track-item">+{payment.items.length - 3} more</span>
                        )}
                      </div>
                      {payment.screenshotUrl ? (
                        <img src={payment.screenshotUrl} alt="Payment proof" className="payment-proof-img" />
                      ) : (
                        <div className="payment-proof-placeholder">📷 No screenshot uploaded</div>
                      )}
                      <button
                        className="btn-verify"
                        onClick={() => handleVerifyPayment(payment)}
                        disabled={verifyingId === payment.id}
                      >
                        {verifyingId === payment.id ? "Verifying..." : "✓ Mark as Verified"}
                      </button>
                    </div>
                  ))}
                </div>

                {verifiedProofs.length > 0 && (
                  <>
                    <h3 style={{ fontFamily: "var(--font)", fontWeight: 700, marginBottom: 12, fontSize: 15, color: "var(--color-primary)" }}>
                      Verified ({verifiedProofs.length})
                    </h3>
                    <div className="pending-payments-list">
                      {verifiedProofs.map((payment) => (
                        <div key={payment.id} className="payment-proof-card" style={{ opacity: 0.65 }}>
                          <div className="payment-proof-header">
                            <div>
                              <div className="payment-proof-table">{payment.tableNumber === 0 ? "🛵 Delivery" : `Table ${payment.tableNumber}`}</div>
                              <div className="payment-proof-meta">{formatDate(payment.createdAt)}</div>
                            </div>
                            <div className="payment-proof-amount">{formatPrice(payment.amount, branchFor(payment).currency || currency)}</div>
                          </div>
                          <div className="verified-label">✅ Verified — {formatDate(payment.verifiedAt)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <div className="tab-content">
          <p style={{ fontSize: "13px", color: "var(--color-muted)", margin: "0 0 12px" }}>{retentionNote}</p>
          {isAllBranches ? (
            branches.map((b) => (
              <div key={b.id} style={{ marginBottom: 28 }}>
                <h3 style={{ fontFamily: "var(--font)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{b.name}</h3>
                <AnalyticsPanel orders={visibleOrders.filter((o) => (o._restaurantId || restaurantId) === b.id)} menuItems={[]} currency={b.currency || "$"} />
              </div>
            ))
          ) : (
            <AnalyticsPanel orders={visibleOrders} menuItems={menuItems} currency={currency} />
          )}
        </div>
      )}

      {/* Reviews Tab — customer star ratings after payment */}
      {activeTab === "reviews" && (
        <div className="tab-content">
          {reviews.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⭐</div>
              <p>No reviews yet — customers are asked to rate their visit after paying.</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 28 }}>⭐</span>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>
                    {(reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)} / 5
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-muted)" }}>
                    {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reviews.map((r) => (
                  <div key={r.id} style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#f5a623", fontSize: 16 }}>
                        {"★".repeat(Number(r.rating) || 0)}{"☆".repeat(5 - (Number(r.rating) || 0))}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                        {r.created_at?.toDate ? r.created_at.toDate().toLocaleString() : ""}
                        {r.table_number ? ` · Table ${r.table_number}` : ""}
                        {isAllBranches && r._restaurantId ? ` · ${branchMap[r._restaurantId]?.name || ""}` : ""}
                      </span>
                    </div>
                    {r.comment && <div style={{ fontSize: 14, marginTop: 6 }}>{r.comment}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Staff Tab */}
      {activeTab === "staff" && (
        <div className="tab-content">
          {isAllBranches ? (
            <BranchRequired title="Staff is per branch" />
          ) : (
          <>
          <div className="content-header">
            <h3>Staff Management</h3>
            <button className="btn-primary" onClick={() => setShowStaffModal(true)}>
              + Add Staff
            </button>
          </div>
          <div className="staff-list">
            {staff.map((member) => (
              <div key={member.id} className="staff-row">
                <div className="staff-avatar">{member.name?.[0]?.toUpperCase()}</div>
                <div className="staff-info">
                  <span className="staff-name">{member.name}</span>
                  <span className="staff-email">{member.email}</span>
                </div>
                <span className={`role-badge role-${member.role}`}>
                  {ROLE_LABELS[member.role] || member.role}
                </span>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      )}

      {/* QR Tab */}
      {activeTab === "qr" && (
        <div className="tab-content">
          {isAllBranches ? (
            <BranchRequired title="QR codes are per branch" />
          ) : (
          <button className="btn-primary" onClick={() => setShowQrModal(true)}>
            Open QR Generator
          </button>
          )}
        </div>
      )}

      {showLeadModal && (
        <div className="modal-overlay" onClick={() => setShowLeadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add your own dish 🍽️</h3>
              <button className="modal-close" onClick={() => setShowLeadModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="form-hint" style={{ marginBottom: 16 }}>
                This is the public demo — before you add your own menu item, tell us
                where to reach you. If you want SAQLYN for your own restaurant, we will follow up.
                Your dish will be visible for 24 hours — demo data is deleted automatically after 24 hours.
              </p>
              <form onSubmit={handleLeadSubmit}>
                <div className="form-group">
                  <label>Your name *</label>
                  <input
                    value={leadForm.name}
                    onChange={(e) => handleLeadField("name", e.target.value)}
                    placeholder="Your full name"
                  />
                  {leadErrors.name && <p className="gs-error">{leadErrors.name}</p>}
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => handleLeadField("email", e.target.value)}
                    placeholder="you@example.com"
                  />
                  {leadErrors.email && <p className="gs-error">{leadErrors.email}</p>}
                </div>
                <div className="form-group">
                  <label>WhatsApp number *</label>
                  <input
                    value={leadForm.whatsapp}
                    onChange={(e) => handleLeadField("whatsapp", e.target.value)}
                    placeholder="03XX-XXXXXXX"
                    inputMode="tel"
                  />
                  {leadErrors.whatsapp && <p className="gs-error">{leadErrors.whatsapp}</p>}
                </div>
                {leadSubmitError && <p className="gs-error">{leadSubmitError}</p>}
                {leadSubmitError && (
                  <div className="gs-actions" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
                    <a
                      className="btn-primary"
                      href={`https://t.me/Saqlyndigital?text=${encodeURIComponent(leadTelegramText)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      💬 Send details on Telegram →
                    </a>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => { setShowLeadModal(false); setShowItemModal(true); }}
                    >
                      Continue anyway
                    </button>
                  </div>
                )}
                <div className="gs-actions" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowLeadModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={leadSubmitting}>
                    {leadSubmitting ? "Saving…" : "Save & add item →"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showItemModal && (
        <MenuItemModal
          item={editingItem}
          categories={categories}
          onClose={() => { setShowItemModal(false); setEditingItem(null); }}
          onSave={handleSaveItem}
        />
      )}

      {showStaffModal && (
        <StaffModal
          restaurant={restaurant || { id: restaurantId }}
          onClose={() => setShowStaffModal(false)}
        />
      )}

      {showQrModal && (
        <QRModal
          restaurant={{ id: restaurantId }}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {pendingDeleteItem && (
        <ConfirmModal
          title="Hide this dish?"
          message="It will disappear from the customer menu, but it stays saved — you can restore it anytime from Hidden dishes below."
          confirmLabel="Hide dish"
          onConfirm={confirmDeleteItem}
          onCancel={() => setPendingDeleteItem(null)}
        />
      )}

      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          restaurantId={receiptOrder._restaurantId || restaurantId}
          restaurantName={branchFor(receiptOrder).name || restaurant?.name}
          restaurantLogo={branchFor(receiptOrder).logo_url || restaurant?.logo_url}
          restaurantAddress={branchFor(receiptOrder).address || restaurant?.address}
          deliveryPhone={branchFor(receiptOrder).delivery_phone || ""}
          complaintsPhone={branchFor(receiptOrder).complaints_phone || ""}
          currency={branchFor(receiptOrder).currency || currency}
          mode="receipt"
          onClose={() => setReceiptOrder(null)}
          discountActor={userProfile ? { uid: userProfile.id, name: userProfile.name } : null}
          actor={userProfile ? { uid: userProfile.id, name: userProfile.name || userProfile.email, role: userProfile.role } : null}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}

const ROLE_LABELS = {
  general_admin: "Admin",
  kitchen: "Kitchen",
  cash_counter: "Cash Counter",
  server: "Server",
};
