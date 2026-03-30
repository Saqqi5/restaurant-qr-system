export default function RestaurantCard({ restaurant, onEdit, onManageStaff, onViewQR, onMapDomain }) {
  return (
    <div className={`restaurant-card ${!restaurant.active ? "inactive" : ""}`}>
      <div className="rc-header">
        {restaurant.logo_url
          ? <img src={restaurant.logo_url} alt={restaurant.name} className="rc-logo" />
          : <div className="rc-logo-placeholder">🏪</div>
        }
        <div className="rc-title">
          <h3>{restaurant.name}</h3>
          <span className="rc-id">ID: {restaurant.id?.slice(0, 8)}...</span>
        </div>
        <span className={`rc-status ${restaurant.active ? "active" : "inactive"}`}>
          {restaurant.active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="rc-meta">
        <div className="rc-meta-item">
          <span>🪑</span> {restaurant.table_count} tables
        </div>
        <div className="rc-meta-item">
          <span>🌐</span> {restaurant.custom_domain || "No custom domain"}
        </div>
        <div className="rc-meta-item">
          <span>📋</span> /{restaurant.slug || restaurant.id?.slice(0, 8)}
        </div>
      </div>

      <div className="rc-actions">
        <button className="rc-btn" onClick={onEdit} title="Edit">✏️ Edit</button>
        <button className="rc-btn" onClick={onManageStaff} title="Staff">👥 Staff</button>
        <button className="rc-btn" onClick={onViewQR} title="QR Codes">📱 QR</button>
        <button className="rc-btn" onClick={onMapDomain} title="Domain">🌐 Domain</button>
      </div>
    </div>
  );
}
