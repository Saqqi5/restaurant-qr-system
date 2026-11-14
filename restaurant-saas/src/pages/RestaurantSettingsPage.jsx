import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { updateRestaurant, getRestaurant, subscribeToPlatformSettings, createPlanPayment, subscribeToRestaurantPlanPayments } from "../config/db";
import { getPlanLimit, getPlanLabel, normalizePlan, getPlanPrice, getStaffLimit, getMenuItemLimit, PLANS } from "../config/plans";
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
    theme: { primary: "#20C997", accent: "#17A884" },
    tax_rate: 0, discount_rate: 0,
    payment_easypaisa_number: "",
    payment_easypaisa_name: "",
    payment_jazzcash_number: "",
    payment_jazzcash_name: "",
    payment_bank_iban: "",
    payment_bank_name: "",
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
          theme: r.theme || { primary: "#20C997", accent: "#17A884" },
          tax_rate: Number(r.tax_rate) || 0,
          discount_rate: Number(r.discount_rate) || 0,
          // No demo fallbacks: an empty account means "not configured" and
          // the customer sees "pay at the counter". Account names default
          // to the restaurant's own name, never "Saqlyn Payments".
          payment_easypaisa_number: r.payment_easypaisa_number || "",
          payment_easypaisa_name: r.payment_easypaisa_name || r.name || "",
          payment_jazzcash_number: r.payment_jazzcash_number || "",
          payment_jazzcash_name: r.payment_jazzcash_name || r.name || "",
          payment_bank_iban: r.payment_bank_iban || "",
          payment_bank_name: r.payment_bank_name || r.name || "",
        });
        setLogoPreview(r.logo_url || "");
      }
    })
      .catch(() => {})
      .finally(() => setLoaded(true));
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
                📋 {getPlanLabel(plan)} plan — {planLimit === null ? "no table limit" : `up to ${planLimit} tables`}.
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

      {/* ── Upgrade Plan (buy a plan, pay SAQLYN, super admin verifies) ── */}
      <PlanUpgradeSection
        restaurantId={restaurantId}
        restaurantName={form.name || "My Restaurant"}
        currentPlan={plan}
        platformSettings={platformLimits}
      />

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
        .plan-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
        @media (max-width: 600px) { .plan-cards { grid-template-columns: 1fr; } }
        .plan-card {
          border: 1.5px solid var(--color-border); border-radius: 12px;
          padding: 14px; cursor: pointer; background: var(--color-surface2);
        }
        .plan-card.selected { border-color: var(--color-primary); background: rgba(32, 201, 151, 0.08); }
        .plan-card-name { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
        .plan-card-price { font-size: 18px; font-weight: 700; color: var(--color-primary); margin-bottom: 6px; }
        .plan-card-limits { font-size: 12px; color: var(--color-muted); line-height: 1.6; }
      `}</style>
    </AdminLayout>
  );
}

// ── Upgrade Plan ──────────────────────────────────────────────────────────
// Owner picks a plan, pays the SAQLYN (platform) account via EasyPaisa /
// JazzCash / Bank and uploads the proof screenshot. The super admin verifies
// the payment — only then the plan activates (30-day period). Same proof flow
// as the food payments, but the money goes to the platform, not the
// restaurant's own customers. While a payment is pending, no second one can
// be sent.
function PlanUpgradeSection({ restaurantId, restaurantName, currentPlan, platformSettings }) {
  const [selectedPlan, setSelectedPlan] = useState(
    currentPlan === "basic" ? "standard" : currentPlan === "standard" ? "premium" : "standard"
  );
  const [selectedMethod, setSelectedMethod] = useState("easypaisa");
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [planPayments, setPlanPayments] = useState([]);

  useEffect(() => {
    if (!restaurantId) return;
    return subscribeToRestaurantPlanPayments(restaurantId, setPlanPayments);
  }, [restaurantId]);

  // The SAQLYN accounts owners pay into (set by the super admin in Platform
  // Settings). Only configured methods are shown.
  const PLATFORM_METHODS = {
    easypaisa: platformSettings?.platform_easypaisa_number ? {
      icon: "💚", name: "EasyPaisa", detail: "Send to mobile account:",
      number: platformSettings.platform_easypaisa_number,
      accountName: platformSettings.platform_easypaisa_name || "Saqlyn",
    } : null,
    jazzcash: platformSettings?.platform_jazzcash_number ? {
      icon: "💜", name: "JazzCash", detail: "Send to mobile account:",
      number: platformSettings.platform_jazzcash_number,
      accountName: platformSettings.platform_jazzcash_name || "Saqlyn",
    } : null,
    bank: platformSettings?.platform_bank_iban ? {
      icon: "🏦", name: "Bank Transfer", detail: "IBAN:",
      number: platformSettings.platform_bank_iban,
      accountName: platformSettings.platform_bank_name || "Saqlyn",
    } : null,
  };
  const configuredMethods = Object.keys(PLATFORM_METHODS).filter((k) => PLATFORM_METHODS[k]);
  const activeMethodKey = configuredMethods.includes(selectedMethod) ? selectedMethod : configuredMethods[0];
  const activeMethod = activeMethodKey ? PLATFORM_METHODS[activeMethodKey] : null;

  const pendingPayment = planPayments.find((p) => p.status === "pending");
  const lastPayment = planPayments[0];
  const currentLabel = getPlanLabel(currentPlan);
  const price = getPlanPrice(selectedPlan, platformSettings);

  function handleProofChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Please use an image under 5MB.");
      return;
    }
    setError("");
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (selectedPlan === currentPlan) {
      setError("You are already on this plan.");
      return;
    }
    if (!activeMethod) {
      setError("Payment accounts are not set up yet. Please contact the administrator.");
      return;
    }
    if (!proofFile) {
      setError("Please upload your payment screenshot to proceed.");
      return;
    }
    setSubmitting(true);
    try {
      // Compress the screenshot to a data URL stored in the payment record.
      const proofImage = await downscaleImage(proofFile, 800, 0.72);
      if (proofImage.length > 700000) {
        setError("Screenshot is too large. Please use a smaller image.");
        setSubmitting(false);
        return;
      }
      await createPlanPayment({
        restaurantId,
        restaurantName,
        plan: selectedPlan,
        amount: price,
        method: activeMethodKey,
        proofImage,
      });
      setSuccess(true);
      setProofFile(null);
      setProofPreview(null);
    } catch (err) {
      setError(err.message || "Failed to submit payment. Please try again.");
    }
    setSubmitting(false);
  }

  const limitsLine = (key) => {
    const tables = getPlanLimit(key, platformSettings);
    const staff = getStaffLimit(key, platformSettings);
    const menu = getMenuItemLimit(key, platformSettings);
    return `${tables === null ? "∞" : tables} tables · ${staff} staff logins · ${menu === null ? "∞" : menu} menu items`;
  };

  return (
    <div className="settings-page">
      <section className="settings-section">
        <h2 className="settings-section-title">⬆️ Upgrade Plan</h2>

        <p className="form-hint" style={{ marginBottom: 16 }}>
          You are on the <strong>{currentLabel}</strong> plan — {limitsLine(currentPlan)}.
          Pick a plan, pay the SAQLYN account below and upload the payment
          screenshot. The super admin verifies it and your plan activates for 30 days.
        </p>

        {success && !pendingPayment && (
          <div className="success-banner">✅ Payment proof sent! The super admin will verify it and your plan will be activated.</div>
        )}

        {pendingPayment && (
          <div style={{ marginBottom: 16 }}>
            <div className="success-banner" style={{ background: "rgba(32,201,151,0.12)", color: "var(--color-text)" }}>
              ⏳ Your <strong>{getPlanLabel(pendingPayment.plan)}</strong> plan payment
              (Rs. {pendingPayment.amount?.toLocaleString?.() || pendingPayment.amount}) is awaiting
              verification by the super admin. Once verified, your plan activates for 30 days.
            </div>
            {pendingPayment.proofImage && (
              <img src={pendingPayment.proofImage} alt="Payment proof" style={{ maxWidth: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8, marginTop: 10 }} />
            )}
          </div>
        )}

        {lastPayment && lastPayment.status === "rejected" && !pendingPayment && (
          <div className="error-banner">
            Your last {getPlanLabel(lastPayment.plan)} plan payment was not verified
            by the super admin. You can submit a new payment below.
          </div>
        )}

        {!pendingPayment && currentPlan !== "premium" && (
          <form onSubmit={handleSubmit}>
            {error && <div className="error-banner">{error}</div>}

            <div className="plan-cards">
              {Object.values(PLANS).map((p) => {
                const isCurrent = p.key === currentPlan;
                return (
                  <div
                    key={p.key}
                    className={`plan-card ${selectedPlan === p.key ? "selected" : ""}`}
                    onClick={() => !isCurrent && setSelectedPlan(p.key)}
                    style={isCurrent ? { opacity: 0.55, cursor: "default" } : undefined}
                  >
                    <div className="plan-card-name">
                      {p.label}{isCurrent ? " — current" : ""}
                    </div>
                    <div className="plan-card-price">Rs. {getPlanPrice(p.key, platformSettings).toLocaleString()}/mo</div>
                    <div className="plan-card-limits">{limitsLine(p.key)}</div>
                  </div>
                );
              })}
            </div>

            {activeMethod ? (
              <>
                <p className="form-hint" style={{ marginBottom: 12 }}>
                  Send <strong>Rs. {price.toLocaleString()}</strong> for the{" "}
                  <strong>{getPlanLabel(selectedPlan)}</strong> plan using any method below,
                  then upload the screenshot.
                </p>

                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {configuredMethods.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`method-btn ${activeMethodKey === key ? "active" : ""}`}
                      onClick={() => setSelectedMethod(key)}
                      style={{ flex: 1, padding: "10px 6px", fontSize: 12 }}
                    >
                      {PLATFORM_METHODS[key].icon} {PLATFORM_METHODS[key].name}
                    </button>
                  ))}
                </div>

                <div className="payment-methods">
                  <div className="payment-method-card">
                    <div className="payment-method-header">
                      <span className="payment-method-icon">{activeMethod.icon}</span>
                      <span className="payment-method-name">{activeMethod.name}</span>
                    </div>
                    <div className="payment-method-detail">{activeMethod.detail}</div>
                    <div className="payment-method-number">{activeMethod.number}</div>
                    <div className="payment-method-detail" style={{ marginTop: 8 }}>
                      Account Name: <strong>{activeMethod.accountName}</strong>
                    </div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(activeMethod.number)}&format=png&qzone=2`}
                      alt={`${activeMethod.name} payment QR code`}
                      className="payment-qr"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Upload Payment Screenshot</label>
                  <input type="file" accept="image/*" onChange={handleProofChange} />
                  {proofPreview && (
                    <img src={proofPreview} alt="Proof preview" style={{ maxWidth: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8, marginTop: 10 }} />
                  )}
                </div>

                <div className="settings-footer">
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? "Sending…" : "📤 Send Payment Proof"}
                  </button>
                </div>
              </>
            ) : (
              <p className="form-hint">
                Payment accounts are not set up yet. Please contact the administrator on{" "}
                <a href="https://t.me/Saqlyndigital" target="_blank" rel="noreferrer">Telegram @SAQLYNDIGITAL</a>{" "}
                to buy a plan.
              </p>
            )}
          </form>
        )}

        {currentPlan === "premium" && !pendingPayment && (
          <p className="form-hint">You are on the highest plan. 🎉</p>
        )}
      </section>
    </div>
  );
}
