import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getRestaurantUsers, subscribeToPlatformSettings, deleteUser, setUserDisabled } from "../../config/db";
import { getStaffLimit, getPlanLabel, normalizePlan } from "../../config/plans";
import { getDemoRemovedStaff, removeDemoStaff, restoreDemoStaff } from "../../utils/session";
import ConfirmModal from "./ConfirmModal";

const STAFF_ROLES = [
  { value: "general_admin", label: "Admin", icon: "🏪", desc: "Menu management & orders overview" },
  { value: "kitchen", label: "Kitchen Operator", icon: "👨‍🍳", desc: "Manage order preparation status" },
  { value: "cash_counter", label: "Cash Counter", icon: "💳", desc: "Process payments" },
  { value: "server", label: "Server / Order Taker", icon: "🛎️", desc: "Create manual orders" },
];

export default function StaffModal({ restaurant, onClose }) {
  const { registerStaff, resetStaffPassword, updateStaff, currentUser, userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === "super_admin";
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "kitchen" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [view, setView] = useState("list"); // "list" | "create" | "edit"
  const [platformLimits, setPlatformLimits] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null); // staff member awaiting remove/hide confirm
  const [pendingReset, setPendingReset] = useState(null); // staff member awaiting password reset
  const [resetResult, setResetResult] = useState(null); // { name, password } after a reset
  const [resetting, setResetting] = useState(false);
  const [disabling, setDisabling] = useState(null); // member id being disabled/enabled
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(null); // staff member being edited
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "kitchen" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

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

  function handleRemove(member) {
    // Ask in the styled in-app dialog (not the browser's plain popup).
    setPendingRemove(member);
  }

  // One-click password reset (super admin only): the Worker sets a new
  // password for the staff member and returns it once, so the super admin
  // can share it. The staff member's old sessions stop working at once.
  function handleReset(member) {
    setPendingReset(member);
  }

  async function confirmReset() {
    const member = pendingReset;
    setPendingReset(null);
    if (!member) return;
    setError("");
    setResetting(true);
    try {
      const password = await resetStaffPassword(member.id);
      setResetResult({ name: member.name, password });
      setSuccess("");
    } catch (err) {
      setError(err.message || "Password reset failed.");
    }
    setResetting(false);
  }

  async function copyResetPassword() {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — the password can still be selected */ }
  }

  // Disable / enable ONE staff login (super admin only). Disabled: that
  // login is blocked with "Your account is disabled. Please contact your
  // administrator." — live, even if they are signed in right now. One
  // click enables them again.
  // Edit an existing staff login (SUPER ADMIN ONLY — a restaurant admin
  // or branch manager never sees the edit button): name, email (username)
  // and role. The email is the login username — if it was typed wrong at
  // creation, fix it here instead of deleting + recreating. The Worker
  // updates both the Firebase Auth login and the staff record.
  function handleEdit(member) {
    setEditing(member);
    setEditForm({ name: member.name || "", email: member.email || "", role: member.role || "kitchen" });
    setEditError("");
    setView("edit");
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setEditError("");
    setEditSaving(true);
    try {
      await updateStaff(editing.id, { name: editForm.name.trim(), email: editForm.email.trim(), role: editForm.role });
      setSuccess(`${editForm.name} updated.`);
      setStaff(await getRestaurantUsers(restaurant.id));
      setEditing(null);
      setView("list");
    } catch (err) {
      setEditError(err.message || "Failed to update staff member");
    }
    setEditSaving(false);
  }

  async function handleToggleDisabled(member) {
    setDisabling(member.id);
    setError("");
    setSuccess("");
    try {
      const disabled = !member.is_disabled;
      await setUserDisabled(member.id, disabled);
      setStaff((prev) => prev.map((m) => (m.id === member.id ? { ...m, is_disabled: disabled } : m)));
      setSuccess(`${member.name} ${disabled ? "disabled — their login is now blocked." : "enabled — they can sign in again."}`);
    } catch (e) {
      setError(e.message || "Failed to update staff member");
    }
    setDisabling(null);
  }

  async function confirmRemove() {
    const member = pendingRemove;
    setPendingRemove(null);
    if (!member) return;
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
            onClick={() => { setEditing(null); setView("list"); }}>
            Current Staff ({visibleStaff.length})
          </button>
          <button className={`modal-tab ${view === "create" ? "active" : ""}`}
            onClick={() => { setEditing(null); setView("create"); }}>
            + Add Staff
          </button>
          {view === "edit" && (
            <button className="modal-tab active">
              ✏️ Edit Staff
            </button>
          )}
        </div>

        <div className="modal-body">
          {success && <div className="success-banner">✅ {success}</div>}

          {resetResult && (
            <div className="reset-result">
              <div><strong>New password for {resetResult.name}:</strong></div>
              <div className="reset-result-row">
                <code>{resetResult.password}</code>
                <button type="button" className="btn-secondary btn-sm" onClick={copyResetPassword}>
                  {copied ? "Copied ✓" : "Copy"}
                </button>
                <button type="button" className="icon-btn" onClick={() => setResetResult(null)}>✕</button>
              </div>
              <div className="form-hint">Share it with them — ask them to change it after they log in (🔒 Password button).</div>
            </div>
          )}

          {view === "list" && (
            <>
            <div className="staff-list">
              {visibleStaff.length === 0 && (
                <div className="empty-state-sm">No staff members yet.</div>
              )}
              {visibleStaff.map((member) => (
                <div key={member.id} className="staff-row">
                  <div className="staff-row-top">
                    <div className="staff-avatar">{member.name?.[0]?.toUpperCase()}</div>
                    <div className="staff-info">
                      <span className="staff-name">{member.name}</span>
                      <span className="staff-email">{member.email}</span>
                    </div>
                  </div>
                  <div className="staff-row-bottom">
                    <span className={`role-badge role-${member.role}`}>
                      {getRoleIcon(member.role)} {getRoleLabel(member.role)}
                    </span>
                    {member.is_disabled && (
                      <span className="disabled-badge" title="This login is disabled">
                        🚫 Disabled
                      </span>
                    )}
                    <div className="staff-actions">
                      {isSuperAdmin && member.id !== currentUser?.uid && (
                        <button
                          type="button"
                          className="icon-btn"
                          title="Edit name, email or role"
                          onClick={() => handleEdit(member)}
                        >
                          ✏️
                        </button>
                      )}
                      {isSuperAdmin && member.id !== currentUser?.uid && (
                        <button
                          type="button"
                          className="icon-btn"
                          title={member.is_disabled ? "Enable this login" : "Disable this login"}
                          onClick={() => handleToggleDisabled(member)}
                          disabled={disabling === member.id}
                        >
                          {member.is_disabled ? "✅" : "🚫"}
                        </button>
                      )}
                      {isSuperAdmin && member.id !== currentUser?.uid && (
                        <button
                          type="button"
                          className="icon-btn"
                          title="Reset password"
                          onClick={() => handleReset(member)}
                        >
                          🔑
                        </button>
                      )}
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
                  </div>
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
                    <div className="staff-row-top">
                      <div className="staff-avatar">{member.name?.[0]?.toUpperCase()}</div>
                      <div className="staff-info">
                        <span className="staff-name">{member.name}</span>
                        <span className="staff-email">{member.email}</span>
                      </div>
                    </div>
                    <div className="staff-row-bottom">
                      <span className={`role-badge role-${member.role}`}>
                        {getRoleIcon(member.role)} {getRoleLabel(member.role)}
                      </span>
                      <div className="staff-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Restore staff member"
                          onClick={() => handleRestoreStaff(member)}
                        >
                          ↩️
                        </button>
                      </div>
                    </div>
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

          {view === "edit" && editing && (
            <form onSubmit={handleSaveEdit} className="staff-form">
              {editError && <div className="error-banner">{editError}</div>}
              <p className="form-hint" style={{ margin: "0 0 12px" }}>
                Change the name, login email or role. The email is the username they sign in with — fix it here if it was typed wrong. The password is changed separately with the 🔑 button.
              </p>

              <div className="form-group">
                <label>Full Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email (login username)</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="john@restaurant.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <div className="role-selector">
                  {STAFF_ROLES.map((role) => (
                    <div
                      key={role.value}
                      className={`role-option ${editForm.role === role.value ? "selected" : ""}`}
                      onClick={() => setEditForm((f) => ({ ...f, role: role.value }))}
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

              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn-primary" disabled={editSaving} style={{ flex: 1 }}>
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setView("list"); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      {pendingRemove && (
        <ConfirmModal
          title={restaurant?.is_demo ? "Hide staff member?" : "Remove staff member?"}
          message={restaurant?.is_demo
            ? `Hide ${pendingRemove.name} in this browser? They will disappear from this staff list only, and return automatically after 24 hours. Their login keeps working.`
            : `Remove ${pendingRemove.name}? Their login will stop working for ${restaurant?.name}.`}
          confirmLabel={restaurant?.is_demo ? "Hide in this browser" : "Remove"}
          danger={!restaurant?.is_demo}
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemove(null)}
        />
      )}
      {pendingReset && (
        <ConfirmModal
          title="Reset password?"
          message={`Reset the password for ${pendingReset.name}? They will get a new password — share it with them and ask them to change it after they log in.`}
          confirmLabel={resetting ? "Resetting…" : "Reset password"}
          onConfirm={confirmReset}
          onCancel={() => setPendingReset(null)}
        />
      )}
    </div>
  );
}
