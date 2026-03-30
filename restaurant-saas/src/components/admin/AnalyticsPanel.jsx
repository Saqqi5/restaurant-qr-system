export default function AnalyticsPanel({ orders, menuItems }) {
  const paid = orders.filter((o) => o.payment_status === "paid");
  const totalRevenue = paid.reduce((s, o) => s + (o.total || 0), 0);
  const avgOrder = paid.length ? totalRevenue / paid.length : 0;

  // Top items by quantity sold
  const itemSales = {};
  paid.forEach((order) => {
    order.items?.forEach((item) => {
      itemSales[item.name] = (itemSales[item.name] || 0) + item.quantity;
    });
  });
  const topItems = Object.entries(itemSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Orders by hour
  const byHour = Array(24).fill(0);
  orders.forEach((o) => {
    const h = o.created_at?.toDate?.()?.getHours?.();
    if (h !== undefined) byHour[h]++;
  });
  const peakHour = byHour.indexOf(Math.max(...byHour));

  const statusBreakdown = {
    paid: orders.filter((o) => o.payment_status === "paid").length,
    unpaid: orders.filter((o) => o.payment_status === "unpaid").length,
  };

  return (
    <div className="analytics-panel">
      <h3>Analytics Overview</h3>

      <div className="analytics-stats">
        <div className="analytics-card">
          <div className="analytics-icon">💰</div>
          <div className="analytics-value">${totalRevenue.toFixed(2)}</div>
          <div className="analytics-label">Total Revenue</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-icon">📋</div>
          <div className="analytics-value">{orders.length}</div>
          <div className="analytics-label">Total Orders</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-icon">📊</div>
          <div className="analytics-value">${avgOrder.toFixed(2)}</div>
          <div className="analytics-label">Avg Order Value</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-icon">⏰</div>
          <div className="analytics-value">{peakHour}:00</div>
          <div className="analytics-label">Peak Hour</div>
        </div>
      </div>

      <div className="analytics-section">
        <h4>Top Selling Items</h4>
        {topItems.length === 0 && <p className="no-data">No sales data yet.</p>}
        {topItems.map(([name, qty], i) => (
          <div key={name} className="top-item-row">
            <span className="top-item-rank">#{i + 1}</span>
            <span className="top-item-name">{name}</span>
            <div className="top-item-bar-wrap">
              <div
                className="top-item-bar"
                style={{ width: `${(qty / (topItems[0]?.[1] || 1)) * 100}%` }}
              />
            </div>
            <span className="top-item-qty">{qty} sold</span>
          </div>
        ))}
      </div>

      <div className="analytics-section">
        <h4>Payment Status</h4>
        <div className="payment-breakdown">
          <div className="pb-item paid">
            <span>Paid</span>
            <strong>{statusBreakdown.paid}</strong>
          </div>
          <div className="pb-item unpaid">
            <span>Unpaid</span>
            <strong>{statusBreakdown.unpaid}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
