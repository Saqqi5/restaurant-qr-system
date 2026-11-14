import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToOrders, updateRestaurant, subscribeToPlatformSettings } from "../config/db";
import { getPlanLimit, getPlanLabel, normalizePlan } from "../config/plans";
import { formatPrice } from "../utils/currency";
import { getRestaurant } from "../config/db";
import { buildQrUrl } from "../config/tenantResolver";
import AdminLayout from "../components/admin/AdminLayout";

const TABLE_STATUS = {
  empty:      { label: "Empty",    color: "#2e2e2e", text: "#888",    border: "#3e3e3e" },
  occupied:   { label: "Occupied", color: "#1a2a1a", text: "#52b788", border: "#52b788" },
  ordered:    { label: "Ordered",  color: "#2a1a0a", text: "#f48c06", border: "#f48c06" },
  ready:      { label: "Ready",    color: "#0a2a1a", text: "#27ae60", border: "#27ae60" },
  billing:    { label: "Billing",  color: "#1a1a2a", text: "#4a90d9", border: "#4a90d9" },
};

export default function TableManagementPage() {
  const { userProfile, restaurantId, logout } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [restaurantLoaded, setRestaurantLoaded] = useState(false);
  const currency = restaurant?.currency || "$";
  const [orders, setOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [platformLimits, setPlatformLimits] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [tableMsg, setTableMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const tableCount = restaurant?.table_count || 20;
  const plan = normalizePlan(restaurant?.plan);
  const planLimit = getPlanLimit(plan, platformLimits);
  const atLimit = planLimit !== null && tableCount >= planLimit;

  // Wait for the restaurant doc before drawing the floor — otherwise the
  // page briefly shows the wrong fallback count (20) instead of the real one.
  useEffect(() => {
    if (!restaurantId) return;
    getRestaurant(restaurantId)
      .then((r) => { if (r) setRestaurant(r); })
      .catch(() => {})
      .finally(() => setRestaurantLoaded(true));
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribeToOrders(restaurantId, setOrders);
    return unsub;
  }, [restaurantId]);

  useEffect(() => {
    const unsub = subscribeToPlatformSettings(setPlatformLimits);
    return unsub;
  }, []);

  // Owners may lower the table count anytime, but never raise it above
  // their plan's limit — at the limit the + button shows the upgrade popup.
  async function handleAddTable() {
    if (!restaurant || saving) return;
    if (atLimit) { setShowUpgrade(true); return; }
    setSaving(true);
    try {
      const next = tableCount + 1;
      await updateRestaurant(restaurantId, { table_count: next });
      setRestaurant({ ...restaurant, table_count: next });
      setTableMsg("");
    } catch (e) {
      setTableMsg(e.message || "Could not add a table.");
    }
    setSaving(false);
  }

  async function handleRemoveTable() {
    if (!restaurant || saving || tableCount <= 1) return;
    if (getTableOrders(tableCount).length > 0) {
      setTableMsg(`Table ${tableCount} still has active orders. Clear them first.`);
      return;
    }
    setSaving(true);
    try {
      const next = tableCount - 1;
      await updateRestaurant(restaurantId, { table_count: next });
      setRestaurant({ ...restaurant, table_count: next });
      if (selectedTable === tableCount) setSelectedTable(null);
      setTableMsg("");
    } catch (e) {
      setTableMsg(e.message || "Could not remove the table.");
    }
    setSaving(false);
  }

  // Build a map of table → status
  function getTableStatus(tableNum) {
    const tableOrders = orders.filter(
      (o) => o.table_number === tableNum && o.payment_status === "unpaid"
    );
    if (!tableOrders.length) return "empty";
    const statuses = tableOrders.map((o) => o.status);
    if (statuses.some((s) => s === "ready")) return "ready";
    if (statuses.some((s) => ["preparing", "confirmed"].includes(s))) return "ordered";
    if (statuses.some((s) => s === "pending")) return "occupied";
    return "billing";
  }

  function getTableOrders(tableNum) {
    return orders.filter(
      (o) => o.table_number === tableNum && o.payment_status === "unpaid"
    );
  }

  const selectedOrders = selectedTable ? getTableOrders(selectedTable) : [];

  const statusCounts = Object.fromEntries(
    Object.keys(TABLE_STATUS).map((s) => [
      s,
      [...Array(tableCount)].filter((_, i) => getTableStatus(i + 1) === s).length,
    ])
  );

  return (
    <AdminLayout
      title="🪑 Tables"
      subtitle="Floor Overview"
      onLogout={logout}
      userProfile={userProfile}
    >
      {!restaurantLoaded ? (
        <div className="tdp-empty" style={{ padding: 40 }}>Loading tables…</div>
      ) : (
      <>
      {/* Plan + table controls */}
      <div className="tables-toolbar">
        <div className="tables-plan">
          📋 {getPlanLabel(plan)} plan — {tableCount} / {planLimit === null ? "∞" : planLimit} tables
        </div>
        <div className="tables-actions">
          <button className="btn-secondary" onClick={handleRemoveTable}
            disabled={saving || tableCount <= 1}>
            − Remove Table
          </button>
          <button className="btn-primary" onClick={handleAddTable} disabled={saving}>
            + Add Table
          </button>
        </div>
      </div>
      {tableMsg && <div className="error-banner">{tableMsg}</div>}

      {showUpgrade && (
        <div className="modal-overlay" onClick={() => setShowUpgrade(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⬆️ Upgrade Your Plan</h3>
              <button className="modal-close" onClick={() => setShowUpgrade(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-info">
                Your {getPlanLabel(plan)} plan allows up to {planLimit} tables.
                To add more tables, upgrade your plan or contact your administrator.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setShowUpgrade(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="table-legend">
        {Object.entries(TABLE_STATUS).map(([key, cfg]) => (
          <div key={key} className="legend-item">
            <span className="legend-dot" style={{ background: cfg.border }} />
            <span className="legend-label">{cfg.label}</span>
            <span className="legend-count">{statusCounts[key]}</span>
          </div>
        ))}
      </div>

      <div className="floor-layout">
        {/* Floor Grid */}
        <div className="table-grid">
          {[...Array(tableCount)].map((_, i) => {
            const num = i + 1;
            const status = getTableStatus(num);
            const cfg = TABLE_STATUS[status];
            const tableOrders = getTableOrders(num);
            const total = tableOrders.reduce((s, o) => s + (o.total || 0), 0);

            return (
              <div
                key={num}
                className={`table-cell ${selectedTable === num ? "selected" : ""}`}
                style={{
                  background: cfg.color,
                  borderColor: cfg.border,
                  color: cfg.text,
                }}
                onClick={() => setSelectedTable(selectedTable === num ? null : num)}
              >
                <div className="table-number">{num}</div>
                <div className="table-status-label">{cfg.label}</div>
                {total > 0 && (
                  <div className="table-total">${total.toFixed(0)}</div>
                )}
                {tableOrders.length > 0 && (
                  <div className="table-order-count">{tableOrders.length} order{tableOrders.length !== 1 ? "s" : ""}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Side Panel — Table Detail */}
        {selectedTable && (
          <div className="table-detail-panel">
            <div className="tdp-header">
              <h3>Table {selectedTable}</h3>
              <button className="tdp-close" onClick={() => setSelectedTable(null)}>✕</button>
            </div>

            <div className="tdp-qr">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                  buildQrUrl(restaurantId, selectedTable, "saas", restaurant?.custom_domain)
                )}&qzone=1`}
                alt="QR"
                width={100} height={100}
                style={{ borderRadius: 8 }}
              />
              <p className="tdp-qr-label">Scan to order</p>
            </div>

            {selectedOrders.length === 0 ? (
              <div className="tdp-empty">No active orders on this table.</div>
            ) : (
              <div className="tdp-orders">
                {selectedOrders.map((order) => (
                  <div key={order.id} className="tdp-order">
                    <div className="tdp-order-header">
                      <span className={`status-dot status-${order.status}`}>
                        {order.status}
                      </span>
                      <span className="tdp-order-total">{formatPrice(order.total, currency)}</span>
                    </div>
                    {order.items?.map((item, j) => (
                      <div key={j} className="tdp-item">
                        <span>{item.name}</span>
                        <span>×{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="tdp-grand-total">
                  Grand Total: <strong>
                    {formatPrice(selectedOrders.reduce((s, o) => s + (o.total || 0), 0), currency)}
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}

      <style>{`
        .table-legend {
          display: flex; gap: 16px; flex-wrap: wrap;
          margin-bottom: 24px; padding: 14px 18px;
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius);
        }
        .legend-item { display: flex; align-items: center; gap: 7px; font-size: 13px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .legend-label { color: var(--color-muted); }
        .legend-count { font-weight: 700; font-size: 12px; }

        .floor-layout { display: flex; gap: 20px; align-items: flex-start; }
        .table-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
          gap: 10px; flex: 1;
        }
        .table-cell {
          border: 2px solid; border-radius: 12px;
          padding: 12px 8px; text-align: center;
          cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
          min-height: 90px; display: flex; flex-direction: column;
          justify-content: center; gap: 3px;
        }
        .table-cell:hover { transform: scale(1.04); box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
        .table-cell.selected { box-shadow: 0 0 0 3px white; }
        .table-number { font-family: var(--font); font-size: 20px; font-weight: 800; }
        .table-status-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.8; }
        .table-total { font-size: 12px; font-weight: 700; margin-top: 4px; }
        .table-order-count { font-size: 10px; opacity: 0.7; }

        .table-detail-panel {
          width: 260px; flex-shrink: 0;
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius); overflow: hidden;
          position: sticky; top: 70px;
          animation: slideIn 0.2s ease;
        }
        .tdp-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px; border-bottom: 1px solid var(--color-border);
          font-family: var(--font); font-weight: 700; font-size: 15px;
        }
        .tdp-close { background: none; color: var(--color-muted); font-size: 18px; padding: 2px 6px; }
        .tdp-qr { text-align: center; padding: 16px; border-bottom: 1px solid var(--color-border); }
        .tdp-qr-label { font-size: 11px; color: var(--color-muted); margin-top: 6px; }
        .tdp-empty { padding: 20px; text-align: center; color: var(--color-muted); font-size: 13px; }
        .tdp-orders { padding: 12px; }
        .tdp-order {
          background: var(--color-surface2); border-radius: 8px;
          padding: 10px 12px; margin-bottom: 8px;
        }
        .tdp-order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .tdp-order-total { font-weight: 700; font-size: 13px; color: var(--color-primary); }
        .tdp-item { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; color: var(--color-muted); }
        .tdp-grand-total { font-size: 14px; padding-top: 10px; border-top: 1px solid var(--color-border); margin-top: 4px; }

        .tables-toolbar {
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px; flex-wrap: wrap; margin-bottom: 16px;
          padding: 12px 16px; background: var(--color-surface);
          border: 1px solid var(--color-border); border-radius: var(--radius);
        }
        .tables-plan { font-weight: 700; font-size: 14px; }
        .tables-actions { display: flex; gap: 8px; }

        .status-dot {
          font-size: 11px; padding: 3px 8px; border-radius: 10px;
          background: var(--color-surface); text-transform: capitalize;
        }
        .status-pending  { background: rgba(255,107,53,0.15); color: #ff6b35; }
        .status-confirmed{ background: rgba(247,147,30,0.15); color: #f7931e; }
        .status-preparing{ background: rgba(74,144,217,0.15); color: #4a90d9; }
        .status-ready    { background: rgba(39,174,96,0.15); color: #27ae60; }
      `}</style>
    </AdminLayout>
  );
}
