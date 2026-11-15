import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getRestaurantUsers, subscribeToPlatformSettings, deleteUser } from "../../config/db";
import { getStaffLimit, getPlanLabel, normalizePlan } from "../../config/plans";
import { getDemoRemovedStaff, removeDemoStaff, restoreDemoStaff } from "../../utils/session";

const STAFF_ROLES = [
  { value: "general_admin", label: "Admin", icon: "🏪", desc: "Menu management & orders overview" },
  { value: "kitchen", label: "Kitchen Operator", icon: "👨‍🍳", desc: "Manage order preparation status" },
  { value: "cash_counter", label: "Cash Counter", icon: "💳", desc: "Process payments" },
  { value: "server", label: "Server / Order Taker", icon: "🛎️", desc: "Create manual orders" },
];

export default function StaffModal({ restaurant, onClose }) {
  const { registerStaff, currentUser } = useAuth();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "kitchen" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [view, setView] = useState("list"); // "list" | "create"
  const [platformLimits, setPlatformLimits] = useState(null);

  const plan = normalizePlan(restaurant?.plan);
  const staffLimit = getStaffLimit(plan, platformLimits);
  const atLimit = staff.length >= staffLimit;

  useEffect(() => {
    if (restaurant?.id) {
      getRestaurantUsers(restaurant.id).then(setStaff);
    }
  }, [restaurant?.id]);

  useEffect(() => {
    const unsub = subscribeToPlatformSettings(setPlatformLimits);
    return unsub;
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (atLimit) {
      setError(`Your ${getPlanLabel(plan)} plan allows up to ${staffLimit} staff logins. To add more staff, upgrade your plan or contact your administrator.`);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await registerStaff(form.email, form.password, form.name, form.role, restaurant.id);
      setSuccess(`${form.name} added as ${form.role}`);
      setForm({ name: "", email: "", password: "", role: "kitchen" });
      const updated = await getRestaurantUsers(restaurant.id);
      setStaff(updated);
      setView("list");
    } catch (err) {
      setError(err.message || "Failed to create staff member");
    }
    setLoading(false);
  }

  async function handleRemove(member) {
    const confirmText = restaurant?.is_demo
      ? `Hide ${member.name} in this browser? They will disappear from this staff list only, and return automatically after 24 hours. Their login keeps working.`
      : `Remove ${member.name}? Their login will stop working for ${restaurant?.name}.`;
    if (!window.confirm(confirmText)) return;
    setError("");
    // On a demo restaurant the removal is per-browser only (localStorage,
    // 24h): another visitor elsewhere still sees them, and they return on
    // their own after 24 hours. The account itself is never deleted — the
    // demo admin may remove any staff row, including other demo accounts.
    if (restaurant?.is_demo) {
      removeDemoStaff(restaurant.id, member.id);
      setStaff(await getRestaurantUsers(restaurant.id));
      setSuccess(`${member.name} hidden in this browser — they return automatically after 24 hours.`);
      return;
    }
    try {
      await deleteUser(member.id);
      setStaff(await getRestaurantUsers(restaurant.id));
      setSuccess(`${member.name} removed.`);
    } catch (err) {
      setError(err.message || "Failed to remove staff member");
    }
  }

  async function handleRestoreStaff(member) {
    restoreDemoStaff(restaurant.id, member.id);
    setStaff(await getRestaurantUsers(restaurant.id));
    setSuccess(`${member.name} restored.`);
  }

  const getRoleLabel = (role) => STAFF_ROLES.find((r) => r.value === role)?.label || role;
  const getRoleIcon = (role) => STAFF_ROLES.find((r) => r.value === role)?.icon || "👤";

  // On a demo restaurant, staff removed in THIS browser (localStorage, 24h)
  // are hidden here only — another browser still sees them.
  const demoRemoved = restaurant?.is_demo ? getDemoRemovedStaff(restaurant.id) : new Set();
  const visibleStaff = staff.filter((m) => !demoRemoved.has(m.id));
  const removedStaff = staff.filter((m) => demoRemoved.has(m.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Staff Management — {restaurant?.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="form-hint" style={{ margin: "0 0 12px" }}>
          📋 {getPlanLabel(plan)} plan — {staff.length} / {staffLimit} staff logins
        </p>

        <div className="modal-tabs">
          <button className={`modal-tab ${view === "list" ? "active" : ""}`}
            onClick={() => setView("list")}>
            Current Staff ({visibleStaff.length})
          </button>
          <button className={`modal-tab ${view === "create" ? "active" : ""}`}
            onClick={() => setView("create")}>
            + Add Staff
          </button>
        </div>

        <div className="modal-body">
          {success && <div className="success-banner">✅ {success}</div>}

          {view === "list" && (
            <>
            <div className="staff-list">
              {visibleStaff.length === 0 && (
                <div className="empty-state-sm">No staff members yet.</div>
              )}
              {visibleStaff.map((member) => (
                <div key={member.id} className="staff-row">
                  <div className="staff-avatar">{member.name?.[0]?.toUpperCase()}</div>
                  <div className="staff-info">
                    <span className="staff-name">{member.name}</span>
                    <span className="staff-email">{member.email}</span>
                  </div>
                  <span className={`role-badge role-${member.role}`}>
                    {getRoleIcon(member.role)} {getRoleLabel(member.role)}
                  </span>
                  {member.id !== currentUser?.uid && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Remove staff member"
                      onClick={() => handleRemove(member)}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
            {removedStaff.length > 0 && (
              <div className="staff-list" style={{ marginTop: 16 }}>
                <p className="form-hint" style={{ margin: "0 0 8px" }}>
                  🙈 Hidden staff — only you can see these (they return automatically after 24 hours)
                </p>
                {removedStaff.map((member) => (
                  <div key={member.id} className="staff-row" style={{ opacity: 0.6 }}>
                    <div className="staff-avatar">{member.name?.[0]?.toUpperCase()}</div>
                    <div className="staff-info">
                      <span className="staff-name">{member.name}</span>
                      <span className="staff-email">{member.email}</span>
                    </div>
                    <span className={`role-badge role-${member.role}`}>
                      {getRoleIcon(member.role)} {getRoleLabel(member.role)}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Restore staff member"
                      onClick={() => handleRestoreStaff(member)}
                    >
                      ↩️
                    </button>
                  </div>
                ))}
              </div>
            )}
            </>
          )}

          {view === "create" && (
            atLimit ? (
              <div className="modal-info">
                ⬆️ Your {getPlanLabel(plan)} plan allows up to {staffLimit} staff logins.
                To add more staff, upgrade your plan or contact your administrator.
              </div>
            ) : (
            <form onSubmit={handleCreate} className="staff-form">
              {error && <div className="error-banner">{error}</div>}

              <div className="form-group">
                <label>Full Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="john@restaurant.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Temporary Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <div className="role-selector">
                  {STAFF_ROLES.map((role) => (
                    <div
                      key={role.value}
                      className={`role-option ${form.role === role.value ? "selected" : ""}`}
                      onClick={() => setForm((f) => ({ ...f, role: role.value }))}
                    >
                      <span className="role-option-icon">{role.icon}</span>
                      <div>
                        <div className="role-option-label">{role.label}</div>
                        <div className="role-option-desc">{role.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Creating..." : "Create Staff Account"}
              </button>
            </form>
            )
          )}
        </div>
      </div>
    </div>
  );
}
