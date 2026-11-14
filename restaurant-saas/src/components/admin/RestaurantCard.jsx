import { useState } from "react";
import { getPlanLabel, getExpiryInfo, formatExpiryDate } from "../../config/plans";
import { continuePlan, startDemo } from "../../config/db";

export default function RestaurantCard({ restaurant, onEdit, onManageStaff, onViewQR, onMapDomain, onDelete }) {
  const [continuing, setContinuing] = useState(false);
  const [continued, setContinued] = useState(false);
  const [demoing, setDemoing] = useState(false);
  const [demoStarted, setDemoStarted] = useState(false);
  const expiry = getExpiryInfo(restaurant);

  async function handleContinue() {
    setContinuing(true);
    try {
      await continuePlan(restaurant.id);
      setContinued(true);
      setTimeout(() => setContinued(false), 3000);
    } finally {
      setContinuing(false);
    }
  }

  // Lend this restaurant as a 7-day demo. Ask first — it puts an expiry
  // on the restaurant, after which the staff logins block.
  async function handleStartDemo() {
    if (!window.confirm(
      `Start a 7-day demo for ${restaurant.name}? The staff logins will stop working after 7 days unless you continue the plan.`
    )) return;
    setDemoing(true);
    try {
      await startDemo(restaurant.id);
      setDemoStarted(true);
      setTimeout(() => setDemoStarted(false), 3000);
    } finally {
      setDemoing(false);
    }
  }

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
        <div className="rc-meta-item">
          <span>💳</span> {getPlanLabel(restaurant.plan)} plan
        </div>
        {expiry.expiresAt && (
          <div className={`rc-meta-item ${expiry.expired ? "rc-expired" : ""}`}>
            <span>🗓️</span>{" "}
            {expiry.expired
              ? `Expired ${formatExpiryDate(expiry.expiresAt)} — login blocked`
              : `Plan ends ${formatExpiryDate(expiry.expiresAt)}`}
          </div>
        )}
      </div>

      <div className="rc-actions">
        <button className="rc-btn" onClick={onEdit} title="Edit">✏️ Edit</button>
        <button className="rc-btn" onClick={onManageStaff} title="Staff">👥 Staff</button>
        <button className="rc-btn" onClick={onViewQR} title="QR Codes">📱 QR</button>
        <button className="rc-btn" onClick={onMapDomain} title="Domain">🌐 Domain</button>
        <button className="rc-btn" onClick={onDelete} title="Delete restaurant"
          style={{ color: "#ff6b6b" }}>🗑️ Delete</button>
      </div>
      <div className="rc-actions" style={{ marginTop: 8 }}>
        <button className="rc-btn" onClick={handleContinue} disabled={continuing} title="Extend the plan by 30 days">
          ▶️ {continued ? "Continued ✓" : continuing ? "Continuing…" : "Continue plan (30 days)"}
        </button>
        <button className="rc-btn" onClick={handleStartDemo} disabled={demoing} title="Lend this restaurant as a 7-day demo — staff logins stop after 7 days">
          🎁 {demoStarted ? "Demo started ✓" : demoing ? "Starting…" : "7-day demo"}
        </button>
      </div>
    </div>
  );
}
