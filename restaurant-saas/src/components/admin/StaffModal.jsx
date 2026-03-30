import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getRestaurantUsers } from "../../config/db";

const STAFF_ROLES = [
  { value: "general_admin", label: "General Admin", icon: "🏪", desc: "Menu management & orders overview" },
  { value: "kitchen", label: "Kitchen Operator", icon: "👨‍🍳", desc: "Manage order preparation status" },
  { value: "cash_counter", label: "Cash Counter", icon: "💳", desc: "Process payments" },
  { value: "server", label: "Server / Order Taker", icon: "🛎️", desc: "Create manual orders" },
];

export default function StaffModal({ restaurant, onClose }) {
  const { registerStaff } = useAuth();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "kitchen" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [view, setView] = useState("list"); // "list" | "create"

  useEffect(() => {
    if (restaurant?.id) {
      getRestaurantUsers(restaurant.id).then(setStaff);
    }
  }, [restaurant?.id]);

  async function handleCreate(e) {
    e.preventDefault();
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

  const getRoleLabel = (role) => STAFF_ROLES.find((r) => r.value === role)?.label || role;
  const getRoleIcon = (role) => STAFF_ROLES.find((r) => r.value === role)?.icon || "👤";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Staff Management — {restaurant?.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button className={`modal-tab ${view === "list" ? "active" : ""}`}
            onClick={() => setView("list")}>
            Current Staff ({staff.length})
          </button>
          <button className={`modal-tab ${view === "create" ? "active" : ""}`}
            onClick={() => setView("create")}>
            + Add Staff
          </button>
        </div>

        <div className="modal-body">
          {success && <div className="success-banner">✅ {success}</div>}

          {view === "list" && (
            <div className="staff-list">
              {staff.length === 0 && (
                <div className="empty-state-sm">No staff members yet.</div>
              )}
              {staff.map((member) => (
                <div key={member.id} className="staff-row">
                  <div className="staff-avatar">{member.name?.[0]?.toUpperCase()}</div>
                  <div className="staff-info">
                    <span className="staff-name">{member.name}</span>
                    <span className="staff-email">{member.email}</span>
                  </div>
                  <span className={`role-badge role-${member.role}`}>
                    {getRoleIcon(member.role)} {getRoleLabel(member.role)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {view === "create" && (
            <form onSubmit={handleCreate} className="staff-form">
              {error && <div className="error-banner">{error}</div>}

              <div className="form-group">
                <label>Full Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="john@restaurant.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Temporary Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
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
                      onClick={() => setForm({ ...form, role: role.value })}
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
          )}
        </div>
      </div>
    </div>
  );
}
