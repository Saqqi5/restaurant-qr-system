import { useState, useEffect, useRef } from "react";
import { formatPrice } from "../../utils/currency";
import { getItemPrice, isItemPromoActive } from "../../config/db";

const CATEGORY_EMOJIS = {
  pizza: "🍕", pasta: "🍝", salad: "🥗", soup: "🍲",
  burger: "🍔", chicken: "🍗", beef: "🥩", fish: "🐟",
  seafood: "🦐", sushi: "🍱", rice: "🍚", noodles: "🍜",
  sandwich: "🥪", wrap: "🌯", taco: "🌮", curry: "🍛",
  dessert: "🍰", cake: "🎂", ice: "🍨", chocolate: "🍫",
  coffee: "☕", tea: "🍵", juice: "🥤", drinks: "🥤",
  appetizer: "🥨", starter: "🥗", side: "🥔", bread: "🥖",
  vegetarian: "🥦", vegan: "🌱", grill: "🔥", bbq: "🍖",
};

function getCategoryEmoji(category = "") {
  const lower = category.toLowerCase();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return "🍽️";
}

function MenuCard({ item, cart, onAdd, onRemove, currency }) {
  const qty = cart.find((c) => c.id === item.id)?.quantity || 0;
  return (
    <div className={`menu-card ${!item.available ? "unavailable" : ""}`}>
      {item.image_url ? (
        <div className="menu-card-image">
          <img src={item.image_url} alt={item.name} loading="lazy" />
          {!item.available && <div className="sold-out-overlay">Sold Out</div>}
        </div>
      ) : (
        <div className="menu-card-emoji">
          {getCategoryEmoji(item.category)}
        </div>
      )}
      <div className="menu-card-body">
        <div className="menu-card-info">
          <h3 className="menu-item-name">{item.name}</h3>
          {item.description && <p className="menu-item-desc">{item.description}</p>}
          <div className="menu-item-meta">
            {isItemPromoActive(item) ? (
              <span className="menu-item-price">
                <s className="price-was">{formatPrice(item.price, currency)}</s>{" "}
                <span className="price-promo">{formatPrice(getItemPrice(item), currency)}</span>
                <span className="promo-badge">🎉 Promo</span>
              </span>
            ) : (
              <span className="menu-item-price">{formatPrice(item.price, currency)}</span>
            )}
            <span className="menu-item-prep">⏱ {item.prep_time_minutes} min</span>
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
}

// The whole menu on one scrollable page, grouped by category — a customer
// sees every category by scrolling, never by tapping each tab. The sticky
// chip bar follows the scroll (scroll-spy): the chip for the section
// currently on screen is highlighted, and tapping a chip jumps to it.
export default function MenuGrid({ items, categories, cart, onAdd, onRemove, currency, searchActive }) {
  const [activeCategory, setActiveCategory] = useState(categories[0] || "");
  const sectionRefs = useRef({});
  const chipRefs = useRef({});
  // While a tap-driven smooth scroll is running, the scroll-spy stays out
  // of the way so the tapped chip keeps the highlight until it lands.
  const scrollingToRef = useRef(null);

  // Categories arrive with the menu (async) — when they load, or when the
  // restaurant changes, default to the first one (menu order).
  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  // Scroll-spy: the chip follows the section on screen. A section owns
  // the highlight while its heading sits in the band just below the
  // sticky chip bar (120px to 35% of the viewport); between sections the
  // last heading that already passed the bar keeps it. The last section
  // can never reach the band — the page ends first — so at the very
  // bottom of the page it owns the highlight outright.
  useEffect(() => {
    if (searchActive) return;
    function onScroll() {
      if (scrollingToRef.current) return;
      const bandTop = 186; // just below the frozen header (76) + nav (48) + tabs (~54)
      const bandBottom = window.innerHeight * 0.35;
      let current = null;
      for (const cat of categories) {
        const el = sectionRefs.current[cat];
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top >= bandTop && top <= bandBottom) current = cat;
      }
      if (current) { setActiveCategory(current); return; }
      let passed = categories[0];
      for (const cat of categories) {
        const el = sectionRefs.current[cat];
        if (el && el.getBoundingClientRect().top <= bandTop) passed = cat;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setActiveCategory(atBottom ? categories[categories.length - 1] : passed);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [categories, searchActive]);

  // Keep the highlighted chip visible inside the horizontal chip bar.
  useEffect(() => {
    chipRefs.current[activeCategory]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategory]);

  function scrollToCategory(cat) {
    setActiveCategory(cat);
    scrollingToRef.current = cat;
    sectionRefs.current[cat]?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Safety: if the smooth scroll never lands (short page), release the lock.
    setTimeout(() => { if (scrollingToRef.current === cat) scrollingToRef.current = null; }, 1200);
  }

  // While searching, ignore categories — search the whole menu, flat.
  if (searchActive) {
    return (
      <div className="menu-grid-wrapper">
        <div className="menu-items-grid">
          {items.length === 0 ? (
            <div className="menu-empty">No dishes found. Try a different search or category.</div>
          ) : items.map((item) => (
            <MenuCard key={item.id} item={item} cart={cart} onAdd={onAdd} onRemove={onRemove} currency={currency} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="menu-grid-wrapper">
      {/* Category tabs — sticky, highlight follows the scroll */}
      <div className="category-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            ref={(el) => { chipRefs.current[cat] = el; }}
            className={`category-tab ${activeCategory === cat ? "active" : ""}`}
            onClick={() => scrollToCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* One section per category, in menu order */}
      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat);
        if (catItems.length === 0) return null;
        return (
          <section
            key={cat}
            ref={(el) => { sectionRefs.current[cat] = el; }}
            className="menu-category-section"
          >
            <h2 className="menu-category-title">{cat}</h2>
            <div className="menu-items-grid">
              {catItems.map((item) => (
                <MenuCard key={item.id} item={item} cart={cart} onAdd={onAdd} onRemove={onRemove} currency={currency} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
