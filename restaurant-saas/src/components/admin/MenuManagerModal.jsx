import { useState, useEffect } from "react";
import {
  subscribeToMenu, createMenuItem, updateMenuItem,
  deleteMenuItem, restoreMenuItem, isItemPromoActive, getItemPrice,
} from "../../config/db";
import { formatPrice } from "../../utils/currency";
import { downscaleImage } from "../../utils/image";
import MenuItemModal from "./MenuItemModal";
import ConfirmModal from "./ConfirmModal";

// The super admin has no restaurant of their own, so they cannot open a
// restaurant's admin dashboard at all — its route is general_admin-only.
// This modal gives them the same dish add/edit/delete tools from the All
// Restaurants screen instead. Menu writes are already allowed for the
// super admin by the Firestore rules, so no rule change is needed.
// Deleting a dish only hides it (soft delete) — it stays in the backend
// and can be restored from the Hidden dishes section below.
export default function MenuManagerModal({ restaurant, onClose }) {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [error, setError] = useState("");

  const currency = restaurant.currency || "$";

  useEffect(() => {
    const unsub = subscribeToMenu(restaurant.id, (items) => {
      setMenuItems(items);
      setLoading(false);
    });
    return unsub;
  }, [restaurant.id]);

  const visibleItems = menuItems.filter((i) => !i.deleted);
  const hiddenItems = menuItems.filter((i) => i.deleted);
  const visibleCategories = [...new Set(visibleItems.map((i) => i.category))];

  function handleAddItem() {
    setEditingItem(null);
    setShowItemModal(true);
  }

  function handleEditItem(item) {
    setEditingItem(item);
    setShowItemModal(true);
  }

  async function handleSaveItem(formData, imageFile) {
    setError("");
    try {
      let image_url = formData.image_url;
      if (imageFile) {
        // Stored as a data URL in the menu item — no Firebase Storage needed.
        image_url = await downscaleImage(imageFile, 800, 0.8);
      }
      const data = { ...formData, image_url };
      if (editingItem) {
        await updateMenuItem(restaurant.id, editingItem.id, data);
        setMenuItems((prev) => prev.map((i) => (i.id === editingItem.id ? { ...i, ...data } : i)));
      } else {
        // No optimistic append: the menu subscription delivers the new
        // item, and appending here too renders it twice until the next
        // snapshot replaces the list.
        await createMenuItem(restaurant.id, data);
      }
      setShowItemModal(false);
      setEditingItem(null);
    } catch (e) {
      setError(e?.message || "Could not save this dish.");
    }
  }

  async function confirmDeleteItem() {
    const itemId = pendingDeleteItem;
    setPendingDeleteItem(null);
    if (!itemId) return;
    await deleteMenuItem(restaurant.id, itemId);
  }

  async function handleRestoreItem(itemId) {
    await restoreMenuItem(restaurant.id, itemId);
  }

  function priceLine(item) {
    if (isItemPromoActive(item)) {
      return (
        <span className="item-price">
          <s className="price-was">{formatPrice(item.price, currency)}</s>{" "}
          <span className="price-promo">{formatPrice(getItemPrice(item), currency)}</span>
          <span className="promo-badge">🎉 Promo</span>
        </span>
      );
    }
    return <span className="item-price">{formatPrice(item.price, currency)}</span>;
  }

  // The dish form and the delete confirm render OUTSIDE the manager's own
  // overlay: a click on their backdrop must not bubble up and close the
  // manager underneath them too.
  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>🍽️ Menu — {restaurant.name}</h3>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          {/* Scrollable body: without .modal-body the dish list spills past
              the viewport with no way to reach the lower rows (the modal
              itself has max-height but no overflow). */}
          <div className="modal-body">
        <p className="form-hint" style={{ margin: "0 0 12px" }}>
          Add, edit or hide dishes for {restaurant.name}. Hidden dishes stay saved and can be restored below.
        </p>

        {error && (
          <div className="error-banner" style={{ marginBottom: 14 }}>{error}</div>
        )}

        <button className="btn-primary" onClick={handleAddItem} style={{ marginBottom: 16 }}>
          ➕ Add Dish
        </button>

        {loading ? (
          <p className="form-hint">Loading menu…</p>
        ) : (
          <>
            {visibleCategories.map((cat) => (
              <div key={cat} className="menu-category-section">
                <h4 className="category-label">{cat}</h4>
                <div className="menu-items-list">
                  {visibleItems.filter((i) => i.category === cat).map((item) => (
                    <div key={item.id} className={`menu-item-row ${!item.available ? "unavailable" : ""}`}>
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="item-thumb" />
                      )}
                      <div className="item-info">
                        <span className="item-name">{item.name}</span>
                        <span className="item-desc">{item.description}</span>
                        <div className="item-meta">
                          {priceLine(item)}
                          <span className="item-prep">⏱ {item.prep_time_minutes} min</span>
                          <span className={`item-status ${item.available ? "available" : "sold-out"}`}>
                            {item.available ? "Available" : "Sold Out"}
                          </span>
                        </div>
                      </div>
                      <div className="item-actions">
                        <button className="btn-icon" onClick={() => handleEditItem(item)} title="Edit dish">✏️</button>
                        <button className="btn-icon btn-danger" onClick={() => setPendingDeleteItem(item.id)} title="Hide dish">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {hiddenItems.length > 0 && (
              <div className="menu-category-section">
                <h4 className="category-label">🙈 Hidden dishes — only you can see these</h4>
                <div className="menu-items-list">
                  {hiddenItems.map((item) => (
                    <div key={item.id} className="menu-item-row unavailable">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="item-thumb" />
                      )}
                      <div className="item-info">
                        <span className="item-name">{item.name}</span>
                        <span className="item-desc">{item.description}</span>
                        <div className="item-meta">
                          {priceLine(item)}
                          <span className="item-prep">⏱ {item.prep_time_minutes} min</span>
                          <span className="item-status sold-out">Hidden</span>
                        </div>
                      </div>
                      <div className="item-actions">
                        <button className="btn-icon" onClick={() => handleEditItem(item)} title="Edit dish">✏️</button>
                        <button className="btn-icon" onClick={() => handleRestoreItem(item.id)} title="Restore dish">↩️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {menuItems.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🍽️</div>
                <h3>No menu items yet</h3>
                <p>Add the first dish for {restaurant.name}.</p>
              </div>
            )}
          </>
        )}
          </div>
        </div>
      </div>

      {showItemModal && (
        <MenuItemModal
          item={editingItem}
          categories={visibleCategories}
          onClose={() => { setShowItemModal(false); setEditingItem(null); }}
          onSave={handleSaveItem}
        />
      )}

      {pendingDeleteItem && (
        <ConfirmModal
          title="Hide this dish?"
          message="This dish will be hidden from the customer menu. It stays saved and can be restored from the Hidden dishes section."
          confirmLabel="Hide dish"
          onConfirm={confirmDeleteItem}
          onCancel={() => setPendingDeleteItem(null)}
        />
      )}
    </>
  );
}
