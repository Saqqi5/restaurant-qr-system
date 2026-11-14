import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getPlatformSettings, updatePlatformSettings } from "../config/db";
import { DEFAULT_PLAN_LIMITS, DEFAULT_STAFF_LIMITS, DEFAULT_MENU_LIMITS, DEFAULT_PLAN_PRICES } from "../config/plans";
import AdminLayout from "../components/admin/AdminLayout";

// Super admin only: the table cap, staff cap, menu-item cap and monthly
// price for each plan, plus the platform's own payment accounts (the
// accounts owners pay into when they buy a plan). Restaurant owners can
// lower their table count anytime, but cannot raise it above their plan's
// limit — these numbers are that limit.
export default function PlatformSettingsPage() {
  const { userProfile, logout } = useAuth();
  const [form, setForm] = useState({
    basic: DEFAULT_PLAN_LIMITS.basic,
    standard: DEFAULT_PLAN_LIMITS.standard,
    premium: DEFAULT_PLAN_LIMITS.premium,
    basic_staff: DEFAULT_STAFF_LIMITS.basic,
    standard_staff: DEFAULT_STAFF_LIMITS.standard,
    premium_staff: DEFAULT_STAFF_LIMITS.premium,
    basic_menu: DEFAULT_MENU_LIMITS.basic,
    standard_menu: DEFAULT_MENU_LIMITS.standard,
    premium_menu: DEFAULT_MENU_LIMITS.premium,
    basic_price: DEFAULT_PLAN_PRICES.basic,
    standard_price: DEFAULT_PLAN_PRICES.standard,
    premium_price: DEFAULT_PLAN_PRICES.premium,
    platform_easypaisa_number: "",
    platform_easypaisa_name: "",
    platform_jazzcash_number: "",
    platform_jazzcash_name: "",
    platform_bank_iban: "",
    platform_bank_name: "",
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
            basic_menu: Number(s.basic_menu ?? DEFAULT_MENU_LIMITS.basic),
            standard_menu: Number(s.standard_menu ?? DEFAULT_MENU_LIMITS.standard),
            premium_menu: Number(s.premium_menu ?? DEFAULT_MENU_LIMITS.premium),
            basic_price: Number(s.basic_price ?? DEFAULT_PLAN_PRICES.basic),
            standard_price: Number(s.standard_price ?? DEFAULT_PLAN_PRICES.standard),
            premium_price: Number(s.premium_price ?? DEFAULT_PLAN_PRICES.premium),
            platform_easypaisa_number: s.platform_easypaisa_number || "",
            platform_easypaisa_name: s.platform_easypaisa_name || "",
            platform_jazzcash_number: s.platform_jazzcash_number || "",
            platform_jazzcash_name: s.platform_jazzcash_name || "",
            platform_bank_iban: s.platform_bank_iban || "",
            platform_bank_name: s.platform_bank_name || "",
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
        premium: Math.max(1, Math.floor(form.premium) || DEFAULT_PLAN_LIMITS.premium),
        basic_staff: Math.max(1, Math.floor(form.basic_staff) || DEFAULT_STAFF_LIMITS.basic),
        standard_staff: Math.max(1, Math.floor(form.standard_staff) || DEFAULT_STAFF_LIMITS.standard),
        premium_staff: Math.max(1, Math.floor(form.premium_staff) || DEFAULT_STAFF_LIMITS.premium),
        basic_menu: Math.max(0, Math.floor(form.basic_menu) || 0),
        standard_menu: Math.max(0, Math.floor(form.standard_menu) || 0),
        premium_menu: Math.max(0, Math.floor(form.premium_menu) || 0),
        basic_price: Math.max(1, Math.floor(form.basic_price) || DEFAULT_PLAN_PRICES.basic),
        standard_price: Math.max(1, Math.floor(form.standard_price) || DEFAULT_PLAN_PRICES.standard),
        premium_price: Math.max(1, Math.floor(form.premium_price) || DEFAULT_PLAN_PRICES.premium),
        platform_easypaisa_number: form.platform_easypaisa_number.trim(),
        platform_easypaisa_name: form.platform_easypaisa_name.trim(),
        platform_jazzcash_number: form.platform_jazzcash_number.trim(),
        platform_jazzcash_name: form.platform_jazzcash_name.trim(),
        platform_bank_iban: form.platform_bank_iban.trim(),
        platform_bank_name: form.platform_bank_name.trim(),
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
                <input type="number" min="1" value={form.premium}
                  onChange={(e) => setForm({ ...form, premium: parseInt(e.target.value) || 1 })} />
                <p className="form-hint">
                  {`${form.premium} tables max.`}
                </p>
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

          <section className="settings-section">
            <h2 className="settings-section-title">🍽️ Plans & Menu Item Limits</h2>
            <p className="form-hint">
              Each plan caps how many dishes a restaurant may add to its menu. At
              the limit, their + Add Item button shows an upgrade message instead.
              Set 0 for unlimited.
            </p>
            <div className="settings-grid">
              <div className="form-group">
                <label>Basic plan — max menu items</label>
                <input type="number" min="0" value={form.basic_menu}
                  onChange={(e) => setForm({ ...form, basic_menu: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Standard plan — max menu items</label>
                <input type="number" min="0" value={form.standard_menu}
                  onChange={(e) => setForm({ ...form, standard_menu: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Premium plan — max menu items</label>
                <input type="number" min="0" value={form.premium_menu}
                  onChange={(e) => setForm({ ...form, premium_menu: parseInt(e.target.value) || 0 })} />
                <p className="form-hint">
                  {form.premium_menu === 0 ? "∞ Unlimited — Premium has no menu item limit." : `${form.premium_menu} menu items max.`}
                </p>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">💰 Plan Prices (PKR / month)</h2>
            <p className="form-hint">
              What owners pay per month for each plan. These are the prices shown
              in the Upgrade Plan section of a restaurant&apos;s Settings and on
              the landing page.
            </p>
            <div className="settings-grid">
              <div className="form-group">
                <label>Basic plan — price (Rs.)</label>
                <input type="number" min="1" value={form.basic_price}
                  onChange={(e) => setForm({ ...form, basic_price: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="form-group">
                <label>Standard plan — price (Rs.)</label>
                <input type="number" min="1" value={form.standard_price}
                  onChange={(e) => setForm({ ...form, standard_price: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="form-group">
                <label>Premium plan — price (Rs.)</label>
                <input type="number" min="1" value={form.premium_price}
                  onChange={(e) => setForm({ ...form, premium_price: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">💳 Platform Payment Accounts</h2>
            <p className="form-hint">
              The SAQLYN accounts owners pay into when they buy or upgrade a plan.
              These are shown on the restaurant&apos;s Upgrade Plan screen. Until
              they are filled in, owners are told to contact the administrator.
            </p>
            <div className="settings-grid">
              <div className="form-group">
                <label>EasyPaisa Number</label>
                <input type="text" value={form.platform_easypaisa_number}
                  onChange={(e) => setForm({ ...form, platform_easypaisa_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label>EasyPaisa Account Name</label>
                <input type="text" value={form.platform_easypaisa_name}
                  onChange={(e) => setForm({ ...form, platform_easypaisa_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>JazzCash Number</label>
                <input type="text" value={form.platform_jazzcash_number}
                  onChange={(e) => setForm({ ...form, platform_jazzcash_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label>JazzCash Account Name</label>
                <input type="text" value={form.platform_jazzcash_name}
                  onChange={(e) => setForm({ ...form, platform_jazzcash_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Bank IBAN</label>
                <input type="text" value={form.platform_bank_iban}
                  onChange={(e) => setForm({ ...form, platform_bank_iban: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Bank Account Title</label>
                <input type="text" value={form.platform_bank_name}
                  onChange={(e) => setForm({ ...form, platform_bank_name: e.target.value })} />
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
