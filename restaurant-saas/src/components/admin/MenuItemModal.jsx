import { useState, useRef } from "react";

const DEFAULT_CATEGORIES = ["Starters", "Main Course", "Beverages", "Desserts", "Sides"];

export default function MenuItemModal({ item, categories, onClose, onSave }) {
  const [form, setForm] = useState({
    name: item?.name || "",
    description: item?.description || "",
    price: item?.price || "",
    category: item?.category || categories[0] || "Main Course",
    prep_time_minutes: item?.prep_time_minutes || 15,
    available: item?.available !== false,
    image_url: item?.image_url || "",
    sort_order: item?.sort_order || 999,
    promo_price: item?.promo_price || "",
    promo_start: item?.promo_start || "",
    promo_end: item?.promo_end || "",
    spice_level: item?.spice_level || "",
    allergens: item?.allergens || "",
    station: item?.station || "",
    half_price: item?.half_price || "",
  });
  // Size options — each row is one size (label + price). Empty = one size
  // at the base price. The customer picks a size when adding the dish.
  const [sizes, setSizes] = useState(
    Array.isArray(item?.sizes) && item.sizes.length > 0
      ? item.sizes.map((s) => ({ label: s.label || "", price: s.price || "" }))
      : []
  );
  const [customCategory, setCustomCategory] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(item?.image_url || "");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...categories])];

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const category = customCategory || form.category;
    const cleanSizes = sizes
      .map((s) => ({ label: (s.label || "").trim(), price: parseFloat(s.price) || 0 }))
      .filter((s) => s.label && s.price > 0);
    await onSave({ ...form, category, sizes: cleanSizes }, imageFile);
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item ? "Edit Menu Item" : "Add Menu Item"}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body modal-two-col">
            {/* Left column */}
            <div className="modal-col">
              <div className="form-group">
                <label>Item Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Margherita Pizza"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of the item..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Half Price <span style={{ fontWeight: 400, color: "var(--color-muted)" }}>(optional)</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.half_price}
                    onChange={(e) => setForm({ ...form, half_price: e.target.value })}
                    placeholder="e.g. 450"
                  />
                </div>
                <div className="form-group">
                  <label>Prep Time (min)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={form.prep_time_minutes}
                    onChange={(e) => setForm({ ...form, prep_time_minutes: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <p className="form-hint">Half price is the Full price's partner — fill it and the dish offers Half / Full (Half at this price, Full at the price above). Leave it empty for one size only. Size options below (if any) win over the half price.</p>

              {/* Promotional offer — admin / super admin only (this form
                  lives on the admin dashboard; menu writes are rules-locked
                  to the restaurant admin and the super admin). */}
              <div className="form-group promo-group">
                <label>🎉 Promotional Offer <span style={{ fontWeight: 400, color: "var(--color-muted)" }}>(optional)</span></label>
                <div className="form-row">
                  <div className="form-group">
                    <label>Promo Price</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.promo_price}
                      onChange={(e) => setForm({ ...form, promo_price: e.target.value })}
                      placeholder="e.g. 1.99"
                    />
                  </div>
                  <div className="form-group">
                    <label>Starts On</label>
                    <input
                      type="date"
                      value={form.promo_start}
                      onChange={(e) => setForm({ ...form, promo_start: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Ends On</label>
                    <input
                      type="date"
                      value={form.promo_end}
                      onChange={(e) => setForm({ ...form, promo_end: e.target.value })}
                    />
                  </div>
                </div>
                <p className="form-hint">Customers see the original price struck through with the promo price — and the order is charged at the promo price. Leave the promo price empty for no offer; leave the dates empty for no time limit.</p>
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {allCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__custom__">+ New Category</option>
                </select>
                {form.category === "__custom__" && (
                  <input
                    className="mt-2"
                    placeholder="Category name"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                  />
                )}
              </div>

              <div className="form-group-inline">
                <label>
                  <input
                    type="checkbox"
                    checked={form.available}
                    onChange={(e) => setForm({ ...form, available: e.target.checked })}
                  />
                  Available for ordering
                </label>
              </div>

              {/* Dish detail — spice, allergens, kitchen station, sizes */}
              <div className="form-group">
                <label>🌶️ Spice Level</label>
                <select
                  value={form.spice_level}
                  onChange={(e) => setForm({ ...form, spice_level: e.target.value })}
                >
                  <option value="">No spice level</option>
                  <option value="Mild">Mild 🌶️</option>
                  <option value="Medium">Medium 🌶️🌶️</option>
                  <option value="Hot">Hot 🌶️🌶️🌶️</option>
                </select>
              </div>

              <div className="form-group">
                <label>⚠️ Allergens</label>
                <input
                  value={form.allergens}
                  onChange={(e) => setForm({ ...form, allergens: e.target.value })}
                  placeholder="e.g. Contains nuts, dairy, gluten"
                />
                <p className="form-hint">Shown on the menu under the dish — leave empty if none.</p>
              </div>

              <div className="form-group">
                <label>🍳 Kitchen Station</label>
                <input
                  value={form.station}
                  onChange={(e) => setForm({ ...form, station: e.target.value })}
                  placeholder="e.g. Tandoor, Curry, Drinks (defaults to category)"
                />
                <p className="form-hint">The kitchen display groups orders by station — the cook picks their station and sees only their items.</p>
              </div>

              <div className="form-group">
                <label>📏 Size Options <span style={{ fontWeight: 400, color: "var(--color-muted)" }}>(optional)</span></label>
                {sizes.map((s, i) => (
                  <div key={i} className="form-row" style={{ marginBottom: 6 }}>
                    <input
                      value={s.label}
                      onChange={(e) => setSizes(sizes.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                      placeholder="e.g. Half / Full"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number" step="0.01" min="0"
                      value={s.price}
                      onChange={(e) => setSizes(sizes.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                      placeholder="Price"
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setSizes(sizes.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                {sizes.length < 4 && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setSizes([...sizes, { label: "", price: "" }])}>+ Add size</button>
                )}
                <p className="form-hint">Empty = one size at the base price. The customer picks a size when adding the dish, and the kitchen ticket shows it.</p>
              </div>
            </div>

            {/* Right column - Image */}
            <div className="modal-col">
              <div className="form-group">
                <label>Item Image</label>
                <div
                  className="image-upload-area"
                  onClick={() => fileRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="image-preview" />
                  ) : (
                    <div className="upload-placeholder">
                      <span>📷</span>
                      <p>Click to upload image</p>
                      <p className="upload-hint">JPG, PNG, WebP — max 5MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                />
                {imagePreview && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm mt-2"
                    onClick={() => { setImageFile(null); setImagePreview(""); setForm({ ...form, image_url: "" }); }}
                  >
                    Remove Image
                  </button>
                )}
              </div>

              <div className="form-group">
                <label>Or Image URL</label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => { setForm({ ...form, image_url: e.target.value }); setImagePreview(e.target.value); }}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving..." : item ? "Update Item" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
