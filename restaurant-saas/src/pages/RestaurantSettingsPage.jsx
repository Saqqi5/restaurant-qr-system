import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { updateRestaurant, getRestaurant, subscribeToPlatformSettings, createPlanPayment, subscribeToRestaurantPlanPayments } from "../config/db";
import { getPlanLimit, getPlanLabel, normalizePlan, getPlanPrice, getStaffLimit, getMenuItemLimit, getBackupLabel, PLANS, DOMAIN_CHARGE_PKR_PER_YEAR, canUseDelivery } from "../config/plans";
import { buildDeliveryUrl } from "../config/tenantResolver";
import { downscaleImage } from "../utils/image";
import AdminLayout from "../components/admin/AdminLayout";
import BranchRequired from "../components/admin/BranchRequired";
import PlanPrice from "../components/PlanPrice";

export default function RestaurantSettingsPage() {
  const { userProfile, restaurantId, logout } = useAuth();
  const { restaurant } = useTenant();

  const [platformLimits, setPlatformLimits] = useState(null);
  const [plan, setPlan] = useState("standard");
  const [form, setForm] = useState({
    tax_rate: 0, discount_rate: 0,
    payment_easypaisa_number: "",
    payment_easypaisa_name: "",
    payment_jazzcash_number: "",
    payment_jazzcash_name: "",
    payment_bank_iban: "",
    payment_bank_name: "",
    delivery_enabled: false,
    delivery_fee: 0,
    free_delivery_above: 0,
    delivery_areas: "",
  });
  // Home Delivery is a Premium feature: the plan must allow it (Premium,
  // or the administrator's override) before the owner can switch it on.
  // delivery_override is set only by the administrator — never saved here.
  const [deliveryOverride, setDeliveryOverride] = useState(false);
  const [deliveryCurrency, setDeliveryCurrency] = useState("Rs.");
  const deliveryAllowed = canUseDelivery(plan, { delivery_override: deliveryOverride });
  const deliveryLink = buildDeliveryUrl(restaurantId, "saas", domainInfo.custom_domain);
  const [loaded, setLoaded] = useState(false);
  const [domainInfo, setDomainInfo] = useState({ custom_domain: null, domain_request: null });
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
    if (!restaurantId || restaurantId === "all") return;
    getRestaurant(restaurantId).then((r) => {
      if (r) {
        setPlan(normalizePlan(r.plan));
        setDomainInfo({ custom_domain: r.custom_domain || null, domain_request: r.domain_request || null });
        setDeliveryOverride(r.delivery_override === true);
        setDeliveryCurrency(r.currency || "Rs.");
        setForm({
          name: r.name || "",
          table_count: r.table_count || 10,
          tax_rate: Number(r.tax_rate) || 0,
          discount_rate: Number(r.discount_rate) || 0,
          delivery_enabled: r.delivery_enabled === true,
          delivery_fee: Number(r.delivery_fee) || 0,
          free_delivery_above: Number(r.free_delivery_above) || 0,
          delivery_areas: r.delivery_areas || "",
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

  // Settings are one branch at a time — "All branches" picks a branch.
  if (restaurantId === "all") {
    return (
      <AdminLayout
        title="⚙️ Settings"
        subtitle="Restaurant Configuration"
        onLogout={logout}
        userProfile={userProfile}
      >
        <BranchRequired title="Settings are per branch" />
      </AdminLayout>
    );
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
            <label>Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. 12 Main Bazaar, Lahore"
            />
            <p className="form-hint">Printed at the bottom of every receipt, below the total.</p>
          </div>

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

        {/* ── Home Delivery ───────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">🛵 Home Delivery</h2>
          {!deliveryAllowed ? (
            <div className="locked-notice">
              <div className="locked-icon">🔒</div>
              <div className="locked-title">Home Delivery is a Premium feature</div>
              <div className="locked-desc">
                Upgrade to Premium or contact your administrator — Telegram @SAQLYNDIGITAL
              </div>
            </div>
          ) : (
            <>
              <p className="form-hint">Customers order from home through your menu link (no table needed) — the kitchen sees delivery orders with the customer's name, phone and address, and the rider takes them out.</p>
              <div className="form-group-inline" style={{ marginBottom: 14 }}>
                <label>
                  <input type="checkbox" checked={!!form.delivery_enabled}
                    onChange={(e) => setForm({ ...form, delivery_enabled: e.target.checked })} />
                  Enable Home Delivery
                </label>
              </div>
              {form.delivery_enabled && (
                <>
                  <div className="settings-grid">
                    <div className="form-group">
                      <label>Delivery Fee ({deliveryCurrency})</label>
                      <input
                        type="number" min="0" step="1"
                        value={form.delivery_fee}
                        onChange={(e) => setForm({ ...form, delivery_fee: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="form-hint">Flat fee per delivery order — added after tax, never taxed.</p>
                    </div>
                    <div className="form-group">
                      <label>Free Delivery Above ({deliveryCurrency})</label>
                      <input
                        type="number" min="0" step="1"
                        value={form.free_delivery_above}
                        onChange={(e) => setForm({ ...form, free_delivery_above: parseFloat(e.target.value) || 0 })}
                      />
                      <p className="form-hint">0 = never free. Orders at or above this total get free delivery.</p>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Delivery Areas</label>
                    <input
                      type="text"
                      value={form.delivery_areas}
                      onChange={(e) => setForm({ ...form, delivery_areas: e.target.value })}
                      placeholder="e.g. Model Town, Gulberg, DHA"
                    />
                    <p className="form-hint">Shown to customers on the order screen. Leave empty to deliver everywhere.</p>
                  </div>
                  <p className="form-hint">Your home-ordering link: <strong>{deliveryLink}</strong> — share it on WhatsApp, Facebook or your delivery QR (QR Generator → Home Delivery QR).</p>
                </>
              )}
            </>
          )}
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


        {/* ── Save ──────────────────────────────────────────────── */}
        <div className="settings-footer">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>

      </form>

      {/* ── Custom Domain (Premium — the administrator buys & links it) ── */}
      <DomainRequestSection
        restaurantId={restaurantId}
        plan={plan}
        domainInfo={domainInfo}
        onRequested={(domain) => setDomainInfo((prev) => ({ ...prev, domain_request: domain }))}
      />

      {/* ── Upgrade Plan (buy a plan, pay SAQLYN, administrator verifies) ── */}
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
// Ask the administrator for a custom domain (e.g. myrestaurant.com).
// The administrator buys it and links it in one click; the request shows
// on the restaurant's card and in the domain dialog until it is served.
function DomainRequestSection({ restaurantId, plan, domainInfo, onRequested }) {
  const [wanted, setWanted] = useState(domainInfo.domain_request || "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (domainInfo.custom_domain) {
    return (
      <section className="settings-section">
        <h2 className="settings-section-title">🌐 Custom Domain</h2>
        <p className="form-hint">
          Your menu is live at{" "}
          <a href={`https://${domainInfo.custom_domain}?table=1`} target="_blank" rel="noreferrer">
            https://{domainInfo.custom_domain}
          </a>
          {" "}— your QR codes already use it.
        </p>
      </section>
    );
  }

  async function handleRequest(e) {
    e.preventDefault();
    const domain = wanted.trim().toLowerCase().replace(/\.$/, "");
    if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/.test(domain)) {
      setError("Enter a valid domain, e.g. myrestaurant.com.");
      return;
    }
    setError("");
    setSending(true);
    try {
      await updateRestaurant(restaurantId, { domain_request: domain, domain_request_at: new Date() });
      setSent(true);
      onRequested(domain);
    } catch (err) {
      setError(err.message || "Could not send the request.");
    }
    setSending(false);
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">🌐 Custom Domain</h2>
      {normalizePlan(plan) !== "premium" && (
        <p className="form-hint">Custom domain is a Premium feature — request it here and the administrator will buy and link it for you.</p>
      )}
      <p className="form-hint">A custom domain costs PKR {DOMAIN_CHARGE_PKR_PER_YEAR.toLocaleString("en-US")} a year, charged separately from the plan.</p>
      {sent || domainInfo.domain_request ? (
        <p className="form-hint">
          ✅ Request sent for <strong>{domainInfo.domain_request}</strong> — the administrator will buy and link it for you.
        </p>
      ) : (
        <form onSubmit={handleRequest}>
          {error && <div className="error-banner">{error}</div>}
          <div className="form-group">
            <label>Domain you want</label>
            <input
              value={wanted}
              onChange={(e) => setWanted(e.target.value)}
              placeholder="myrestaurant.com"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={sending}>
            {sending ? "Sending…" : "📩 Request Custom Domain"}
          </button>
        </form>
      )}
    </section>
  );
}

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
    return `${tables === null ? "∞" : tables} tables · ${staff} staff logins · ${menu === null ? "∞" : menu} menu items · ${getBackupLabel(key, platformSettings)}`;
  };

  return (
    <div className="settings-page">
      <section className="settings-section">
        <h2 className="settings-section-title">⬆️ Upgrade Plan</h2>

        <p className="form-hint" style={{ marginBottom: 16 }}>
          You are on the <strong>{currentLabel}</strong> plan — {limitsLine(currentPlan)}.
          Pick a plan, pay the SAQLYN account below and upload the payment
          screenshot. The administrator verifies it and your plan activates for 30 days.
        </p>

        {success && !pendingPayment && (
          <div className="success-banner">✅ Payment proof sent! The administrator will verify it and your plan will be activated.</div>
        )}

        {pendingPayment && (
          <div style={{ marginBottom: 16 }}>
            <div className="success-banner" style={{ background: "rgba(32,201,151,0.12)", color: "var(--color-text)" }}>
              ⏳ Your <strong>{getPlanLabel(pendingPayment.plan)}</strong> plan payment
              (Rs. {pendingPayment.amount?.toLocaleString?.() || pendingPayment.amount}) is awaiting
              verification by the administrator. Once verified, your plan activates for 30 days.
            </div>
            {pendingPayment.proofImage && (
              <img src={pendingPayment.proofImage} alt="Payment proof" style={{ maxWidth: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8, marginTop: 10 }} />
            )}
          </div>
        )}

        {lastPayment && lastPayment.status === "rejected" && !pendingPayment && (
          <div className="error-banner">
            Your last {getPlanLabel(lastPayment.plan)} plan payment was not verified
            by the administrator. You can submit a new payment below.
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
                    <div className="plan-card-price"><PlanPrice pkr={getPlanPrice(p.key, platformSettings)} variant="settings" /></div>
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
