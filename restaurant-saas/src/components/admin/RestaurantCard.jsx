import { useState } from "react";
import { getPlanLabel, getExpiryInfo, formatExpiryDate } from "../../config/plans";
import { continuePlan, startDemo, resetDemoRestaurant } from "../../config/db";
import ConfirmModal from "./ConfirmModal";

export default function RestaurantCard({ restaurant, onEdit, onManageStaff, onViewQR, onMapDomain, onDelete }) {
  const [continuing, setContinuing] = useState(false);
  const [continued, setContinued] = useState(false);
  const [demoing, setDemoing] = useState(false);
  const [demoStarted, setDemoStarted] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "demo" | "reset"
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
    // Ask in the styled in-app dialog (not the browser's plain popup).
    setConfirmAction("demo");
  }

  async function confirmStartDemo() {
    setConfirmAction(null);
    setDemoing(true);
    try {
      await startDemo(restaurant.id);
      setDemoStarted(true);
      setTimeout(() => setDemoStarted(false), 3000);
    } finally {
      setDemoing(false);
    }
  }

  // Wipe a demo restaurant clean after visitors have played with it:
  // all orders, payment proofs and plan payments go, and the menu is
  // restored to the original seed. Plan, tables and settings are kept.
  async function handleResetDemo() {
    // Ask in the styled in-app dialog (not the browser's plain popup).
    setConfirmAction("reset");
  }

  async function confirmResetDemo() {
    setConfirmAction(null);
    setResetting(true);
    try {
      await resetDemoRestaurant(restaurant.id);
      setResetDone(true);
      setTimeout(() => setResetDone(false), 3000);
    } finally {
      setResetting(false);
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
        {restaurant.is_demo && (
          <button className="rc-btn" onClick={handleResetDemo} disabled={resetting} title="Delete all demo orders & payment proofs and restore the original menu">
            ↺ {resetDone ? "Demo reset ✓" : resetting ? "Resetting…" : "Reset demo"}
          </button>
        )}
      </div>
      {confirmAction === "demo" && (
        <ConfirmModal
          title="Start 7-day demo?"
          message={`Start a 7-day demo for ${restaurant.name}? The staff logins will stop working after 7 days unless you continue the plan.`}
          confirmLabel="Start demo"
          onConfirm={confirmStartDemo}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "reset" && (
        <ConfirmModal
          title="Reset demo?"
          message={`Reset the ${restaurant.name} demo? This deletes ALL its orders and payment proofs and restores the original menu. The plan, tables and settings stay as they are.`}
          confirmLabel="Reset demo"
          danger
          onConfirm={confirmResetDemo}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
