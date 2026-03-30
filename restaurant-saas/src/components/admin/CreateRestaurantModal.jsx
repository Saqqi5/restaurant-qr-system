import { useState } from "react";

export default function CreateRestaurantModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name: "", table_count: 10, logo_url: "", plan: "saas",
    theme: { primary: "#e85d04", accent: "#f48c06" }
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await onCreate(form);
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
              <input type="number" min="1" max="200" value={form.table_count}
                onChange={(e) => setForm({ ...form, table_count: parseInt(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Logo URL (optional)</label>
              <input type="url" value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://..." />
            </div>
            <div className="form-group">
              <label>Plan</label>
              <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                <option value="saas">SaaS (Shared Platform)</option>
                <option value="standalone">Standalone (White Label)</option>
              </select>
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
