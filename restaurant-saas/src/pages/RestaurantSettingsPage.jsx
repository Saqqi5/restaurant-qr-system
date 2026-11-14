import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { updateRestaurant, getRestaurant, subscribeToPlatformSettings } from "../config/db";
import { getPlanLimit, getPlanLabel, normalizePlan } from "../config/plans";
import { downscaleImage } from "../utils/image";
import AdminLayout from "../components/admin/AdminLayout";

const PRESET_THEMES = [
  { name: "Ember",     primary: "#e85d04", accent: "#f48c06" },
  { name: "Ocean",     primary: "#0077b6", accent: "#00b4d8" },
  { name: "Forest",    primary: "#2d6a4f", accent: "#52b788" },
  { name: "Plum",      primary: "#7b2d8b", accent: "#c77dff" },
  { name: "Slate",     primary: "#2b2d42", accent: "#8d99ae" },
  { name: "Rose",      primary: "#c1121f", accent: "#e63946" },
];

export default function RestaurantSettingsPage() {
  const { userProfile, restaurantId, logout } = useAuth();
  const { restaurant } = useTenant();

  const [platformLimits, setPlatformLimits] = useState(null);
  const [plan, setPlan] = useState("standard");
  const [form, setForm] = useState({
    name: "", table_count: 10, logo_url: "",
    theme: { primary: "#e85d04", accent: "#f48c06" },
    tax_rate: 0, discount_rate: 0,
    payment_easypaisa_number: "0300-1234567",
    payment_easypaisa_name: "Saqlyn Payments",
    payment_jazzcash_number: "0311-7654321",
    payment_jazzcash_name: "Saqlyn Payments",
    payment_bank_iban: "PK12 HABB 0000 0012 3456 7890",
    payment_bank_name: "Saqlyn Restaurant Ltd",
  });
  const [loaded, setLoaded] = useState(false);
  const planLimit = getPlanLimit(plan, platformLimits);
  // Owners may lower the count anytime; the cap is the plan limit, or the
  // current count when already above it (grandfathered — cannot grow further).
  const maxTables = planLimit === null ? 500 : Math.max(form.table_count || 1, planLimit);

  useEffect(() => {
    const unsub = subscribeToPlatformSettings(setPlatformLimits);
    return unsub;
  }, []);

  // TenantContext is empty on /admin/* routes, so load the restaurant doc
  // directly — without this the form opens blank and saving wipes the name.
  useEffect(() => {
    if (!restaurantId) return;
    getRestaurant(restaurantId).then((r) => {
      if (r) {
        setPlan(normalizePlan(r.plan));
        setForm({
          name: r.name || "",
          table_count: r.table_count || 10,
          logo_url: r.logo_url || "",
          theme: r.theme || { primary: "#e85d04", accent: "#f48c06" },
          tax_rate: Number(r.tax_rate) || 0,
          discount_rate: Number(r.discount_rate) || 0,
          payment_easypaisa_number: r.payment_easypaisa_number || "0300-1234567",
          payment_easypaisa_name: r.payment_easypaisa_name || "Saqlyn Payments",
          payment_jazzcash_number: r.payment_jazzcash_number || "0311-7654321",
          payment_jazzcash_name: r.payment_jazzcash_name || "Saqlyn Payments",
          payment_bank_iban: r.payment_bank_iban || "PK12 HABB 0000 0012 3456 7890",
          payment_bank_name: r.payment_bank_name || "Saqlyn Restaurant Ltd",
        });
        setLogoPreview(r.logo_url || "");
      }
      setLoaded(true);
    });
  }, [restaurantId]);
  const [logoFile, setLogoFile]   = useState(null);
  const [logoPreview, setLogoPreview] = useState(restaurant?.logo_url || "");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState("");

  function handleLogoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function applyPreset(preset) {
    setForm((f) => ({ ...f, theme: { primary: preset.primary, accent: preset.accent } }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      let logo_url = form.logo_url;
      if (logoFile) {
        // Stored as a data URL — no Firebase Storage needed.
        logo_url = await downscaleImage(logoFile, 400, 0.8);
      }
      await updateRestaurant(restaurantId, { ...form, logo_url });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to save settings.");
    }
    setSaving(false);
  }

  if (!loaded) {
    return (
      <AdminLayout
        title="⚙️ Settings"
        subtitle="Restaurant Configuration"
        onLogout={logout}
        userProfile={userProfile}
      >
        <p style={{ color: "var(--color-muted)", padding: 24 }}>Loading settings…</p>
      </AdminLayout>
    );
  }

  // Live theme preview on the page
  const previewStyle = {
    "--preview-primary": form.theme.primary,
    "--preview-accent":  form.theme.accent,
  };

  return (
    <AdminLayout
      title="⚙️ Settings"
      subtitle="Restaurant Configuration"
      onLogout={logout}
      userProfile={userProfile}
    >
      <form onSubmit={handleSave} className="settings-page">

        {saved  && <div className="success-banner">✅ Settings saved successfully.</div>}
        {error  && <div className="error-banner">{error}</div>}

        {/* ── Branding ──────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">🏪 Branding</h2>

          <div className="settings-grid">
            <div className="form-group">
              <label>Restaurant Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My Restaurant"
                required
              />
            </div>

            <div className="form-group">
              <label>Number of Tables</label>
              <p className="form-hint" style={{ margin: "0 0 6px" }}>
                📋 {getPlanLabel(plan)} plan — up to {planLimit === null ? "unlimited" : `${planLimit} tables`}.
                You can lower this anytime, but not raise it above your plan limit.
              </p>
              <input
                type="number" min="1" max={maxTables}
                value={form.table_count}
                onChange={(e) => setForm({ ...form, table_count: Math.min(Math.max(parseInt(e.target.value) || 1, 1), maxTables) })}
              />
              <span className="form-hint">Used for QR code generation and table selectors.</span>
            </div>
          </div>

          {/* Logo Upload */}
          <div className="form-group">
            <label>Restaurant Logo</label>
            <div className="logo-upload-row">
              <div className="logo-preview-box">
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" className="logo-preview-img" />
                  : <span className="logo-placeholder">🏪</span>
                }
              </div>
              <div>
                <input
                  type="file" accept="image/*" onChange={handleLogoChange}
                  style={{ display: "none" }} id="logo-upload"
                />
                <label htmlFor="logo-upload" className="btn-secondary" style={{ cursor: "pointer", display: "inline-block", padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>
                  Upload Logo
                </label>
                <p className="form-hint">PNG, JPG, WebP — recommended 200×200px, max 2MB</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Billing ─────────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">🧾 Billing & Tax</h2>
          <div className="settings-grid">
            <div className="form-group">
              <label>Tax Rate (%)</label>
              <input
                type="number" min="0" max="100" step="0.5"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
              />
              <p className="form-hint">Added to every bill — e.g. GST / VAT.</p>
            </div>
            <div className="form-group">
              <label>Discount (%)</label>
              <input
                type="number" min="0" max="100" step="0.5"
                value={form.discount_rate}
                onChange={(e) => setForm({ ...form, discount_rate: parseFloat(e.target.value) || 0 })}
              />
              <p className="form-hint">Default discount applied to every bill.</p>
            </div>
          </div>
        </section>

        {/* ── Payment Methods ───────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">💳 Payment Methods</h2>
          <p className="form-hint">These are the accounts customers see on the Pay Bill screen. Change them to your own numbers — every restaurant has its own.</p>
          <div className="settings-grid">
            <div className="form-group">
              <label>EasyPaisa Number</label>
              <input
                type="text"
                value={form.payment_easypaisa_number}
                onChange={(e) => setForm({ ...form, payment_easypaisa_number: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>EasyPaisa Account Name</label>
              <input
                type="text"
                value={form.payment_easypaisa_name}
                onChange={(e) => setForm({ ...form, payment_easypaisa_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>JazzCash Number</label>
              <input
                type="text"
                value={form.payment_jazzcash_number}
                onChange={(e) => setForm({ ...form, payment_jazzcash_number: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>JazzCash Account Name</label>
              <input
                type="text"
                value={form.payment_jazzcash_name}
                onChange={(e) => setForm({ ...form, payment_jazzcash_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Bank IBAN</label>
              <input
                type="text"
                value={form.payment_bank_iban}
                onChange={(e) => setForm({ ...form, payment_bank_iban: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Bank Account Title</label>
              <input
                type="text"
                value={form.payment_bank_name}
                onChange={(e) => setForm({ ...form, payment_bank_name: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* ── Theme ─────────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">🎨 Theme Colors</h2>

          {/* Preset swatches */}
          <div className="theme-presets">
            {PRESET_THEMES.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="theme-preset-btn"
                title={preset.name}
                onClick={() => applyPreset(preset)}
                style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }}
              >
                {form.theme.primary === preset.primary && (
                  <span className="theme-check">✓</span>
                )}
              </button>
            ))}
          </div>

          <div className="settings-grid">
            <div className="form-group">
              <label>Primary Color</label>
              <div className="color-input-row">
                <input
                  type="color"
                  value={form.theme.primary}
                  onChange={(e) => setForm({ ...form, theme: { ...form.theme, primary: e.target.value } })}
                  className="color-swatch-input"
                />
                <input
                  type="text"
                  value={form.theme.primary}
                  onChange={(e) => setForm({ ...form, theme: { ...form.theme, primary: e.target.value } })}
                  placeholder="#e85d04"
                  style={{ fontFamily: "monospace" }}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Accent Color</label>
              <div className="color-input-row">
                <input
                  type="color"
                  value={form.theme.accent}
                  onChange={(e) => setForm({ ...form, theme: { ...form.theme, accent: e.target.value } })}
                  className="color-swatch-input"
                />
                <input
                  type="text"
                  value={form.theme.accent}
                  onChange={(e) => setForm({ ...form, theme: { ...form.theme, accent: e.target.value } })}
                  placeholder="#f48c06"
                  style={{ fontFamily: "monospace" }}
                />
              </div>
            </div>
          </div>

          {/* Live preview card */}
          <div className="theme-preview-card" style={previewStyle}>
            <div className="theme-preview-header"
              style={{ background: form.theme.primary }}>
              <span style={{ fontWeight: 700, color: "white", fontSize: 15 }}>
                {form.name || "Restaurant Name"}
              </span>
              <span style={{
                background: "rgba(255,255,255,0.2)", color: "white",
                padding: "3px 10px", borderRadius: 20, fontSize: 12
              }}>
                Table 4
              </span>
            </div>
            <div className="theme-preview-body">
              <div className="theme-preview-item">
                <span>Margherita Pizza</span>
                <button style={{
                  background: form.theme.primary, color: "white",
                  padding: "5px 14px", borderRadius: 6, fontSize: 12, border: "none"
                }}>Add</button>
              </div>
              <div className="theme-preview-item">
                <span>Tiramisu</span>
                <button style={{
                  background: form.theme.primary, color: "white",
                  padding: "5px 14px", borderRadius: 6, fontSize: 12, border: "none"
                }}>Add</button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Save ──────────────────────────────────────────────── */}
        <div className="settings-footer">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>

      </form>

      <style>{`
        .settings-page { max-width: 680px; }
        .settings-section {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius); padding: 28px; margin-bottom: 24px;
        }
        .settings-section-title {
          font-family: var(--font); font-size: 16px; font-weight: 600;
          margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border);
        }
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 600px) { .settings-grid { grid-template-columns: 1fr; } }
        .form-hint { font-size: 12px; color: var(--color-muted); margin-top: 5px; display: block; }
        .logo-upload-row { display: flex; align-items: center; gap: 20px; }
        .logo-preview-box {
          width: 72px; height: 72px; border-radius: 14px;
          background: var(--color-surface2); border: 1px solid var(--color-border);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
        }
        .logo-preview-img { width: 100%; height: 100%; object-fit: cover; }
        .logo-placeholder { font-size: 32px; }
        .theme-presets { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .theme-preset-btn {
          width: 44px; height: 44px; border-radius: 10px;
          border: 2px solid transparent; position: relative;
          transition: transform 0.15s, border-color 0.15s;
        }
        .theme-preset-btn:hover { transform: scale(1.1); }
        .theme-check {
          position: absolute; inset: 0; display: flex;
          align-items: center; justify-content: center;
          color: white; font-size: 16px; font-weight: 700;
        }
        .color-input-row { display: flex; gap: 10px; align-items: center; }
        .color-swatch-input {
          width: 44px; height: 40px; padding: 2px; border-radius: 8px;
          cursor: pointer; flex-shrink: 0; border: 1px solid var(--color-border);
        }
        .theme-preview-card {
          border-radius: 12px; overflow: hidden;
          border: 1px solid var(--color-border); margin-top: 16px;
        }
        .theme-preview-header {
          padding: 14px 16px; display: flex;
          justify-content: space-between; align-items: center;
        }
        .theme-preview-body { background: var(--color-surface2); padding: 14px; }
        .theme-preview-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 0; border-bottom: 1px solid var(--color-border); font-size: 14px;
        }
        .theme-preview-item:last-child { border-bottom: none; }
        .settings-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
      `}</style>
    </AdminLayout>
  );
}
