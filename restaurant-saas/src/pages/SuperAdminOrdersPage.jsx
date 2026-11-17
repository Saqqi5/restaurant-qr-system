// SuperAdminOrdersPage.jsx — All Orders across every restaurant, for the
// super admin (SAQLYN). Nothing is ever hard-deleted: cancelled orders stay
// saved with status "cancelled" + who cancelled them, so any order can be
// found later by its order number or by date and handed to the restaurant.
//
// NOTE (verified live 2026-11-16): a collectionGroup query on "orders"
// returns 403 under the published rules, even though a plain list on one
// restaurant's orders subcollection returns 200. So this page queries each
// restaurant's orders subcollection separately (in parallel) and merges the
// results client-side. Same filters, no rules change needed.
import { useState, useEffect } from "react";
import { getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { getAllRestaurants, ordersCol, getOrderPayable } from "../config/db";
import { formatPrice } from "../utils/currency";
import { useAuth } from "../contexts/AuthContext";
import AdminLayout from "../components/admin/AdminLayout";
import ReceiptModal from "../components/ReceiptModal";

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
function toDateInput(date) {
  return date.toISOString().split("T")[0];
}

export default function SuperAdminOrdersPage() {
  const { userProfile, logout } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(toDateInput(startOfDay(new Date())));
  const [dateTo, setDateTo] = useState(toDateInput(new Date()));
  const [restaurantFilter, setRestaurantFilter] = useState("all");
  const [orderNo, setOrderNo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [slipOrder, setSlipOrder] = useState(null);

  useEffect(() => {
    getAllRestaurants().then((list) => {
      setRestaurants(list);
      fetchOrders(list);
    }).catch(() => setRestaurants([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restMap = {};
  restaurants.forEach((r) => { restMap[r.id] = r; });

  // Restaurant pick is INSTANT: selecting one restaurant loads ALL its
  // orders at once (no date limit) — the super admin sees its full history.
  // Switching back to "All restaurants" loads the date-ranged view again.
  // Dates are NOT instant: they only apply when Apply is pressed, for
  // whichever restaurant is selected at the time.
  async function fetchOrders(restList = restaurants, restFilter = restaurantFilter, useDates = restFilter === "all") {
    setLoading(true);
    try {
      const num = parseInt(orderNo, 10);
      const targets = restFilter === "all"
        ? restList
        : restList.filter((r) => r.id === restFilter);
      // One single-collection query per restaurant (proven to work under
      // the published rules); merged + sorted client-side.
      const snaps = await Promise.all(targets.map((r) => {
        if (Number.isFinite(num)) {
          return getDocs(query(ordersCol(r.id), where("order_number", "==", num)));
        }
        if (!useDates) {
          return getDocs(query(ordersCol(r.id), orderBy("created_at", "desc")));
        }
        const from = Timestamp.fromDate(startOfDay(new Date(dateFrom)));
        const to = Timestamp.fromDate(endOfDay(new Date(dateTo)));
        return getDocs(query(
          ordersCol(r.id),
          where("created_at", ">=", from),
          where("created_at", "<=", to),
          orderBy("created_at", "desc")
        ));
      }));
      let list = [];
      snaps.forEach((snap, i) => {
        snap.docs.forEach((d) => list.push({ id: d.id, ...d.data(), restaurant_id: targets[i].id }));
      });
      list.sort((a, b) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0));
      setOrders(list);
    } catch (e) {
      setOrders([]);
    }
    setLoading(false);
  }

  const filtered = orders.filter((o) =>
    (restaurantFilter === "all" || o.restaurant_id === restaurantFilter) &&
    (statusFilter === "all" || o.status === statusFilter) &&
    (paymentFilter === "all" || o.payment_status === paymentFilter)
  );

  const totalRevenue = filtered
    .filter((o) => o.payment_status === "paid" && o.status !== "cancelled")
    .reduce((s, o) => s + getOrderPayable(o).payable, 0);
  // Revenue is shown in the selected restaurant's currency. With "All
  // restaurants" the total mixes currencies — if every restaurant happens to
  // share one currency (e.g. all Rs.), use it; otherwise fall back to $.
  const allCurrencies = [...new Set(restaurants.map((r) => r.currency || "$"))];
  const revenueCurrency = restaurantFilter === "all"
    ? (allCurrencies.length === 1 ? allCurrencies[0] : "$")
    : (restMap[restaurantFilter]?.currency || "$");

  function fmt(ts) {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleString([], { dateStyle: "short", timeStyle: "short" });
  }

  // Real Excel file (.xlsx), not a plain CSV: highlighted SAQLYN-green
  // header row, proper column widths, frozen header + auto-filter, so it
  // opens in Excel as a professional table. (A CSV has no formatting —
  // headers open plain and long names get cut off.)
  // File name carries the restaurant + the report period, e.g.
  // orders_lahori-dastarkhwan_2026-11-15_to_2026-11-16.xlsx
  // (orders_all_… when all restaurants are selected).
  async function exportExcel() {
    // Loaded on demand so the ~1MB spreadsheet library stays out of the
    // main bundle — it downloads only when Export is clicked.
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "SAQLYN";
    const sheetName = restaurantFilter === "all" ? "All Orders" : (restMap[restaurantFilter]?.name || "Orders").slice(0, 31);
    const ws = wb.addWorksheet(sheetName);
    ws.columns = [
      { header: "Order #", key: "no", width: 10 },
      { header: "Restaurant", key: "rest", width: 24 },
      { header: "Table", key: "table", width: 9 },
      { header: "Status", key: "status", width: 12 },
      { header: "Payment", key: "payment", width: 11 },
      { header: "Total", key: "total", width: 13 },
      { header: "Date", key: "date", width: 20 },
      { header: "Cancelled By", key: "cancelledBy", width: 17 },
      { header: "Items", key: "items", width: 55 },
    ];
    filtered.forEach((o) => {
      ws.addRow({
        no: o.order_number ?? "",
        rest: restMap[o.restaurant_id]?.name || o.restaurant_id || "",
        table: o.table_number,
        status: o.status,
        payment: o.payment_status,
        total: getOrderPayable(o).payable,
        date: o.created_at?.toDate?.() || "",
        cancelledBy: o.cancelled_by_name || "",
        items: o.items?.map((i) => `${i.name} x${i.quantity}`).join("; ") || "",
      });
    });
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF20C997" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    headerRow.height = 22;
    ws.autoFilter = { from: "A1", to: `I${ws.rowCount}` };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.getColumn("date").numFmt = "yyyy-mm-dd hh:mm";
    ws.getColumn("total").numFmt = "#,##0.00";
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const restSlug = restaurantFilter === "all"
      ? "all"
      : (restaurants.find((r) => r.id === restaurantFilter)?.slug || restMap[restaurantFilter]?.name || restaurantFilter)
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.download = `orders_${restSlug}_${dateFrom}_to_${dateTo}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminLayout
      title="📋 All Orders"
      subtitle="Every restaurant — find any order by number or date"
      onLogout={logout}
      userProfile={userProfile}
    >
      <div className="history-filters">
        <div className="filter-group">
          <label>Restaurant</label>
          <select
            value={restaurantFilter}
            onChange={(e) => {
              const v = e.target.value;
              setRestaurantFilter(v);
              fetchOrders(restaurants, v, v === "all");
            }}
          >
            <option value="all">All restaurants</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Order #</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 12"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value.replace(/[^0-9]/g, ""))}
            style={{ minWidth: 90 }}
          />
        </div>
        <div className="filter-group">
          <label>Order Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="served">Served</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Payment</label>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
        <button className="btn-primary" onClick={() => fetchOrders(restaurants, restaurantFilter, true)} disabled={loading}>
          {loading ? "Loading…" : "Apply"}
        </button>
        <button className="btn-secondary" onClick={exportExcel} disabled={!filtered.length}>
          ⬇️ Export Excel
        </button>
      </div>

      <div className="history-summary">
        <div className="hs-item">
          <span className="hs-label">Orders</span>
          <span className="hs-value">{filtered.length}</span>
        </div>
        <div className="hs-item">
          <span className="hs-label">Revenue (paid, excl. cancelled)</span>
          <span className="hs-value">{formatPrice(totalRevenue, revenueCurrency)}</span>
        </div>
        <div className="hs-item">
          <span className="hs-label">Cancelled</span>
          <span className="hs-value">{filtered.filter((o) => o.status === "cancelled").length}</span>
        </div>
      </div>

      {restaurantFilter !== "all" && (
        <p className="form-hint" style={{ marginBottom: 12 }}>
          Showing all orders of {restMap[restaurantFilter]?.name || "this restaurant"} — to see a specific date, pick the dates and press Apply.
        </p>
      )}

      <p className="form-hint" style={{ marginBottom: 12 }}>
        Click any order to view its slip — status, items and bill.
      </p>

      {loading ? (
        <div className="empty-state"><p>Loading orders…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No orders found. Try a wider date range or another order number.</p>
        </div>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Restaurant</th>
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
                <tr
                  key={`${order.restaurant_id}-${order.id}`}
                  onClick={() => setSlipOrder(order)}
                  title="Click to view slip"
                  style={{ cursor: "pointer", ...(order.status === "cancelled" ? { opacity: 0.65 } : {}) }}
                >
                  <td className="ht-mono">#{order.order_number ?? order.id?.slice(-6).toUpperCase()}</td>
                  <td>{restMap[order.restaurant_id]?.name || order.restaurant_id || "—"}</td>
                  <td className="ht-mono">{fmt(order.created_at)}</td>
                  <td><span className="table-badge-sm">T{order.table_number}</span></td>
                  <td className="ht-items">
                    {order.items?.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                  </td>
                  <td className="ht-price">{formatPrice(getOrderPayable(order).payable, restMap[order.restaurant_id]?.currency || "$")}</td>
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

      {slipOrder && (
        <ReceiptModal
          order={slipOrder}
          restaurantId={slipOrder.restaurant_id}
          restaurantName={restMap[slipOrder.restaurant_id]?.name}
          restaurantLogo={restMap[slipOrder.restaurant_id]?.logo_url}
          restaurantAddress={restMap[slipOrder.restaurant_id]?.address}
          deliveryPhone={restMap[slipOrder.restaurant_id]?.delivery_phone || ""}
          complaintsPhone={restMap[slipOrder.restaurant_id]?.complaints_phone || ""}
          currency={restMap[slipOrder.restaurant_id]?.currency || "$"}
          mode="receipt"
          onClose={() => setSlipOrder(null)}
          discountActor={userProfile ? { uid: userProfile.id, name: userProfile.name } : null}
          onDiscountApplied={() => fetchOrders()}
        />
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
