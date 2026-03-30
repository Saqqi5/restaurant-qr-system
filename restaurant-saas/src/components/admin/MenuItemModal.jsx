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
  });
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
    await onSave({ ...form, category }, imageFile);
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
