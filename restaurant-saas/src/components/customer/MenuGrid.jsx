import { useState } from "react";

export default function MenuGrid({ items, categories, cart, onAdd, onRemove }) {
  const [activeCategory, setActiveCategory] = useState(categories[0] || "");

  const getCartQty = (itemId) => cart.find((c) => c.id === itemId)?.quantity || 0;

  return (
    <div className="menu-grid-wrapper">
      {/* Category tabs */}
      <div className="category-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`category-tab ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="menu-items-grid">
        {items.filter((i) => i.category === activeCategory || !activeCategory).map((item) => {
          const qty = getCartQty(item.id);
          return (
            <div key={item.id} className={`menu-card ${!item.available ? "unavailable" : ""}`}>
              {item.image_url && (
                <div className="menu-card-image">
                  <img src={item.image_url} alt={item.name} loading="lazy" />
                  {!item.available && <div className="sold-out-overlay">Sold Out</div>}
                </div>
              )}
              <div className="menu-card-body">
                <div className="menu-card-info">
                  <h3 className="menu-item-name">{item.name}</h3>
                  {item.description && <p className="menu-item-desc">{item.description}</p>}
                  <div className="menu-item-meta">
                    <span className="menu-item-price">${item.price?.toFixed(2)}</span>
                    <span className="menu-item-prep">⏱ {item.prep_time_minutes}min</span>
                  </div>
                </div>
                <div className="menu-card-action">
                  {qty === 0 ? (
                    <button
                      className="btn-add"
                      onClick={() => onAdd(item)}
                      disabled={!item.available}
                    >
                      {item.available ? "Add" : "Unavailable"}
                    </button>
                  ) : (
                    <div className="qty-control">
                      <button onClick={() => onRemove(item.id)}>−</button>
                      <span>{qty}</span>
                      <button onClick={() => onAdd(item)}>+</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
