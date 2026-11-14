import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getPlatformSettings, updatePlatformSettings } from "../config/db";
import { DEFAULT_PLAN_LIMITS, DEFAULT_STAFF_LIMITS } from "../config/plans";
import AdminLayout from "../components/admin/AdminLayout";

// Super admin only: the table cap for each plan. Restaurant owners can
// lower their table count anytime, but cannot raise it above their plan's
// limit — these numbers are that limit. Premium = 0 means no cap.
export default function PlatformSettingsPage() {
  const { userProfile, logout } = useAuth();
  const [form, setForm] = useState({
    basic: DEFAULT_PLAN_LIMITS.basic,
    standard: DEFAULT_PLAN_LIMITS.standard,
    premium: DEFAULT_PLAN_LIMITS.premium,
    basic_staff: DEFAULT_STAFF_LIMITS.basic,
    standard_staff: DEFAULT_STAFF_LIMITS.standard,
    premium_staff: DEFAULT_STAFF_LIMITS.premium,
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // A failed read (e.g. rules not published yet) must not leave the page
  // stuck on "Loading settings…" — the form opens with the defaults instead.
  useEffect(() => {
    getPlatformSettings()
      .then((s) => {
        if (s) {
          setForm({
            basic: Number(s.basic ?? DEFAULT_PLAN_LIMITS.basic),
            standard: Number(s.standard ?? DEFAULT_PLAN_LIMITS.standard),
            premium: Number(s.premium ?? DEFAULT_PLAN_LIMITS.premium),
            basic_staff: Number(s.basic_staff ?? DEFAULT_STAFF_LIMITS.basic),
            standard_staff: Number(s.standard_staff ?? DEFAULT_STAFF_LIMITS.standard),
            premium_staff: Number(s.premium_staff ?? DEFAULT_STAFF_LIMITS.premium),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updatePlatformSettings({
        basic: Math.max(1, Math.floor(form.basic) || DEFAULT_PLAN_LIMITS.basic),
        standard: Math.max(1, Math.floor(form.standard) || DEFAULT_PLAN_LIMITS.standard),
        premium: Math.max(0, Math.floor(form.premium) || 0),
        basic_staff: Math.max(1, Math.floor(form.basic_staff) || DEFAULT_STAFF_LIMITS.basic),
        standard_staff: Math.max(1, Math.floor(form.standard_staff) || DEFAULT_STAFF_LIMITS.standard),
        premium_staff: Math.max(1, Math.floor(form.premium_staff) || DEFAULT_STAFF_LIMITS.premium),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to save settings.");
    }
    setSaving(false);
  }

  return (
    <AdminLayout
      title="⚙️ Platform Settings"
      subtitle="Plans & table limits"
      onLogout={logout}
      userProfile={userProfile}
    >
      {!loaded ? (
        <p style={{ color: "var(--color-muted)", padding: 24 }}>Loading settings…</p>
      ) : (
        <form onSubmit={handleSave} className="settings-page">
          {saved && <div className="success-banner">✅ Settings saved successfully.</div>}
          {error && <div className="error-banner">{error}</div>}

          <section className="settings-section">
            <h2 className="settings-section-title">💳 Plans & Table Limits</h2>
            <p className="form-hint">
              Each plan caps how many tables a restaurant may have. Restaurant admins
              can lower their table count anytime, but cannot raise it above their
              plan&apos;s limit — at the limit, their + Add Table button shows an
              upgrade message instead.
            </p>
            <div className="settings-grid">
              <div className="form-group">
                <label>Basic plan — max tables</label>
                <input type="number" min="1" value={form.basic}
                  onChange={(e) => setForm({ ...form, basic: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="form-group">
                <label>Standard plan — max tables</label>
                <input type="number" min="1" value={form.standard}
                  onChange={(e) => setForm({ ...form, standard: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="form-group">
                <label>Premium plan — max tables</label>
                <input type="number" min="0" value={form.premium}
                  onChange={(e) => setForm({ ...form, premium: parseInt(e.target.value) || 0 })} />
                <p className="form-hint">0 = no limit at all.</p>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">👥 Plans & Staff Limits</h2>
            <p className="form-hint">
              Each plan caps how many staff logins a restaurant may have. At the
              limit, the + Add Staff button shows an upgrade message instead.
            </p>
            <div className="settings-grid">
              <div className="form-group">
                <label>Basic plan — max staff logins</label>
                <input type="number" min="1" value={form.basic_staff}
                  onChange={(e) => setForm({ ...form, basic_staff: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="form-group">
                <label>Standard plan — max staff logins</label>
                <input type="number" min="1" value={form.standard_staff}
                  onChange={(e) => setForm({ ...form, standard_staff: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="form-group">
                <label>Premium plan — max staff logins</label>
                <input type="number" min="1" value={form.premium_staff}
                  onChange={(e) => setForm({ ...form, premium_staff: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
          </section>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      )}
    </AdminLayout>
  );
}
