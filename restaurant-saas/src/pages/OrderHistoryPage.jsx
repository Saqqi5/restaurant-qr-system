import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { ordersCol, subscribeToPlatformSettings } from "../config/db";
import { formatPrice, useRestaurantCurrency } from "../utils/currency";
import { getBackupDays, getPlanLabel, getRetentionCutoffDate, isOrderWithinRetention } from "../config/plans";
import AdminLayout from "../components/admin/AdminLayout";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function OrderHistoryPage() {
  const { userProfile, restaurantId, logout, trialInfo } = useAuth();
  const currency = useRestaurantCurrency(restaurantId);
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [dateFrom, setDateFrom] = useState(toDateInput(startOfDay(new Date())));
  const [dateTo,   setDateTo]   = useState(toDateInput(new Date()));
  const [statusFilter, setStatusFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [platformLimits, setPlatformLimits] = useState(null);
  useEffect(() => subscribeToPlatformSettings(setPlatformLimits), []);
  // Retention window (his 2026-11-16 order): the admin sees only orders
  // newer than their plan's backup window. Nothing is deleted — the
  // super admin still sees everything.
  const retentionDays = getBackupDays(trialInfo?.plan || "basic", platformLimits);
  const cutoffInput = toDateInput(getRetentionCutoffDate(trialInfo?.plan || "basic", platformLimits));

  async function fetchOrders() {
    setLoading(true);
    const from = Timestamp.fromDate(startOfDay(new Date(dateFrom)));
    const to   = Timestamp.fromDate(endOfDay(new Date(dateTo)));
    const q = query(
      ordersCol(restaurantId),
      where("created_at", ">=", from),
      where("created_at", "<=", to),
      orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => { if (restaurantId) fetchOrders(); }, [restaurantId]);

  // Payment filter + order-status filter (cancelled orders stay in
  // history with who cancelled them — nothing is ever hard-deleted).
  const filtered = orders.filter((o) =>
    (statusFilter === "all" || o.payment_status === statusFilter) &&
    (orderStatusFilter === "all" || o.status === orderStatusFilter) &&
    isOrderWithinRetention(o, trialInfo?.plan || "basic", platformLimits)
  );

  const totalRevenue = filtered
    .filter((o) => o.payment_status === "paid")
    .reduce((s, o) => s + (o.total || 0), 0);

  function exportCSV() {
    const rows = [
      ["Order #", "Order ID", "Table", "Status", "Payment", "Total", "Date", "Cancelled By", "Items"].join(","),
      ...filtered.map((o) => [
        o.order_number ?? "",
        o.id,
        o.table_number,
        o.status,
        o.payment_status,
        o.total?.toFixed(2),
        o.created_at?.toDate?.()?.toISOString?.() || "",
        o.cancelled_by_name || "",
        `"${o.items?.map((i) => `${i.name} x${i.quantity}`).join("; ")}"`,
      ].join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `orders_${dateFrom}_to_${dateTo}.csv`;
    a.click();
  }

  function fmt(ts) {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleString([], { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <AdminLayout
      title="📋 Order History"
      subtitle="Reports & Export"
      onLogout={logout}
      userProfile={userProfile}
    >
      {/* Filters */}
      <div className="history-filters">
        <div className="filter-group">
          <label>From</label>
          <input type="date" value={dateFrom} min={cutoffInput} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Payment</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Order Status</label>
          <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="served">Served</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button className="btn-primary" onClick={fetchOrders} disabled={loading}>
          {loading ? "Loading…" : "Apply"}
        </button>
        <button className="btn-secondary" onClick={exportCSV} disabled={!filtered.length}>
          ⬇️ Export CSV
        </button>
      </div>

      <p style={{ fontSize: "13px", color: "var(--color-muted)", margin: "0 0 12px" }}>
        Showing orders from the last {retentionDays} days — your {getPlanLabel(trialInfo?.plan || "basic")} plan keeps {retentionDays} days of history. Older orders are kept by the administrator.
      </p>

      {/* Summary row */}
      <div className="history-summary">
        <div className="hs-item">
          <span className="hs-label">Orders</span>
          <span className="hs-value">{filtered.length}</span>
        </div>
        <div className="hs-item">
          <span className="hs-label">Revenue (paid)</span>
          <span className="hs-value">{formatPrice(totalRevenue, currency)}</span>
        </div>
        <div className="hs-item">
          <span className="hs-label">Avg. Order</span>
          <span className="hs-value">
            {filtered.length ? formatPrice(totalRevenue / filtered.filter(o => o.payment_status === "paid").length || 0, currency) : "—"}
          </span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="empty-state"><p>Loading orders…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No orders found for this date range.</p>
        </div>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Time</th>
                <th>Table</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} style={order.status === "cancelled" ? { opacity: 0.65 } : undefined}>
                  <td className="ht-mono">#{order.order_number ?? order.id?.slice(-6).toUpperCase()}</td>
                  <td className="ht-mono">{fmt(order.created_at)}</td>
                  <td><span className="table-badge-sm">T{order.table_number}</span></td>
                  <td className="ht-items">
                    {order.items?.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                  </td>
                  <td className="ht-price">{formatPrice(order.total, currency)}</td>
                  <td>
                    <span className={`status-pill status-${order.status}`}>
                      {order.status}
                    </span>
                    {order.status === "cancelled" && order.cancelled_by_name && (
                      <div style={{ fontSize: 11, color: "#e05252", marginTop: 2 }}>
                        by {order.cancelled_by_name}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`payment-dot ${order.payment_status}`}>
                      {order.payment_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .history-filters {
          display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .filter-group { display: flex; flex-direction: column; gap: 5px; }
        .filter-group label { font-size: 12px; color: var(--color-muted); font-weight: 500; }
        .filter-group input, .filter-group select { width: auto; min-width: 140px; }

        .history-summary {
          display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;
        }
        .hs-item {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius); padding: 14px 20px; flex: 1; min-width: 120px;
        }
        .hs-label { display: block; font-size: 12px; color: var(--color-muted); margin-bottom: 4px; }
        .hs-value { font-family: var(--font); font-size: 22px; font-weight: 700; }

        .history-table-wrap { overflow-x: auto; }
        .history-table {
          width: 100%; border-collapse: collapse; font-size: 13px;
        }
        .history-table th {
          text-align: left; padding: 10px 14px; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--color-muted); border-bottom: 1px solid var(--color-border);
          white-space: nowrap;
        }
        .history-table td {
          padding: 12px 14px; border-bottom: 1px solid var(--color-border);
          vertical-align: middle;
        }
        .history-table tr:last-child td { border-bottom: none; }
        .history-table tr:hover td { background: var(--color-surface); }
        .ht-mono { font-family: monospace; font-size: 12px; white-space: nowrap; }
        .ht-items { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-muted); }
        .ht-price { font-weight: 700; color: var(--color-primary); white-space: nowrap; }
      `}</style>
    </AdminLayout>
  );
}

function toDateInput(date) {
  return date.toISOString().split("T")[0];
}
