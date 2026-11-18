import { useState } from "react";
import { PLANS, getPlanLimit, normalizePlan } from "../../config/plans";
import CurrencySelect from "./CurrencySelect";
import { downscaleImage } from "../../utils/image";
import { extractLogoColors } from "../../utils/logoColors";

export default function CreateRestaurantModal({ onClose, onCreate, initial }) {
  const [form, setForm] = useState({
    name: "", table_count: 10, logo_url: "", plan: "basic",
    currency: "$", address: "",
    theme: { primary: "#20C997", accent: "#17A884" },
    ...(initial || {}),
  });
  const createLimit = getPlanLimit(normalizePlan(form.plan), null);
  const [loading, setLoading] = useState(false);
  // Logo: upload a file (stored as a compressed data URL, no Storage
  // needed) or paste a URL. The preview shows what the customer will see.
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(form.logo_url || "");

  function handleLogoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
    // Auto-pick the theme colours from the logo — the admin can still
    // change them below. Only for file uploads (a pasted URL is
    // cross-origin and the canvas cannot read it).
    extractLogoColors(previewUrl).then((colors) => {
      if (colors) setForm((f) => ({ ...f, theme: colors }));
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    let logo_url = form.logo_url;
    if (logoFile) {
      logo_url = await downscaleImage(logoFile, 400, 0.8);
    }
    await onCreate({ ...form, logo_url });
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Restaurant</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Restaurant Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Bella Italia" required />
            </div>
            <div className="form-group">
              <label>Number of Tables</label>
              <input type="number" min="1" max={createLimit === null ? 200 : createLimit} value={form.table_count}
                onChange={(e) => setForm({ ...form, table_count: Math.min(Math.max(parseInt(e.target.value) || 1, 1), createLimit === null ? 200 : createLimit) })} />
              {createLimit !== null && (
                <p className="form-hint">The {form.plan} plan allows up to {createLimit} tables.</p>
              )}
              <p className="form-hint">Every plan starts with a 7-day free trial. After expiry the login is blocked until the administrator continues the plan.</p>
              <p className="form-hint">4 staff logins (Admin, Kitchen, Cashier, Waiter) are created automatically with the default passwords.</p>
            </div>
            <div className="form-group">
              <label>Logo (optional — shows with the name on the menu, cart, bill and receipt)</label>
              {logoPreview && (
                <img src={logoPreview} alt="Logo preview" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", display: "block", marginBottom: 8 }} />
              )}
              <input type="file" accept="image/*" onChange={handleLogoChange} />
              <p className="form-hint">Theme colours are picked automatically from your logo — change them below if you like.</p>
              <input type="url" value={form.logo_url} style={{ marginTop: 8 }}
                onChange={(e) => { setForm({ ...form, logo_url: e.target.value }); setLogoPreview(e.target.value); }}
                placeholder="…or paste a logo URL https://..." />
            </div>
            <div className="form-group">
              <label>Plan</label>
              <select value={form.plan} onChange={(e) => {
                const plan = e.target.value;
                const limit = getPlanLimit(plan, null);
                setForm({ ...form, plan, table_count: limit === null ? form.table_count : Math.min(form.table_count, limit) });
              }}>
                {Object.values(PLANS).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}{p.defaultTableLimit === null ? " (no table limit)" : ` (up to ${p.defaultTableLimit} tables)`}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Currency</label>
              <CurrencySelect value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
              <p className="form-hint">Shown on every bill and in revenue. Default is US Dollar ($).</p>
            </div>
            <div className="form-group">
              <label>Address (optional — shows on the receipt)</label>
              <input value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. 12 Main Bazaar, Lahore" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Primary Color</label>
                <input type="color" value={form.theme.primary}
                  onChange={(e) => setForm({ ...form, theme: { ...form.theme, primary: e.target.value } })} />
              </div>
              <div className="form-group">
                <label>Accent Color</label>
                <input type="color" value={form.theme.accent}
                  onChange={(e) => setForm({ ...form, theme: { ...form.theme, accent: e.target.value } })} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Creating..." : "Create Restaurant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
